#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

TARGET = "https://m72692591-collab.github.io/praxelta-services/"
REQUIRED_PUBLIC_FILES = {"index.html", "404.html", "robots.txt", ".nojekyll"}
ONE_SHOT_WORKFLOWS = {
    "one-shot-normalize-legacy-redirect.yml",
    "one-shot-verify-legacy-redirect.yml",
}
INERT_WORKFLOWS = {
    "public-maestro-worker.yml",
    "public-actions-health.yml",
}
PERMANENT_WORKFLOWS = {
    "legacy-redirect-guard.yml",
    "deploy-legacy-redirect.yml",
    "archive-legacy-after-live-verification.yml",
}

FORBIDDEN_HTML_PATTERNS = {
    "client JavaScript": re.compile(r"<script\b|javascript:|\bon\w+\s*=", re.I),
    "form": re.compile(r"<form\b|<input\b|<button\b|<textarea\b|<select\b", re.I),
    "network client": re.compile(r"fetch\s*\(|XMLHttpRequest|WebSocket\s*\(", re.I),
    "analytics": re.compile(
        r"google-analytics|googletagmanager|gtag\s*\(|yaCounter|metrika|pixel\b|analytics",
        re.I,
    ),
    "payment or lead collection": re.compile(
        r"checkout|payment|merchant|webhook|lead[-_ ]?intake|оставить\s+заявку|оплатить|заказать",
        re.I,
    ),
    "embedded external content": re.compile(r"<iframe\b|<object\b|<embed\b", re.I),
}


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(read_text(path))
    if not isinstance(value, dict):
        raise ValueError(f"JSON root must be an object: {path}")
    return value


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def validate_html(path: Path, errors: list[str]) -> None:
    if not path.is_file():
        errors.append(f"missing HTML file: {path}")
        return
    text = read_text(path)
    lowered = text.casefold()
    require(TARGET in text, f"canonical target missing: {path}", errors)
    require("праксельта" in lowered, f"canonical brand missing: {path}", errors)
    require(
        re.search(
            r'<link\s+rel=["\']canonical["\']\s+href=["\']'
            + re.escape(TARGET)
            + r'["\']',
            text,
            re.I,
        )
        is not None,
        f"exact canonical link missing: {path}",
        errors,
    )
    require(
        re.search(r'<meta\s+name=["\']robots["\'][^>]*noindex', text, re.I)
        is not None,
        f"noindex missing: {path}",
        errors,
    )
    require(
        re.search(
            r'<meta\s+http-equiv=["\']refresh["\'][^>]*'
            + re.escape(TARGET),
            text,
            re.I,
        )
        is not None,
        f"static meta refresh missing: {path}",
        errors,
    )
    for label, pattern in FORBIDDEN_HTML_PATTERNS.items():
        if pattern.search(text):
            errors.append(f"forbidden {label} in {path}")


def validate_inert_workflow(path: Path, errors: list[str]) -> None:
    if not path.is_file():
        errors.append(f"inert historical workflow missing: {path}")
        return
    text = read_text(path)
    require("workflow_dispatch:" in text, f"manual trigger missing: {path}", errors)
    require("permissions:" in text and "contents: read" in text, f"read-only permissions missing: {path}", errors)
    require("if: ${{ false }}" in text, f"permanent skip gate missing: {path}", errors)
    require(re.search(r"^\s*schedule\s*:", text, re.M) is None, f"schedule must be absent: {path}", errors)
    require(re.search(r"^\s*push\s*:", text, re.M) is None, f"push trigger must be absent: {path}", errors)
    require("contents: write" not in text, f"write permission forbidden: {path}", errors)
    require("ollama pull" not in text, f"model execution forbidden: {path}", errors)
    require("git push" not in text, f"repository mutation forbidden: {path}", errors)


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    public_root = root / "public"
    workflows = root / ".github" / "workflows"

    if not public_root.is_dir():
        return ["public deployment directory is missing"]
    actual_public = {path.name for path in public_root.iterdir() if path.is_file()}
    require(
        actual_public == REQUIRED_PUBLIC_FILES,
        "public artifact file set drift: " + ", ".join(sorted(actual_public)),
        errors,
    )

    for relative in ("index.html", "404.html"):
        validate_html(root / relative, errors)
        validate_html(public_root / relative, errors)
        if (root / relative).is_file() and (public_root / relative).is_file():
            require(
                (root / relative).read_bytes() == (public_root / relative).read_bytes(),
                f"root/public byte drift: {relative}",
                errors,
            )

    robots = public_root / "robots.txt"
    require(robots.is_file(), "robots.txt missing", errors)
    if robots.is_file():
        robots_text = read_text(robots)
        require("User-agent: *" in robots_text, "robots wildcard missing", errors)
        require("Disallow: /" in robots_text, "robots disallow missing", errors)

    status_path = root / "legacy_status.json"
    require(status_path.is_file(), "legacy_status.json missing", errors)
    if status_path.is_file():
        try:
            status = read_json(status_path)
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            errors.append(f"legacy status invalid: {exc}")
        else:
            expected = {
                "schema_version": 2,
                "status": "LEGACY_COMPATIBILITY_ONLY",
                "active_brand": False,
                "redirect_only": True,
                "public_artifact_path": "public",
                "historical_internal_code_deployed": False,
                "public_worker_active": False,
                "new_development_allowed": False,
                "new_marketing_allowed": False,
                "lead_collection_allowed": False,
                "analytics_allowed": False,
                "archive_after_live_http_verification": True,
                "live_http_verified": False,
                "archived_verified": False,
            }
            for key, expected_value in expected.items():
                require(status.get(key) == expected_value, f"status field drift: {key}", errors)
            destination = status.get("canonical_destination") or {}
            require(destination.get("brand_ru") == "ПРАКСЕЛЬТА", "brand_ru drift", errors)
            require(destination.get("brand_latin") == "PRAXELTA", "brand_latin drift", errors)
            require(destination.get("repository") == "m72692591-collab/praxelta-services", "destination repository drift", errors)
            require(destination.get("url") == TARGET, "destination URL drift", errors)
            surface = status.get("public_surface") or {}
            for key in ("forms", "lead_collection", "payments", "analytics", "client_javascript"):
                require(surface.get(key) is False, f"public surface must disable {key}", errors)
            for key in ("noindex", "canonical", "old_links_route_to_canonical_root"):
                require(surface.get(key) is True, f"public surface must enable {key}", errors)

    for filename in INERT_WORKFLOWS:
        validate_inert_workflow(workflows / filename, errors)
    for filename in PERMANENT_WORKFLOWS:
        require((workflows / filename).is_file(), f"permanent workflow missing: {filename}", errors)
    for filename in ONE_SHOT_WORKFLOWS:
        require(not (workflows / filename).exists(), f"completed one-shot workflow remains: {filename}", errors)

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--report")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    errors = validate(root)
    report = {
        "schema_version": 2,
        "status": "PASS" if not errors else "FAIL",
        "repository_role": "LEGACY_COMPATIBILITY_ONLY",
        "canonical_target": TARGET,
        "public_artifact": "public",
        "client_javascript": False,
        "forms": False,
        "lead_collection": False,
        "payments": False,
        "analytics": False,
        "historical_internal_code_deployed": False,
        "archive_verified": False,
        "error_count": len(errors),
        "errors": errors,
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    print(rendered)
    if args.report:
        output = root / args.report
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered + "\n", encoding="utf-8")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
