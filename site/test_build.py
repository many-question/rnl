"""Release download links, including earlier tags that only shipped Windows files."""
import importlib.util
import json
import subprocess
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("site_build", Path(__file__).with_name("build.py"))
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class ReleaseDownloads(unittest.TestCase):
    def test_linux_requires_both_packages_in_the_selected_tag(self):
        for targets, expected in [(["appimage", "deb"], True), (["nsis", "msi"], False), (["deb"], False)]:
            config = SimpleNamespace(stdout=json.dumps({"bundle": {"targets": targets}}))
            with self.subTest(targets=targets), patch.object(build.subprocess, "run", return_value=config) as run:
                self.assertEqual(build.has_linux_release("0.1.2"), expected)
                self.assertEqual(run.call_args.args[0], ["git", "show", "viewer-v0.1.2:apps/desktop/tauri.linux.conf.json"])

    def test_missing_config_or_no_release_has_no_linux_links(self):
        with patch.object(build.subprocess, "run", side_effect=subprocess.CalledProcessError(128, "git")):
            self.assertFalse(build.has_linux_release("0.1.1"))
        with patch.object(build.subprocess, "run") as run:
            self.assertFalse(build.has_linux_release(None))
            run.assert_not_called()

    def test_bilingual_downloads_for_old_new_and_no_release(self):
        for version, linux in [("0.1.1", False), ("0.1.2", True), (None, False)]:
            with self.subTest(version=version), patch.object(build, "has_linux_release", return_value=linux):
                pages = build.build(version)
                for language in ["zh", "en"]:
                    for page in ["tools.html", "rnl-tools-standalone.html"]:
                        html = pages[f"{language}/{page}"]
                        self.assertNotIn("{{viewer-", html)
                        self.assertNotIn("<!--linux-release-->", html)
                        self.assertEqual("-linux-x86_64.AppImage\"" in html, linux)
                        self.assertEqual("-linux-x86_64.deb\"" in html, linux)
                        self.assertEqual("-windows-x64-setup.exe\"" in html, version is not None)
                        if linux:
                            self.assertIn("viewer-v0.1.2/RNL-Viewer-0.1.2-linux-x86_64.deb", html)
                            self.assertIn("--appimage-extract-and-run", html)
                            self.assertIn("sudo apt install ./RNL-Viewer-0.1.2", html)

    def test_linux_blocks_obey_the_release_markup_rules(self):
        self.assertEqual(build.check_release("<!--linux-release-->{{viewer-tag}}<!--/linux-release-->", "test"), [])
        self.assertTrue(build.check_release("<!--linux-release-->{{viewer-tag}}", "test"))
        self.assertTrue(build.check_release("<!--no-linux-release-->{{viewer-tag}}<!--/no-linux-release-->", "test"))


if __name__ == "__main__":
    unittest.main()
