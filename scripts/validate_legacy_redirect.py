#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS_PATH = ROOT / "legacy_status.json"
REDIRECT_PAGES = (ROOT / "index.html", ROOT / "404.html")

ALLOWED_TOP_LEVEL = {
    ".github",
    ".gitignore",
    ".nojekyll",
    "README.md",
    "index.html",
    "404.html",
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
DESTINATION_MARKERS = (
    "ПРАКСЕЛЬТА",
    "PRAXELTA",
    "m72692591-collab.github.io/praxelta-services",
)


def fail(message: str) -> None:
    print(f"LEGACY_REDIRECT_FAIL — {message}")
    raise SystemExit(1)


def validate_redirect_page(path: Path) -> None:
    if not path.exists():
        fail(f"{path.name} is missing")
    text = path.read_text(encoding="utf-8-sig")
    if not any(marker in text for marker in DESTINATION_MARKERS):
        fail(f"{path.name} does not identify the canonical destination")
    for pattern in FORBIDDEN_PATTERNS:
        if pattern.search(text):
            fail(
                f"{path.name} contains forbidden active functionality: "
                f"{pattern.pattern}"
            )


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
    if (
        destination.get("brand_ru") != "ПРАКСЕЛЬТА"
        or destination.get("brand_latin") != "PRAXELTA"
        or destination.get("repository")
        != "m72692591-collab/praxelta-services"
    ):
        fail("canonical destination must be ПРАКСЕЛЬТА / PRAXELTA")

    unexpected = sorted(
        path.name
        for path in ROOT.iterdir()
        if path.name not in ALLOWED_TOP_LEVEL and path.name != ".git"
    )
    if unexpected:
        fail("unexpected top-level entries: " + ", ".join(unexpected))

    for page in REDIRECT_PAGES:
        validate_redirect_page(page)

    print(
        "LEGACY_REDIRECT_PASS — repository is redirect-only and both "
        "index/404 routes point to ПРАКСЕЛЬТА / PRAXELTA"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
