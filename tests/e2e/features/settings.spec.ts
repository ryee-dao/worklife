import { expect } from "@playwright/test";
import { test } from "../fixtures";
import { FILENAMES, DEFAULTS, DIFFICULTY_PRESETS } from "../../../src/shared/constants"
import fs from "fs";
import path from "path";
import { TimerState } from "../../../src/main/timer/timerState"
import { convertMinutesToMs, convertMsToMinutes, convertMsToSeconds } from "../../../src/shared/utils/time"
import { clickAndWaitForClose } from "../helpers";

test.describe.configure({ mode: 'parallel' });

test("Changing timer settings only updates after a break", async ({ userDataDir, launchElectron }) => {
  const { settingsWindow, electronApp } = await launchElectron();
  const newTimerInterval = 10;

  await test.step("Change timer duration in settings", async () => {
    // Navigate to the Settings tab
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Settings' }).click();
    // Assert inputs start at their default values
    expect(Number(await settingsWindow.getByTestId("timer-duration").locator('input').inputValue())).toBe(convertMsToMinutes(DEFAULTS.DEFAULT_TIMER_DURATION_MS));
    // Change the timer duration and save
    await settingsWindow.getByTestId("timer-duration").locator('input').fill(String(newTimerInterval));
    await settingsWindow.getByRole('button', { name: 'SAVE CHANGES' }).click();
    await settingsWindow.getByText('Settings saved successfully').waitFor();
  });

  await test.step("Skip to break and verify setting not yet applied", async () => {
    // Navigate back to the Timer tab
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Timer' }).click();
    // Forward to overdue, which transitions directly
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window'),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('forward-button').click()
    ])
    // Assert the new duration has NOT taken effect mid-session
    const initialTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    expect(initialTimerState.currentCountdownMs).not.toBe(convertMinutesToMs(newTimerInterval));
    // Start the break, then skip it
    await breakWindow.getByTestId("overdue-window-start-break-button").click()
    await clickAndWaitForClose(breakWindow, breakWindow.getByTestId("break-window-skip-break-button"));
  });

  await test.step("Verify setting applied after break completes", async () => {
    // Wait for the settings window to settle after the break
    await settingsWindow.getByTestId("timer-powerup-bar").waitFor();
    // Assert the new duration is now in effect
    const modifiedTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    expect(modifiedTimerState.currentCountdownMs).toBe(convertMinutesToMs(newTimerInterval))
  });

  await test.step("Verify settings UI still reflects change", async () => {
    // Navigate to the Settings tab
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Settings' }).click();
    // Assert the inputs still show the saved values
    expect(Number(await settingsWindow.getByTestId("timer-duration").locator('input').inputValue())).toBe(newTimerInterval);
  });
});

test("Changing difficulty only updates after a break", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();
  const newAllottedPowerups = DIFFICULTY_PRESETS.HARD.allottedPowerups;

  await test.step("Change the difficulty to hard in settings", async () => {
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Settings' }).click();
    await settingsWindow.getByRole('link', { name: 'Difficulty' }).click();
    await settingsWindow.getByTestId("difficulty-card-HARD").click();
    await settingsWindow.getByRole('button', { name: 'SAVE CHANGES' }).click();
    await settingsWindow.getByText('Settings saved successfully').waitFor();
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Timer' }).click();
  });

  await test.step("Verify the power-ups are unchanged before the break", async () => {
    await testClock.fastForward(1);
    await expect(settingsWindow.getByTestId("powerup-count")).toHaveText(`${DEFAULTS.DEFAULT_ALLOTTED_POWERUPS}`);
  });

  await test.step("Take a full break", async () => {
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window'),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('forward-button').click(),
    ]);
    await breakWindow.getByTestId("overdue-window-start-break-button").click();
    const closePromise = breakWindow.waitForEvent('close');
    await testClock.fastForward(convertMsToSeconds(DEFAULTS.DEFAULT_BREAK_DURATION_MS), 0);
    await closePromise;
  });

  await test.step("Verify the new power-up count applies after the break", async () => {
    await testClock.fastForward(1);
    await expect(settingsWindow.getByTestId("powerup-count")).toHaveText(`${newAllottedPowerups}`);
  });
});

test("Workday settings are saved", async ({ launchElectron, userDataDir }) => {
  const { settingsWindow } = await launchElectron();

  await test.step("Change the workday in settings", async () => {
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Settings' }).click();
    await settingsWindow.getByRole('link', { name: 'Workday' }).click();
    await settingsWindow.getByTestId("workday-days").getByRole('checkbox', { name: 'Sun' }).uncheck();
    await settingsWindow.getByTestId("workday-hours").locator('input').first().fill("08:30");
    await settingsWindow.getByTestId("workday-auto-stop").getByRole('checkbox').check();
    await settingsWindow.getByRole('button', { name: 'SAVE CHANGES' }).click();
    await settingsWindow.getByText('Settings saved successfully').waitFor();
  });

  await test.step("Verify the workday was written to file", async () => {
    const workdayConfigs = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.WORKDAY.CONFIGS), "utf-8")
    );
    expect(workdayConfigs).toEqual({ days: [1, 2, 3, 4, 5, 6], start: "08:30", end: "23:59", autoStopAtEnd: true });
  });

  await test.step("Verify an end before the start can't be saved", async () => {
    await settingsWindow.getByTestId("workday-hours").locator('input').last().fill("08:00");
    await expect(settingsWindow.getByText("The workday must end after it starts")).toBeVisible();
    await expect(settingsWindow.getByRole('button', { name: 'SAVE CHANGES' })).toBeDisabled();
  });
});
