# site

A static introduction page, in Chinese and English, for circuit designers who have not worked on EDA tooling: what RNL is, the problem it addresses, the goal, before/after scenarios, the planned toolchain, the settled principles, the language, and a few examples.

**Status:** an explainer, not a specification. The RNL snippets follow the language discussion's current 1.16 scheme (2026-09-29), which is not yet written into [`spec/`](../spec/README.md); the page says so. Layouts in the drawings are placed by hand, not produced by a solver.

## One source, two languages

Both pages are built from the single source in `src/`. Every piece of text a reader sees is written once per language, next to each other:

```html
<h2><zh>同一件事，两种做法。</zh><en>Same task, two ways.</en></h2>
<button aria-label="<zh>切换配色</zh><en>Switch color theme</en>">…</button>
```

```js
cap: '<zh><b>只有网表</b>：网表里只有器件和连接。</zh><en><b>Netlist only</b>: the netlist holds only devices and connections.</en>'
```

The same markup works in HTML text, attribute values, and JavaScript strings. Structure, drawings, and behavior exist once, so a change to the layout or to a demo applies to both languages at the same time.

When you edit text:

- Change both blocks of a group together. A group is a `<zh>` block followed by an `<en>` block, with only whitespace between them. A long group can put `<en>` on the next line.
- An empty block is allowed where one language needs no text, for example `<zh>Host adapter</zh><en></en>` for a gloss the English page does not need.
- For a phrase with a number or name in it, translate the whole phrase and use a placeholder, as `fill('<zh>交叉 {crossings} 处</zh><en>{crossings} crossings</en>', m)` does in `intro.js`, rather than splitting it into fragments.
- Code comments are in English and are not translated.

`build.py` refuses to build when a text is missing a language or has a stray language tag, and when Chinese characters reach the English page (except elements marked `lang="zh-CN"`, such as the language switch). [`pages.yml`](../.github/workflows/pages.yml) runs the build on every pull request that touches `site/`, so an unpaired text fails the check before it is merged.

## Building and viewing

From the repository root, with Python 3 and nothing else:

```bash
python site/build.py            # write site/dist/ (ignored by Git)
python site/build.py --check    # check the sources only
python site/build.py --zip rnl-intro.zip   # also pack the built site
```

Then open `site/dist/index.html` (Chinese) or `site/dist/en/index.html` (English) in a browser, or serve `site/dist/` with any static server. Fonts load from Google Fonts and fall back to system fonts offline.

| Output in `site/dist/` | Content |
| --- | --- |
| `index.html`, `assets/` | Chinese page, at the site root |
| `en/index.html`, `en/assets/` | English page |
| `rnl-intro-standalone.html`, `en/rnl-intro-standalone.html` | Single-file pages with the styles and scripts inlined; their language switch links to the published site |

[`pages.yml`](../.github/workflows/pages.yml) publishes `site/dist/` to GitHub Pages whenever `site/` changes on `main`. The language switch keeps the reader on the same section.

## Files

| Path | Content |
| --- | --- |
| `src/index.html` | Page structure and text |
| `src/assets/intro.css` | Styles: light and dark palettes, narrow-screen layout, no animation under `prefers-reduced-motion`, fonts per language |
| `src/assets/schem.js` | Small schematic renderer: self-drawn textbook symbols, the eight orientation codes, pin-based wiring, animated layout transitions, annotation layer |
| `src/assets/rnl-code.js` | Display-only highlighting of SPICE lines and `@RNL` records, and code-line/drawing cross-highlighting |
| `src/assets/scenes.js` | Circuits, layouts, wiring, annotations, and example files for each demo |
| `src/assets/intro.js` | Section interactions |
| `build.py` | Builds both languages, the single-file pages, and the optional zip; checks the language pairs |

The symbols are drawn for this page and contain no Analog Canvas material. Like other paths outside `spec/`, `docs/`, and the data directories, this directory is licensed under [MIT](../LICENSE).
