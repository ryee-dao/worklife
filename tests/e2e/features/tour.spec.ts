import { expect, Page } from "@playwright/test";
import { test } from "../fixtures";
import { getWindowBounds } from "../helpers";
import { FILENAMES } from "@shared/constants";
import fs from "fs";
import path from "path";

test.describe.configure({ mode: 'parallel' });

// Whether the tour has locked an element away: everything behind the overlay is inert while a tour is on
const isInert = (page: Page, testId: string) => page.evaluate((testId) => {
  return !!document.querySelector(`[data-testid="${testId}"]`)!.closest("[inert]");
}, testId);

test("The first run walks through the tour on its own clock, then starts the timer", async ({ userDataDir, launchElectron }, testInfo) => {
  userDataDir.seed(FILENAMES.TOUR.STATE, { seen: false });
  const { electronApp, settingsWindow, testClock } = await launchElectron();
  const heading = settingsWindow.getByTestId("tour-card").getByRole("heading");
  const next = settingsWindow.getByTestId("tour-next");
  const digits = settingsWindow.getByTestId("timer-time-digits");
  const toggleButton = settingsWindow.getByTestId("timer-buttons-container").getByTestId("toggle-timer-button");
  const snapshot = (name: string) => settingsWindow.screenshot({ path: testInfo.outputPath(`${name}.png`) });

  await test.step("The tour's clock runs in the timer's place, and the stop button can't be reached", async () => {
    await expect(heading).toHaveText("Already running.");
    await expect(digits).toHaveText("45 : 00");
    await testClock.fastForward(2);
    await expect(digits).toHaveText("44 : 58");
    expect(await isInert(settingsWindow, "toggle-timer-button")).toBe(true);
    await snapshot("1-running");
    await next.click();
  });

  await test.step("One rule, with the stop button in the spotlight", async () => {
    await expect(heading).toHaveText("One rule.");
    await expect(settingsWindow.getByTestId("tour-spotlight")).toBeVisible();
    await snapshot("2-one-rule");
    await next.click();
  });

  let breakWindow: Page;
  await test.step("Time's up: the last seconds run down, and the real overdue window opens, grows, and only its palm moves on", async () => {
    await expect(heading).toHaveText("Time's up.");
    await expect(next).toBeHidden();
    await expect(digits).toHaveText("00 : 03");
    [breakWindow] = await Promise.all([electronApp.waitForEvent("window"), testClock.fastForward(3)]);
    await expect(breakWindow.getByTestId("overdue-window-title")).toBeVisible();
    await expect(breakWindow.getByTestId("tour-pulse")).toBeVisible();
    const before = (await getWindowBounds(electronApp, breakWindow))!;
    await testClock.fastForward(4);
    await expect.poll(async () => (await getWindowBounds(electronApp, breakWindow))!.width).toBeGreaterThan(before.width);
    await expect(breakWindow.getByTestId("overdue-window-time-display")).toContainText("00 : 04");
    await snapshot("3-overdue");

    await breakWindow.getByTestId("overdue-window-stop-button").click();
    await expect(heading).toHaveText("Time's up.");
    await breakWindow.getByTestId("overdue-window-start-break-button").click();
  });

  await test.step("Then the break, with its card in the window, which closes when the break is over", async () => {
    const card = breakWindow.getByTestId("tour-card");
    await expect(card.getByRole("heading")).toHaveText("Breaks find you.");
    await expect(breakWindow.getByTestId("break-window-time-display")).toContainText("00 : 15");
    await expect(settingsWindow.getByTestId("tour-card")).toBeHidden();
    await breakWindow.screenshot({ path: testInfo.outputPath("4-break.png") });
    await testClock.fastForward(15);
    await expect.poll(() => breakWindow.isClosed()).toBe(true);
  });

  await test.step("Stats, then Difficulty", async () => {
    await expect(heading).toHaveText("Stats.");
    await expect.poll(() => settingsWindow.evaluate(() => location.hash)).toBe("#/stats");
    await expect(settingsWindow.getByTestId("today-panel")).toBeVisible();
    await snapshot("5-stats");
    await next.click();
    await expect(heading).toHaveText("Difficulty.");
    await expect.poll(() => settingsWindow.evaluate(() => location.hash)).toBe("#/settings/difficulty");
    await snapshot("6-difficulty");
    await next.click();
  });

  await test.step("The real timer shows at the end, stopped, and the start prompt starts it for good", async () => {
    await expect(heading).toHaveText("Press start.");
    await expect(next).toBeHidden();
    await expect(digits).toHaveText("45 : 00");
    await expect(toggleButton).toHaveAttribute("title", "Resume");
    await snapshot("7-start");
    await settingsWindow.getByTestId("tour-advance").click();
    await expect(settingsWindow.getByTestId("tour")).toBeHidden();
    await expect(toggleButton).toHaveAttribute("title", "Stop (costs a checkpoint)");
    await testClock.fastForward(1);
    await expect(digits).toHaveText("44 : 59");
    await expect.poll(() => fs.readFileSync(path.join(userDataDir.path, FILENAMES.TOUR.STATE), "utf-8")).toBe(JSON.stringify({ seen: true }));
  });
});

test("A replay holds the real timer, skipping points back at the corner button, and nothing is lost", async ({ launchElectron }) => {
  const { settingsWindow, testClock } = await launchElectron();
  const heading = settingsWindow.getByTestId("tour-card").getByRole("heading");
  const digits = settingsWindow.getByTestId("timer-time-digits");
  await expect(settingsWindow.getByTestId("tour")).toBeHidden();
  await testClock.fastForward(1);
  await expect(digits).toHaveText("44 : 59");

  await settingsWindow.getByTestId("tabs-navbar").getByRole("link", { name: "Stats" }).click();
  await settingsWindow.getByTestId("replay-tour").click();
  await expect(heading).toHaveText("Already running.");
  await expect.poll(() => settingsWindow.evaluate(() => location.hash)).toBe("#/timer");
  await expect(digits).toHaveText("45 : 00");
  await testClock.fastForward(2);

  // Skip from the overdue beat, before its window opens
  await settingsWindow.getByTestId("tour-next").click();
  await settingsWindow.getByTestId("tour-next").click();
  await expect(heading).toHaveText("Time's up.");
  await settingsWindow.getByTestId("tour-skip").click();
  await expect(heading).toHaveText("Skipped.");
  await expect(settingsWindow.getByTestId("tour-spotlight")).toBeVisible();
  await expect(settingsWindow.getByTestId("tour-skip")).toBeHidden();
  expect(await isInert(settingsWindow, "replay-tour")).toBe(true);
  await expect(digits).toHaveText("44 : 59"); // The real timer, back where it was held

  await settingsWindow.getByTestId("tour-next").click();
  await expect(settingsWindow.getByTestId("tour")).toBeHidden();
  await testClock.fastForward(1);
  await expect(digits).toHaveText("44 : 58");
});

test("A replay nobody clicks fades out and ends", async ({ launchElectron }) => {
  const { settingsWindow, testClock } = await launchElectron();
  const tour = settingsWindow.getByTestId("tour");
  await settingsWindow.getByTestId("replay-tour").click();
  await expect(tour).toBeVisible();

  await testClock.fastForward(25);
  await expect(tour).toHaveAttribute("data-fading", "true");
  await testClock.fastForward(5);
  await expect(tour).toBeHidden();
  await expect(settingsWindow.getByTestId("timer-time-digits")).toHaveText("45 : 00");
});
