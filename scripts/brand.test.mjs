import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { chromium, darkColour, darkLogo, ICON_BACKGROUND, root, renderLogo } from "./brand.mjs";

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

test("small SVG icons gain sharper ink only at 32px and below, including when embedded as images", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });
    const icon = readFileSync(join(root, "brand/rnl-icon.svg"), "utf8");
    const normal = icon.replace(/<style>.*?<\/style>\n/s, "<style>.icon-small { display: none; }</style>\n");
    const soft = icon.replace("</style>", ".icon-small { display: none !important; } .icon-normal { display: inline !important; }</style>");
    assert.match(icon, new RegExp(`fill="${ICON_BACKGROUND}"`));
    async function pixels(svg, size) {
      const src = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
      await page.setContent(`<style>body{margin:0}img{display:block}</style><img width="${size}" height="${size}" src="${src}">`);
      await page.locator("img").evaluate(el => el.decode());
      const screenshot = await page.locator("img").screenshot({ omitBackground: true });
      return page.evaluate(async src => {
        const image = new Image(); image.src = src; await image.decode();
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = image.width;
        const context = canvas.getContext("2d"); context.drawImage(image, 0, 0);
        return [...context.getImageData(0, 0, image.width, image.height).data];
      }, "data:image/png;base64," + screenshot.toString("base64"));
    }
    const ink = data => data.reduce((sum, _, i) => i % 4 ? sum : sum +
      Math.max(0, Math.min(data[i] - 19, data[i + 1] - 32, data[i + 2] - 51)), 0);
    const fringes = data => data.reduce((sum, _, i) => sum +
      Number(i % 4 === 0 && data[i] > 32 && data[i] < 223 && data[i + 2] >= data[i]), 0);
    for (const size of [16, 24, 32, 48, 256]) {
      const actual = await pixels(icon, size), original = await pixels(normal, size);
      if (size <= 32) {
        // Pixel fitting replaces fractional coverage with solid pixels; retain a weight increase.
        assert.ok(ink(actual) > ink(original) * 1.15, `${size}px should have stronger visible strokes`);
        assert.ok(fringes(actual) < fringes(await pixels(soft, size)) * .7, `${size}px should have fewer blended edge pixels`);
        for (let i = 0; i < actual.length; i += 4) {
          if (actual[i] <= 32) continue; // The rounded backdrop may retain partial coverage.
          assert.ok(["224,224,226", "232,89,12"].includes(actual.slice(i, i + 3).join(",")),
            `${size}px circuit paths and dots should use solid colours without blended edges`);
        }
      }
      else assert.deepEqual(actual, original, `${size}px must retain the original strokes`);
    }
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
