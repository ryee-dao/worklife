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
  projects: [
    { name: "smoke", testMatch: "smoke.spec.ts" },       // Does the app start and basically work
    { name: "layout", testMatch: "layout.spec.ts" },     // Nothing is hidden, wrapped or overlapping
    { name: "features", testMatch: "features/**/*.spec.ts" },
    // The browser demo, served from the same build
    { name: "web", testMatch: "web/**/*.spec.ts", use: { browserName: "chromium", baseURL: "http://127.0.0.1:4173", viewport: { width: 1000, height: 820 } } },
  ],
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: true,
    timeout: 30 * 1000,
  },
});