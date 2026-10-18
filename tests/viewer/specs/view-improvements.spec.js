import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { root } from "../fixtures.js";
import { expect, test } from "../viewer.js";

const box = (viewer) => viewer.viewBox().then((b) => b.split(" ").map(Number));
const modes = { web: {}, desktop: { platform: "desktop", settings: "1" } };

// Measure the actual screenshot, including antialiasing, in CSS pixels. An opaque line contributes
// its full width; its two partially covered edge pixels contribute their fractional coverage.
async function inkWidth(page, point) {
  const png = await page.screenshot({ clip: { x: Math.floor(point.x) - 2, y: Math.floor(point.y) - 10, width: 5, height: 20 } });
  const coverage = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
    const c = document.createElement("canvas");
    c.width = bitmap.width; c.height = bitmap.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) ink += 1 - data[i] / 255;
    bitmap.close();
    return ink / c.width / (c.height / 20); // screenshots may use two device pixels per CSS pixel
  }, [...png]);
  return coverage / (1 - 29 / 255); // the renderer's default ink, #1d1d1f
}

test("CLI SVG hairlines remain fixed when opened and resized independently of the viewer", async ({ page }, info) => {
  const out = info.outputPath("render");
  execFileSync(process.env.RNL_BIN, ["render", path.join(root, "tests/viewer/inputs/default-hairlines.sp"), "--no-std", "-o", out]);
  const svg = await fs.readFile(path.join(out, "default-hairlines.svg"), "utf8");
  await page.route("**/standalone.svg", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
  await page.goto(`${process.env.RNL_VIEWER_URL}/standalone.svg`);
  const widths = [];
  for (const factor of [0.6, 1, 1.4]) {
    const p = await page.locator("svg").evaluate((el, factor) => {
      el.style.width = `${el.viewBox.baseVal.width * factor}px`;
      el.style.height = `${el.viewBox.baseVal.height * factor}px`;
      const m = el.getScreenCTM();
      // SVGPoint works on the shared Chromium 109 / Safari 16 browser baseline too.
      const p = el.createSVGPoint(); p.x = 140; p.y = 98;
      const screen = p.matrixTransform(m);
      return { x: screen.x, y: screen.y };
    }, factor);
    widths.push(await inkWidth(page, p));
  }
  for (const w of widths) expect(Math.abs(w - 1.2)).toBeLessThan(0.1);
});

for (const [platform, query] of Object.entries(modes)) {
  test.describe(`view improvements, ${platform}`, () => {
    test.beforeEach(async ({ viewer }) => {
      await viewer.open("view-improvements", query);
      await viewer.settled();
    });

    test("default, explicit zero and double hairlines retain their screen widths while nonzero scales", async ({ page, viewer }) => {
      await viewer.open("view-hairlines", query);
      await page.evaluate(() => window.viewer.command("grid-none"));
      const scale = await page.evaluate(() => window.viewer.doc.levels[window.viewer.level].scale);
      for (const y of [-4, -7, -10, -13]) {
        await page.keyboard.press("f");
        const widths = [];
        for (let zoom = 0; zoom < 3; zoom++) {
          const p = await viewer.point(10 * scale, -y * scale);
          widths.push(await inkWidth(page, p));
          if (zoom < 2) {
            const before = await viewer.viewBox();
            await page.mouse.move(p.x, p.y);
            await page.mouse.wheel(0, -Math.log(1.25) / 0.0015);
            await expect.poll(() => viewer.viewBox()).not.toBe(before);
          }
        }
        if (y === -10) expect(widths[2] / widths[0]).toBeCloseTo(1.25 ** 2, 1);
        else {
          for (const w of widths) expect(Math.abs(w - widths[0])).toBeLessThan(0.15);
          if (y !== -13) expect(Math.abs(widths[0] - 1.2)).toBeLessThan(0.1);
        }
      }
    });

    test("Dark reflects only HSL L below 25%, preserves alpha and original Documents, and restores Light", async ({ page }) => {
      const original = await page.evaluate(() => window.viewer.doc.levels[window.viewer.level].svg);
      await page.evaluate(() => window.fakeShell.menu("background-dark"));
      await expect(page.locator("#canvas")).toHaveCSS("background-color", "rgb(24, 24, 28)");
      const svg = page.locator("#canvas > svg");
      await expect(svg.locator('[stroke="#8080ff"]')).toHaveCount(1);
      await expect(svg.locator('[stroke="#000080"]')).toHaveCount(1);
      await expect(svg.locator('[stroke="#f00"]')).toHaveCount(1);
      await expect(svg.locator('[stroke="#8080ff80"]')).toHaveCount(1);
      await expect(svg.locator('[fill="#cfcfef"]')).toHaveCount(1);
      // The renderer's default text ink receives exactly the same rule as explicit colours.
      await expect(svg.locator('[fill="#e0e0e2"]')).not.toHaveCount(0);
      expect(await page.evaluate(() => window.viewer.doc.levels[window.viewer.level].svg)).toBe(original);
      const boundary = await page.evaluate(async () => {
        const { DARK_LIGHTNESS_THRESHOLD: t, darkLightness, darkColour } = await import("../background.js");
        return [t, ...[t - 1e-6, t, t + 1e-6].map(darkLightness), darkColour("#000"), darkColour("#0008"), darkColour("#001122")];
      });
      expect(boundary).toEqual([0.25, 0.750001, 0.25, 0.250001, "#ffffff", "#ffffff88", "#ddeeff"]);
      await page.evaluate(() => window.fakeShell.menu("background-light"));
      // Only the viewBox/size and the selection overlay differ from the core's SVG.
      await expect(svg.locator('[stroke="#00007f"]')).toHaveCount(1);
      await expect(svg.locator('[stroke="#00007f80"]')).toHaveCount(1);
      await expect(svg.locator('[fill="#101030"]')).toHaveCount(1);
      await expect(svg.locator('[fill="#1d1d1f"]')).not.toHaveCount(0);
      await expect(svg.locator('[stroke="#8080ff"]')).toHaveCount(0);
    });

    test("Background menu persists through the platform's settings store", async ({ page, viewer }) => {
      if (platform === "web") {
        await viewer.menuTitle("View").click();
        await page.locator(".menu-item.opens", { hasText: "Background" }).click();
        await viewer.menuItem("background-dark").click();
      } else await page.evaluate(() => window.fakeShell.menu("background-dark"));
      await expect(page.locator("body")).toHaveAttribute("data-background", "dark");
      if (platform === "desktop") {
        await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("fake-settings")).background)).toBe("dark");
        expect(await page.evaluate(() => localStorage.getItem("background"))).toBeNull();
      } else expect(await page.evaluate(() => JSON.parse(localStorage.getItem("background")))).toBe("dark");
      await page.reload();
      await viewer.started(); await viewer.idle();
      await expect(page.locator("body")).toHaveAttribute("data-background", "dark");
      expect(await page.evaluate(() => [window.viewer.checked("background-dark"), window.viewer.checked("background-light")])).toEqual([true, false]);
    });

    test("white selection glows against white hairlines, hover tips and lazy thumbnails stay legible", async ({ page, viewer }) => {
      await page.evaluate(() => window.viewer.command("background-dark"));
      await viewer.click("R1");
      const marked = page.locator("#canvas g.sel").first();
      await expect(marked.locator('[stroke]:not([stroke="none"]):not(.inner)').first()).toHaveCSS("stroke", "rgb(255, 255, 255)");
      await expect(marked).toHaveCSS("filter", /drop-shadow/);
      const p = await viewer.where("R1");
      await page.mouse.move(p.x + 1, p.y);
      await expect(page.locator("#hover-tip")).toBeVisible();
      await expect(page.locator("#hover-tip")).toHaveCSS("color", "rgb(255, 255, 255)");
      await viewer.open("unplaced", query);
      await page.locator("#tab-unplaced").click();
      await expect(page.locator(".thumb svg").first()).toBeVisible();
      await expect(page.locator(".thumb").first()).toHaveCSS("background-color", "rgb(24, 24, 28)");
      await expect(page.locator('.thumb [stroke="#e0e0e2"]').first()).toBeAttached();
    });

    test("right drag fits the rectangle in either direction; short click, Escape and capture loss leave it alone", async ({ page, viewer }) => {
      const r = await page.locator("#canvas").boundingBox();
      for (const reversed of [false, true]) {
        await page.keyboard.press("f");
        const before = await box(viewer);
        const a = { x: Math.round(r.x + r.width * 0.2), y: Math.round(r.y + r.height * 0.3) };
        const b = { x: Math.round(r.x + r.width * 0.6), y: Math.round(r.y + r.height * 0.6) };
        const [start, end] = reversed ? [b, a] : [a, b];
        await page.mouse.move(start.x, start.y); await page.mouse.down({ button: "right" });
        await page.mouse.move(end.x, end.y, { steps: 5 });
        await expect(page.locator(".zoom-box")).toBeVisible();
        expect(await box(viewer)).toEqual(before);
        await page.mouse.up({ button: "right" });
        await expect(page.locator(".zoom-box")).toBeHidden();
        const after = await box(viewer);
        const ratio = Math.max((b.x - a.x) / r.width, (b.y - a.y) / r.height);
        expect(after[2]).toBeCloseTo(before[2] * ratio, 6);
        expect(after[3]).toBeCloseTo(before[3] * ratio, 6);
        expect(after[0] + after[2] / 2).toBeCloseTo(before[0] + before[2] * ((a.x + b.x) / 2 - r.x) / r.width, 6);
        expect(after[1] + after[3] / 2).toBeCloseTo(before[1] + before[3] * ((a.y + b.y) / 2 - r.y) / r.height, 6);
      }
      const before = await viewer.viewBox();
      for (const cancel of ["short", "Escape", "capture"]) {
        await page.mouse.move(r.x + 30, r.y + 40); await page.mouse.down({ button: "right" });
        await page.mouse.move(r.x + (cancel === "short" ? 32 : 200), r.y + (cancel === "short" ? 41 : 200));
        if (cancel === "Escape") await page.keyboard.press("Escape");
        if (cancel === "capture") await page.locator("#canvas").dispatchEvent("pointercancel", { pointerId: 1 });
        await page.mouse.up({ button: "right" });
        expect(await viewer.viewBox()).toBe(before);
        await expect(page.locator(".zoom-box")).toBeHidden();
      }
      // Browser context menus remain suppressed on this canvas, which has no application menu.
      expect(await page.locator("#canvas").evaluate((c) => !c.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })))).toBe(true);
    });

    test("arrows pan 10%, Shift 30%; editors, search, lists and overlap picker retain their keys", async ({ page, viewer }) => {
      await page.locator("#canvas").focus();
      for (const [key, dx, dy] of [["ArrowRight", 0.1, 0], ["ArrowLeft", -0.1, 0], ["ArrowUp", 0, -0.1], ["Shift+ArrowDown", 0, 0.3]]) {
        const before = await box(viewer);
        await page.keyboard.press(key);
        const after = await box(viewer);
        expect(after[0]).toBeCloseTo(before[0] + dx * before[2], 6);
        expect(after[1]).toBeCloseTo(before[1] + dy * before[3], 6);
        expect(after.slice(2)).toEqual(before.slice(2));
      }
      await page.locator("#tab-hierarchy").click();
      await page.locator("#search").fill("abc");
      const beforeSearch = await viewer.viewBox();
      await page.keyboard.press("ArrowLeft");
      expect(await viewer.viewBox()).toBe(beforeSearch);
      expect(await page.locator("#search").evaluate((e) => e.selectionStart)).toBe(2);
      await page.evaluate(() => window.viewer.command("toggle-edit"));
      await page.locator("#tab-netlist").click();
      const editor = page.locator("textarea").first();
      await editor.focus();
      const beforeEdit = await viewer.viewBox();
      await page.keyboard.press("ArrowDown");
      expect(await viewer.viewBox()).toBe(beforeEdit);
      await viewer.open("pick", query);
      const p = await viewer.overlap("R1", "R2");
      await page.mouse.click(p.x, p.y);
      await expect(page.locator("#pick-list")).toBeVisible();
      const beforePick = await viewer.viewBox();
      const active = await page.locator("#pick-list").getAttribute("aria-activedescendant");
      await page.keyboard.press("ArrowDown");
      expect(await viewer.viewBox()).toBe(beforePick);
      expect(await page.locator("#pick-list").getAttribute("aria-activedescendant")).not.toBe(active);
    });

    test("review screenshots of the same selected circuit", async ({ page, viewer }, info) => {
      await viewer.open("04-hierarchy", query);
      await viewer.click("X2");
      await page.mouse.move(1, 1);
      const out = process.env.RNL_REVIEW_DIR || info.outputDir;
      await fs.mkdir(out, { recursive: true });
      for (const mode of ["light", "dark"]) {
        await page.evaluate((m) => window.viewer.command(`background-${m}`), mode);
        await page.screenshot({ path: `${out}/${platform}-${info.project.name}-${mode}.png` });
      }
    });
  });
}
