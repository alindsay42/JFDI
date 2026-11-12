import { expect, test, type Page } from "@playwright/test";

async function addPerson(page: Page, name: string, colour: string) {
  await page.getByLabel("Name").fill(name);
  await page.getByRole("radio", { name: colour }).check();
  await page.getByRole("button", { name: "Add", exact: true }).click();
}

test("first run: add a person and land on their Today screen", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText("Add the first person to get started.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();

  await addPerson(page, "Diane", "Purple");

  const bar = page.locator(".you-bar");
  await expect(bar).toContainText("Diane");
  await expect(bar).toHaveCSS("background-color", "rgb(124, 58, 237)");
  await expect(page.getByRole("heading", { name: "No programme yet" })).toBeVisible();
  await expect(page.getByText(/Version \d+\.\d+\.\d+/)).toBeVisible();
});

test("switching between people, and it's remembered after closing", async ({ page }) => {
  await page.goto("./");
  await addPerson(page, "Diane", "Purple");
  await page.getByRole("button", { name: "Diane. Change person" }).click();
  await expect(page.getByText("Who's training?")).toBeVisible();

  await page.getByRole("button", { name: "Add person" }).click();
  await addPerson(page, "Andrew", "Blue");
  await expect(page.locator(".you-bar")).toHaveCSS("background-color", "rgb(37, 99, 235)");

  await page.reload();
  await expect(page.locator(".you-bar")).toContainText("Andrew");

  await page.getByRole("button", { name: "Andrew. Change person" }).click();
  await page.getByRole("button", { name: "Diane" }).click();
  await expect(page.locator(".you-bar")).toContainText("Diane");
});

test("nothing scrolls sideways", async ({ page }) => {
  await page.goto("./");
  await addPerson(page, "A name long enough to test wrapping", "Teal");
  for (const route of ["#/today", "#/who", "#/progress", "#/programme", "#/data", "#/help", "#/equipment", "#/exercises"]) {
    await page.goto(`./${route}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, route).toBeLessThanOrEqual(0);
  }
});

test("opens and keeps working with no network", async ({ page, context }) => {
  await page.goto("./");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // Reload once so the service worker controls the page, as it does after the first visit on the tablet.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await addPerson(page, "Diane", "Purple");
  await expect(page.locator(".you-bar")).toContainText("Diane");
  await page.reload();
  await expect(page.locator(".you-bar")).toContainText("Diane");
});

test("help: from the bottom of any screen, with contents that jump to each section", async ({ page }) => {
  await page.goto("./");
  // Before anyone is added
  await page.getByRole("link", { name: "Help" }).click();
  await expect(page.getByRole("heading", { name: "Help", level: 1 })).toBeVisible();
  await page.goto("./");
  await addPerson(page, "Diane", "Purple");
  await page.getByRole("link", { name: "Help" }).click();
  await expect(page.locator(".you-bar")).toContainText("Diane");
  const contents = page.getByRole("navigation", { name: "Contents" });
  await contents.getByRole("link", { name: "Backup" }).click();
  await expect(page).toHaveURL(/#\/help\/backup$/);
  await expect(page.getByRole("heading", { name: "Backup", level: 2 })).toBeInViewport();
  await expect(page.getByText("Importing the same file again doesn't double anything up.")).toBeVisible();
});
