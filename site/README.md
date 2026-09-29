# site

A static introduction page (in Chinese) for circuit designers who have not worked on EDA tooling: what RNL is, the problem it addresses, the goal, before/after scenarios, the planned toolchain, the settled principles, the language, and a few examples.

**Status:** an explainer, not a specification. The RNL snippets follow the language discussion's current 1.16 scheme (2026-09-29), which is not yet written into [`spec/`](../spec/README.md); the page says so. Layouts in the drawings are placed by hand, not produced by a solver.

## Viewing and publishing

- Open `index.html` in a browser; there is no build step and no dependency. Fonts load from Google Fonts and fall back to system fonts offline.
- [`pages.yml`](../.github/workflows/pages.yml) publishes the page to GitHub Pages whenever `site/` changes on `main`, together with the single-file page and the zip package as downloads. Any other static host can serve `index.html` and `assets/` as they are.
- `python site/package.py` (standard library only) writes a portable package to `site/dist/` (ignored by Git): `rnl-intro-standalone.html` with the CSS and scripts inlined, and `rnl-intro.zip` with the site folder, the single-file build, and usage notes.

## Files

| Path | Content |
| --- | --- |
| `index.html` | Page structure and text |
| `assets/intro.css` | Styles: light and dark palettes, narrow-screen layout, no animation under `prefers-reduced-motion` |
| `assets/schem.js` | Small schematic renderer: self-drawn textbook symbols, the eight orientation codes, pin-based wiring, animated layout transitions, annotation layer |
| `assets/rnl-code.js` | Display-only highlighting of SPICE lines and `@RNL` records, and code-line/drawing cross-highlighting |
| `assets/scenes.js` | Circuits, layouts, wiring, annotations, and example files for each demo |
| `assets/intro.js` | Section interactions |
| `package.py` | Builds the single-file page and the zip package |

The symbols are drawn for this page and contain no Analog Canvas material. Like other paths outside `spec/`, `docs/`, and the data directories, this directory is licensed under [MIT](../LICENSE).
