from __future__ import annotations

import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "validate_legacy_redirect_v2.py"
spec = importlib.util.spec_from_file_location("legacy_redirect_v2", SCRIPT)
assert spec and spec.loader
validator = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = validator
spec.loader.exec_module(validator)


class LegacyRedirectV2Tests(unittest.TestCase):
    def setUp(self) -> None:
        self._temp = tempfile.TemporaryDirectory()
        self.root = Path(self._temp.name) / "repo"
        shutil.copytree(ROOT, self.root, ignore=shutil.ignore_patterns(".git", "__pycache__", "*.pyc"))

    def tearDown(self) -> None:
        self._temp.cleanup()

    def errors(self) -> list[str]:
        return validator.validate(self.root)

    def test_current_contract_passes(self) -> None:
        self.assertEqual(self.errors(), [])

    def test_client_javascript_is_rejected(self) -> None:
        path = self.root / "public" / "index.html"
        path.write_text(path.read_text(encoding="utf-8") + "\n<script>location.replace('/')</script>\n", encoding="utf-8")
        self.assertTrue(any("client JavaScript" in item for item in self.errors()))

    def test_form_is_rejected(self) -> None:
        path = self.root / "public" / "404.html"
        path.write_text(path.read_text(encoding="utf-8") + "\n<form></form>\n", encoding="utf-8")
        self.assertTrue(any("forbidden form" in item for item in self.errors()))

    def test_wrong_target_is_rejected(self) -> None:
        path = self.root / "index.html"
        path.write_text(path.read_text(encoding="utf-8").replace(validator.TARGET, "https://example.invalid/"), encoding="utf-8")
        self.assertTrue(any("canonical target missing" in item for item in self.errors()))

    def test_active_worker_trigger_is_rejected(self) -> None:
        path = self.root / ".github" / "workflows" / "public-maestro-worker.yml"
        path.write_text(path.read_text(encoding="utf-8") + "\npush:\n", encoding="utf-8")
        self.assertTrue(any("push trigger must be absent" in item for item in self.errors()))

    def test_one_shot_residue_is_rejected(self) -> None:
        path = self.root / ".github" / "workflows" / "one-shot-normalize-legacy-redirect.yml"
        path.write_text("name: old\n", encoding="utf-8")
        self.assertTrue(any("one-shot workflow remains" in item for item in self.errors()))

    def test_false_archive_claim_is_rejected(self) -> None:
        path = self.root / "legacy_status.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["archived_verified"] = True
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        self.assertTrue(any("archived_verified" in item for item in self.errors()))


if __name__ == "__main__":
    unittest.main()
