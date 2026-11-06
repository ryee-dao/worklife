import { test, expect } from "@playwright/test";

// The demo page moves its clock through window.__demo, set by the demo app
type DemoWindow = Window & { __demo: { fastForward: (seconds: number) => void } };

test("The web demo runs the tour, then goes overdue and takes a break inside the page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto("/");
  const app = page.frameLocator("iframe");
  const heading = app.getByTestId("tour-card").getByRole("heading");

  await test.step("The tour plays through the same beats as the app", async () => {
    const titles = ["Already running.", "One rule.", "Time's up.", "Breaks find you.", "Stats.", "Difficulty.", "That's it."];
    for (const title of titles) {
      await expect(heading).toHaveText(title);
      if (title === "Time's up.") {
        await app.getByTestId("overdue-window-start-break-button").click();
      } else {
        await app.getByTestId("tour-next").click();
      }
    }
    await expect(app.getByTestId("tour")).toBeHidden();
  });

  const frame = page.frame({ url: /demo/ })!;
  const host = app.getByTestId("demo-break-host");
  const fastForward = (seconds: number) => frame.evaluate((seconds) => (window as unknown as DemoWindow).__demo.fastForward(seconds), seconds);

  await test.step("Forwarding to the break opens the overdue window inside the page, and it grows", async () => {
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
