import { expect, Page } from "@playwright/test";
import { test } from "./fixtures";
import { FILENAMES, DEFAULTS } from "./../../src/shared/constants"
import fs from "fs";
import path from "path";
import { TimerState } from "../../src/main/timer/timerState"
import { convertMinutesToMs, convertMsToMinutes, convertMsToSeconds } from "../../src/shared/utils/time"
import { getWindowBounds } from "./helpers";

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
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
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
});

test("App launches the overdue window properly when the timer countdown is reached", async ({ launchElectron, userDataDir }) => {
  // Seed a short countdown so the timer expires quickly
  userDataDir.seed(FILENAMES.TIMER.STATE, {
    currentCountdownMs: 5 * 1000,
    status: "RUNNING",
    _bypassThreshold: true,
  })

  const { settingsWindow, electronApp, testClock } = await launchElectron();

  await test.step("Verify timer counts down from seeded state", async () => {
    // Tick 4 times, countdown should be at 1 second
    await testClock.fastForward(4);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("00 : 01")).toBeVisible()
  });

  await test.step("Verify overdue window appears and counts up", async () => {
    // Listen for the window before the tick that triggers it
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
      testClock.fastForward(1),
    ]);

    // Assert the overdue timer counts up
    await testClock.fastForward(5);
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 05")).toBeVisible()
    await testClock.fastForward(5);
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 10")).toBeVisible()
  });
});

test("App pauses properly", async ({ launchElectron }) => {
  const { settingsWindow, testClock } = await launchElectron();

  await test.step("Tick and capture initial state", async () => {
    // Advance 5 seconds so we have a known display value
    await testClock.fastForward(5);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 55")).toBeVisible()
  });

  await test.step("Pause and verify timer stops", async () => {
    // Pause the timer
    await settingsWindow.getByTestId('toggle-timer-button').click();
    // Tick while paused, timer should not move
    await testClock.fastForward(5);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 55")).toBeVisible()
  });

  await test.step("Unpause and verify timer resumes", async () => {
    // Unpause the timer
    await settingsWindow.getByTestId('toggle-timer-button').click();
    // Tick after unpause, timer should now advance
    await testClock.fastForward(5);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 50")).toBeVisible()
  });
});

test("Break window is unable to skip after all skips are exhausted", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();

  await test.step("Verify initial skip state", async () => {
    // All skip icons should be visible and none should be used
    await settingsWindow.getByTestId("timer-skipbox").waitFor();
    const totalNumberOfSkips = await settingsWindow.getByTestId("timer-skip-icon").count();
    const currentNumberOfUsedSkips = await settingsWindow.locator('.used-skip').count();
    expect(totalNumberOfSkips).toBeGreaterThan(0);
    expect(currentNumberOfUsedSkips).toBe(0);
  });

  const totalNumberOfSkips = await settingsWindow.getByTestId("timer-skip-icon").count();
  let expectedNumberOfSkips = 0;

  // First iteration skips directly from overdue,
  // remaining iterations go through break window
  // Both paths should consume a skip and close the window.
  for (let loopIdx = 0; loopIdx < totalNumberOfSkips; loopIdx++) {
    const skipFromOverdue = loopIdx === 0;

    await test.step(`Exhaust skip ${loopIdx + 1} of ${totalNumberOfSkips} (from ${skipFromOverdue ? 'overdue' : 'break'})`, async () => {
      // Skip to overdue to open the break window
      const [breakWindow] = await Promise.all([
        electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
        settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
      ]);

      if (skipFromOverdue) {
        // Skip break directly from overdue without starting break first
        await expect(breakWindow.getByTestId('overdue-window-time-display')).toBeVisible();
        const closePromise = breakWindow.waitForEvent('close');
        await breakWindow.getByTestId("overdue-window-skip-break-button").click();
        await testClock.fastForward(1);
        await closePromise;
      } else {
        // Start break first, then skip from break screen
        await breakWindow.getByTestId("overdue-window-start-break-button").click();
        const closePromise = breakWindow.waitForEvent('close');
        await breakWindow.getByTestId("break-window-skip-break-button").click();
        await testClock.fastForward(1);
        await closePromise;
      }

      // Verify the skip was registered: window closed and used-skip count increased
      await settingsWindow.getByTestId("timer-skipbox").waitFor();
      expect(breakWindow.isClosed()).toBeTruthy();
      expect(await settingsWindow.getByTestId("timer-skip-icon").count()).toBe(totalNumberOfSkips);

      expectedNumberOfSkips += 1;
      expect(await settingsWindow.locator('.used-skip').count()).toBe(expectedNumberOfSkips);
    });
  }

  await test.step("Verify skip is disabled on overdue and break screens after exhaustion", async () => {
    // Open a new overdue window with all skips exhausted
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
    ]);

    // The skip button on the overdue screen should be disabled
    await expect(breakWindow.getByTestId("overdue-window-skip-break-button")).toBeDisabled();
    // Force-clicking the disabled button should have no effect
    await breakWindow.getByTestId("overdue-window-skip-break-button").click({ force: true });
    await testClock.fastForward(1);
    expect(breakWindow.isClosed()).toBeFalsy();

    // Transition to break screen and verify the same constraint holds
    await breakWindow.getByTestId("overdue-window-start-break-button").click();

    // The skip button on the break screen should also be disabled
    await expect(breakWindow.getByTestId("break-window-skip-break-button")).toBeDisabled();
    // Force-clicking the disabled button should have no effect
    await breakWindow.getByTestId("break-window-skip-break-button").click({ force: true });
    await testClock.fastForward(1);
    expect(breakWindow.isClosed()).toBeFalsy();
  });
});

test("Break can be skipped directly from overdue without starting break first", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();
  let breakWindow: Page;

  await test.step("Skip to overdue", async () => {
    // Skip the work timer to trigger the overdue window
    [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click(),
    ]);
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 00")).toBeVisible();
  });

  await test.step("Verify overdue is counting up before skipping", async () => {
    // Let the overdue timer accumulate to confirm the window is actively tracking
    await testClock.fastForward(7);
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 07")).toBeVisible();
  });

  await test.step("Skip break directly from overdue and verify window closes", async () => {
    // Clicking skip from overdue should bypass the break screen entirely
    // and transition straight back to running
    const closePromise = breakWindow.waitForEvent('close');
    await breakWindow.getByTestId("overdue-window-skip-break-button").click();
    await testClock.fastForward(1);
    await closePromise;
    expect(breakWindow.isClosed()).toBeTruthy();
  });

  await test.step("Verify timer is back to running with fresh countdown", async () => {
    // The settings window should show the timer counting from a full work session
    await testClock.fastForward(1);
    await expect(settingsWindow.getByTestId('timer-time-display')).toBeVisible();
    const timerText = await settingsWindow.getByTestId('timer-time-display').textContent();
    expect(timerText).toContain("44 : 59");
  });

  await test.step("Verify skip was counted", async () => {
    // Skipping from overdue should still consume a skip, same as skipping from break
    await settingsWindow.getByTestId("timer-skipbox").waitFor();
    expect(await settingsWindow.locator('.used-skip').count()).toBe(1);
  });
});
test("Changing timer settings only updates after a break", async ({ userDataDir, launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();
  const newTimerInterval = 10;

  await test.step("Change timer duration in settings", async () => {
    // Navigate to the Settings tab
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Settings' }).click();
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
    // Skip to overdue, skipTimer transitions directly
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
    ])
    // Assert the new duration has NOT taken effect mid-session
    const initialTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    expect(initialTimerState.currentCountdownMs).not.toBe(convertMinutesToMs(newTimerInterval));
    // Start the break, then skip it
    await breakWindow.getByTestId("overdue-window-start-break-button").click()
    const closePromise = breakWindow.waitForEvent('close');
    await breakWindow.getByTestId("break-window-skip-break-button").click()
    await testClock.fastForward(1);
    await closePromise;
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
    // Assert the inputs still show the saved values
    expect(Number(await settingsWindow.getByTestId("timer-duration").locator('input').inputValue())).toBe(newTimerInterval);
    expect(Number(await settingsWindow.getByTestId("break-duration").locator('input').inputValue())).toBe(convertMsToSeconds(DEFAULTS.DEFAULT_BREAK_DURATION_MS));
  });
});

test("Data persists when app is closed", async ({ launchElectron, userDataDir }) => {
  let savedTimerState: TimerState;

  await test.step("Launch app, tick, pause, and capture state", async () => {
    const { settingsWindow, electronApp, testClock } = await launchElectron();
    // Read the initial state
    const initialTimerState: TimerState = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.TIMER.STATE), "utf-8")
    );
    // Advance the timer
    await testClock.fastForward(10);
    // Pause the timer
    await settingsWindow.getByTestId("timer-buttons-container").getByTestId('toggle-timer-button').click();
    // Read the paused state and assert it advanced
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

test("Overdue window grows in size across levels", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();
  let breakWindow: Page;
  let initialBounds: Electron.Rectangle | null

  await test.step("Skip to overdue and capture initial window size", async () => {
    [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click(),
    ]);
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 00")).toBeVisible();
    await testClock.fastForward(1);
    initialBounds = await getWindowBounds(electronApp, breakWindow);
  });

  await test.step("Verify window grows after crossing level 1 threshold", async () => {
    await testClock.fastForward(convertMsToSeconds(DEFAULTS.DEFAULT_LEVEL_THRESHOLD_MS));
    const level1Bounds = await getWindowBounds(electronApp, breakWindow);
    expect(level1Bounds!.width).toBeGreaterThan(initialBounds!.width);
    expect(level1Bounds!.height).toBeGreaterThan(initialBounds!.height);
  });

  await test.step("Verify window grows again after crossing level 2 threshold", async () => {
    const beforeBounds = await getWindowBounds(electronApp, breakWindow);
    await testClock.fastForward(convertMsToSeconds(DEFAULTS.DEFAULT_LEVEL_THRESHOLD_MS));
    const level2Bounds = await getWindowBounds(electronApp, breakWindow);
    expect(level2Bounds!.width).toBeGreaterThan(beforeBounds!.width);
    expect(level2Bounds!.height).toBeGreaterThan(beforeBounds!.height);
  });

  await test.step("Verify window grows again after crossing level 3 threshold", async () => {
    const beforeBounds = await getWindowBounds(electronApp, breakWindow);
    await testClock.fastForward(convertMsToSeconds(DEFAULTS.DEFAULT_LEVEL_THRESHOLD_MS));
    const level3Bounds = await getWindowBounds(electronApp, breakWindow);
    expect(level3Bounds!.width).toBeGreaterThan(beforeBounds!.width);
    expect(level3Bounds!.height).toBeGreaterThan(beforeBounds!.height);
  });
});

test("Break window closes after break countdown finishes naturally", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();
  let breakWindow: Page;

  await test.step("Skip to overdue and start break", async () => {
    [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window', { timeout: 10 * 1000 }),
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