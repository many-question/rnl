// Large files keep the complete text/model and only a viewport plus overscan in the DOM.
// Small files retain their ordinary DOM, including native browser text selection.
import { VirtualSelection } from "./virtual-selection.js";

const LIMIT = 1000;
const OVERSCAN = 40;

export class LineWindow {
  constructor(source, model, decorate) {
    this.source = source;
    this.model = model;
    this.decorate = decorate;
    this.el = document.createElement("div");
    this.el.className = "file";
    this.el.dataset.lineCount = String(model.texts.length);
    this.gutter = Math.max(4.5, String(model.texts.length).length + 1.4);
    this.el.style.setProperty("--line-number-width", `${this.gutter}em`);
    this.el.hidden = true;
    this.lines = new Array(model.texts.length);
    this.rendered = new Map();
    this.scroll = 0;
    this.height = parseFloat(getComputedStyle(source).lineHeight) || 19.375;
    this.virtual = model.texts.length > LIMIT;
    this.first = 0;
    this.last = -1;
    if (this.virtual) {
      this.el.classList.add("virtual-file");
      this.before = document.createElement("div");
      this.after = document.createElement("div");
      this.before.className = this.after.className = "line-spacer";
      this.before.setAttribute("aria-hidden", "true");
      this.after.setAttribute("aria-hidden", "true");
      this.rows = document.createElement("div");
      this.el.append(this.before, this.rows, this.after);
      this.after.style.height = `${model.texts.length * this.height}px`;
      this.selection = new VirtualSelection(this);
    } else this.rows = this.el;
  }

  lineHeight() {
    // Rect edges lose subpixel precision millions of pixels from the viewport. CSS's used height
    // stays stable, including fractional line heights, when the scrollbar jumps across a huge file.
    const row = this.rendered.values().next().value;
    const measured = row && parseFloat(getComputedStyle(row).height);
    return measured || this.height;
  }

  refresh(force = false) {
    if (this.el.hidden && this.virtual) return;
    const source = this.source;
    this.selection?.syncNative();
    const height = this.lineHeight(), heightChanged = height !== this.height;
    this.height = height;
    const count = this.model.texts.length;
    const first = this.virtual ? Math.min(Math.max(0, count - 1), Math.max(0, Math.floor((source.scrollTop - 4) / this.height) - OVERSCAN)) : 0;
    const last = this.virtual ? Math.min(count - 1, Math.ceil((source.scrollTop + source.clientHeight) / this.height) + OVERSCAN) : count - 1;
    if (!force && !heightChanged && this.first === first && this.last === last) return;
    const scroll = source.scrollTop;
    this.first = first;
    this.last = last;
    for (const [i, el] of this.rendered) {
      if (i >= first && i <= last) continue;
      el.remove();
      this.rendered.delete(i);
      delete this.lines[i];
    }
    let at = this.rows.firstChild;
    for (let i = first; i <= last; i++) {
      let el = this.rendered.get(i);
      if (!el) {
        el = this.model.render(i);
        this.decorate(el, i + 1);
        this.rendered.set(i, el);
        this.lines[i] = el;
      } else if (force) this.decorate(el, i + 1);
      if (el !== at) this.rows.insertBefore(el, at);
      at = el.nextSibling;
    }
    if (this.virtual) {
      this.before.style.height = `${first * this.height}px`;
      this.after.style.height = `${Math.max(0, count - last - 1) * this.height}px`;
      // Keep horizontal extent stable when a wide line scrolls out of the DOM.
      const style = getComputedStyle(source), fontSize = parseFloat(style.fontSize);
      this.width ??= this.model.columns * fontSize * 0.62 + fontSize * (this.gutter + 2.8) + 3;
      for (const el of this.rendered.values()) this.width = Math.max(this.width, el.scrollWidth);
      this.el.style.minWidth = `${Math.ceil(this.width)}px`;
      source.scrollTop = scroll;
      this.selection.paint();
    }
  }

  reveal(line, atTop = false) {
    const n = Math.max(0, Math.min(this.model.texts.length - 1, line - 1));
    const top = this.virtual ? 4 + n * this.height : this.lines[n]?.offsetTop;
    if (top === undefined) return;
    this.source.scrollTop = Math.max(0, atTop ? top - 4 : top - this.source.clientHeight / 2 + this.height / 2);
    this.refresh();
    return this.lines[n];
  }

  destroy() { this.selection?.destroy(); }
}
