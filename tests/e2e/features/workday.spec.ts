import { expect } from "@playwright/test";
import { test } from "../fixtures";
import { FILENAMES } from "@shared/constants";
import { StatsEvent } from "@main/stats/stats";
import fs from "fs";
import path from "path";

test("The workday schedule starts a stopped timer, and stops it at the end even during lunch", async ({ userDataDir, launchElectron }) => {
  // An hour the test can't be running in, so the schedule's edges are only the ones the test drives
  const startHour = new Date().getHours() < 12 ? 14 : 2;
  const today = new Date().toLocaleDateString("en-CA");
  const at = (hours: number, minutes: number) => new Date(new Date().setHours(hours, minutes, 0, 0)).getTime();
  userDataDir.seed(FILENAMES.WORKDAY.CONFIGS, { days: [0, 1, 2, 3, 4, 5, 6], start: `${String(startHour).padStart(2, "0")}:00`, end: `${String(startHour + 1).padStart(2, "0")}:00`, autoStopAtEnd: true });
  userDataDir.seed(FILENAMES.STATS.STATE, { lastSummaryDate: today }); // So the end of the day doesn't open its card over the timer

  const { settingsWindow, electronApp, testClock } = await launchElectron();
  const check = (nowMs: number) => electronApp.evaluate((_, nowMs) => global.__test_checkWorkday!(nowMs), nowMs);
  const toggle = settingsWindow.getByTestId("timer-buttons-container").getByTestId("toggle-timer-button");

  await test.step("Before the workday a stopped timer stays stopped", async () => {
    await toggle.click(); // A relaunch always runs, so the stop happens here
    await check(at(startHour - 1, 59));
    await testClock.fastForward(1);
    await expect(toggle).toHaveAttribute("title", "Resume");
  });

  await test.step("The workday starting resumes it", async () => {
    await check(at(startHour, 0));
    await testClock.fastForward(1);
    await expect(toggle).toHaveAttribute("title", "Stop (costs a checkpoint)");
  });

  await test.step("The workday ending stops it, even at lunch, with a full timer for tomorrow", async () => {
    await settingsWindow.getByTestId("lunch-button").click();
    await expect(toggle).toHaveAttribute("title", "Back from lunch");
    await check(at(startHour + 1, 0));
    await testClock.fastForward(1);
    await expect(toggle).toHaveAttribute("title", "Resume");
    await expect(settingsWindow.getByTestId("timer-time-digits")).toHaveText("45 : 00"); // A full block, not the one lunch interrupted
  });

  await test.step("The log says the schedule did it", async () => {
    const events: StatsEvent[] = fs.readFileSync(path.join(userDataDir.path, FILENAMES.STATS.EVENTS), "utf-8").trim().split("\n").map((line) => JSON.parse(line));
    expect(events).toContainEqual(expect.objectContaining({ type: "RESUMED", source: "SCHEDULE" }));
    expect(events).toContainEqual(expect.objectContaining({ type: "STOPPED", source: "SCHEDULE", from: "LUNCH" }));
  });
});
