import { expect, Page } from "@playwright/test";
import { test } from "../fixtures";
import { clickTrayMenuItem, getTrayMenuLabels } from "../helpers";

test.describe.configure({ mode: 'parallel' });

test("Tray menu shows the right actions and controls the timer", async ({ launchElectron }) => {
  const { settingsWindow, electronApp, testClock } = await launchElectron({ withTray: true });
  let breakWindow: Page;

  await test.step("Running: menu offers Stop, Forward to Break, Snooze and Lunch", async () => {
    // The tray menu is built on the first tick
    await testClock.fastForward(1);
    expect(await getTrayMenuLabels(electronApp)).toEqual(["Show Settings", "Stop", "Forward to Break", "Snooze +5 min", "Lunch (45 min)", "Quit"]);
    const header = await electronApp.evaluate(() => global.__test_getTrayMenu!()!.items[0].label);
    expect(header).toMatch(/^Today: (Dim|Glimmer|Glow|Shine|Radiant)/);
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

  await test.step("Forward to Break from the tray opens the overdue window", async () => {
    [breakWindow] = await Promise.all([
      electronApp.waitForEvent('window'),
      clickTrayMenuItem(electronApp, "Forward to Break"),
    ]);
    await expect(breakWindow.getByTestId('overdue-window-time-display').getByText("00 : 00")).toBeVisible();
    expect(await getTrayMenuLabels(electronApp)).toEqual(["Show Settings", "Start Break", "Lunch (45 min)", "Skip Break", "Stop", "Quit"]);
  });

  await test.step("Start Break from the tray starts the break", async () => {
    await clickTrayMenuItem(electronApp, "Start Break");
    await testClock.fastForward(5);
    await expect(breakWindow.getByTestId('break-window-time-display').getByText("00 : 25")).toBeVisible();
  });

  await test.step("Skip Break from the tray ends the break and uses a power-up", async () => {
    const closePromise = breakWindow.waitForEvent('close');
    await clickTrayMenuItem(electronApp, "Skip Break");
    await closePromise;
    await expect(settingsWindow.getByTestId("powerup-count")).toHaveText("2");
  });

  await test.step("Lunch from the tray, then back early", async () => {
    await clickTrayMenuItem(electronApp, "Lunch (45 min)");
    await testClock.fastForward(1);
    expect(await getTrayMenuLabels(electronApp)).toEqual(["Show Settings", "Back from Lunch", "Quit"]);
    await clickTrayMenuItem(electronApp, "Back from Lunch");
    await testClock.fastForward(1);
    expect(await getTrayMenuLabels(electronApp)).toEqual(["Show Settings", "Stop", "Forward to Break", "Snooze +5 min", "Quit"]);
  });
});
