from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/validate_legacy_redirect_v2.py"
spec = importlib.util.spec_from_file_location("legacy", SCRIPT)
assert spec and spec.loader
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)


def make_repo(root: Path) -> None:
    (root / "scripts").mkdir()
    (root / "tests").mkdir()
    contract = {
        "schema_version": 2,
        "status": "LEGACY_COMPATIBILITY_REDIRECT_ONLY",
        "active_brand": False,
        "active_marketing": False,
        "new_development": False,
        "lead_collection": False,
        "payment_collection": False,
        "analytics": False,
        "canonical_successor": {
            "repository": "m72692591-collab/praxelta-services",
            "brand_ru": "ПРАКСЕЛЬТА",
            "brand_latin": "PRAXELTA",
            "public_url": "https://m72692591-collab.github.io/praxelta-services/",
        },
        "archive_gate": {
            "automatic_archive_allowed": False,
            "redirect_verified_required": True,
            "external_link_inventory_required": True,
            "owner_decision_required": True,
        },
    }
    (root / "legacy_contract_v2.json").write_text(
        json.dumps(contract, ensure_ascii=False), encoding="utf-8"
    )
    (root / "index.html").write_text(
        "<!doctype html><html><head>"
        '<meta name="robots" content="noindex,follow">'
        '<meta http-equiv="refresh" content="0; url=https://m72692591-collab.github.io/praxelta-services/">'
        "<title>ПРАКСЕЛЬТА / PRAXELTA · LEGACY_COMPATIBILITY_REDIRECT_ONLY</title>"
        "</head><body><a href=\"https://m72692591-collab.github.io/praxelta-services/\">"
        "ПРАКСЕЛЬТА / PRAXELTA</a></body></html>",
        encoding="utf-8",
    )
    text = "# LEGACY_COMPATIBILITY_REDIRECT_ONLY\n\nПреемник: ПРАКСЕЛЬТА / PRAXELTA.\n"
    (root / "README.md").write_text(text, encoding="utf-8")
    (root / "DEPRECATED_COMPATIBILITY_ONLY.md").write_text(text, encoding="utf-8")


def test_valid_redirect_only_repo_passes() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        make_repo(root)
        assert legacy.validate(root) == []


def test_form_is_forbidden() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        make_repo(root)
        path = root / "index.html"
        path.write_text(path.read_text(encoding="utf-8") + "<form></form>", encoding="utf-8")
        errors = legacy.validate(root)
        assert any("forbidden form" in error for error in errors)


def test_analytics_is_forbidden() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        make_repo(root)
        path = root / "index.html"
        path.write_text(path.read_text(encoding="utf-8") + "<script>gtag('event')</script>", encoding="utf-8")
        errors = legacy.validate(root)
        assert any("forbidden analytics" in error for error in errors)


def test_new_development_cannot_be_enabled() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        make_repo(root)
        path = root / "legacy_contract_v2.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["new_development"] = True
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        errors = legacy.validate(root)
        assert any("new_development must remain false" in error for error in errors)


def test_archive_requires_owner_decision() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        make_repo(root)
        path = root / "legacy_contract_v2.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["archive_gate"]["owner_decision_required"] = False
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        errors = legacy.validate(root)
        assert any("owner_decision_required" in error for error in errors)
