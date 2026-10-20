// Run before the main module graph is ready, so the loading screen can already name its version.
// Use each platform's existing metadata rather than keeping another version number in the page.
import { nextPaint } from "./loading.js";

// These stylesheets do not block the HTML startup screen's first paint. Activate each as it
// arrives, and initialize layout only after the main stylesheet has loaded. Fonts are optional.
function styleReady(id, required) {
  const link = document.getElementById(id);
  return new Promise((resolve, reject) => {
    const loaded = () => { link.media = "all"; resolve(); };
    if (link.sheet) { loaded(); return; }
    link.addEventListener("load", loaded, { once: true });
    link.addEventListener("error", () => required ? reject(new Error("The viewer stylesheet could not be loaded.")) : resolve(), { once: true });
    link.media = "print";
    link.rel = "stylesheet";
  });
}
export const stylesReady = styleReady("viewer-style", true);
void styleReady("viewer-fonts", false);
// The main graph might still be downloading when a stylesheet fails.
stylesReady.catch(() => {});

const version = window.__TAURI__
  ? window.__TAURI__.app.getVersion()
  : fetch("about.json").then((response) => response.ok ? response.json() : {}).then((about) => about.version);

const named = Promise.resolve(version).then((value) => {
  const label = document.getElementById("startup-version");
  if (label && value) label.textContent = `v${value}`;
}).catch(() => {}); // Metadata failure must not prevent the viewer from opening.

let nativeHandoff;
function revealNativePage() {
  if (!window.__TAURI__) return;
  return nativeHandoff ??= (async () => {
    await nextPaint();
    await window.__TAURI__.core.invoke("finish_startup");
  })();
}
// The native text covers WebView2 creation. Hand over as soon as the HTML startup screen has
// painted, so it can show the shared file-loading stages while the main graph initializes.
if (window.__TAURI__) void named.then(revealNativePage).catch(() => {});

/** Reveal the viewer after startup, including when startup reports an error. */
export async function finishStartup() {
  document.getElementById("startup")?.remove();
  document.body.classList.remove("starting");
  await revealNativePage();
}
