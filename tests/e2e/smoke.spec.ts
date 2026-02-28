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

test("App pauses properly", async ({ launchElectron }) => {
  const { settingsWindow } = await launchElectron();

  // Get the time before pause
  const timerBeforePause = await settingsWindow.getByTestId('timer-time-display').textContent()

  // Expect that the timer stops counting down after pausing 
  await settingsWindow.getByTestId('toggle-timer-button').click();
  await settingsWindow.waitForTimeout(3 * 1000);
  await expect(settingsWindow.getByTestId('timer-time-display').getByText(timerBeforePause!)).toBeVisible({ timeout: 3 * 1000 })

  // Expect that the timer starts to countdown after unpausing 
  await settingsWindow.getByTestId('toggle-timer-button').click();
  await settingsWindow.waitForTimeout(3 * 1000);
  await expect(settingsWindow.getByTestId('timer-time-display').getByText(timerBeforePause!)).not.toBeVisible({ timeout: 3 * 1000 })
});

test("Break window is unable to skip after all skips are exhausted", async ({ launchElectron }) => {
  const { settingsWindow, electronApp } = await launchElectron();

  // Wait for the skip container to appear
  await settingsWindow.getByTestId("timer-skipbox").waitFor()

  // Get the number of total and used skips 
  const totalNumberOfSkips = await settingsWindow.getByTestId("timer-skip-icon").count()
  let currentNumberOfUsedSkips = await settingsWindow.locator('.used-skip').count()
  let expectedNumberOfSkips = 0;

  // Expect that there are more than 0 skips by default and none are used
  expect(totalNumberOfSkips).toBeGreaterThan(0);
  expect(currentNumberOfUsedSkips).toBe(expectedNumberOfSkips);

  // Loop {totalNumberOfSkips} number of times
  for (let loopIdx = 0; loopIdx < totalNumberOfSkips; loopIdx++) {
    // Click on the skip button and capture the break window
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', {
        timeout: 10 * 1000,
      }),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
    ])

    // Click on the skip break icon
    await breakWindow.getByTestId("break-skip").click()
    await breakWindow.waitForEvent('close');
    await settingsWindow.getByTestId("timer-skipbox").waitFor()

    // Expect the break window to be closed
    expect(breakWindow.isClosed()).toBeTruthy();

    // Expect the same number of total skips to be present
    expect(await settingsWindow.getByTestId("timer-skip-icon").count()).toBe(totalNumberOfSkips);

    // Expect the number of used skips incremented by one
    currentNumberOfUsedSkips = await settingsWindow.locator('.used-skip').count()
    expectedNumberOfSkips += 1;
    expect(currentNumberOfUsedSkips).toBe(expectedNumberOfSkips);
  }

  // Skip one last time
  const [breakWindow] = await Promise.all([
    electronApp.waitForEvent('window', {
      timeout: 10 * 1000,
    }),
    settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
  ])

  // Expect the skip button is disabled
  await expect(breakWindow.getByTestId("break-skip")).toBeDisabled();

  // Expect that clicking on the skip does nothing
  await breakWindow.getByTestId("break-skip").click({ delay: 1 * 1000, force: true })
  await breakWindow.waitForTimeout(2 * 1000)
  expect(breakWindow.isClosed()).toBeFalsy();
});