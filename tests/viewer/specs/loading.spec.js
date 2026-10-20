import { expect, test } from "../viewer.js";

test("loading reports stages without a percentage and clears when the document is painted", async ({ page, viewer }) => {
  await viewer.open();
  await page.evaluate(async () => {
    const { shell } = await import('./shell.js');
    const build = shell.build;
    shell.build = async (source, edits, progress) => {
      await new Promise(resolve => window.finishReading = resolve);
      progress('parsing');
      await new Promise(resolve => window.finishParsing = resolve);
      return build(source, edits);
    };
    window.loadingStages = [];
    new MutationObserver(() => window.loadingStages.push(document.getElementById('loading').dataset.stage))
      .observe(document.getElementById('loading'), { attributes: true, attributeFilter: ['data-stage'] });
    window.fakeShell.open('04-hierarchy');
  });
  const loading = page.locator('#loading');
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('data-stage', 'reading');
  await expect(loading.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'true');
  await page.waitForFunction(() => window.finishReading);
  await page.evaluate(() => window.finishReading());
  await expect(loading).toHaveAttribute('data-stage', 'parsing');
  await page.evaluate(() => window.finishParsing());
  await viewer.idle();
  await expect(loading).toBeHidden();
  await expect(page.locator('#app')).not.toHaveAttribute('aria-busy');
  expect(await page.evaluate(() => window.loadingStages)).toContain('displaying');
});

test("a failed open clears its loading indicator and still reports the error", async ({ page, viewer }) => {
  await viewer.open();
  await page.evaluate(() => { window.fakeShell.fail = 'cannot read fixture'; window.fakeShell.open('04-hierarchy'); });
  await expect(page.locator('#diags')).toContainText('cannot read fixture');
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#app')).not.toHaveAttribute('aria-busy');
});
