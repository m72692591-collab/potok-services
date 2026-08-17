#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS_PATH = ROOT / "legacy_status.json"
INDEX_PATH = ROOT / "index.html"

ALLOWED_TOP_LEVEL = {
    ".github",
    ".gitignore",
    ".nojekyll",
    "README.md",
    "index.html",
    "LEGACY_COMPATIBILITY_ONLY.md",
    "legacy_status.json",
    "scripts",
}
FORBIDDEN_PATTERNS = [
    re.compile(r"<form\b", re.IGNORECASE),
    re.compile(r"fetch\s*\(", re.IGNORECASE),
    re.compile(r"XMLHttpRequest", re.IGNORECASE),
    re.compile(r"yaCounter|google-analytics|gtag\s*\(", re.IGNORECASE),
    re.compile(r"оплат|заказать|оставить заявку|тариф", re.IGNORECASE),
]


def fail(message: str) -> None:
    print(f"LEGACY_REDIRECT_FAIL — {message}")
    raise SystemExit(1)


def main() -> int:
    if not STATUS_PATH.exists():
        fail("legacy_status.json is missing")
    data = json.loads(STATUS_PATH.read_text(encoding="utf-8-sig"))
    required = {
        "status": "LEGACY_COMPATIBILITY_ONLY",
        "active_brand": False,
        "redirect_only": True,
        "new_development_allowed": False,
        "new_marketing_allowed": False,
        "lead_collection_allowed": False,
        "analytics_allowed": False,
    }
    for key, expected in required.items():
        if data.get(key) != expected:
            fail(f"{key} must be {expected!r}")
    destination = data.get("canonical_destination", {})
    if destination.get("brand_ru") != "ПРАКСЕЛЬТА" or destination.get("brand_latin") != "PRAXELTA":
        fail("canonical destination must be ПРАКСЕЛЬТА / PRAXELTA")

    unexpected = sorted(path.name for path in ROOT.iterdir() if path.name not in ALLOWED_TOP_LEVEL and path.name != ".git")
    if unexpected:
        fail("unexpected top-level entries: " + ", ".join(unexpected))

    if not INDEX_PATH.exists():
        fail("index.html is missing")
    index = INDEX_PATH.read_text(encoding="utf-8-sig")
    if "ПРАКСЕЛЬТА" not in index and "PRAXELTA" not in index:
        fail("index.html does not identify the canonical destination")
    for pattern in FORBIDDEN_PATTERNS:
        if pattern.search(index):
            fail(f"index.html contains forbidden active functionality: {pattern.pattern}")

    print("LEGACY_REDIRECT_PASS — repository is redirect-only and points to ПРАКСЕЛЬТА / PRAXELTA")
    return 0


if __name__ == "__main__":
    sys.exit(main())
