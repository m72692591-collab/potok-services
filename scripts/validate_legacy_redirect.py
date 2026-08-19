#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

TARGET = "https://m72692591-collab.github.io/praxelta-services/"
MARKER = "PRAXELTA_REDIRECT_ONLY_V1"
ALLOWED_TOP_LEVEL = {
    ".github",
    ".gitignore",
    "404.html",
    "README.md",
    "index.html",
    "legacy_status.json",
    "scripts",
}
EXPECTED_WORKFLOWS = {"legacy-redirect-guard.yml"}
EXPECTED_SCRIPTS = {"validate_legacy_redirect.py"}
FORBIDDEN_HTML = (
    r"<script\b",
    r"<form\b",
    r"<input\b",
    r"<button\b",
    r"fetch\s*\(",
    r"XMLHttpRequest",
    r"navigator\.sendBeacon",
    r"gtag\s*\(",
    r"google-analytics",
    r"ym\s*\(",
    r"metrika",
    r"webhook",
    r"payment",
    r"checkout",
    r"lead[_-]?intake",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def validate(root: Path) -> dict:
    errors: list[str] = []
    top = {p.name for p in root.iterdir() if p.name != ".git"}
    unexpected = sorted(top - ALLOWED_TOP_LEVEL)
    if unexpected:
        fail(errors, "unexpected top-level entries: " + ", ".join(unexpected))

    workflows_dir = root / ".github" / "workflows"
    workflows = {p.name for p in workflows_dir.glob("*.y*ml")} if workflows_dir.exists() else set()
    if workflows != EXPECTED_WORKFLOWS:
        fail(errors, f"workflow set mismatch: expected={sorted(EXPECTED_WORKFLOWS)} actual={sorted(workflows)}")

    scripts_dir = root / "scripts"
    scripts = {p.name for p in scripts_dir.iterdir() if p.is_file()} if scripts_dir.exists() else set()
    if scripts != EXPECTED_SCRIPTS:
        fail(errors, f"script set mismatch: expected={sorted(EXPECTED_SCRIPTS)} actual={sorted(scripts)}")

    html_receipts: dict[str, dict] = {}
    for name in ("index.html", "404.html"):
        path = root / name
        if not path.is_file():
            fail(errors, f"missing {name}")
            continue
        text = path.read_text(encoding="utf-8")
        lower = text.lower()
        if TARGET not in text:
            fail(errors, f"{name}: canonical target missing")
        if MARKER not in text:
            fail(errors, f"{name}: redirect marker missing")
        if not re.search(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\']noindex,follow["\']', lower):
            fail(errors, f"{name}: exact noindex,follow missing")
        if not re.search(r'<meta[^>]+http-equiv=["\']refresh["\'][^>]+content=["\']0;\s*url=' + re.escape(TARGET.lower()), lower):
            fail(errors, f"{name}: zero-delay meta refresh missing")
        if not re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']' + re.escape(TARGET.lower()) + r'["\']', lower):
            fail(errors, f"{name}: exact canonical link missing")
        for pattern in FORBIDDEN_HTML:
            if re.search(pattern, text, flags=re.IGNORECASE):
                fail(errors, f"{name}: forbidden functional marker {pattern}")
        html_receipts[name] = {"size": path.stat().st_size, "sha256": sha256(path)}

    status_path = root / "legacy_status.json"
    if not status_path.is_file():
        fail(errors, "legacy_status.json missing")
        status = {}
    else:
        try:
            status = json.loads(status_path.read_text(encoding="utf-8"))
        except Exception as exc:  # pragma: no cover - fail-closed
            fail(errors, f"legacy_status.json invalid: {exc}")
            status = {}
    expected_false = (
        "forms", "lead_collection", "payments", "analytics", "client_javascript",
        "active_worker", "active_queue", "new_product_development",
        "branch_deletion", "history_rewrite",
    )
    if status.get("status") != "LEGACY_REDIRECT_ONLY":
        fail(errors, "legacy_status.json: wrong status")
    if status.get("canonical_target") != TARGET:
        fail(errors, "legacy_status.json: wrong canonical target")
    for key in expected_false:
        if status.get(key) is not False:
            fail(errors, f"legacy_status.json: {key} must be false")

    return {
        "schema_version": 1,
        "validated_at_utc": datetime.now(timezone.utc).isoformat(),
        "status": "PASS" if not errors else "FAIL",
        "target": TARGET,
        "marker": MARKER,
        "top_level": sorted(top),
        "workflows": sorted(workflows),
        "scripts": sorted(scripts),
        "html": html_receipts,
        "forms": False if not errors else None,
        "lead_collection": False if not errors else None,
        "payments": False if not errors else None,
        "analytics": False if not errors else None,
        "client_javascript": False if not errors else None,
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--receipt")
    args = parser.parse_args()
    result = validate(Path(args.root).resolve())
    payload = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.receipt:
        receipt = Path(args.receipt)
        receipt.parent.mkdir(parents=True, exist_ok=True)
        receipt.write_text(payload, encoding="utf-8")
    print(payload, end="")
    if result["status"] != "PASS":
        print("LEGACY_REDIRECT_FAIL", file=sys.stderr)
        return 1
    print("LEGACY_REDIRECT_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
