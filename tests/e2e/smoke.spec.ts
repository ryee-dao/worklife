import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { FILENAMES, DEFAULTS } from "./../../src/shared/constants"
import fs from "fs";
import path from "path";

test.describe.configure({ mode: 'parallel' });

test("App launches with a visible window and starts up with valid components & states", async ({ userDataDir, launchElectron }) => {
  const { settingsWindow, electronApp } = await launchElectron();

  // Verify defaults were written to file immediately
  const initialTimerState = JSON.parse(
    fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
  );
  expect(initialTimerState.currentCountdownMs).toBe(DEFAULTS.DEFAULT_TIMER_DURATION_MS);
  expect(initialTimerState.status).toBe("RUNNING");

  // Expect that the timer counts down properly
  await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 55")).toBeVisible({ timeout: 6 * 1000 })
  await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 50")).toBeVisible({ timeout: 6 * 1000 })

  // Expect that there are 3 skips by default
  expect(await settingsWindow.getByTestId("timer-skip-icon").count()).toBe(3)

  // Expect that the play and pause button are visible by default 
  await expect(settingsWindow.getByTestId("timer-buttons-container").getByTestId('toggle-timer-button')).toBeVisible();
  await expect(settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button')).toBeVisible();

  // Click on the skip button and capture the break window
  const [breakWindow] = await Promise.all([
    electronApp.waitForEvent('window', {
      timeout: 10 * 1000,
    }),
    settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
  ])

  // Expect that the break time counts down as expected
  await expect(breakWindow.getByTestId('break-time-display').getByText("00 : 25")).toBeVisible({ timeout: 6 * 1000 })
  await expect(breakWindow.getByTestId('break-time-display').getByText("00 : 20")).toBeVisible({ timeout: 6 * 1000 })
});


test("App launches the break window properly when the timer countdown is reached", async ({ launchElectron, userDataDir }) => {
  // Set initial state of timer
  userDataDir.seed(FILENAMES.TIMER.STATE, {
    currentCountdownMs: 5 * 1000,
    status: "RUNNING",
    _bypassThreshold: true,
  })

  const { settingsWindow, electronApp } = await launchElectron();

  // Expect that the timer counts down from less than 10 seconds 
  await expect(settingsWindow.getByTestId('timer-time-display').getByText("00 : 0")).toBeVisible({ timeout: 3 * 1000 })

  // Capture the break window once it appears
  const breakWindow = await electronApp.waitForEvent('window', {
    timeout: 10 * 1000,
  });

  // Expect that the break time counts down as expected
  await expect(breakWindow.getByTestId('break-time-display').getByText("00 : 25")).toBeVisible({ timeout: 6 * 1000 })
  await expect(breakWindow.getByTestId('break-time-display').getByText("00 : 20")).toBeVisible({ timeout: 6 * 1000 })
});