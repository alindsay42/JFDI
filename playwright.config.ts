import { defineConfig, devices } from "@playwright/test";

// Lenovo Tab P11 in Chrome: about 1000 × 600 in landscape (architecture.md, decision 2). Checked on the tablet later.
const p11 = { viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const p11Portrait = { ...p11, viewport: { width: 600, height: 1000 } };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4173/",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "tablet-landscape-light", use: { ...p11, colorScheme: "light" } },
    { name: "tablet-landscape-dark", use: { ...p11, colorScheme: "dark" } },
    { name: "tablet-portrait-light", use: { ...p11Portrait, colorScheme: "light" } },
    { name: "phone-dark", use: { ...devices["Pixel 7"], colorScheme: "dark" } },
  ],
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173/",
    reuseExistingServer: !process.env.CI,
  },
});
