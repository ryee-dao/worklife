import { _electron as electron, ElectronApplication, Page } from "playwright";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import fs from 'fs'

const TEST_DIR_PREFIX = "worklife-test-";

const UNSAFE_CHARS = /['"]/;

function ensureDirExists(p: string) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function getSafeTempRoot() {
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

export async function launchApp(userDataDir: string) {
  // Launch Electron app.
  const electronApp = await electron.launch({
    args: [
      path.join(__dirname, "../../dist/main/main.js"),
      `--user-data-dir=${userDataDir}`,
    ],
    cwd: path.join(__dirname, "../.."),  // project root
  });

  // Capture main process output
  const process = electronApp.process();
  process.stderr?.on("data", (data) => console.log("[STDERR]", data.toString()));
  process.stdout?.on("data", (data) => console.log("[STDOUT]", data.toString()));

  // Evaluation expression in the Electron context.
  const appPath = await electronApp.evaluate(async ({ app }) => {
    return app.getAppPath();
  });

  // Get the first window that the app opens
  const window = await electronApp.firstWindow();

  // Pipe Electron console to test output for debugging
  window.on("console", (msg) => console.log(`[Electron] ${msg.text()}`));

  return { electronApp, window };
}
