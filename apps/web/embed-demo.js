const viewer = document.getElementById("viewer");
const buttons = [...document.querySelectorAll("[data-url]")];
const output = document.getElementById("events");
const url = new URL("./?embed=1", location.href);
url.searchParams.set("origin", location.origin);
let loaded = null;
let level = "";

function open(button) {
  for (const item of buttons) item.setAttribute("aria-pressed", String(item === button));
  viewer.contentWindow.postMessage({ rnl: 1, type: "open", url: button.dataset.url }, location.origin);
}

window.addEventListener("message", (event) => {
  if (event.source !== viewer.contentWindow || event.origin !== location.origin || event.data?.rnl !== 1) return;
  const message = event.data;
  if (message.type === "ready") {
    buttons.forEach((button) => { button.disabled = false; });
    open(buttons[0]);
  } else if (message.type === "loaded") {
    loaded = message;
    level = message.level;
  } else if (message.type === "level") level = message.name;
  else if (message.type === "error") { output.textContent = message.message; return; }
  else return;
  if (loaded) output.textContent = `loaded: ${JSON.stringify(loaded)} · level: ${level}`;
});
buttons.forEach((button) => button.addEventListener("click", () => open(button)));
viewer.src = url.href;
