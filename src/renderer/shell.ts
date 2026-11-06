// The demo page's one control: a fresh page is a fresh install, which starts with the tour
document.getElementById("replay")!.addEventListener("click", () => {
  const app = document.getElementById("app") as HTMLIFrameElement;
  app.contentWindow?.location.reload();
});
