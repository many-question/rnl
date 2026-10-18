// A display preference only: keep the Document and the core's exported SVG untouched.
import { setCheck } from "./commands.js";
import { refreshGridColours } from "./grid.js";
import { save } from "./util.js";

export const DARK_LIGHTNESS_THRESHOLD = 0.25;
let dark = false;
const originals = new WeakMap();

export const darkLightness = (lightness) => lightness < DARK_LIGHTNESS_THRESHOLD ? 1 - lightness : lightness;

/** RNL colours are CSS hex, with optional alpha. Reflect HSL L, retaining hue, saturation and alpha. */
export function darkColour(colour) {
  if (!/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(colour)) return colour;
  const hex = colour.slice(1);
  const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
  const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lo = Math.min(...rgb), hi = Math.max(...rgb);
  const lightness = (lo + hi) / 2;
  const reflected = darkLightness(lightness);
  if (reflected === lightness) return colour;
  // The HSL chroma is unchanged by L -> 1-L. All three channels shift by 1 - max - min.
  const shift = reflected - lightness;
  return "#" + rgb.map((c) => Math.round((c + shift) * 255).toString(16).padStart(2, "0")).join("") + full.slice(6);
}

/** Apply the preference to a newly imported drawing or thumbnail, or restore its original colours. */
export function colourDrawing(svg) {
  for (const el of svg.querySelectorAll("[stroke], [fill]")) {
    if (el.closest(".overlay")) continue;
    if (!originals.has(el)) {
      originals.set(el, ["stroke", "fill"].map((attr) => [attr, el.getAttribute(attr)]));
    }
    for (const [attr, colour] of originals.get(el)) {
      if (colour !== null) el.setAttribute(attr, dark ? darkColour(colour) : colour);
    }
  }
}

export function setBackground(mode) {
  dark = mode === "dark";
  document.body.dataset.background = dark ? "dark" : "light";
  save("background", dark ? "dark" : "light");
  setCheck("background-light", !dark);
  setCheck("background-dark", dark);
  for (const svg of document.querySelectorAll("#canvas > svg, .thumb svg")) colourDrawing(svg);
  refreshGridColours();
}
