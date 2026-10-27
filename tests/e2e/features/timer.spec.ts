import { expect, Page } from "@playwright/test";
import { test } from "../fixtures";
import { FILENAMES, DEFAULTS } from "../../../src/shared/constants"
import { convertMsToSeconds } from "../../../src/shared/utils/time"
import { clickAndWaitForClose, getWindowBounds } from "../helpers";

test.describe.configure({ mode: 'parallel' });

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

test("Snooze adds time and uses one power-up", async ({ launchElectron }) => {
  const { settingsWindow, testClock } = await launchElectron();
  const snoozeButton = settingsWindow.getByTestId("snooze-button");
  const powerupCount = settingsWindow.getByTestId("powerup-count");

  await test.step("Snooze shows its length, and the bar shows the power-ups left", async () => {
    await testClock.fastForward(1);
    await expect(snoozeButton).toContainText("+5m");
    await expect(powerupCount).toHaveText(`${DEFAULTS.DEFAULT_ALLOTTED_POWERUPS}`);
  });

  await test.step("Snoozing adds 5 minutes to the countdown", async () => {
    await snoozeButton.click();
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("49 : 59")).toBeVisible();
    await expect(powerupCount).toHaveText(`${DEFAULTS.DEFAULT_ALLOTTED_POWERUPS - 1}`);
  });
});

test("Lunch counts down, can end early, and is used up for the day", async ({ launchElectron }) => {
  const { settingsWindow, testClock } = await launchElectron();
  const lunchButton = settingsWindow.getByTestId("lunch-button");

  await test.step("Take lunch from the power-up bar", async () => {
    await testClock.fastForward(1);
    await expect(settingsWindow.getByTestId("lunch-count")).toHaveText("1");
    await lunchButton.click();
    await expect(settingsWindow.getByTestId("timer-lunch-label")).toBeVisible();
    await testClock.fastForward(5);
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 55")).toBeVisible(); // The 45 minute lunch
  });

  await test.step("Coming back early starts a full work session", async () => {
    await settingsWindow.getByTestId("timer-buttons-container").getByTestId("toggle-timer-button").click();
    await testClock.fastForward(1);
    await expect(settingsWindow.getByTestId("timer-lunch-label")).toBeHidden();
    await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 59")).toBeVisible();
  });

  await test.step("Lunch is gone for the rest of the day", async () => {
    await expect(settingsWindow.getByTestId("lunch-count")).toHaveText("0");
    await expect(lunchButton).toBeDisabled();
  });
});

test("Stop is an escape hatch from the overdue window", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();

  const [breakWindow] = await Promise.all([
    electronApp.waitForEvent('window'),
    settingsWindow.getByTestId("timer-buttons-container").getByTestId('forward-button').click(),
  ]);
  await clickAndWaitForClose(breakWindow, breakWindow.getByTestId("overdue-window-stop-button"));

  // Stopped with a full timer, so resuming starts a fresh work session
  await testClock.fastForward(1);
  await expect(settingsWindow.getByTestId('timer-time-display').getByText("45 : 00")).toBeVisible();
  await settingsWindow.getByTestId("timer-buttons-container").getByTestId("toggle-timer-button").click();
  await testClock.fastForward(1);
  await expect(settingsWindow.getByTestId('timer-time-display').getByText("44 : 59")).toBeVisible();
});

test("Break window is unable to skip after all power-ups are used", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();
  const powerupCount = settingsWindow.getByTestId("powerup-count");
  const totalNumberOfSkips = DEFAULTS.DEFAULT_ALLOTTED_POWERUPS;

  await test.step("Verify every power-up is left", async () => {
    await expect(powerupCount).toHaveText(`${totalNumberOfSkips}`);
  });

  // First iteration skips directly from overdue,
  // remaining iterations go through break window
  // Both paths should consume a skip and close the window.
  for (let loopIdx = 0; loopIdx < totalNumberOfSkips; loopIdx++) {
    const skipFromOverdue = loopIdx === 0;

    await test.step(`Exhaust skip ${loopIdx + 1} of ${totalNumberOfSkips} (from ${skipFromOverdue ? 'overdue' : 'break'})`, async () => {
      // Skip to overdue to open the break window
      const [breakWindow] = await Promise.all([
        electronApp.waitForEvent('window'),
        settingsWindow.getByTestId("timer-buttons-container").getByTestId('forward-button').click()
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

      // Verify the skip was registered: window closed and one fewer power-up left
      expect(breakWindow.isClosed()).toBeTruthy();
      await expect(powerupCount).toHaveText(`${totalNumberOfSkips - loopIdx - 1}`);
    });
  }

  await test.step("Verify skip is disabled on overdue and break screens after exhaustion", async () => {
    // Open a new overdue window with all skips exhausted
    const [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window'),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('forward-button').click()
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
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('forward-button').click(),
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
    // Skipping from overdue should still use a power-up, same as skipping from break
    await expect(settingsWindow.getByTestId("powerup-count")).toHaveText(`${DEFAULTS.DEFAULT_ALLOTTED_POWERUPS - 1}`);
  });
});

test("Overdue window grows in size across levels", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron();
  let breakWindow: Page;
  let initialBounds: Electron.Rectangle | null

  await test.step("Skip to overdue and capture initial window size", async () => {
    [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window'),
      settingsWindow.getByTestId("timer-buttons-container").getByTestId('forward-button').click(),
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
