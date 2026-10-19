// The problems list: the errors, warnings and hints, the most serious first; clicking one shows
// its line in the text. The line numbers of the lines they are on are coloured.

import { markSourceDiagnostics, revealLine } from "./text.js";
import { $, span } from "./util.js";
import { shell } from "./shell.js";
import { includePublicPackage } from "./pool.js";

const SEVERITY_ORDER = { error: 0, warning: 1, hint: 2 };
let renderVersion = 0;

function packageHint(d, version) {
  // Path-based includes and alias failures need different remedies. Keep the core diagnostic intact.
  const missing = /^package (\S+)(?: (\S+))? cannot be found: this USE-PACKAGE fails/.exec(d.message);
  if (!missing || d.severity !== "error") return null;
  const li = document.createElement("li");
  li.className = "diag hint package-hint";
  const message = span("msg", "Look for it in File › Include Public Package…");
  li.append(span("sev", "hint"), message);
  if (shell.platform === "desktop") {
    message.textContent = "Add the package file to Library or a PATH directory; public packages are listed on the website's ";
    const link = document.createElement("a");
    link.href = "https://rich-netlist.github.io/rnl/en/packages.html";
    link.textContent = "Packages page";
    link.addEventListener("click", (e) => { e.preventDefault(); shell.browse?.(link.href); });
    message.append(link, ".");
  } else if (shell.publicPackages) {
    shell.publicPackages().then((packages) => {
      if (version !== renderVersion || !li.isConnected) return;
      const pkg = packages.find(p => !p.builtin && p.name === missing[1] && p.version === missing[2]);
      if (!pkg) return;
      message.textContent = "This package is published. ";
      const include = document.createElement("button");
      include.type = "button";
      include.textContent = "Include";
      include.addEventListener("click", async () => {
        include.disabled = true;
        try { await includePublicPackage(pkg); }
        finally { include.disabled = false; }
      });
      message.append(include);
    }).catch(() => { /* The manual File menu hint remains available offline. */ });
  }
  return li;
}

export function renderDiagnostics(list) {
  const version = ++renderVersion;
  const sorted = list
    .map((d, i) => ({ d, i }))
    .sort((a, b) => SEVERITY_ORDER[a.d.severity] - SEVERITY_ORDER[b.d.severity] || a.i - b.i)
    .map((x) => x.d);
  const ul = $("diags");
  ul.replaceChildren();
  for (const d of sorted) {
    const li = document.createElement("li");
    li.className = `diag ${d.severity}`;
    li.append(span("sev", d.severity), span("msg", d.message));
    if (d.file) {
      const loc = span("loc", `${d.file}:${d.line}${d.col ? `:${d.col}` : ""}`);
      if (d.full_path) loc.title = d.full_path;
      li.append(loc);
    }
    if (d.origin) li.append(span("more", d.origin));
    if (d.cause) li.append(span("more", `upstream cause: ${d.cause}`));
    if (d.file_index !== null && d.file_index !== undefined && d.line) {
      li.classList.add("located");
      li.title = "Show in the netlist";
      li.addEventListener("click", () => revealLine(d.file_index, d.line, true));
    }
    ul.append(li);
    const hint = packageHint(d, version);
    if (hint) ul.append(hint);
  }
  if (sorted.length === 0) {
    const li = document.createElement("li");
    li.className = "nothing";
    li.textContent = "No errors, warnings or hints.";
    ul.append(li);
  }
  const counts = $("counts");
  counts.replaceChildren();
  const n = (s) => list.filter((d) => d.severity === s).length;
  for (const [s, one, many] of [["error", "error", "errors"], ["warning", "warning", "warnings"], ["hint", "hint", "hints"]]) {
    const k = n(s);
    if (k) counts.append(span(`n-${s}`, `${k} ${k === 1 ? one : many}`));
  }
  if (list.length === 0) counts.append(span("none", "none"));
}

/** Colour the line numbers of lines with diagnostics, by the most serious one. */
export function markDiagnostics(list) {
  const worst = new Map();
  for (const d of list) {
    if (d.file_index === null || d.file_index === undefined || !d.line) continue;
    const key = `${d.file_index}:${d.line}`;
    const was = worst.get(key);
    if (!was || SEVERITY_ORDER[d.severity] < SEVERITY_ORDER[was]) worst.set(key, d.severity);
  }
  markSourceDiagnostics(worst);
}
