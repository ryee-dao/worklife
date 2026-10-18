import { defineConfig } from "@playwright/test";
import os from "os";

// A "16GB" machine reports ~15.6GiB, so the cutoff sits below that
const totalRamGiB = os.totalmem() / 1024 ** 3;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // Two Electron instances on a low-RAM machine time out waiting for windows
  workers: totalRamGiB < 12 ? 1 : 2,
  reporter: [
    ['list'],
    ['html']
  ],
  timeout: 1 * 60 * 1000,
  retries: 1,
});