// Generate the committed brand assets with the existing CLI, Chromium and Tauri tools.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const viewerRequire = createRequire(join(root, "tests/viewer/package.json"));
export const { chromium } = viewerRequire("@playwright/test");
const rnl = process.env.RNL_BIN || join(root, "target/debug", process.platform === "win32" ? "rnl.exe" : "rnl");
const number = n => String(Number(n.toFixed(6)));

// Copied from apps/viewer-ui/background.js: importing that module also initializes the viewer DOM.
// brand.test.mjs checks this copy against the viewer's actual implementation.
export function darkColour(colour) {
  if (!/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(colour)) return colour;
  const hex = colour.slice(1);
  const full = hex.length <= 4 ? [...hex].map(c => c + c).join("") : hex;
  const rgb = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
  const lo = Math.min(...rgb), hi = Math.max(...rgb);
  const lightness = (lo + hi) / 2;
  const reflected = lightness < 0.25 ? 1 - lightness : lightness;
  if (reflected === lightness) return colour;
  const shift = reflected - lightness;
  return "#" + rgb.map(c => Math.round((c + shift) * 255).toString(16).padStart(2, "0")).join("") + full.slice(6);
}

/** Render afresh, remove the paper, and frame the painted bounds with 6% of their width per side. */
export async function renderLogo(page) {
  const temporary = mkdtempSync(join(tmpdir(), "rnl-brand-"));
  try {
    execFileSync(rnl, ["render", "brand/rnl-logo.sp", "-o", temporary], { cwd: root, stdio: "pipe" });
    let svg = readFileSync(join(temporary, "rnl-logo.svg"), "utf8").replace(/\r\n/g, "\n");
    if (!/<rect class="backdrop"[^>]*\/>/.test(svg)) throw new Error("The renderer's backdrop changed; review brand.mjs");
    svg = svg.replace(/\n<rect class="backdrop"[^>]*\/>/, "");
    await page.setContent(svg);
    const bounds = await page.evaluate(() => {
      const elements = [...document.querySelectorAll("svg path, svg circle, svg ellipse, svg line, svg polyline, svg polygon, svg rect, svg text")];
      if (!elements.length) throw new Error("The logo has no drawing");
      const boxes = elements.map(el => {
        const box = el.getBBox();
        const style = getComputedStyle(el);
        // This logo uses round caps and joins. getBBox() excludes strokes in Chromium.
        const half = style.stroke === "none" ? 0 : parseFloat(style.strokeWidth) / 2;
        return [box.x - half, box.y - half, box.x + box.width + half, box.y + box.height + half];
      });
      return [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])),
        Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))];
    });
    // Round the browser's float32 SVG geometry before doing layout arithmetic.
    const [x0, y0, x1, y1] = bounds.map(n => Number(n.toFixed(4)));
    const width = x1 - x0, height = y1 - y0, pad = width * 0.06;
    const box = [x0 - pad, y0 - pad, width + pad * 2, height + pad * 2].map(number).join(" ");
    svg = svg.replace(/^<svg\b[^>]*>/, tag => tag
      .replace(/ (?:width|height)="[^"]*"/g, "")
      .replace(/viewBox="[^"]*"/, `viewBox="${box}"`));
    return { svg, bounds: { x: x0, y: y0, width, height } };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

export function darkLogo(svg) {
  return svg.replace(/\b(stroke|fill)="(#[\da-f]+)"/gi, (_, attribute, colour) => `${attribute}="${darkColour(colour)}"`);
}

// Tauri emits the same ICNS representations in a random order. Keep their payloads untouched,
// but sort the resource blocks by four-character type so repeated generation is byte-identical.
function stableIcns(file) {
  const data = readFileSync(file), blocks = [];
  if (data.toString("ascii", 0, 4) !== "icns" || data.readUInt32BE(4) !== data.length) throw new Error("Invalid ICNS header");
  for (let offset = 8; offset < data.length;) {
    const size = data.readUInt32BE(offset + 4);
    if (size < 8 || offset + size > data.length) throw new Error("Invalid ICNS resource");
    blocks.push(data.subarray(offset, offset + size));
    offset += size;
  }
  blocks.sort((a, b) => Buffer.compare(a.subarray(0, 4), b.subarray(0, 4)));
  writeFileSync(file, Buffer.concat([data.subarray(0, 8), ...blocks]));
}

function iconSvg(dark, bounds) {
  const scale = 1024 * 0.72 / Math.max(bounds.width, bounds.height);
  const x = 512 - (bounds.x + bounds.width / 2) * scale;
  const y = 512 - (bounds.y + bounds.height / 2) * scale;
  const body = dark.replace(/^<svg[^>]*>\n/, "").replace(/\n<\/svg>\n$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n` +
    `<rect width="1024" height="1024" rx="180" fill="#14345c"/>\n` +
    `<g transform="translate(${number(x)} ${number(y)}) scale(${number(scale)})">\n${body}\n</g>\n</svg>\n`;
}

async function png(page, svg, size, path) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`);
  await page.screenshot({ path, omitBackground: true });
}

async function generate() {
  execFileSync(rnl, ["check", "brand/rnl-logo.sp"], { cwd: root, stdio: "inherit" });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const { svg, bounds } = await renderLogo(page);
    const dark = darkLogo(svg), icon = iconSvg(dark, bounds);
    const write = (path, text) => writeFileSync(join(root, path), text);
    write("brand/rnl-logo.svg", svg);
    write("brand/rnl-logo-dark.svg", dark);
    write("brand/rnl-icon.svg", icon);
    await png(page, icon, 1024, join(root, "brand/rnl-icon-1024.png"));

    const assets = join(root, "site/src/assets");
    mkdirSync(join(assets, "brand"), { recursive: true });
    copyFileSync(join(root, "brand/rnl-logo.svg"), join(assets, "brand/rnl-logo.svg"));
    copyFileSync(join(root, "brand/rnl-logo-dark.svg"), join(assets, "brand/rnl-logo-dark.svg"));
    writeFileSync(join(assets, "favicon.svg"), icon);
    await png(page, icon, 32, join(assets, "favicon-32.png"));
    await png(page, icon, 180, join(assets, "apple-touch-icon.png"));
    const viewerIcons = join(root, "apps/viewer-ui/icons");
    mkdirSync(viewerIcons, { recursive: true });
    for (const name of ["favicon.svg", "favicon-32.png", "apple-touch-icon.png"]) {
      copyFileSync(join(assets, name), join(viewerIcons, name));
    }
  } finally {
    await browser.close();
  }

  // The installed Tauri entry point is the same command as `npx tauri icon`, without a download.
  // Generate in a temporary folder and retain only the bundle's configured icons.
  const temporary = mkdtempSync(join(tmpdir(), "rnl-tauri-icons-"));
  try {
    const require = createRequire(join(root, "apps/desktop/package.json"));
    execFileSync(process.execPath, [require.resolve("@tauri-apps/cli/tauri.js"), "icon",
      join(root, "brand/rnl-icon-1024.png"), "-o", temporary], { cwd: root, stdio: "inherit" });
    const config = JSON.parse(readFileSync(join(root, "apps/desktop/tauri.conf.json"), "utf8"));
    for (const icon of config.bundle.icon) copyFileSync(join(temporary, icon.replace(/^icons\//, "")), join(root, "apps/desktop", icon));
    stableIcns(join(root, "apps/desktop/icons/icon.icns"));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  console.log("Brand assets regenerated. Review the SVG and small-size icons before committing.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generate();
