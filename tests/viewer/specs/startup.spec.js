import { expect, test } from "../viewer.js";

for (const colorScheme of ["light", "dark"]) {
  test(`startup paints before stylesheets and modules arrive (${colorScheme})`, async ({ page, viewer }) => {
    await page.emulateMedia({ colorScheme });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route(/\/(?:style\.css|fonts\/fonts\.css|main\.js|startup\.js)$/, async route => {
      await gate;
      await route.continue();
    });
    await page.route("**/about.json", route => route.fulfill({ json: { version: "9.8.7" } }));
    try {
      await page.goto(`${process.env.RNL_VIEWER_URL}/index.html?shell=fake`, { waitUntil: "commit" });
      const startup = page.locator("#startup");
      await expect(startup).toBeVisible();
      await expect(startup.locator("strong")).toHaveText("RNL Viewer");
      await expect(page.locator("#app")).toBeHidden();
      const layout = await startup.evaluate(async el => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const box = el.querySelector("strong").getBoundingClientRect();
        return { center: box.x + box.width / 2, viewport: innerWidth,
          font: getComputedStyle(el.querySelector("strong")).fontSize, background: getComputedStyle(el).backgroundColor };
      });
      expect(layout.center).toBeCloseTo(layout.viewport / 2, 0);
      expect(layout.font).toBe("28px");
      expect(layout.background).toBe(colorScheme === "dark" ? "rgb(31, 31, 34)" : "rgb(244, 244, 242)");
    } finally { release(); }
    await viewer.started();
    await expect(page.locator("#startup")).toHaveCount(0);
    await expect(page.locator("#app")).toBeVisible();
    await expect(page.locator("#viewer-style")).toHaveAttribute("media", "all");
  });
}

test("a failed main stylesheet reveals the startup error instead of hanging", async ({ page }) => {
  await page.route("**/style.css", route => route.abort());
  await page.goto(`${process.env.RNL_VIEWER_URL}/index.html?shell=fake`);
  await expect(page.locator("#startup")).toHaveCount(0);
  await expect(page.locator("#empty")).toContainText("The viewer stylesheet could not be loaded.");
});
