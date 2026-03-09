import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    globalSetup: "./tests/e2e/global-setup.ts",
    workers: 2,
    reporter: [
        ['list'],
        ['html']
    ],
    retries: 1,
    use: {
        headless: true
    }
});