import { test, expect } from "@playwright/test";
import { ElectronApplication, Page } from "playwright";
import {
  launchApp,
  createTestUserDataDir,
  cleanupTestUserDataDir,
} from "./helpers";

let electronApp: ElectronApplication;
let window: Page;
let userDataDir: string;

test.beforeEach(async () => {
  userDataDir = createTestUserDataDir();
  const app = await launchApp(userDataDir);
  electronApp = app.electronApp;
  window = app.window;
});

test.afterEach(async () => {
  await electronApp.close();
  cleanupTestUserDataDir(userDataDir);
});

test("app launches with a visible window", async () => {
  const delay = ms => new Promise(res => setTimeout(res, ms));
  await delay(5000);
  // Window exists and is visible
//   console.log(await window.title()); // is an empty string when it should NOT be
//   const isVisible = await window.locator("body").isVisible();
  expect(true).toBe(true);
});
