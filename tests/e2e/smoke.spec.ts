import { expect, Page } from "@playwright/test";
import { test } from "./fixtures";
import { FILENAMES, DEFAULTS } from "./../../src/shared/constants"
import fs from "fs";
import path from "path";
import { TimerState } from "../../src/main/timer/timerState"
import { StatsEvent } from "../../src/main/stats/stats"
import { convertMinutesToMs } from "../../src/shared/utils/time"

test.describe.configure({ mode: 'parallel' });

test("App launches with a visible window and starts up with valid components & states", async ({ userDataDir, launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();
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
    await testClock.fastForward(5);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 55")).toBeVisible()
    await testClock.fastForward(5);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 50")).toBeVisible()
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
      electronApp.waitForEvent('window'),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click(),
    ])

    // Assert the overdue timer counts up
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 00")).toBeVisible()
    await testClock.fastForward(5);
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 05")).toBeVisible()
    await testClock.fastForward(5);
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 10")).toBeVisible()
  });

  await test.step("Start break and verify break countdown", async () => {
    // Start the break from the overdue window
    await breakWindow.getByTestId("overdue-window-start-break-button").click();
    // Assert the break timer counts down
    await testClock.fastForward(5);
    await expect(breakWindow.getByTestId('break-window-time-display').getByText("00 : 25")).toBeVisible()
    await testClock.fastForward(5);
    await expect(breakWindow.getByTestId('break-window-time-display').getByText("00 : 20")).toBeVisible()
  });

  await test.step("Quit and verify the stats events were logged in order", async () => {
    await electronApp.close();
    // Each line of the events file is one event
    const events: StatsEvent[] = fs.readFileSync(path.join(userDataDir.path, FILENAMES.STATS.EVENTS), "utf-8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(events.map((event) => event.type)).toEqual(["APP_STARTED", "OVERDUE_STARTED", "BREAK_STARTED", "APP_QUIT"]);
    expect.soft(events[1]).toMatchObject({ cause: "TIMER_SKIPPED", source: "WINDOW", countdownMs: convertMinutesToMs(44) + 50 * 1000 });
    expect.soft(events[2]).toMatchObject({ source: "WINDOW", overdueMs: 10 * 1000 });
    expect.soft(events[3]).toMatchObject({ status: "BREAK" });
  });
});

test("Break window closes after break countdown finishes naturally", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();
  let breakWindow: Page;

  await test.step("Skip to overdue and start break", async () => {
    [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window'),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click(),
    ]);
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 00")).toBeVisible();
    await breakWindow.getByTestId("overdue-window-start-break-button").click();
  });

  await test.step("Verify break is counting down", async () => {
    await testClock.fastForward(5);
    await expect(breakWindow.getByTestId('break-window-time-display').getByText("00 : 25")).toBeVisible();
  });

  await test.step("Verify window closes when break finishes", async () => {
    const closePromise = breakWindow.waitForEvent('close');
    await testClock.fastForward(25);
    await closePromise;
    expect(breakWindow.isClosed()).toBeTruthy();
  });

  await test.step("Verify timer is back to running", async () => {
    await testClock.fastForward(1);
    await expect(settingsWindow.getByTestId('timer-time-display')).toBeVisible();
    const timerText = await settingsWindow.getByTestId('timer-time-display').textContent();
    expect(timerText).not.toContain("00 : 00");
  });
});

test("Data persists when app is closed", async ({ launchElectron, userDataDir }) => {
  let savedTimerState: TimerState;

  await test.step("Launch app, tick, stop, and capture state", async () => {
    const { settingsWindow, electronApp, testClock } = await launchElectron();
    // Read the initial state
    const initialTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    // Advance the timer
    await testClock.fastForward(10);
    // Stop the timer
    await settingsWindow.getByTestId("timer-buttons-container").getByTestId('toggle-timer-button').click();
    // Read the stopped state and assert it advanced
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
