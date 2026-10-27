import { expect } from "@playwright/test";
import { test } from "../fixtures";

test.describe.configure({ mode: 'parallel' });

test("Stats tab shows today's score and the clean-day calendar", async ({ launchElectron }) => {
  const { settingsWindow, testClock } = await launchElectron();
  const today = new Date().toLocaleDateString("en-CA");

  await test.step("The ring around the timer shows today's score", async () => {
    await testClock.fastForward(1);
    await expect(settingsWindow.getByTestId("compliance-ring-label")).toHaveText(/^Today \d+%$/);
  });

  await test.step("The Stats tab shows the total and today on the calendar", async () => {
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Stats' }).click();
    await expect(settingsWindow.getByTestId("total-clean-days")).toHaveText("0");
    await expect(settingsWindow.getByTestId(`calendar-day-${today}`)).toBeVisible();
  });

  await test.step("Picking today shows its card, still in progress", async () => {
    await settingsWindow.getByTestId(`calendar-day-${today}`).click();
    await expect(settingsWindow.getByTestId("day-card-result")).toHaveText("Day in progress");
  });
});
