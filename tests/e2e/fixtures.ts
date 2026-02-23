import { test as base } from "@playwright/test";
import { ElectronApplication, Page } from "playwright";
import { launchApp, createTestUserDataDir, cleanupTestUserDataDir } from "./helpers";
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

  launchElectron: async ({ userDataDir }, use) => {
    let app: Awaited<ReturnType<typeof launchApp>> | null = null;

    await use(async () => {
      app = await launchApp(userDataDir.path);
      return app;
    });

    // Teardown
    if (app) await (app as Awaited<ReturnType<typeof launchApp>>).electronApp.close();
  },
});

export { test }