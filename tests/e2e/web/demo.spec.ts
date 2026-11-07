import { test, expect, Page } from "@playwright/test";

// The demo page moves its clock through window.__demo, set by the demo app
type DemoWindow = Window & { __demo: { fastForward: (seconds: number) => void } };

test("The web demo runs the tour in a real window, then goes overdue and takes a break inside the page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto("/");
  const app = page.frameLocator("iframe");
  const heading = app.getByTestId("tour-card").getByRole("heading");
  const next = app.getByTestId("tour-next");
  await expect(heading).toHaveText("Already running.");
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
    await expect(app.getByTestId("demo-break-host")).toBeHidden();

    await popup.getByTestId("overdue-window-stop-button").click();
    await expect(heading).toHaveText("Time's up.");
    await popup.getByTestId("overdue-window-start-break-button").click();
  });

  await test.step("The break's card is in the window, with the browser's caveat, and the window closes after it", async () => {
    await expect(popup.getByTestId("break-window-title")).toBeVisible();
    await expect(popup.getByTestId("tour-card").getByRole("heading")).toHaveText("Breaks find you.");
    await expect(popup.getByRole("link", { name: "Download the app" })).toBeVisible();
    await fastForward(15);
    await expect.poll(() => popup.isClosed()).toBe(true);
  });

  await test.step("Stats, Difficulty, then the start prompt starts the demo's timer", async () => {
    await expect(heading).toHaveText("Stats.");
    await next.click();
    await expect(heading).toHaveText("Difficulty.");
    await next.click();
    await expect(heading).toHaveText("Press start.");
    await app.getByTestId("tour-advance").click();
    await expect(app.getByTestId("tour")).toBeHidden();
    await expect(app.getByTestId("toggle-timer-button")).toHaveAttribute("title", "Stop (costs a checkpoint)");
  });

  const host = app.getByTestId("demo-break-host");
  await test.step("After the tour, forwarding opens the overdue window inside the page, and it grows", async () => {
    await app.getByTestId("timer-buttons-container").getByTestId("forward-button").click();
    await expect(host.getByTestId("overdue-window-title")).toBeVisible();
    const before = (await host.getByTestId("demo-break-window").boundingBox())!;
    await fastForward(10);
    await expect.poll(async () => (await host.getByTestId("demo-break-window").boundingBox())!.width).toBeGreaterThan(before.width);
  });

  await test.step("The break fills the page, then work starts again", async () => {
    await host.getByTestId("overdue-window-start-break-button").click();
    await expect(host.getByTestId("break-window-title")).toBeVisible();
    await fastForward(30);
    await expect(host).toBeHidden();
    await expect(app.getByTestId("timer-buttons-container").getByTestId("forward-button")).toBeVisible();
  });

  await test.step("Replaying from the page brings the tour back", async () => {
    await page.getByRole("button", { name: "Replay the tour" }).click();
    await expect(heading).toHaveText("Already running.");
  });

  expect(errors).toEqual([]);
});
