import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { chromium, darkColour, darkLogo, renderLogo, root } from "./brand.mjs";

test("the current renderer reproduces the committed logo byte for byte", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const { svg } = await renderLogo(page);
    assert.ok(Buffer.from(svg).equals(readFileSync(join(root, "brand/rnl-logo.svg"))),
      "run node scripts/brand.mjs and review the logo");
    assert.equal(darkLogo(svg), readFileSync(join(root, "brand/rnl-logo-dark.svg"), "utf8"),
      "run node scripts/brand.mjs and review the logo");
  } finally {
    await browser.close();
  }
});

test("brand colours match the viewer, including threshold boundaries and alpha", () => {
  // Isolate the actual module's pure functions from its DOM imports. No viewer code is rewritten.
  const source = readFileSync(join(root, "apps/viewer-ui/background.js"), "utf8")
    .replace(/^import .*;\r?$/gm, "").replace(/^export /gm, "");
  const viewerColour = vm.runInNewContext(source + "\n; darkColour");
  const colours = ["#1d1d1f", "#e8590c", "#14345c", "#000", "#0008", "#abc", "#abcd", "#00112280",
    "#ff0000", "#00007f", "#000080", "#FFFFFF", "none", "currentColor", "#invalid"];
  for (let r = 0; r <= 255; r += 17) {
    for (let g = 0; g <= 255; g += 17) {
      for (let b = 0; b <= 255; b += 17) colours.push("#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join(""));
    }
  }
  for (const colour of colours) assert.equal(darkColour(colour), viewerColour(colour), colour);
});
