# RNL brand assets

The source is [rnl-logo.sp](rnl-logo.sp), copied unchanged from the original RNL 0.3 logo.
It defines its own symbols and styles and contains no text. Keep its circuit and line weights intact.

| File | Use |
| --- | --- |
| `rnl-logo.sp` | Editable source; render with the RNL CLI |
| `rnl-logo.svg` | Transparent original colours for light backgrounds |
| `rnl-logo-dark.svg` | Transparent colours for dark backgrounds, using the viewer's `darkColour` rule |
| `rnl-icon.svg` | 1024-unit icon, dark logo on `#14345c`, corner radius 180 |
| `rnl-icon-1024.png` | Chromium rasterization used as Tauri's input |

The transparent logos have 6% of the painted width as padding on every side, including strokes.
The icon centres the painted bounds and makes their longer side 72% of the canvas.
No small-size variant changes the circuit or thickens its strokes.

## Regeneration

From the repository root, install the existing tools once:

```sh
cargo build -p rnl-cli
npm ci --prefix tests/viewer
node tests/viewer/node_modules/@playwright/test/cli.js install chromium
npm ci --prefix apps/desktop
```

Then regenerate everything with one command:

```sh
node scripts/brand.mjs
```

The script uses `target/debug/rnl` (`rnl.exe` on Windows); `RNL_BIN` can select another freshly built CLI.
It invokes the installed Tauri CLI's `icon` command, equivalent to `npx tauri icon`, in a temporary
folder and copies only the five icons listed in `apps/desktop/tauri.conf.json`. Unused Appx,
Android and iOS outputs are discarded; the bundle configuration stays unchanged.
Tauri's ICNS resource blocks arrive in a random order, so the script sorts them by type without
changing any image payload. This makes that file reproducible as well.

The same command also updates:

- `site/src/assets/favicon.svg`, `favicon-32.png` and `apple-touch-icon.png` (180px).
- `apps/viewer-ui/icons/`: copies of those favicons, carried into the web viewer by its existing build.
- `site/src/assets/brand/`: copies of both transparent logos for the homepage.

The site keeps these generated copies in its source assets so its Python-only build and downloadable
zip work without Rust or Chromium. `site/build.py` publishes them under both `zh/assets/` and
`en/assets/`, and embeds them as data URLs in the standalone pages, which still work offline.
Normal site and viewer pages use relative icon paths, including when hosted under `/rnl/`.
The standard page template uses the public site's English asset URLs so its downloadable HTML,
version pages and comparison pages share the same icons without changing the standard publisher.

The homepage's `.hero-logo` is decorative (`alt=""`). CSS follows the same `html[data-theme]`
and system preference rules as the site; it has no click action. Its `cap`-based image height
accounts for the SVG padding, matching the painted height to the wordmark's capital letters
(about `.70em` in the site's display font, with an `em` fallback).

## Renderer regression check

```sh
node --test scripts/brand.test.mjs
```

Pages CI runs this after building the current CLI and installing its existing Playwright Chromium.
It rerenders and crops the source, compares `rnl-logo.svg` byte for byte, and also checks the dark
derivative. Renderer output changes fail with `run node scripts/brand.mjs and review the logo`.
Regenerate when that check fails, then inspect the new logos and small icons before committing.
The colour test compares the copied helper against `apps/viewer-ui/background.js`, including
threshold boundaries, short hex values and alpha. PNG, ICO and ICNS files are not compared in CI.

The site's Chromium and WebKit checks cover the homepage themes, narrow layout and favicon URLs.
For visual review, compare 16, 24, 32, 48 and 256px icons on light and dark backgrounds.

`rnl check brand/rnl-logo.sp`: **0 errors, 0 warnings, 5 hints**. The hints identify intentional
overrides of `$base`, `$signal`, `$NMOS`, `$GROUND_SYMBOL` and `$JUNCTION_SYMBOL` from the standard
package. The source is preserved rather than changing it to silence those hints.
