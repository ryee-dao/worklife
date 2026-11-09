// The demo's stylesheet is built by Tailwind v4, so a browser without these shows black text and blank buttons (Firefox before
// 128, Chrome before 111, Safari before 16.4). Checked by feature, not by version, so a browser that catches up just works
const supports = (property: string, value: string) => typeof CSS !== "undefined" && CSS.supports(property, value);
const supported =
  supports("color", "oklch(0 0 0)") &&
  supports("color", "color-mix(in oklab, red, red)") &&
  supports("container-type", "size") &&
  typeof CSS !== "undefined" && "registerProperty" in CSS; // @property
if (!supported) {
  document.getElementById("app")!.remove(); // Stops the demo loading, so the browser isn't left with a half-styled page
  document.getElementById("replay")!.remove();
  document.getElementById("unsupported")!.hidden = false;
}

// The demo page's one control: a fresh page is a fresh install, which starts with the tour
document.getElementById("replay")?.addEventListener("click", () => {
  const app = document.getElementById("app") as HTMLIFrameElement;
  app.contentWindow?.location.reload();
});
