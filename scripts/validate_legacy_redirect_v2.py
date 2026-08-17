#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REQUIRED_STATUS = "LEGACY_COMPATIBILITY_REDIRECT_ONLY"
FORBIDDEN_HTML_PATTERNS = {
    "form": re.compile(r"<form\b", re.IGNORECASE),
    "input": re.compile(r"<input\b", re.IGNORECASE),
    "payment": re.compile(r"оплат|payment|checkout|robokassa", re.IGNORECASE),
    "lead": re.compile(r"оставить заявку|заказать|получить расч[её]т|lead", re.IGNORECASE),
    "analytics": re.compile(r"google-analytics|gtag\s*\(|yaCounter|yandex\.metrika|pixel", re.IGNORECASE),
    "network_script": re.compile(r"fetch\s*\(|XMLHttpRequest|axios\.", re.IGNORECASE),
}


def load_json(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict):
        raise ValueError("legacy contract must be an object")
    return data


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    contract_path = root / "legacy_contract_v2.json"
    index_path = root / "index.html"
    readme_path = root / "README.md"
    marker_path = root / "DEPRECATED_COMPATIBILITY_ONLY.md"

    for path in (contract_path, index_path, readme_path, marker_path):
        if not path.is_file():
            errors.append(f"required file missing: {path.relative_to(root)}")
    if errors:
        return errors

    data = load_json(contract_path)
    if data.get("schema_version") != 2:
        errors.append("schema_version must be 2")
    if data.get("status") != REQUIRED_STATUS:
        errors.append(f"status must be {REQUIRED_STATUS}")
    for key in (
        "active_brand",
        "active_marketing",
        "new_development",
        "lead_collection",
        "payment_collection",
        "analytics",
    ):
        if data.get(key) is not False:
            errors.append(f"{key} must remain false")

    successor = data.get("canonical_successor")
    if not isinstance(successor, dict):
        errors.append("canonical_successor must be an object")
    else:
        if successor.get("repository") != "m72692591-collab/praxelta-services":
            errors.append("canonical successor repository changed")
        if successor.get("brand_ru") != "ПРАКСЕЛЬТА":
            errors.append("canonical successor RU brand changed")
        if successor.get("brand_latin") != "PRAXELTA":
            errors.append("canonical successor Latin brand changed")
        url = successor.get("public_url")
        if not isinstance(url, str) or not url.startswith("https://"):
            errors.append("canonical successor public_url must be HTTPS")

    archive_gate = data.get("archive_gate")
    if not isinstance(archive_gate, dict):
        errors.append("archive_gate must be an object")
    else:
        if archive_gate.get("automatic_archive_allowed") is not False:
            errors.append("automatic archive must remain false")
        for key in (
            "redirect_verified_required",
            "external_link_inventory_required",
            "owner_decision_required",
        ):
            if archive_gate.get(key) is not True:
                errors.append(f"archive gate {key} must remain true")

    index = index_path.read_text(encoding="utf-8-sig")
    readme = readme_path.read_text(encoding="utf-8-sig")
    marker = marker_path.read_text(encoding="utf-8-sig")
    successor_url = str(successor.get("public_url", "")) if isinstance(successor, dict) else ""

    for token in ("ПРАКСЕЛЬТА", "PRAXELTA", REQUIRED_STATUS):
        if token not in index:
            errors.append(f"index.html missing required token: {token}")
    if successor_url and successor_url not in index:
        errors.append("index.html does not link to canonical successor URL")
    if '<meta name="robots" content="noindex,follow">' not in index:
        errors.append("index.html must use noindex,follow")
    if "http-equiv=\"refresh\"" not in index and "http-equiv='refresh'" not in index:
        errors.append("index.html must contain a static redirect")

    for label, pattern in FORBIDDEN_HTML_PATTERNS.items():
        if pattern.search(index):
            errors.append(f"index.html contains forbidden {label} functionality")

    for text_name, text in (("README.md", readme), ("DEPRECATED_COMPATIBILITY_ONLY.md", marker)):
        if "ПРАКСЕЛЬТА" not in text or REQUIRED_STATUS not in text:
            errors.append(f"{text_name} must identify the redirect-only status and successor")

    allowed_top_level = {
        ".git",
        ".github",
        ".gitignore",
        ".nojekyll",
        "README.md",
        "index.html",
        "404.html",
        "robots.txt",
        "sitemap.xml",
        "CNAME",
        "DEPRECATED_COMPATIBILITY_ONLY.md",
        "legacy_contract_v2.json",
        "scripts",
        "tests",
    }
    unexpected = sorted(path.name for path in root.iterdir() if path.name not in allowed_top_level)
    if unexpected:
        errors.append("unexpected top-level entries in redirect-only repository: " + ", ".join(unexpected))

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--report", default="legacy-redirect-v2-report.json")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    errors = validate(root)
    payload = {
        "schema_version": 2,
        "status": "PASS" if not errors else "FAIL",
        "error_count": len(errors),
        "errors": errors,
        "destructive_actions_performed": False,
        "automatic_archive_performed": False,
    }
    report = root / args.report
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
