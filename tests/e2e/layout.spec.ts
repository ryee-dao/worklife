import { expect, Locator, Page } from "@playwright/test";
import { ElectronApplication } from "playwright";
import { test } from "./fixtures";

test.describe.configure({ mode: 'parallel' });

// The default window size, and a small one
const windowSizes = [
  { width: 800, height: 600 },
  { width: 500, height: 400 },
];

async function resizeWindow(electronApp: ElectronApplication, page: Page, size: { width: number; height: number }) {
  await electronApp.evaluate(({ BrowserWindow }, { width, height }) => {
    BrowserWindow.getAllWindows()[0].setContentSize(width, height);
  }, size);
  await page.waitForFunction((width) => window.innerWidth === width, size.width);
}

// Fails when two elements cover any of the same area. A hidden element can't overlap anything
async function expectNoOverlap(a: Locator, b: Locator) {
  const boxA = await a.boundingBox();
  const boxB = await b.boundingBox();
  if (!boxA || !boxB) return;
  const overlaps =
    boxA.x < boxB.x + boxB.width && boxB.x < boxA.x + boxA.width &&
    boxA.y < boxB.y + boxB.height && boxB.y < boxA.y + boxA.height;
  expect(overlaps, `${a} overlaps ${b}`).toBe(false);
}

// Fails when text wraps onto a second line
async function expectSingleLine(locator: Locator) {
  const heightInLines = await locator.evaluate((element) => {
    return element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).fontSize);
  });
  expect(heightInLines, `${locator} wraps`).toBeLessThan(1.5);
}

// Fails when the page scrolls sideways, meaning something is wider than the window
async function expectNoSidewaysScroll(page: Page) {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits, "page is wider than the window").toBe(true);
}

for (const size of windowSizes) {
  test(`Timer tab fits at ${size.width}×${size.height}`, async ({ launchElectron }) => {
    const { electronApp, settingsWindow, testClock } = await launchElectron();
    await resizeWindow(electronApp, settingsWindow, size);
    await testClock.fastForward(1);
    const digits = settingsWindow.getByTestId("timer-time-digits");

    await expect(digits).toBeVisible();
    await expect(digits).toBeInViewport({ ratio: 1 });
    await expectSingleLine(digits);
    await expectNoOverlap(settingsWindow.getByTestId("timer-powerup-bar"), digits);
    await expectNoOverlap(settingsWindow.getByTestId("timer-buttons-container"), digits);
    await expectNoSidewaysScroll(settingsWindow);
  });

  test(`Stats tab fits at ${size.width}×${size.height}`, async ({ launchElectron }) => {
    const { electronApp, settingsWindow } = await launchElectron();
    await resizeWindow(electronApp, settingsWindow, size);
    await settingsWindow.getByTestId("tabs-navbar").getByRole('link', { name: 'Stats' }).click();
    const todayPanel = settingsWindow.getByTestId("today-panel");
    const calendar = settingsWindow.getByTestId("month-calendar");
    const dayCard = settingsWindow.getByTestId("day-card");

    await expect(todayPanel).toBeInViewport({ ratio: 1 });
    await expect(calendar).toBeVisible();
    await expect(dayCard).toBeVisible();
    await expectSingleLine(settingsWindow.getByTestId("calendar-month"));
    await expectNoOverlap(todayPanel, calendar);
    await expectNoOverlap(calendar, dayCard);
    await expectNoSidewaysScroll(settingsWindow);
  });
}
