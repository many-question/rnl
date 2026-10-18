// Session file pool and the desktop's ordered search paths.
import { inform } from "./dialog.js";
import { changes } from "./edits.js";
import { currentSource, isLoading, openSource } from "./open.js";
import { setPane, setSidebar } from "./panels.js";
import { shell } from "./shell.js";
import { $, load, save, settingsPath } from "./util.js";

let items = [];
let changing = false;

function button(label, action, title = label) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.title = title;
  b.setAttribute("aria-label", title);
  b.addEventListener("click", action);
  return b;
}

async function update(action) {
  if (changing || isLoading()) return;
  changing = true;
  try {
    if (await action() === false) return false;
    shell.setPool?.(items);
    render();
    // Keep edits and the current view, rebuilding only the text already applied.
    if (currentSource()) await openSource(currentSource(), true, changes(true));
    return true;
  } catch (e) {
    render();
    await inform({ title: "Files and search paths", paragraphs: [String(e)] });
  } finally {
    changing = false;
  }
}

export async function includeFiles(kind) {
  if (!shell.include) return;
  const changed = await update(async () => {
    const added = await shell.include(kind);
    if (!added.length) return false;
    for (const item of added) {
      const at = items.findIndex((old) => old.path === item.path && !old.builtin);
      if (at < 0) items.push(item);
      else items[at] = item;
    }
  });
  if (changed) { setSidebar(true); setPane("files"); }
}

function render() {
  const list = $("pool-list");
  list.replaceChildren();
  for (const item of [...items.filter((i) => !i.builtin), ...items.filter((i) => i.builtin)]) {
    const row = document.createElement("li");
    row.className = "pool-row";
    row.dataset.path = item.path;
    const open = button(item.name, async () => {
      await openSource(item.source, false);
      if (currentSource() === item.source) setPane("netlist");
    }, `Open ${item.name}`);
    open.className = "pool-open";
    row.append(open);
    if (item.builtin) {
      const badge = document.createElement("span");
      badge.className = "pool-badge";
      badge.textContent = "Built-in · read only";
      row.append(badge);
    } else {
      row.append(button("Exclude", () => update(() => { items = items.filter((i) => i !== item); }), `Exclude ${item.name}`));
    }
    list.append(row);
  }
  renderPaths();
}

function paths() {
  const value = load("search-paths", []);
  return Array.isArray(value) ? value.filter((p) => typeof p === "string") : [];
}

function renderPaths() {
  $("path-list").replaceChildren();
  $("add-path").hidden = !shell.pickPath;
  $("path-note").textContent = shell.pickPath
    ? `Searched in this order, after relative paths and the file pool. Settings: ${settingsPath}`
    : "Browsers cannot search local directories. Include files or folders above; the file pool lasts until this page closes.";
  if (!shell.pickPath) return;
  paths().forEach((path, index, all) => {
    const row = document.createElement("li");
    row.className = "pool-row";
    const label = document.createElement("span");
    label.className = "pool-open";
    label.textContent = path;
    label.title = path;
    row.append(label);
    for (const [name, delta] of [["Up", -1], ["Down", 1]]) {
      const move = button(name, () => update(async () => {
        const next = paths();
        [next[index], next[index + delta]] = [next[index + delta], next[index]];
        await save("search-paths", next);
      }), `${name}: ${path}`);
      move.disabled = index + delta < 0 || index + delta >= all.length;
      row.append(move);
    }
    row.append(button("Remove", () => update(() => save("search-paths", paths().filter((_, k) => k !== index))), `Remove ${path}`));
    $("path-list").append(row);
  });
}

export async function startPool() {
  if (shell.bundledFiles) {
    const bundled = await shell.bundledFiles();
    items = Object.entries(bundled).map(([path, text]) => ({ path, name: path.replace("<bundled>/", ""), builtin: true,
      source: { path, name: path, text: shell.platform === "web" ? text : undefined, readonly: true } }));
  }
  $("include-file").addEventListener("click", () => includeFiles("file"));
  $("include-folder").addEventListener("click", () => includeFiles("folder"));
  $("include-library").hidden = !shell.includeLibrary;
  $("include-library").addEventListener("click", () => includeFiles("library"));
  $("add-path").addEventListener("click", () => update(async () => {
    const path = await shell.pickPath();
    if (!path || paths().includes(path)) return false;
    await save("search-paths", [...paths(), path]);
  }));
  shell.onInclude?.((added) => update(() => {
    for (const item of added) {
      const at = items.findIndex((old) => old.path === item.path);
      if (at < 0) items.push(item); else items[at] = item;
    }
    setSidebar(true);
    setPane("files");
  }));
  window.addEventListener("settings-error", (event) => {
    $("path-note").textContent = `Settings could not be saved: ${event.detail}`;
  });
  render();
}
