#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / "queue/inbox"
RECEIPTS = ROOT / "queue/receipts"
RESULTS = ROOT / "queue/results"
PUBLIC_OUTPUT = ROOT / "public-output"
STATE = ROOT / "automation/health/PUBLIC_QWEN_WORKER_STATE.json"
MODEL = os.environ.get("PUBLIC_QWEN_MODEL", "qwen2.5-coder:0.5b")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")


class WorkerError(RuntimeError):
    pass


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_id(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-")
    if not cleaned:
        raise WorkerError("task_id is empty")
    return cleaned[:120]


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise WorkerError(f"missing file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise WorkerError(f"invalid JSON: {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise WorkerError(f"JSON root must be object: {path}")
    return value


def write_json_atomic(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", delete=False, dir=path.parent, suffix=".tmp"
    ) as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        temporary = Path(handle.name)
    temporary.replace(path)


def write_text_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", delete=False, dir=path.parent, suffix=".tmp"
    ) as handle:
        handle.write(content)
        temporary = Path(handle.name)
    temporary.replace(path)


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def validate_task(task: dict[str, Any]) -> str:
    task_id = safe_id(str(task.get("task_id", "")))
    if task.get("status") != "READY":
        raise WorkerError("task status must be READY")
    if task.get("public_context_only") is not True:
        raise WorkerError("public_context_only must be true")
    if int(task.get("budget_rub", -1)) != 0:
        raise WorkerError("budget_rub must be 0")
    if task.get("provider_policy") != "free_only":
        raise WorkerError("provider_policy must be free_only")
    if task.get("external_side_effects") != "deny":
        raise WorkerError("external_side_effects must be deny")
    if task.get("action") not in {"answer", "write_files"}:
        raise WorkerError("action must be answer or write_files")
    prompt = str(task.get("prompt", "")).strip()
    if not prompt:
        raise WorkerError("prompt is empty")
    forbidden = [
        "password",
        "cookie",
        "session token",
        "otp",
        "captcha",
        "private repository",
        "personal data",
        "bank card",
    ]
    lowered = prompt.casefold()
    if any(marker in lowered for marker in forbidden):
        raise WorkerError("prompt contains a forbidden public-worker marker")
    return task_id


def call_ollama(task: dict[str, Any]) -> str:
    action = task["action"]
    format_instruction = (
        "Return only one JSON object with summary and a non-empty files array. "
        "Each file must contain path and complete content. Paths are relative names "
        "inside the task's isolated public-output directory. Do not use Markdown fences."
        if action == "write_files"
        else "Return a concise, complete answer in Russian unless the task requests another language."
    )
    system = (
        "You are a public-safe zero-cost MAESTRO worker. Use only the supplied public "
        "task. Never claim websites, messages, payments, browser accounts or commands. "
        "Never request or expose secrets, private repository content or personal data. "
        + format_instruction
    )
    payload: dict[str, Any] = {
        "model": MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": str(task["prompt"])},
        ],
        "options": {"temperature": 0.1, "num_ctx": 4096, "num_predict": 900},
    }
    if action == "write_files":
        payload["format"] = "json"
    request = urllib.request.Request(
        f"{OLLAMA_URL}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=420) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1000]
        raise WorkerError(f"Ollama HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise WorkerError(f"Ollama transport: {exc.reason}") from exc
    content = str((result.get("message") or {}).get("content") or "").strip()
    if not content:
        raise WorkerError("Ollama returned empty content")
    return content


def apply_write_files(task_id: str, response: str) -> dict[str, Any]:
    try:
        parsed = json.loads(response)
    except json.JSONDecodeError as exc:
        raise WorkerError(f"write_files output is not JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise WorkerError("write_files output root must be object")
    files = parsed.get("files")
    if not isinstance(files, list) or not files:
        raise WorkerError("write_files output requires non-empty files")
    if len(files) > 10:
        raise WorkerError("too many files")

    target_root = (PUBLIC_OUTPUT / task_id).resolve()
    prepared: list[tuple[Path, str]] = []
    seen: set[Path] = set()
    for item in files:
        if not isinstance(item, dict):
            raise WorkerError("file item must be object")
        relative = str(item.get("path", "")).replace("\\", "/").strip("/")
        if not relative or relative.startswith(".") or ".." in Path(relative).parts:
            raise WorkerError(f"unsafe relative path: {relative!r}")
        content = item.get("content")
        if not isinstance(content, str):
            raise WorkerError(f"file content must be string: {relative}")
        if len(content.encode("utf-8")) > 500_000:
            raise WorkerError(f"file too large: {relative}")
        target = (target_root / relative).resolve()
        if target != target_root and target_root not in target.parents:
            raise WorkerError(f"path escapes task output: {relative}")
        if target in seen:
            raise WorkerError(f"duplicate path: {relative}")
        seen.add(target)
        prepared.append((target, content))

    written: list[dict[str, Any]] = []
    for target, content in prepared:
        write_text_atomic(target, content)
        written.append(
            {
                "path": str(target.relative_to(ROOT)).replace("\\", "/"),
                "bytes": len(content.encode("utf-8")),
                "sha256": sha256_text(content),
            }
        )
    return {"summary": str(parsed.get("summary", "")), "files": written}


def pending_cards() -> list[Path]:
    INBOX.mkdir(parents=True, exist_ok=True)
    RECEIPTS.mkdir(parents=True, exist_ok=True)
    RESULTS.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUTPUT.mkdir(parents=True, exist_ok=True)
    return [
        path
        for path in sorted(INBOX.glob("*.json"))
        if not (RESULTS / path.name).exists()
    ]


def rejected_result(task_id: str, message: str) -> dict[str, Any]:
    receipt = {
        "schema": 1,
        "task_id": task_id,
        "status": "REJECTED",
        "imported_at_utc": now(),
        "model": MODEL,
        "budget_rub": 0,
        "external_side_effects": "deny",
        "reason": message,
    }
    write_json_atomic(RECEIPTS / f"{task_id}.json", receipt)
    result = {
        "schema": 1,
        "task_id": task_id,
        "status": "REJECTED",
        "finished_at_utc": now(),
        "provider_type": "policy",
        "model": None,
        "budget_rub": 0,
        "external_side_effects": "deny",
        "error": message,
        "boundary": "Rejected before model execution; no external side effect and no output file.",
    }
    write_json_atomic(RESULTS / f"{task_id}.json", result)
    return result


def process(path: Path) -> dict[str, Any]:
    fallback_id = safe_id(path.stem)
    try:
        task = load_json(path)
        task_id = validate_task(task)
    except Exception as exc:
        return rejected_result(fallback_id, str(exc))

    receipt = {
        "schema": 1,
        "task_id": task_id,
        "status": "IMPORTED",
        "imported_at_utc": now(),
        "model": MODEL,
        "budget_rub": 0,
        "external_side_effects": "deny",
    }
    write_json_atomic(RECEIPTS / f"{task_id}.json", receipt)

    try:
        response = call_ollama(task)
        if task["action"] == "write_files":
            result_value = apply_write_files(task_id, response)
            answer = ""
        else:
            result_value = None
            answer = response
            write_text_atomic(RESULTS / f"{task_id}.md", answer + "\n")
        result = {
            "schema": 1,
            "task_id": task_id,
            "status": "DONE",
            "finished_at_utc": now(),
            "provider_type": "ollama",
            "model": MODEL,
            "budget_rub": 0,
            "external_side_effects": "deny",
            "answer_sha256": sha256_text(answer) if answer else None,
            "applied": result_value,
            "boundary": "Public-safe text/file work only. No accounts, publication or payments.",
        }
    except Exception as exc:
        result = {
            "schema": 1,
            "task_id": task_id,
            "status": "FAILED",
            "finished_at_utc": now(),
            "provider_type": "ollama",
            "model": MODEL,
            "budget_rub": 0,
            "external_side_effects": "deny",
            "error": str(exc),
        }
    write_json_atomic(RESULTS / f"{task_id}.json", result)
    return result


def main() -> int:
    cards = pending_cards()
    results: list[dict[str, Any]] = []
    for path in cards[:2]:
        results.append(process(path))

    remaining = len(pending_cards())
    failed = sum(item["status"] == "FAILED" for item in results)
    rejected = sum(item["status"] == "REJECTED" for item in results)
    done = sum(item["status"] == "DONE" for item in results)
    state = {
        "schema": 1,
        "status": (
            "PUBLIC_QWEN_WORKER_READY"
            if remaining == 0 and failed == 0
            else "PUBLIC_QWEN_WORKER_DEGRADED"
        ),
        "checked_at_utc": now(),
        "model": MODEL,
        "processed": [item["task_id"] for item in results],
        "done": done,
        "failed": failed,
        "rejected": rejected,
        "pending_count": remaining,
        "budget_rub": 0,
        "public_context_only": True,
    }
    write_json_atomic(STATE, state)
    print(json.dumps(state, ensure_ascii=False, indent=2))
    return 0 if remaining == 0 and failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
