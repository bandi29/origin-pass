import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Prefer a healthy existing server; when port 3000 serves only 5xx, Playwright
    // will not reuse it (waits for 2xx) — start Next directly (skip ensure-dev-port).
    command: "npx next dev -p 3000",
    url: process.env.E2E_BASE_URL || "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})

