import { defineConfig } from "@playwright/test";

export default defineConfig({
    globalSetup: "./tests/e2e/global-setup.ts",
    workers: 2,
    reporter: [
        ['list'],
        ['html']
    ],
    retries: 1
});