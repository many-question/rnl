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


class SiteExamples(unittest.TestCase):
    def test_examples_are_published_and_linked_in_both_languages(self):
        with patch.object(build, "has_linux_release", return_value=False):
            pages = build.build(None)
        for name in ("ota5t.sp", "ota5t-zh.sp", "ota5t-edits.sp", "ota5t-resolved.sp", "ota5t_tb.sp"):
            self.assertIn(f"examples/{name}", pages)
        for lang, label in (("zh", "在查看器中打开"), ("en", "Open in viewer")):
            self.assertIn(f'href="../viewer/?url=samples/site/ota5t.sp">{label}</a>', pages[f"{lang}/index.html"])
            self.assertIn(
                f'href="{build.SITE_URL}viewer/?url=samples/site/ota5t.sp">{label}</a>',
                pages[f"{lang}/rnl-intro-standalone.html"],
            )
            self.assertIn(f'href="../viewer/?url=samples/site/ota5t.sp">{label}</a>', pages[f"{lang}/language.html"])
            self.assertIn(f'href="../viewer/?url=samples/site/ota5t_tb.sp"', pages[f"{lang}/language.html"])

    def test_check_examples_detects_drift_between_scenes_and_examples(self):
        files = build.sources()
        ex = build.examples()
        self.assertEqual(build.check_examples(files, ex), [])
        drifted = dict(ex, **{"ota5t.sp": ex["ota5t.sp"].replace("#M1 @PLACE(12, 8)", "#M1 @PLACE(14, 8)")})
        errors = build.check_examples(files, drifted)
        self.assertTrue(any("L_SYM" in e for e in errors), errors)


if __name__ == "__main__":
    unittest.main()
