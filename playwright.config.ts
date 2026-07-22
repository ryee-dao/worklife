import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    globalSetup: "./tests/e2e/global-setup.ts",
    workers: 2,
    reporter: [
        ['list'],
        ['html']
    ],
    timeout: 5 * 60 * 1000,
    retries: 1,
    use: {
        headless: true
    }
});