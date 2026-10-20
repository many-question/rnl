// The text pane: the netlist and the files it includes, highlighted, with the statements that do
// not take effect marked, and the places of the selected object. Clicking a name or a statement in
// the text selects its object; double-clicking a subcircuit instance opens it. While a subcircuit
// is drawn, the text outside its definition is dimmed.

import { doc, selected } from "./state.js";
import { clearEditors, editing, focusEditor, renderEditors, revealInEditor, showEditor } from "./editor.js";
import { clearSelection, select } from "./selection.js";
import { descend, opens } from "./subcircuits.js";
import { lineModel } from "./text-lines.js";
import { LineWindow } from "./line-window.js";
import { TextFind } from "./text-find.js";
import { $ } from "./util.js";

const app = $("app");
const source = $("source");
const netlistPane = $("pane-netlist");
const tabs = $("file-tabs");

export let fileShown = 0; // the file in the text pane
export let fileViews = []; // per file: a LineWindow with text data, rendered rows and saved scroll
let lineOwners = []; // per file: line number -> the instance whose statement it is
let pendingReveal = null; // a line to bring into view once the text pane is shown
let scope = null; // the definition of the subcircuit drawn: { f, from, to }, its file and lines
let notDrawn = []; // per file: line number -> why its statement is not drawn
const find = new TextFind(() => fileViews[fileShown], n => revealLine(fileShown, n, false));

/** Edit > Find in Netlist, routed through the shared command table like the other page commands. */
export async function findInSource() {
  if (!doc || editing || document.querySelector("dialog[open]")) return;
  const { setPane, setSidebar } = await import("./panels.js");
  setSidebar(true);
  setPane("netlist");
  find.open();
}

/** Mark the selected object's places in the text; with `reveal`, scroll to where it is named. */
export function paintSourceSelection(reveal) {
  repaintLines();
  if (!reveal || selected === null || !doc) return;
  const spans = doc.spans.filter((s) => s.object === selected);
  const target = spans.find((s) => s.kind === "name") || spans.find((s) => s.file === fileShown) || spans[0];
  if (target) revealLine(target.file, target.line, false);
}

function decorateLine(f, n, el) {
  const obj = selected === null || !doc ? null : doc.objects[selected];
  el.classList.toggle("hl-line", !!obj?.lines && obj.lines[0] === f && n >= obj.lines[1] && n <= obj.lines[2]);
  for (const span of el.querySelectorAll("[data-obj]")) span.classList.toggle("hl", span.dataset.obj.split(" ").includes(String(selected)));
  el.classList.toggle("in-scope", !!scope && scope.f === f && n >= scope.from && n <= scope.to);
  const reason = notDrawn[f]?.get(n);
  el.classList.toggle("not-drawn", reason !== undefined);
  if (reason !== undefined) el.title = reason;
  else el.removeAttribute("title");
  const severity = fileViews[f]?.diagnostics?.get(n);
  for (const kind of ["error", "warning", "hint"]) el.classList.toggle(`d-${kind}`, severity === kind);
}

function repaintLines() {
  fileViews.forEach((view, f) => { for (const [i, el] of view.rendered) decorateLine(f, i + 1, el); });
}

/** Store diagnostics by logical line, including rows outside the viewport. */
export function markSourceDiagnostics(worst) {
  for (const view of fileViews) view.diagnostics = new Map();
  for (const [key, severity] of worst) {
    const [f, n] = key.split(":").map(Number);
    fileViews[f]?.diagnostics.set(n, severity);
  }
  repaintLines();
}

/** The actual line height even when line 1 has been recycled out of the DOM. */
export const sourceLineHeight = (f) => fileViews[f]?.lineHeight() || 19.375;

export function refreshSource() {
  if (!editing) fileViews[fileShown]?.refresh();
}
let scrollFrame = 0;
source.addEventListener("scroll", () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; refreshSource(); });
}, { passive: true });
new ResizeObserver(refreshSource).observe(source);
source.addEventListener("keydown", e => { if (!editing) fileViews[fileShown]?.selection?.key(e); });
source.addEventListener("copy", e => { if (!editing) fileViews[fileShown]?.selection?.copy(e); });
document.addEventListener("pointerdown", e => {
  if (!source.contains(e.target)) fileViews[fileShown]?.selection?.clear();
});

export function clearSource(message) {
  find.close(false);
  clearEditors();
  for (const view of fileViews) view.destroy();
  scope = null;
  notDrawn = [];
  source.classList.remove("scoped");
  fileViews = [];
  lineOwners = [];
  tabs.replaceChildren();
  source.replaceChildren();
  const p = document.createElement("p");
  p.className = "placeholder";
  p.textContent = message;
  source.append(p);
}

export function renderFiles() {
  for (const view of fileViews) view.destroy();
  source.replaceChildren();
  scope = null;
  notDrawn = doc.files.map(() => new Map());
  source.classList.remove("scoped");
  fileViews = [];
  lineOwners = doc.files.map(() => new Map());
  doc.objects.forEach((o, k) => {
    if (o.kind !== "instance" || !o.lines) return;
    const [f, a, b] = o.lines;
    for (let n = a; n <= b; n++) lineOwners[f].set(n, k);
  });
  tabs.replaceChildren();
  doc.files.forEach((file, f) => {
    const view = new LineWindow(source, lineModel(file, f, doc.spans, doc.dialect), (el, n) => decorateLine(f, n, el));
    fileViews.push(view);
    source.append(view.el);
    if (!view.virtual) view.refresh();
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = file.name.split(/[\\/]/).pop();
    b.title = file.path;
    b.addEventListener("click", () => {
      showFile(f);
      focusEditor();
    });
    tabs.append(b);
  });
  renderEditors();
  if (doc.files.length === 0) clearSource("This document has no host file to show.");
}

export function showFile(f) {
  if (!fileViews[f]) return;
  if (fileViews[fileShown] && fileShown !== f) fileViews[fileShown].scroll = source.scrollTop;
  fileViews.forEach((v, k) => { v.el.hidden = k !== f || editing; });
  [...tabs.children].forEach((b, k) => b.setAttribute("aria-selected", String(k === f)));
  fileShown = f;
  showEditor(f);
  if (editing) find.close(false);
  source.classList.toggle("virtualized", fileViews[f].virtual && !editing);
  if (!editing) fileViews[f].refresh();
  source.scrollTop = fileViews[f].scroll;
  refreshSource();
  tabInView(tabs.children[f]);
  find.changed();
}

// The file tabs scroll sideways with no scrollbar: the tab of the file shown is kept in view, and a
// wheel turned over them scrolls them, as a sideways swipe does.

/**
 * Scroll the file tabs, when they must, so that `tab` is in view, or as much of it as fits. They
 * scroll by whole pixels, rounded to bring the tab's edge in, as WebKit cuts a scroll to whole pixels.
 */
function tabInView(tab) {
  const [s, t] = [tabs.getBoundingClientRect(), tab.getBoundingClientRect()];
  if (t.left < s.left) tabs.scrollLeft -= Math.ceil(s.left - t.left);
  else if (t.right > s.right) tabs.scrollLeft += Math.min(Math.ceil(t.right - s.right), Math.floor(t.left - s.left));
}

tabs.addEventListener(
  "wheel",
  (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || tabs.scrollWidth <= tabs.clientWidth) return;
    e.preventDefault();
    tabs.scrollLeft += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * tabs.clientWidth : e.deltaY;
  },
  { passive: false },
);

/** Whether the text pane is on screen, so that lines can be scrolled to. */
function sourceShown() {
  return !app.classList.contains("sidebar-hidden") && !netlistPane.hidden;
}

/**
 * Show a line of a file in the middle of the text pane, or with `atTop` at its top; with `flash`,
 * blink it. While the text pane is hidden, the line, and its file, wait until it is shown again: a
 * hidden pane has no scroll to keep for the file it leaves.
 */
export function revealLine(f, line, flash, atTop = false) {
  if (f === null || f === undefined || !fileViews[f] || !line) return;
  if (!sourceShown()) {
    pendingReveal = { f, line, flash, atTop };
    return;
  }
  pendingReveal = null;
  showFile(f);
  if (editing) {
    revealInEditor(f, line);
    return;
  }
  const el = fileViews[f].reveal(line, atTop);
  if (!el) return;
  if (flash) {
    el.classList.remove("flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("flash");
  }
}

export function revealPending() {
  if (pendingReveal && sourceShown()) {
    const { f, line, flash, atTop } = pendingReveal;
    revealLine(f, line, flash, atTop);
  }
}

/**
 * Dim the text outside the definition of the subcircuit that level `i` draws, from its header to its
 * end; at a file level, or with none, nothing is dimmed.
 */
export function scopeSource(i) {
  const lines = doc && doc.levels[i] ? doc.levels[i].lines : null;
  scope = lines ? { f: lines[0], from: lines[1], to: lines[2] } : null;
  repaintLines();
  source.classList.toggle("scoped", scope !== null);
}

/**
 * Grey the statements of the objects of level `i` that are not drawn, those that have no position
 * and those that cannot be drawn at all, the way the text outside the subcircuit drawn is dimmed;
 * the statements of the level drawn before are no longer greyed.
 */
export function markUnplaced(i) {
  notDrawn = fileViews.map(() => new Map());
  const level = doc && doc.levels[i];
  for (const u of level?.unplaced || []) {
    for (const o of u.objects) {
      const lines = doc.objects[o].lines;
      if (!lines) continue;
      const [f, from, to] = lines;
      for (let n = from; n <= to; n++) notDrawn[f]?.set(n, u.reason ? `Not drawn: ${u.reason}` : "Not drawn: it has no position yet");
    }
  }
  repaintLines();
}

/** Bring the start of the definition of the subcircuit that level `i` draws to the top of the text. */
export function revealDefinition(i) {
  const lines = doc && doc.levels[i] ? doc.levels[i].lines : null;
  if (lines) revealLine(lines[0], lines[1], false, true);
}

source.addEventListener("click", (e) => {
  if (!doc || String(window.getSelection())) return; // selecting text is not a click
  const s = e.target.closest("[data-obj]");
  if (s) {
    // the first object of a place is the one written most narrowly: `#M1` in `#M1:d` is M1
    select(Number(s.dataset.obj.split(" ")[0]), "source", { newWindow: e.shiftKey });
    return;
  }
  const ln = e.target.closest(".ln");
  const owner = ln ? lineOwners[fileShown].get(Number(ln.dataset.line)) : undefined;
  if (owner !== undefined) select(owner, "source", { newWindow: e.shiftKey });
  else clearSelection();
});

source.addEventListener("dblclick", (e) => {
  if (!doc) return;
  const s = e.target.closest("[data-obj]");
  const ln = e.target.closest(".ln");
  const o = s
    ? s.dataset.obj.split(" ").map(Number).find((k) => opens(k) !== null)
    : ln ? lineOwners[fileShown].get(Number(ln.dataset.line)) : undefined;
  if (opens(o) === null) return;
  window.getSelection().removeAllRanges(); // the word the double click selected
  fileViews[fileShown]?.selection?.clear();
  descend(o, { newWindow: e.shiftKey });
});
