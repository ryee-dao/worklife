import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { FILENAMES, DEFAULTS } from "./../../src/shared/constants"
import fs from "fs";
import path from "path";
import { TimerState } from "../../src/main/timer/timerState"
import { convertMinutesToMs, convertMsToMinutes, convertMsToSeconds } from "../../src/shared/utils/time"

test.describe.configure({ mode: 'parallel' });

test("App launches with a visible window and starts up with valid components & states", async ({ userDataDir, launchElectron }) => {
  const { settingsWindow, electronApp } = await launchElectron();

  await test.step("Verify defaults written to file", async () => {
    const initialTimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    expect.soft(initialTimerState.currentCountdownMs).toBe(DEFAULTS.DEFAULT_TIMER_DURATION_MS);
    expect.soft(initialTimerState.status).toBe("RUNNING");
  });

  await test.step("Verify timer counts down", async () => {
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 55")).toBeVisible({ timeout: 6 * 1000 })
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 50")).toBeVisible({ timeout: 6 * 1000 })
  });

  await test.step("Verify default UI state", async () => {
    expect(await settingsWindow.getByTestId("timer-skip-icon").count()).toBe(3)
    await expect(settingsWindow.getByTestId("timer-buttons-container").getByTestId('toggle-timer-button')).toBeVisible();
    await expect(settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button')).toBeVisible();
  });

  await test.step("Skip to break and verify break countdown", async () => {
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
    ])
    await expect(breakWindow.getByTestId('break-time-display').getByText("00 : 25")).toBeVisible({ timeout: 6 * 1000 })
    await expect(breakWindow.getByTestId('break-time-display').getByText("00 : 20")).toBeVisible({ timeout: 6 * 1000 })
  });
});


test("App launches the break window properly when the timer countdown is reached", async ({ launchElectron, userDataDir }) => {
  userDataDir.seed(FILENAMES.TIMER.STATE, {
    currentCountdownMs: 5 * 1000,
    status: "RUNNING",
    _bypassThreshold: true,
  })

  const { settingsWindow, electronApp } = await launchElectron();

  await test.step("Verify timer counts down from seeded state", async () => {
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("00 : 0")).toBeVisible({ timeout: 3 * 1000 })
  });

  await test.step("Verify break window appears and counts down", async () => {
    const breakWindow = await electronApp.waitForEvent('window', { timeout: 10 * 1000 });
    await expect(breakWindow.getByTestId('break-time-display').getByText("00 : 25")).toBeVisible({ timeout: 6 * 1000 })
    await expect(breakWindow.getByTestId('break-time-display').getByText("00 : 20")).toBeVisible({ timeout: 6 * 1000 })
  });
});

test("App pauses properly", async ({ launchElectron }) => {
  const { settingsWindow } = await launchElectron();
  const timerBeforePause = await settingsWindow.getByTestId('timer-time-display').textContent()

  await test.step("Pause and verify timer stops", async () => {
    await settingsWindow.getByTestId('toggle-timer-button').click();
    await settingsWindow.waitForTimeout(3 * 1000);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText(timerBeforePause!)).toBeVisible({ timeout: 3 * 1000 })
  });

  await test.step("Unpause and verify timer resumes", async () => {
    await settingsWindow.getByTestId('toggle-timer-button').click();
    await settingsWindow.waitForTimeout(3 * 1000);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText(timerBeforePause!)).not.toBeVisible({ timeout: 3 * 1000 })
  });
});

test("Break window is unable to skip after all skips are exhausted", async ({ launchElectron }) => {
  const { settingsWindow, electronApp } = await launchElectron();

  await test.step("Verify initial skip state", async () => {
    await settingsWindow.getByTestId("timer-skipbox").waitFor()
    const totalNumberOfSkips = await settingsWindow.getByTestId("timer-skip-icon").count()
    const currentNumberOfUsedSkips = await settingsWindow.locator('.used-skip').count()
    expect(totalNumberOfSkips).toBeGreaterThan(0);
    expect(currentNumberOfUsedSkips).toBe(0);
  });

  const totalNumberOfSkips = await settingsWindow.getByTestId("timer-skip-icon").count()
  let expectedNumberOfSkips = 0;

  for (let loopIdx = 0; loopIdx < totalNumberOfSkips; loopIdx++) {
    await test.step(`Exhaust skip ${loopIdx + 1} of ${totalNumberOfSkips}`, async () => {
      const [breakWindow] = await Promise.all([
        electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
        settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
      ])

      await breakWindow.getByTestId("break-skip").click()
      await breakWindow.waitForEvent('close');
      await settingsWindow.getByTestId("timer-skipbox").waitFor()

      expect(breakWindow.isClosed()).toBeTruthy();
      expect(await settingsWindow.getByTestId("timer-skip-icon").count()).toBe(totalNumberOfSkips);

      expectedNumberOfSkips += 1;
      expect(await settingsWindow.locator('.used-skip').count()).toBe(expectedNumberOfSkips);
    });
  }

  await test.step("Verify skip is disabled after exhaustion", async () => {
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
    ])

    await expect(breakWindow.getByTestId("break-skip")).toBeDisabled();
    await breakWindow.getByTestId("break-skip").click({ delay: 1 * 1000, force: true })
    await breakWindow.waitForTimeout(2 * 1000)
    expect(breakWindow.isClosed()).toBeFalsy();
  });
});

test("Changing timer settings properly reflects after the break", async ({ userDataDir, launchElectron }) => {
  const { settingsWindow, electronApp } = await launchElectron();
  const newTimerInterval = 10;

  await test.step("Change timer duration in settings", async () => {
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Settings' }).click();
    await settingsWindow.waitForTimeout(1 * 1000);
    expect(Number(await settingsWindow.getByTestId("timer-duration").locator('input').inputValue())).toBe(convertMsToMinutes(DEFAULTS.DEFAULT_TIMER_DURATION_MS));
    expect(Number(await settingsWindow.getByTestId("break-duration").locator('input').inputValue())).toBe(convertMsToSeconds(DEFAULTS.DEFAULT_BREAK_DURATION_MS));
    await settingsWindow.getByTestId("timer-duration").locator('input').fill(String(newTimerInterval));
    await settingsWindow.getByRole('button', { name: 'SAVE CHANGES' }).click();
    await settingsWindow.getByText('Settings saved successfully').waitFor();
  });

  await test.step("Skip to break and verify setting not yet applied", async () => {
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Timer' }).click();
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
    ])
    const initialTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    expect(initialTimerState.currentCountdownMs).not.toBe(convertMinutesToMs(newTimerInterval));
    await breakWindow.getByTestId("break-skip").click()
    await breakWindow.waitForEvent('close');
  });

  await test.step("Verify setting applied after break completes", async () => {
    await settingsWindow.getByTestId("timer-skipbox").waitFor();
    const modifiedTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    expect(modifiedTimerState.currentCountdownMs).toBe(convertMinutesToMs(newTimerInterval))
  });

  await test.step("Verify settings UI still reflects change", async () => {
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Settings' }).click();
    await settingsWindow.waitForTimeout(1 * 1000);
    expect(Number(await settingsWindow.getByTestId("timer-duration").locator('input').inputValue())).toBe(newTimerInterval);
    expect(Number(await settingsWindow.getByTestId("break-duration").locator('input').inputValue())).toBe(convertMsToSeconds(DEFAULTS.DEFAULT_BREAK_DURATION_MS));
  });
});

test("Data persists when app is closed", async ({ launchElectron, userDataDir }) => {
  let savedTimerState: TimerState;

  await test.step("Launch app and pause after delay", async () => {
    const { settingsWindow: firstWindow, electronApp } = await launchElectron();
    const initialTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    await firstWindow.getByTestId("timer-buttons-container").getByTestId('toggle-timer-button').click({ delay: 5 * 1000 });
    savedTimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    expect(savedTimerState.currentCountdownMs).not.toBe(initialTimerState.currentCountdownMs);
    await electronApp.close();
  });

  await test.step("Relaunch and verify persisted state", async () => {
    const { settingsWindow } = await launchElectron();
    await settingsWindow.waitForLoadState('domcontentloaded');
    const newTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    expect(newTimerState.currentCountdownMs).toBe(savedTimerState.currentCountdownMs);
  });
});