import { expect, Locator, Page } from "@playwright/test";
import { ElectronApplication } from "playwright";
import { test } from "./fixtures";
import { FILENAMES } from "@shared/constants";

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

// Fails when an element's middle is off the window's middle, as letter-spacing or a stray flex row can push it
async function expectCentered(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!;
  const windowWidth = await page.evaluate(() => window.innerWidth);
  expect(Math.abs(box.x + box.width / 2 - windowWidth / 2), `${locator} is off center`).toBeLessThanOrEqual(2);
}

test("Overdue and break windows keep their title and time centered", async ({ launchElectron }) => {
  const { settingsWindow, electronApp } = await launchElectron();
  const [breakWindow] = await Promise.all([
    electronApp.waitForEvent('window'),
    settingsWindow.getByTestId("timer-buttons-container").getByTestId('forward-button').click(),
  ]);

  await expect(breakWindow.getByTestId("overdue-window-time-display")).toBeVisible();
  await expectCentered(breakWindow, breakWindow.getByTestId("overdue-window-title"));
  await expectCentered(breakWindow, breakWindow.getByTestId("overdue-window-time-display"));

  await breakWindow.getByTestId("overdue-window-start-break-button").click();
  await expect(breakWindow.getByTestId("break-window-time-display")).toBeVisible();
  await expectCentered(breakWindow, breakWindow.getByTestId("break-window-title"));
  await expectCentered(breakWindow, breakWindow.getByTestId("break-window-time-display"));
});

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
    // The buttons row spans the window, so check the corner button against the last button in it
    await expectNoOverlap(settingsWindow.getByTestId("replay-tour"), settingsWindow.getByTestId("timer-buttons-container").getByRole("button").last());
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

  test(`Tour fits at ${size.width}×${size.height}`, async ({ userDataDir, launchElectron }) => {
    userDataDir.seed(FILENAMES.TOUR.STATE, { seen: false });
    const { electronApp, settingsWindow } = await launchElectron();
    await resizeWindow(electronApp, settingsWindow, size);
    const card = settingsWindow.getByTestId("tour-card");
    const next = settingsWindow.getByTestId("tour-next");

    // The first two beats spotlight the timer tab, and the card must leave the spotlight clear
    for (const target of ["timer-time-digits", "toggle-timer-button"]) {
      await expect(card).toBeInViewport({ ratio: 1 });
      await expect(settingsWindow.getByTestId("tour-spotlight")).toBeVisible();
      await expectNoOverlap(card, settingsWindow.getByTestId(target));
      await next.click();
    }

    // The overdue beat's card stays on the dashboard while its window opens elsewhere
    await expect(card.getByRole("heading")).toHaveText("Time's up.");
    await expect(card).toBeInViewport({ ratio: 1 });
    await expectNoSidewaysScroll(settingsWindow);

    // A skipped first run ends on the start prompt, and the card must leave the start button clear
    await settingsWindow.getByTestId("tour-skip").click();
    await expect(card.getByRole("heading")).toHaveText("Press start.");
    await expect(settingsWindow.getByTestId("tour-spotlight")).toBeVisible();
    await expect(card).toBeInViewport({ ratio: 1 });
    await expectNoOverlap(card, settingsWindow.getByTestId("tour-advance"));
  });
}
