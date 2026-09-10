import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 12000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.AEROVIA_TEST_URL || "http://127.0.0.1:4908",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
    launchOptions: process.env.CI
      ? { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }
      : undefined,
  },
  webServer: process.env.AEROVIA_TEST_URL
    ? undefined
    : {
        command: "npm run preview",
        url: "http://127.0.0.1:4908",
        reuseExistingServer: false,
        timeout: 30000,
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
});
