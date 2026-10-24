import { defineConfig } from "@playwright/test";
import os from "os";

// Two Electron apps at once is too much for machines under 16GB (a 16GB machine reports ~15.6GB)
const totalMemoryGB = os.totalmem() / 1024 ** 3;
const workers = totalMemoryGB > 15.5 ? 2 : 1;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers,
  reporter: [
    ['list'],
    ['html']
  ],
  timeout: 90 * 1000,
  retries: 1,
});