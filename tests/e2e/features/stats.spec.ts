import { expect } from "@playwright/test";
import { test } from "../fixtures";

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
    await expect(settingsWindow.getByTestId("today-panel")).toContainText("Stopped · losing a checkpoint every");
    await expect(settingsWindow.getByTestId("today-panel").getByTestId("day-bar")).toHaveClass(/animate-flash/);
  });

  await test.step("The calendar can fill each day by checkpoint or as a whole", async () => {
    await expect(todayCell).toHaveAttribute("style", /linear-gradient/);
    await settingsWindow.getByTestId("calendar-fill-mode").click();
    await expect(todayCell).not.toHaveAttribute("style", /linear-gradient/);
  });

  await test.step("The calendar goes back a month, but not past this one", async () => {
    const thisMonth = await settingsWindow.getByTestId("calendar-month").textContent();
    await expect(settingsWindow.getByTestId("calendar-next-month")).toBeDisabled();
    await settingsWindow.getByTestId("calendar-previous-month").click();
    await expect(settingsWindow.getByTestId("calendar-month")).not.toHaveText(thisMonth!);
    await expect(todayCell).toBeHidden();
  });
});
