import { expect, Page } from "@playwright/test";
import { test } from "../fixtures";
import { FILENAMES } from "@shared/constants";
import fs from "fs";
import path from "path";

test.describe.configure({ mode: 'parallel' });

// Whether a click at an element's center would land on the tour (its dim layer or card) instead of the element
const isBlockedByTour = (page: Page, testId: string) => page.evaluate((testId) => {
  const box = document.querySelector(`[data-testid="${testId}"]`)!.getBoundingClientRect();
  return !!document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('[data-testid="tour"]');
}, testId);

test("The first run walks through the tour once", async ({ userDataDir, launchElectron }, testInfo) => {
  userDataDir.seed(FILENAMES.TOUR.STATE, { seen: false });
  const { settingsWindow, testClock } = await launchElectron();
  const heading = settingsWindow.getByTestId("tour-card").getByRole("heading");
  const next = settingsWindow.getByTestId("tour-next");
  const demo = settingsWindow.getByTestId("demo-break-window");
  const stopButton = settingsWindow.getByTestId("timer-buttons-container").getByTestId("toggle-timer-button");
  const snapshot = (name: string) => settingsWindow.screenshot({ path: testInfo.outputPath(`${name}.png`) });

  await test.step("The timer runs behind the overlay, and the stop button can't be reached", async () => {
    await expect(heading).toHaveText("Already running.");
    await testClock.fastForward(2);
    await expect(settingsWindow.getByTestId("timer-time-display").getByText("44 : 58")).toBeVisible();
    expect(await isBlockedByTour(settingsWindow, "toggle-timer-button")).toBe(true);
    await snapshot("1-running");
    await next.click();
  });

  await test.step("One rule, with the stop button in the spotlight", async () => {
    await expect(heading).toHaveText("One rule.");
    await expect(settingsWindow.getByTestId("tour-spotlight")).toBeVisible();
    expect(await isBlockedByTour(settingsWindow, "toggle-timer-button")).toBe(true);
    await snapshot("2-one-rule");
    await next.click();
  });

  await test.step("The overdue window appears in the dashboard, counts up and grows, and only the palm moves on", async () => {
    await expect(heading).toHaveText("Time's up.");
    await expect(next).toBeHidden();
    await expect(demo.getByTestId("overdue-window-title")).toBeVisible();
    await expect(settingsWindow.getByTestId("tour-pulse")).toBeVisible();
    const before = (await demo.boundingBox())!;
    // The demo runs on its own clock, in real seconds
    await expect(demo.getByTestId("overdue-window-time-display")).not.toContainText("00 : 00");
    await expect.poll(async () => (await demo.boundingBox())!.width, { timeout: 10 * 1000 }).toBeGreaterThan(before.width);
    await snapshot("3-overdue");

    // The demo's buttons are the real ones, so stop must not reach the timer
    await demo.getByTestId("overdue-window-stop-button").click();
    await expect(heading).toHaveText("Time's up.");
    await expect(stopButton).toHaveAttribute("title", "Stop (costs a checkpoint)");
    await demo.getByTestId("overdue-window-start-break-button").click();
  });

  await test.step("Then the break", async () => {
    await expect(heading).toHaveText("Breaks find you.");
    await expect(demo.getByTestId("break-window-title")).toBeVisible();
    await expect(demo.getByTestId("break-window-time-display")).toContainText("00 : ");
    await snapshot("4-break");
    await next.click();
  });

  await test.step("Stats", async () => {
    await expect(heading).toHaveText("Stats.");
    await expect.poll(() => settingsWindow.evaluate(() => location.hash)).toBe("#/stats");
    await expect(settingsWindow.getByTestId("today-panel")).toBeVisible();
    await snapshot("5-stats");
    await next.click();
  });

  await test.step("Difficulty", async () => {
    await expect(heading).toHaveText("Difficulty.");
    await expect.poll(() => settingsWindow.evaluate(() => location.hash)).toBe("#/settings/difficulty");
    await expect(settingsWindow.getByTestId("difficulty-level")).toBeVisible();
    await snapshot("6-difficulty");
    await next.click();
  });

  await test.step("Start working closes the tour for good", async () => {
    await expect(heading).toHaveText("That's it.");
    await expect(next).toHaveText("Start working");
    await snapshot("7-done");
    await next.click();
    await expect(settingsWindow.getByTestId("tour")).toBeHidden();
    await expect.poll(() => settingsWindow.evaluate(() => location.hash)).toBe("#/timer");
    await expect.poll(() => fs.readFileSync(path.join(userDataDir.path, FILENAMES.TOUR.STATE), "utf-8")).toBe(JSON.stringify({ seen: true }));
  });

  await test.step("The timer kept running the whole time", async () => {
    await expect(stopButton).toHaveAttribute("title", "Stop (costs a checkpoint)");
    await testClock.fastForward(1);
    await expect(settingsWindow.getByTestId("timer-time-display").getByText("44 : 57")).toBeVisible();
  });
});

test("A later launch has no tour, the corner button replays it, and skipping points back at the button", async ({ userDataDir, launchElectron }) => {
  const { settingsWindow } = await launchElectron();
  const heading = settingsWindow.getByTestId("tour-card").getByRole("heading");
  await expect(settingsWindow.getByTestId("timer-time-display")).toBeVisible();
  await expect(settingsWindow.getByTestId("tour")).toBeHidden();

  await settingsWindow.getByTestId("tabs-navbar").getByRole("link", { name: "Stats" }).click();
  await settingsWindow.getByTestId("replay-tour").click();
  await expect(heading).toHaveText("Already running.");
  await expect.poll(() => settingsWindow.evaluate(() => location.hash)).toBe("#/timer");

  // Skip from a demo beat, so the demo window goes away with it
  await settingsWindow.getByTestId("tour-next").click();
  await settingsWindow.getByTestId("tour-next").click();
  await expect(settingsWindow.getByTestId("demo-break-window")).toBeVisible();
  await settingsWindow.getByTestId("tour-skip").click();
  await expect(heading).toHaveText("Skipped.");
  await expect(settingsWindow.getByTestId("demo-break-window")).toBeHidden();
  await expect(settingsWindow.getByTestId("tour-spotlight")).toBeVisible();
  await expect(settingsWindow.getByTestId("tour-skip")).toBeHidden();
  expect(await isBlockedByTour(settingsWindow, "replay-tour")).toBe(true);

  await settingsWindow.getByTestId("tour-next").click();
  await expect(settingsWindow.getByTestId("tour")).toBeHidden();
  await expect.poll(() => fs.readFileSync(path.join(userDataDir.path, FILENAMES.TOUR.STATE), "utf-8")).toBe(JSON.stringify({ seen: true }));
});
