import { expect, Page } from "@playwright/test";
import { test } from "./fixtures";
import { FILENAMES, DEFAULTS } from "./../../src/shared/constants"
import fs from "fs";
import path from "path";
import { TimerState } from "../../src/main/timer/timerState"
import { convertMinutesToMs, convertMsToMinutes, convertMsToSeconds } from "../../src/shared/utils/time"

test.describe.configure({ mode: 'parallel' });

test("App launches with a visible window and starts up with valid components & states", async ({ userDataDir, launchElectron }) => {
  const { settingsWindow, electronApp } = await launchElectron();
  let breakWindow: Page;

  await test.step("Verify defaults written to file", async () => {
    // Read the timer state file written on launch
    const initialTimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    // Assert the default duration and status were persisted
    expect.soft(initialTimerState.currentCountdownMs).toBe(DEFAULTS.DEFAULT_TIMER_DURATION_MS);
    expect.soft(initialTimerState.status).toBe("RUNNING");
  });

  await test.step("Verify timer counts down", async () => {
    // Assert the display ticks down through consecutive values
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 55")).toBeVisible({ timeout: 6 * 1000 })
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 50")).toBeVisible({ timeout: 6 * 1000 })
  });

  await test.step("Verify default UI state", async () => {
    // Assert all three skip icons are present
    expect(await settingsWindow.getByTestId("timer-skip-icon").count()).toBe(3)
    // Assert the toggle and skip buttons are visible
    await expect(settingsWindow.getByTestId("timer-buttons-container").getByTestId('toggle-timer-button')).toBeVisible();
    await expect(settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button')).toBeVisible();
  });

  await test.step("Skip to overdue and verify overdue timer", async () => {
    // Skip the work timer and wait for the overdue window to open
    [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
    ])
    // Assert the overdue timer counts up
    await expect(breakWindow.getByTestId('overdue-time-display').getByText("00 : 05")).toBeVisible({ timeout: 6 * 1000 })
    await expect(breakWindow.getByTestId('overdue-time-display').getByText("00 : 10")).toBeVisible({ timeout: 6 * 1000 })
  });

  await test.step("Start break and verify break countdown", async () => {
    // Start the break from the overdue window
    breakWindow.getByTestId("start-break").click()
    // Assert the break timer counts down
    await expect(breakWindow.getByTestId('break-time-display').getByText("00 : 25")).toBeVisible({ timeout: 6 * 1000 })
    await expect(breakWindow.getByTestId('break-time-display').getByText("00 : 20")).toBeVisible({ timeout: 6 * 1000 })
  });
});


test("App launches the overdue window properly when the timer countdown is reached", async ({ launchElectron, userDataDir }) => {
  // Seed a short countdown so the timer expires quickly
  userDataDir.seed(FILENAMES.TIMER.STATE, {
    currentCountdownMs: 5 * 1000,
    status: "RUNNING",
    _bypassThreshold: true,
  })

  const { settingsWindow, electronApp } = await launchElectron();

  await test.step("Verify timer counts down from seeded state", async () => {
    // Assert the seeded countdown reaches near zero
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("00 : 0")).toBeVisible({ timeout: 3 * 1000 })
  });

  await test.step("Verify overdue window appears and counts up", async () => {
    // Wait for the overdue window to open on expiry
    const breakWindow = await electronApp.waitForEvent('window', { timeout: 10 * 1000 });
    // Assert the overdue timer counts up
    await expect(breakWindow.getByTestId('overdue-time-display').getByText("00 : 05")).toBeVisible({ timeout: 6 * 1000 })
    await expect(breakWindow.getByTestId('overdue-time-display').getByText("00 : 10")).toBeVisible({ timeout: 6 * 1000 })
  });
});

test("App pauses properly", async ({ launchElectron }) => {
  const { settingsWindow } = await launchElectron();
  // Capture the displayed time before pausing
  const timerBeforePause = await settingsWindow.getByTestId('timer-time-display').textContent()

  await test.step("Pause and verify timer stops", async () => {
    // Pause the timer
    await settingsWindow.getByTestId('toggle-timer-button').click();
    await settingsWindow.waitForTimeout(3 * 1000);
    // Assert the time still shows the pre-pause value
    await expect(settingsWindow.getByTestId('timer-time-display').getByText(timerBeforePause!)).toBeVisible({ timeout: 3 * 1000 })
  });

  await test.step("Unpause and verify timer resumes", async () => {
    // Unpause the timer
    await settingsWindow.getByTestId('toggle-timer-button').click();
    await settingsWindow.waitForTimeout(3 * 1000);
    // Assert the time has moved off the pre-pause value
    await expect(settingsWindow.getByTestId('timer-time-display').getByText(timerBeforePause!)).not.toBeVisible({ timeout: 3 * 1000 })
  });
});

test("Break window is unable to skip after all skips are exhausted", async ({ launchElectron }) => {
  const { settingsWindow, electronApp } = await launchElectron();

  await test.step("Verify initial skip state", async () => {
    // Wait for the skipbox to render
    await settingsWindow.getByTestId("timer-skipbox").waitFor()
    // Count total and used skips
    const totalNumberOfSkips = await settingsWindow.getByTestId("timer-skip-icon").count()
    const currentNumberOfUsedSkips = await settingsWindow.locator('.used-skip').count()
    // Assert skips exist and none are used yet
    expect(totalNumberOfSkips).toBeGreaterThan(0);
    expect(currentNumberOfUsedSkips).toBe(0);
  });

  const totalNumberOfSkips = await settingsWindow.getByTestId("timer-skip-icon").count()
  let expectedNumberOfSkips = 0;

  for (let loopIdx = 0; loopIdx < totalNumberOfSkips; loopIdx++) {
    await test.step(`Exhaust skip ${loopIdx + 1} of ${totalNumberOfSkips}`, async () => {
      // Go to break state
      const [breakWindow] = await Promise.all([
        electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
        settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
      ])
      await breakWindow.getByTestId("start-break").click()

      // Skip break
      await breakWindow.getByTestId("break-skip").click()
      await breakWindow.waitForEvent('close');
      await settingsWindow.getByTestId("timer-skipbox").waitFor()

      // Assert that break window was closed
      expect(breakWindow.isClosed()).toBeTruthy();
      expect(await settingsWindow.getByTestId("timer-skip-icon").count()).toBe(totalNumberOfSkips);

      // Assert the number of skips matches expected count
      expectedNumberOfSkips += 1;
      expect(await settingsWindow.locator('.used-skip').count()).toBe(expectedNumberOfSkips);
    });
  }

  await test.step("Verify skip is disabled after exhaustion", async () => {
    // Go to break state
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
    ])
    await breakWindow.getByTestId("start-break").click()

    // Assert the skip break button is now disabled
    await expect(breakWindow.getByTestId("break-skip")).toBeDisabled();

    // Force click the skip break button
    await breakWindow.getByTestId("break-skip").click({ delay: 1 * 1000, force: true })
    await breakWindow.waitForTimeout(2 * 1000)

    // Assert that it has not closed
    expect(breakWindow.isClosed()).toBeFalsy();
  });
});

test("Changing timer settings only updates after a break", async ({ userDataDir, launchElectron }) => {
  const { settingsWindow, electronApp } = await launchElectron();
  const newTimerInterval = 10;

  await test.step("Change timer duration in settings", async () => {
    // Navigate to the Settings tab
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Settings' }).click();
    await settingsWindow.waitForTimeout(1 * 1000);
    // Assert inputs start at their default values
    expect(Number(await settingsWindow.getByTestId("timer-duration").locator('input').inputValue())).toBe(convertMsToMinutes(DEFAULTS.DEFAULT_TIMER_DURATION_MS));
    expect(Number(await settingsWindow.getByTestId("break-duration").locator('input').inputValue())).toBe(convertMsToSeconds(DEFAULTS.DEFAULT_BREAK_DURATION_MS));
    // Change the timer duration and save
    await settingsWindow.getByTestId("timer-duration").locator('input').fill(String(newTimerInterval));
    await settingsWindow.getByRole('button', { name: 'SAVE CHANGES' }).click();
    await settingsWindow.getByText('Settings saved successfully').waitFor();
  });

  await test.step("Skip to break and verify setting not yet applied", async () => {
    // Navigate back to the Timer tab
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Timer' }).click();
    // Go to break state
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
    ])
    // Assert the new duration has NOT taken effect mid-session
    const initialTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    expect(initialTimerState.currentCountdownMs).not.toBe(convertMinutesToMs(newTimerInterval));
    // Start and skip the break
    await breakWindow.getByTestId("start-break").click()
    await breakWindow.getByTestId("break-skip").click()
    await breakWindow.waitForEvent('close');
  });

  await test.step("Verify setting applied after break completes", async () => {
    // Wait for the settings window to settle after the break
    await settingsWindow.getByTestId("timer-skipbox").waitFor();
    // Assert the new duration is now in effect
    const modifiedTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    expect(modifiedTimerState.currentCountdownMs).toBe(convertMinutesToMs(newTimerInterval))
  });

  await test.step("Verify settings UI still reflects change", async () => {
    // Navigate to the Settings tab
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Settings' }).click();
    await settingsWindow.waitForTimeout(1 * 1000);
    // Assert the inputs still show the saved values
    expect(Number(await settingsWindow.getByTestId("timer-duration").locator('input').inputValue())).toBe(newTimerInterval);
    expect(Number(await settingsWindow.getByTestId("break-duration").locator('input').inputValue())).toBe(convertMsToSeconds(DEFAULTS.DEFAULT_BREAK_DURATION_MS));
  });
});

test("Data persists when app is closed", async ({ launchElectron, userDataDir }) => {
  let savedTimerState: TimerState;

  await test.step("Launch app and pause after delay", async () => {
    const { settingsWindow: firstWindow, electronApp } = await launchElectron();
    // Capture the countdown right after launch
    const initialTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    // Let the timer run, then pause
    await firstWindow.getByTestId("timer-buttons-container").getByTestId('toggle-timer-button').click({ delay: 5 * 1000 });
    // Capture the paused state and assert it advanced from launch
    savedTimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    expect(savedTimerState.currentCountdownMs).not.toBe(initialTimerState.currentCountdownMs);
    // Close the app
    await electronApp.close();
  });

  await test.step("Relaunch and verify persisted state", async () => {
    // Relaunch the app
    const { settingsWindow } = await launchElectron();
    await settingsWindow.waitForLoadState('domcontentloaded');
    // Assert the countdown resumed from the saved value
    const newTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    expect(newTimerState.currentCountdownMs).toBe(savedTimerState.currentCountdownMs);
  });
});