import { expect } from "@playwright/test";
import { test } from "../fixtures";
import { FILENAMES } from "@shared/constants";
import fs from "fs";
import path from "path";

test.describe.configure({ mode: 'parallel' });

test("Stats tab shows today's checkpoint live, and the month calendar", async ({ launchElectron }) => {
  const { settingsWindow, testClock } = await launchElectron();
  const today = new Date().toLocaleDateString("en-CA");
  const todayCell = settingsWindow.getByTestId(`calendar-day-${today}`);

  await test.step("Today starts at Dim, counting down to the next checkpoint", async () => {
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Stats' }).click();
    await testClock.fastForward(1);
    await expect(settingsWindow.getByTestId("today-level")).toHaveText("Dim");
    // The tests' workday is the whole day, so late in the day the next checkpoint no longer fits
    await expect(settingsWindow.getByTestId("today-countdown")).toHaveText(/until Glimmer|hold Dim/);
    await expect(settingsWindow.getByTestId("month-total")).toHaveText("0");
  });

  await test.step("Today is on the calendar, and picking it shows its card", async () => {
    await todayCell.click();
    await expect(settingsWindow.getByTestId("day-card-result")).toHaveText("Dim so far");
  });

  await test.step("Stopping shows the day draining, live", async () => {
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Timer' }).click();
    await settingsWindow.getByTestId("timer-buttons-container").getByTestId("toggle-timer-button").click();
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Stats' }).click();
    await testClock.fastForward(1);
    // Already at Dim, so there's nothing left to lose
    await expect(settingsWindow.getByTestId("today-panel")).toContainText("Stopped");
    await expect(settingsWindow.getByTestId("today-countdown")).toHaveText("Resume to climb again");
    await expect(settingsWindow.getByTestId("today-panel").getByTestId("day-bar")).toHaveClass(/animate-flash/);
  });

  await test.step("The calendar fills each day diagonally to its checkpoint, and shows the stage", async () => {
    await expect(todayCell).toHaveAttribute("style", /linear-gradient\(to (top right|right top)/);
    await expect(settingsWindow.getByTestId("today-panel").getByTestId("checkpoint-stage")).toHaveText("1");
  });

  await test.step("The calendar goes back a month, but not past this one", async () => {
    const thisMonth = await settingsWindow.getByTestId("calendar-month").textContent();
    await expect(settingsWindow.getByTestId("calendar-next-month")).toBeDisabled();
    await settingsWindow.getByTestId("calendar-previous-month").click();
    await expect(settingsWindow.getByTestId("calendar-month")).not.toHaveText(thisMonth!);
    await expect(todayCell).toBeHidden();
  });
});

test("Past days keep their cards: a clean day, a stop, and a lunch with a skip", async ({ launchElectron, userDataDir }) => {
  // The first three days of the month, or of last month early in a month, so all three are over
  const today = new Date();
  const month = today.getDate() > 3 ? today : new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const dayAt = (day: number, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(month.getFullYear(), month.getMonth(), day, hours, minutes).getTime();
  };
  const localDate = (day: number) => new Date(month.getFullYear(), month.getMonth(), day).toLocaleDateString("en-CA");
  // An event as the app logs it, on the tests' all-day workday
  const event = (at: number, transition: object) => JSON.stringify({
    v: 1, id: String(at), at, tzOffsetMin: 0 - new Date(at).getTimezoneOffset(),
    config: {
      timerDurationMs: 2700000, breakDurationMs: 30000, warningThresholdMs: 120000, snoozeDurationMs: 300000, allottedPowerups: 3, lunchDurationMs: 2700000,
      checkpointDecayMs: 900000, difficulty: "NORMAL", levelThresholdMs: 180000, workday: { days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59", autoStopAtEnd: false },
    },
    ...transition,
  });
  const day = (n: number, ...middle: [string, object][]) => [
    event(dayAt(n, "00:00"), { type: "APP_STARTED", previousStatus: null }),
    ...middle.map(([time, transition]) => event(dayAt(n, time), transition)),
    event(dayAt(n, "23:59"), { type: "APP_QUIT", status: "RUNNING", countdownMs: 0, overdueMs: 0 }),
  ];
  fs.writeFileSync(path.join(userDataDir.path, FILENAMES.STATS.EVENTS), [
    ...day(1),
    ...day(2, ["12:00", { type: "STOPPED", source: "WINDOW", from: "RUNNING", countdownMs: 0 }], ["12:10", { type: "RESUMED", source: "WINDOW", countdownMs: 0 }]),
    ...day(3,
      ["12:00", { type: "LUNCH_STARTED", source: "WINDOW", from: "RUNNING", lunchMs: 2700000 }],
      ["12:45", { type: "LUNCH_ENDED", cause: "TIME_UP" }],
      ["15:00", { type: "BREAK_SKIPPED", source: "WINDOW", from: "OVERDUE", overdueMs: 0, breakElapsedMs: 0, powerupsLeft: 2 }],
    ),
  ].join("\n") + "\n");

  const { settingsWindow } = await launchElectron();
  const card = settingsWindow.getByTestId("day-card");
  await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Stats' }).click();
  if (month !== today) await settingsWindow.getByTestId("calendar-previous-month").click();

  await settingsWindow.getByTestId(`calendar-day-${localDate(1)}`).click();
  await expect(card).toContainText("Radiant");
  await expect(card).toContainText(/0 power-up.*no lunch/);
  await settingsWindow.getByTestId(`calendar-day-${localDate(2)}`).click();
  await expect(card).toContainText("Glow"); // A ten-minute stop at midday costs a checkpoint and restarts the climb
  await settingsWindow.getByTestId(`calendar-day-${localDate(3)}`).click();
  await expect(card).toContainText("Radiant"); // Lunch and a skipped break don't break the run
  await expect(card).toContainText(/1 power-up.*lunch taken/);
  await expect(settingsWindow.getByTestId("month-total")).toHaveText("2.5"); // Radiant is a whole day, Glow half
});
