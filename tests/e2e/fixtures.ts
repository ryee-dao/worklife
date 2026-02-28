/* eslint-disable no-empty-pattern */
import { test as base, TestInfo } from "@playwright/test";
import { ElectronApplication, Page } from "playwright";
import { launchApp, createTestUserDataDir } from "./helpers";
import fs from "fs";
import path from "path";

type UserDataDir = {
  path: string;
  seed: (filename: string, data: object) => void;
};
type LaunchElectron = () => Promise<{ electronApp: ElectronApplication; settingsWindow: Page }>;

const test = base.extend<{
  userDataDir: UserDataDir;
  launchElectron: LaunchElectron
}>({
  userDataDir: async ({ }, use) => {
    const dir = createTestUserDataDir();
    await use({
      path: dir,
      seed(filename: string, data: object) {
        console.log(path.join(dir, filename))
        fs.writeFileSync(path.join(dir, filename), JSON.stringify(data));
      },
    });
    // cleanupTestUserDataDir(dir);
  },

  launchElectron: async ({ userDataDir }, use, testInfo) => {
    const apps: ElectronApplication[] = [];
    const tracedContexts = new Set();

    await use(async () => {
      const result = await launchApp(userDataDir.path);
      apps.push(result.electronApp);
      await startTracingForWindow(result.settingsWindow, tracedContexts);

      result.electronApp.on('window', async (window) => {
        await startTracingForWindow(window, tracedContexts);
      });

      return result;
    });

    for (const app of apps) {
      const tracePaths = await stopAllTracing(app, tracedContexts, testInfo);
      attachTraces(tracePaths, testInfo);
      await app.close();
    }

  },
});

// Manual tracing since it doesn't work with Electron
async function startTracingForWindow(window: Page, tracedContexts: Set<unknown>) {
  if (tracedContexts.has(window.context())) return;
  tracedContexts.add(window.context());
  await window.context().tracing.start({
    screenshots: true,
    snapshots: true,
  });
}

async function stopAllTracing(
  app: ElectronApplication,
  tracedContexts: Set<unknown>,
  testInfo: TestInfo
): Promise<string[]> {
  const tracePaths: string[] = [];
  for (const win of app.windows()) {
    if (tracedContexts.has(win.context())) {
      const tracePath = testInfo.outputPath(`trace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.zip`);
      await win.context().tracing.stop({ path: tracePath });
      tracePaths.push(tracePath);
      tracedContexts.delete(win.context());
    }
  }
  return tracePaths;
}

function attachTraces(tracePaths: string[], testInfo: TestInfo) {
  for (const tracePath of tracePaths) {
    testInfo.attachments.push({
      name: 'trace',
      path: tracePath,
      contentType: 'application/zip',
    });
  }
}

export { test }