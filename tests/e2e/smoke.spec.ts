import { expect, Page } from "@playwright/test";
import { test } from "./fixtures";
import { FILENAMES, DEFAULTS, DIFFICULTY_PRESETS } from "./../../src/shared/constants"
import fs from "fs";
import path from "path";
import { TimerState } from "../../src/main/timer/timerState"
import { StatsEvent } from "../../src/main/stats/stats"
import { convertMinutesToMs, convertMsToMinutes, convertMsToSeconds } from "../../src/shared/utils/time"
import { clickAndWaitForClose, clickTrayMenuItem, getTrayMenuLabels, getWindowBounds } from "./helpers";

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
      electronApp.waitForEvent('window'),
      testClock.fastForward(1),
    ]);

    // Assert the overdue timer counts up
    await testClock.fastForward(5);
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 05")).toBeVisible()
    await testClock.fastForward(5);
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 10")).toBeVisible()
  });
});

test("App stops properly", async ({ launchElectron }) => {
  const { settingsWindow, testClock } = await launchElectron();

  await test.step("Tick and capture initial state", async () => {
    // Advance 5 seconds so we have a known display value
    await testClock.fastForward(5);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 55")).toBeVisible()
  });

  await test.step("Stop and verify timer stops", async () => {
    // Stop the timer
    await settingsWindow.getByTestId('toggle-timer-button').click();
    // Tick while stopped, timer should not move
    await testClock.fastForward(5);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 55")).toBeVisible()
  });

  await test.step("Resume and verify timer resumes", async () => {
    // Resume the timer
    await settingsWindow.getByTestId('toggle-timer-button').click();
    // Tick after resuming, timer should now advance
    await testClock.fastForward(5);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 50")).toBeVisible()
  });
});

test("Snooze adds time and uses one snooze", async ({ launchElectron }) => {
  const { settingsWindow, testClock } = await launchElectron();
  const snoozeButton = settingsWindow.getByTestId("snooze-button");

  await test.step("Snooze shows its length and how many are left", async () => {
    await testClock.fastForward(1);
    await expect(snoozeButton).toContainText("+5m");
    await expect(snoozeButton).toContainText(`${DEFAULTS.DEFAULT_ALLOTTED_SNOOZES} left`);
  });

  await test.step("Snoozing adds 5 minutes to the countdown", async () => {
    await snoozeButton.click();
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("49 : 59")).toBeVisible();
    await expect(snoozeButton).toContainText(`${DEFAULTS.DEFAULT_ALLOTTED_SNOOZES - 1} left`);
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
        electronApp.waitForEvent('window'),
        settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
      ]);

      if (skipFromOverdue) {
        // Skip break directly from overdue without starting break first
        await expect(breakWindow.getByTestId('overdue-window-time-display')).toBeVisible();
        await clickAndWaitForClose(breakWindow, breakWindow.getByTestId("overdue-window-skip-break-button"));
      } else {
        // Start break first, then skip from break screen
        await breakWindow.getByTestId("overdue-window-start-break-button").click();
        await clickAndWaitForClose(breakWindow, breakWindow.getByTestId("break-window-skip-break-button"));
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
      electronApp.waitForEvent('window'),
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
      electronApp.waitForEvent('window'),
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
    await clickAndWaitForClose(breakWindow, breakWindow.getByTestId("overdue-window-skip-break-button"));
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
    // Skip to overdue, skipTimer transitions directly
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window'),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click()
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

test("Changing difficulty only updates after a break", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();
  const newAllottedBreaks = DIFFICULTY_PRESETS.HARD.allottedBreaks;

  await test.step("Change the difficulty to hard in settings", async () => {
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Settings' }).click();
    await settingsWindow.getByRole('link', { name: 'Difficulty' }).click();
    await settingsWindow.getByTestId("difficulty-level").getByRole('radio', { name: /Hard/ }).check();
    await settingsWindow.getByRole('button', { name: 'SAVE CHANGES' }).click();
    await settingsWindow.getByText('Settings saved successfully').waitFor();
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Timer' }).click();
  });

  await test.step("Verify the skips are unchanged before the break", async () => {
    await testClock.fastForward(1);
    await expect(settingsWindow.getByTestId("timer-skip-icon")).toHaveCount(DEFAULTS.DEFAULT_ALLOTTED_BREAKS);
  });

  await test.step("Take a full break", async () => {
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window'),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('skip-button').click(),
    ]);
    await breakWindow.getByTestId("overdue-window-start-break-button").click();
    const closePromise = breakWindow.waitForEvent('close');
    await testClock.fastForward(convertMsToSeconds(DEFAULTS.DEFAULT_BREAK_DURATION_MS), 0);
    await closePromise;
  });

  await test.step("Verify the new skip count applies after the break", async () => {
    await testClock.fastForward(1);
    await expect(settingsWindow.getByTestId("timer-skip-icon")).toHaveCount(newAllottedBreaks);
  });
});

test("Workday settings are saved", async ({ launchElectron, userDataDir }) => {
  const { settingsWindow } = await launchElectron();

  await test.step("Change the workday in settings", async () => {
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Settings' }).click();
    await settingsWindow.getByRole('link', { name: 'Workday' }).click();
    await settingsWindow.getByTestId("workday-days").getByRole('checkbox', { name: 'Sat' }).check();
    await settingsWindow.getByTestId("workday-hours").locator('input').first().fill("08:30");
    await settingsWindow.getByTestId("workday-auto-stop").getByRole('checkbox').check();
    await settingsWindow.getByRole('button', { name: 'SAVE CHANGES' }).click();
    await settingsWindow.getByText('Settings saved successfully').waitFor();
  });

  await test.step("Verify the workday was written to file", async () => {
    const workdayConfigs = JSON.parse(
      fs.readFileSync(path.join(userDataDir.path, FILENAMES.WORKDAY.CONFIGS), "utf-8")
    );
    expect(workdayConfigs).toEqual({ days: [1, 2, 3, 4, 5, 6], start: "08:30", end: "17:00", autoStopAtEnd: true });
  });

  await test.step("Verify an end before the start can't be saved", async () => {
    await settingsWindow.getByTestId("workday-hours").locator('input').last().fill("08:00");
    await expect(settingsWindow.getByText("The workday must end after it starts")).toBeVisible();
    await expect(settingsWindow.getByRole('button', { name: 'SAVE CHANGES' })).toBeDisabled();
  });
});

test("Overdue window grows in size across levels", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();
  let breakWindow: Page;
  let initialBounds: Electron.Rectangle | null

  await test.step("Skip to overdue and capture initial window size", async () => {
    [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window'),
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

test("Warning sound triggers when timer crosses warning threshold", async ({ launchElectron, userDataDir }) => {
  // Seed countdown just above the warning threshold so one tick crosses it
  const warningThresholdMs = DEFAULTS.DEFAULT_WARNING_THRESHOLD_MS;
  userDataDir.seed(FILENAMES.TIMER.STATE, {
    currentCountdownMs: warningThresholdMs + 5000,
    status: "RUNNING",
    _bypassThreshold: true,
  });

  const { settingsWindow, testClock } = await launchElectron();

  interface WindowWithAudioSpy extends Window {
    __audioPlayCalls: string[];
  }

  await test.step("Inject Audio spy before warning fires", async () => {
    // Replace Audio in the renderer with a spy that tracks calls
    await settingsWindow.evaluate(() => {
      const w = window as unknown as WindowWithAudioSpy;
      w.__audioPlayCalls = [];
      window.Audio = class MockAudio {
        src: string;
        constructor(src?: string) {
          this.src = src || '';
        }
        play() {
          (window as unknown as WindowWithAudioSpy).__audioPlayCalls.push(this.src);
          return Promise.resolve();
        }
      } as unknown as typeof Audio;
    });
  });

  await test.step("Tick before warning threshold and verify sound was not triggered", async () => {
    await testClock.fastForward(1);

    const audioPlayCalls = await settingsWindow.evaluate(() => {
      return (window as unknown as WindowWithAudioSpy).__audioPlayCalls;
    });

    expect(audioPlayCalls.length).toBe(0);
  });

  await test.step("Tick past warning threshold and verify sound was triggered", async () => {
    await testClock.fastForward(10);

    const audioPlayCalls = await settingsWindow.evaluate(() => {
      return (window as unknown as WindowWithAudioSpy).__audioPlayCalls;
    });

    expect(audioPlayCalls.length).toBe(1);
    expect(audioPlayCalls[0]).toContain('warning');
  });
});

test('Closing the settings window hides it and keeps the app running', async ({ launchElectron }) => {
  const { electronApp } = await launchElectron();

  const getSettingsWindowState = () =>
    electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('dashboard'));
      return win ? { visible: win.isVisible(), destroyed: win.isDestroyed() } : null;
    });

  await test.step('Close the settings window', async () => {
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('dashboard'))!.close();
    });
  });

  await test.step('Window is hidden, not destroyed', async () => {
    // null = destroyed (close handler missing), visible = hide() didn't run
    await expect.poll(getSettingsWindowState).toEqual({ visible: false, destroyed: false });
  });
});

test('Display listeners are not re-registered when a break window opens', async ({ userDataDir, launchElectron }) => {
  userDataDir.seed(FILENAMES.TIMER.STATE, {
    currentCountdownMs: 1000,
    status: 'RUNNING',
    _bypassThreshold: true,
  });
  const { electronApp, testClock } = await launchElectron();
  let listenersAtStartup: number;

  const getDisplayListenerCount = () =>
    electronApp.evaluate(({ screen }) => screen.listenerCount('display-metrics-changed'));


  await test.step('Count display listeners at startup', async () => {
    listenersAtStartup = await getDisplayListenerCount();
  });

  await test.step('Go overdue so the break window is created', async () => {
    await testClock.fastForward(1);
    await expect.poll(() =>
      electronApp.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some(w => w.webContents.getURL().includes('break'))
      )
    ).toBe(true);
  });

  await test.step('Display listener count is unchanged', async () => {
    expect(await getDisplayListenerCount()).toBe(listenersAtStartup);
  });
});
test("Tray menu shows the right actions and controls the timer", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron({ withTray: true });
  let breakWindow: Page;

  await test.step("Running: menu offers Stop, Skip to Break and Snooze", async () => {
    // The tray menu is built on the first tick
    await testClock.fastForward(1);
    expect(await getTrayMenuLabels(electronApp)).toEqual(["Show Settings", "Stop", "Skip to Break", "Snooze +5 min", "Quit"]);
  });

  await test.step("Stop from the tray stops the timer", async () => {
    await clickTrayMenuItem(electronApp, "Stop");
    await testClock.fastForward(5);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 59")).toBeVisible();
    expect(await getTrayMenuLabels(electronApp)).toEqual(["Show Settings", "Resume", "Quit"]);
  });

  await test.step("Resume from the tray restarts the timer", async () => {
    await clickTrayMenuItem(electronApp, "Resume");
    await testClock.fastForward(5);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 54")).toBeVisible();
  });

  await test.step("Skip to Break from the tray opens the overdue window", async () => {
    [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window'),
      clickTrayMenuItem(electronApp, "Skip to Break"),
    ]);
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 00")).toBeVisible();
    expect(await getTrayMenuLabels(electronApp)).toEqual(["Show Settings", "Start Break", "Skip Break", "Quit"]);
  });

  await test.step("Start Break from the tray starts the break", async () => {
    await clickTrayMenuItem(electronApp, "Start Break");
    await testClock.fastForward(5);
    await expect(breakWindow.getByTestId('break-window-time-display').getByText("00 : 25")).toBeVisible();
  });

  await test.step("Skip Break from the tray ends the break and uses a skip", async () => {
    const closePromise = breakWindow.waitForEvent('close');
    await clickTrayMenuItem(electronApp, "Skip Break");
    await closePromise;
    await settingsWindow.getByTestId("timer-skipbox").waitFor();
    expect(await settingsWindow.locator('.used-skip').count()).toBe(1);
  });
});
