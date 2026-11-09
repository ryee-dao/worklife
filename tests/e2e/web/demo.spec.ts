import { test, expect, Page } from "@playwright/test";

// The demo page moves its clock through window.__demo, set by the demo app
type DemoWindow = Window & { __demo: { fastForward: (seconds: number) => void } };

test("The web demo runs the tour in a real window, then goes overdue and takes a break in one again", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto("/");
  const app = page.frameLocator("iframe");
  const heading = app.getByTestId("tour-card").getByRole("heading");
  const next = app.getByTestId("tour-next");
  await expect(heading).toHaveText("The timer.");
  const frame = page.frame({ url: /demo/ })!;
  const fastForward = (seconds: number) => frame.evaluate((seconds) => (window as unknown as DemoWindow).__demo.fastForward(seconds), seconds);

  let popup: Page;
  await test.step("The overdue beat opens a real window, which grows, and only its palm moves on", async () => {
    await next.click();
    await expect(heading).toHaveText("One rule.");
    await next.click();
    await expect(heading).toHaveText("Time's up.");
    [popup] = await Promise.all([page.waitForEvent("popup"), fastForward(3)]);
    await expect(popup.getByTestId("overdue-window-title")).toBeVisible();
    await expect(popup.getByTestId("tour-pulse")).toBeVisible();
    await expect(popup.getByTestId("tour-note")).toContainText("press the palm");
    await expect(app.getByTestId("demo-break-host")).toBeHidden();

    await popup.getByTestId("overdue-window-stop-button").click();
    await expect(heading).toHaveText("Time's up.");
    await popup.getByTestId("overdue-window-start-break-button").click();
  });

  await test.step("The break's card is in the window, with the browser's caveat, and the window closes after it", async () => {
    await expect(popup.getByTestId("break-window-title")).toBeVisible();
    await expect(popup.getByTestId("tour-card").getByRole("heading")).toHaveText("The break.");
    await expect(popup.getByRole("link", { name: "Download the app" })).toBeVisible();
    await fastForward(15);
    await expect.poll(() => popup.isClosed()).toBe(true);
  });

  await test.step("Stats, the settings pages, then the start prompt starts the demo's timer", async () => {
    await expect(heading).toHaveText("Checkpoints.");
    await expect(app.getByTestId("today-level")).toHaveText("Glow");
    await next.click();
    await expect(heading).toHaveText("If you stop.");
    await expect(app.getByTestId("today-level")).toHaveText("Glimmer");
    await app.getByTestId("tour-back").click();
    await expect(heading).toHaveText("Checkpoints.");
    await next.click();
    await next.click();
    await expect(heading).toHaveText("Timer.");
    await next.click();
    await expect(heading).toHaveText("Workday.");
    await next.click();
    await expect(heading).toHaveText("Overdue.");
    await next.click();
    await expect(heading).toHaveText("Difficulty.");
    await next.click();
    await expect(heading).toHaveText("Press start.");
    await app.getByTestId("tour-advance").click();
    await expect(app.getByTestId("tour")).toBeHidden();
    await expect(app.getByTestId("toggle-timer-button")).toHaveAttribute("title", "Stop (costs a checkpoint)");
  });

  await test.step("After the tour, forwarding opens the overdue window as a popup again, and it grows", async () => {
    [popup] = await Promise.all([page.waitForEvent("popup"), app.getByTestId("timer-buttons-container").getByTestId("forward-button").click()]);
    await expect(popup.getByTestId("overdue-window-title")).toBeVisible();
    await expect(app.getByTestId("demo-break-host")).toBeHidden();
    const before = await popup.evaluate(() => window.outerWidth);
    await fastForward(10);
    await expect.poll(() => popup.evaluate(() => window.outerWidth)).toBeGreaterThan(before);
  });

  await test.step("The break takes the window, then work starts again", async () => {
    await popup.getByTestId("overdue-window-start-break-button").click();
    await expect(popup.getByTestId("break-window-title")).toBeVisible();
    await fastForward(30);
    await expect.poll(() => popup.isClosed()).toBe(true);
    await expect(app.getByTestId("timer-buttons-container").getByTestId("forward-button")).toBeVisible();
  });

  await test.step("Replaying from the page brings the tour back", async () => {
    await page.getByRole("button", { name: "Replay the tour" }).click();
    await expect(heading).toHaveText("The timer.");
  });

  expect(errors).toEqual([]);
});

test("A browser without the stylesheet's CSS gets a note instead of the demo", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => { CSS.supports = () => false; });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "This demo needs a newer browser." })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Replay the tour" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
  expect(errors).toEqual([]);
});
