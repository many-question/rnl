import fs from "node:fs/promises";
import { expect, test } from "../viewer.js";

const frames = (page) => page.locator("#canvas > svg .overlay rect:not(.label)");
const circles = (page) => page.locator("#canvas > svg .overlay circle");

async function exactFrame(page, points) {
  const rect = frames(page);
  await expect(rect).toHaveCount(1);
  const [[x0, y0], [x1, y1]] = points;
  const drawn = await rect.evaluate((r) => ["x", "y", "width", "height"].map((k) => Number(r.getAttribute(k))));
  for (const [i, want] of [x0, y0, x1 - x0, y1 - y0].entries()) expect(Math.abs(drawn[i] - want)).toBeLessThanOrEqual(1e-6);
  await expect(rect).toHaveAttribute("vector-effect", "non-scaling-stroke");
  await expect(rect).toHaveCSS("stroke-width", "1.5px");
}

async function screenshot(page, info, platform, name, mode) {
  if (info.project.name !== "chromium" || !process.env.RNL_REVIEW_DIR) return;
  await fs.mkdir(process.env.RNL_REVIEW_DIR, { recursive: true });
  await page.keyboard.press("f");
  await page.mouse.move(1, 1);
  await page.screenshot({ path: `${process.env.RNL_REVIEW_DIR}/${platform}-${name}-${mode}.png` });
}

for (const platform of ["web", "desktop"]) {
  for (const name of ["ground", "supply", "port", "junction"]) {
    test(`${platform}: ${name} selects only its own exact box at both zooms and backgrounds`, async ({ page, viewer }, info) => {
      await viewer.open("virtual-selection", { platform });
      await viewer.click(`%${name}`);
      await viewer.selected(`usage %${name} in virtual-selection.sp`);
      const points = await page.evaluate(() => {
        const v = window.viewer;
        return v.doc.levels[v.level].hits.find((h) => h.kind === "box" && h.objects[0] === v.selected).points;
      });
      for (const mode of ["light", "dark"]) {
        await page.evaluate((mode) => window.viewer.command(`background-${mode}`), mode);
        await page.keyboard.press("f");
        const fitted = await viewer.viewBox();
        for (const key of [null, "Control+="]) {
          if (key) {
            await page.keyboard.press(key);
            await expect.poll(() => viewer.viewBox()).not.toBe(fitted);
          }
          await exactFrame(page, points);
          await expect(circles(page)).toHaveCount(0);
          await expect(page.locator("#enter-badge")).toBeHidden();
        }
        if (name === "ground" || name === "port") await screenshot(page, info, platform, name, mode);
      }
      await viewer.build(() => page.keyboard.press("F5"));
      await viewer.selected(`usage %${name} in virtual-selection.sp`);
      await exactFrame(page, points);
      // Clearing the selection removes the frame, including a junction with no associated net.
      await page.keyboard.press("Escape");
      await viewer.selected(null);
      await expect(frames(page)).toHaveCount(0);
    });
  }

  test(`${platform}: a wire selects its network without framing its virtual symbols`, async ({ page, viewer }, info) => {
    await viewer.open("virtual-selection", { platform });
    await viewer.click("%ground");
    await expect(frames(page)).toHaveCount(1);
    await viewer.click("rail", "wire");
    await viewer.selected("net rail in virtual-selection.sp");
    const counts = await page.evaluate(() => {
      const v = window.viewer;
      const hits = v.doc.levels[v.level].hits.filter((h) => h.objects.includes(v.selected));
      return { symbols: hits.filter((h) => h.kind === "box").length, pins: hits.filter((h) => h.kind === "pin").length };
    });
    expect(counts.symbols).toBe(3); // Two grounds and a supply share rail.
    expect(counts.pins).toBeGreaterThan(0);
    for (const mode of ["light", "dark"]) {
      await page.evaluate((mode) => window.viewer.command(`background-${mode}`), mode);
      await expect(frames(page)).toHaveCount(0);
      await expect(circles(page)).toHaveCount(counts.pins);
      await expect(page.locator("#enter-badge")).toBeHidden();
      await screenshot(page, info, platform, "wire", mode);
    }
  });

  test(`${platform}: virtual labels still select the net and named symbols keep their hover name`, async ({ page, viewer }) => {
    await viewer.open("virtual-selection", { platform });
    const p = await viewer.where("%supply");
    await page.mouse.move(p.x, p.y);
    await expect(page.locator("#hover-tip")).toHaveText("supply");
    const id = await page.evaluate(() => {
      const v = window.viewer;
      const usage = v.doc.objects.findIndex((o) => o.kind === "usage" && o.name === "%supply");
      const label = v.doc.levels[v.level].hits.find((h) => h.kind === "label" && h.objects.includes(usage));
      if (v.doc.objects[label.objects[0]].kind !== "net") throw new Error("usage label must keep its net first");
      return label.id;
    });
    const label = await viewer.labelWhere(id);
    await page.mouse.click(label.x, label.y);
    await viewer.selected("net rail in virtual-selection.sp");
    await expect(frames(page)).toHaveCount(0);
    await expect(page.locator("#canvas > svg .overlay rect.label")).not.toHaveCount(0);
  });

  test(`${platform}: an instance keeps its exact frame and opens its subcircuit`, async ({ page, viewer }) => {
    await viewer.open("virtual-selection", { platform });
    await viewer.click("X1");
    await viewer.selected("instance X1 in virtual-selection.sp");
    const points = await page.evaluate(() => {
      const v = window.viewer;
      return v.doc.levels[v.level].hits.find((h) => h.kind === "box" && h.objects[0] === v.selected).points;
    });
    await exactFrame(page, points);
    await expect(circles(page)).toHaveCount(0);
    await expect(page.locator("#enter-badge")).toBeVisible();
    await page.locator("#enter-badge").click();
    await expect(page.locator("#level-name")).toHaveText("cell");
  });
}
