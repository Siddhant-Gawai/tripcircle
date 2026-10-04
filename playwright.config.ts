import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
const localLaunch = process.env.TEST_BROWSER_CONFIG
  ? JSON.parse(readFileSync(process.env.TEST_BROWSER_CONFIG, "utf8"))
  : undefined;
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    launchOptions: localLaunch,
    baseURL: "http://127.0.0.1:4173/tripcircle/",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/tripcircle/",
    reuseExistingServer: !process.env.CI,
  },
});
