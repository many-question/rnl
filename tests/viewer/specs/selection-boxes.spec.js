import fs from "node:fs/promises";
import { expect, test } from "../viewer.js";

for (const platform of ["web", "desktop"]) {
  for (const [name, kind] of [["Xexplicit", "explicit"], ["Xinferred", "inferred"]]) {
    test(`${platform}: ${kind} symbol box is the exact selection frame and the badge has a fixed pixel gap`, async ({ page, viewer }, info) => {
      await viewer.open("selection-boxes", { platform });
      await viewer.click(name);
      await viewer.selected(`instance ${name} in selection-boxes.sp`);
      const rect = page.locator("#canvas > svg .overlay rect:not(.label)");
      const badge = page.locator("#enter-badge");
      await expect(rect).toHaveCount(1);
      await expect(badge).toBeVisible();
      const points = await page.evaluate(() => {
        const v = window.viewer;
        return v.doc.levels[v.level].hits.find((h) => h.kind === "box" && h.objects.includes(v.selected)).points;
      });
      const [[x0, y0], [x1, y1]] = points;
      // The explicit box is rotated 90 degrees; the inferred box excludes its text.
      expect(x1 - x0).toBeCloseTo(kind === "explicit" ? 56 : 84, 6);
      expect(y1 - y0).toBeCloseTo(kind === "explicit" ? 84 : 28, 6);
      for (const mode of ["light", "dark"]) {
        await page.evaluate((mode) => window.viewer.command(`background-${mode}`), mode);
        if (kind === "explicit") {
          // Black fill becomes white in Dark, but retains the normal subcircuit highlight.
          await expect(page.locator("#canvas g.sel circle")).toHaveCSS("fill", "rgb(194, 37, 92)");
          await expect(page.locator("#canvas g.sel").first()).toHaveCSS("filter", "none");
        }
        await page.keyboard.press("f");
        for (const key of [null, "Control+="]) {
          if (key) await page.keyboard.press(key);
          const drawn = await rect.evaluate((r) => ["x", "y", "width", "height"].map((k) => Number(r.getAttribute(k))));
          for (const [i, want] of [x0, y0, x1 - x0, y1 - y0].entries()) expect(drawn[i]).toBeCloseTo(want, 6);
          await expect(rect).toHaveAttribute("vector-effect", "non-scaling-stroke");
          await expect(rect).toHaveCSS("stroke-width", "1.5px");
          const corner = await viewer.point(x1, y0);
          const b = await badge.boundingBox();
          // CSS layout rounds to subpixel quanta (e.g. 1/64 px); SVG geometry above stays exact.
          expect(b.x - corner.x).toBeCloseTo(4, 1);
          expect(corner.y - (b.y + b.height)).toBeCloseTo(4, 1);
          expect(b.width).toBeCloseTo(22, 3);
          expect(b.height).toBeCloseTo(22, 3);
        }
        const out = process.env.RNL_REVIEW_DIR || info.outputDir;
        await fs.mkdir(out, { recursive: true });
        await page.mouse.move(1, 1);
        await page.screenshot({ path: `${out}/${platform}-${info.project.name}-box-${kind}-${mode}.png` });
      }
      // The anchor still opens the subcircuit after zooming and changing backgrounds.
      await badge.click();
      await expect(page.locator("#level-name")).toHaveText("cell");
    });
  }
}
