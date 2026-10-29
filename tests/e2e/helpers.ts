import { _electron as electron, ElectronApplication, Locator, Page } from "playwright";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import fs from 'fs'

const TEST_DIR_PREFIX = "worklife-test-";


function ensureDirExists(p: string) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function getSafeTempRoot() {
  const UNSAFE_CHARS = /['"]/;
  const sysTmp = tmpdir();
  if (!UNSAFE_CHARS.test(sysTmp)) return sysTmp;

  // Cross-platform fallback: inside project (avoids user profile paths)
  return ensureDirExists(path.resolve(process.cwd(), ".tmp", "pw"));
}

export function createTestUserDataDir(): string {
  const root = getSafeTempRoot();
  return mkdtempSync(path.join(root, TEST_DIR_PREFIX));
}

export function cleanupTestUserDataDir(dir: string): void {
  if (existsSync(dir) && dir.includes(TEST_DIR_PREFIX)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function launchApp(userDataDir: string, withTray = false) {
  // Launch Electron app.
  const electronApp = await electron.launch({
    args: [
      path.join(__dirname, "../../dist/main/main.js"),
      `--user-data-dir=${userDataDir}`,
    ],
    env: {
      ...process.env,
      PLAYWRIGHT_TEST: "1",
      PLAYWRIGHT_TRAY: withTray ? "1" : "",
    },
    cwd: path.join(__dirname, "../.."),  // project root
  });

  // Capture main process output
  const electronProcess = electronApp.process();
  electronProcess.stderr?.on("data", (data) => console.log("[STDERR]", data.toString()));
  electronProcess.stdout?.on("data", (data) => console.log("[STDOUT]", data.toString()));

  // Get the first window that the app opens
  const settingsWindow = await electronApp.firstWindow();

  // Pipe Electron console to test output for debugging
  settingsWindow.on("console", (msg) => console.log(`[Electron] ${msg.text()}`));

  return {
    electronApp,
    settingsWindow,
    context: settingsWindow.context(),
    testClock: createTestClock(electronApp)
  };
}

// Create an internal test clock so events are triggered deterministically
export type TestClock = ReturnType<typeof createTestClock>;
export function createTestClock(electronApp: ElectronApplication) {
  return {
    async fastForward(seconds: number, delayMs = 500) {
      for (let i = 0; i < seconds; i++) {
        await electronApp.evaluate(() => {
          global.__test_fastForwardTimerOneSecond!();
        });
      }
      // Add an optional delay after the fast forward so the tests aren't too fast to follow 
      await new Promise(resolve => setTimeout(resolve, delayMs));
    },
  };
}

export async function getWindowBounds(electronApp: ElectronApplication, page: Page) {
  const url = page.url();
  return electronApp.evaluate(({ BrowserWindow }, targetUrl) => {
    const win = BrowserWindow.getAllWindows().find(w =>
      !w.isDestroyed() && w.webContents.getURL() === targetUrl
    );
    return win?.getBounds() ?? null;
  }, url);
}
// The labels in the tray menu, without separators
export async function getTrayMenuLabels(electronApp: ElectronApplication) {
  return electronApp.evaluate(() => {
    const menu = global.__test_getTrayMenu!()!;
    return menu.items
      .filter((item) => item.type !== "separator" && item.enabled) // The score header isn't an action
      .map((item) => item.label);
  });
}

// Clicks a tray menu item the way a user would after right-clicking the tray
export async function clickTrayMenuItem(electronApp: ElectronApplication, label: string) {
  await electronApp.evaluate((_, label) => {
    const menu = global.__test_getTrayMenu!()!;
    const item = menu.items.find((item) => item.label === label);
    if (!item) {
      throw new Error(`Tray menu has no item called "${label}"`);
    }
    item.click();
  }, label);
}

// Clicks a button that closes its own window, then waits for the window to close
export async function clickAndWaitForClose(window: Page, button: Locator) {
  const closed = window.waitForEvent('close');
  // The window can close before Playwright finishes the click, which it reports as an error
  await button.click().catch((error) => {
    if (!window.isClosed()) throw error;
  });
  await closed;
}
