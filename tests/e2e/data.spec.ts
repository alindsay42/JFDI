import { expect, test, type Page } from "@playwright/test";

const REBUILD_BACKUP = "tests/fixtures/rebuild-log-backup-sample.json";

async function addPerson(page: Page, name: string, colour: string) {
  await page.goto("./#/who");
  await page.locator(".who").waitFor();
  if (!(await page.getByLabel("Name").isVisible())) await page.getByRole("button", { name: "Add person" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("radio", { name: colour }).check();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(".you-bar")).toContainText(name);
}


test("import Rebuild Log history, then again without doubling it", async ({ page }) => {
  await page.goto("./");
  await addPerson(page, "Andrew", "Blue");
  await page.getByRole("link", { name: "Backup" }).click();
  await page.getByTestId("Choose a Rebuild Log backup").setInputFiles(REBUILD_BACKUP);
  await expect(page.getByRole("status")).toContainText("26 new sessions, 54 days, 9 weigh-ins");

  await page.getByTestId("Choose a Rebuild Log backup").setInputFiles(REBUILD_BACKUP);
  await expect(page.getByRole("status")).toContainText("0 new sessions, 26 updated");

  await page.getByRole("link", { name: "Progress" }).click();
  await expect(page.getByText("26 sessions, 54 days with a check-in or walk, 9 weigh-ins.")).toBeVisible();
  await expect(page.locator(".history-row")).toHaveCount(10);
  await page.getByRole("button", { name: "Show all 26" }).click();
  await expect(page.locator(".history-row")).toHaveCount(26);
});

test("back up on one tablet and restore on another", async ({ page, browser }) => {
  await page.goto("./");
  await addPerson(page, "Andrew", "Blue");
  await page.getByRole("link", { name: "Backup" }).click();
  await page.getByTestId("Choose a Rebuild Log backup").setInputFiles(REBUILD_BACKUP);
  await expect(page.getByRole("status")).toContainText("26 new sessions");
  await addPerson(page, "Diane", "Purple");
  await page.getByRole("link", { name: "Backup" }).click();
  await expect(page.getByText("Last backup: never")).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save a backup" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^jfdi-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  await expect(page.getByText("Last backup: never")).toBeHidden();

  // A fresh device: restore before adding anyone
  const other = await browser.newContext();
  const tablet = await other.newPage();
  await tablet.goto("./");
  await tablet.getByRole("link", { name: "Restore a backup instead" }).click();
  await tablet.getByTestId("Choose a backup to restore").setInputFiles(file);
  const dialog = tablet.getByRole("dialog", { name: "Replace everything with this backup?" });
  await expect(dialog).toContainText("2 people (Andrew, Diane) and 26 sessions");
  await dialog.getByRole("button", { name: "Replace everything" }).click();
  await expect(tablet.getByRole("status")).toContainText("Restored the backup");

  await tablet.getByRole("link", { name: "Back" }).click();
  await tablet.getByRole("button", { name: "Andrew" }).click();
  await tablet.getByRole("link", { name: "Progress" }).click();
  await expect(tablet.getByText("26 sessions, 54 days")).toBeVisible();
  await other.close();
});

test("files that aren't the right kind are explained", async ({ page }) => {
  await page.goto("./");
  await addPerson(page, "Andrew", "Blue");
  await page.getByRole("link", { name: "Backup" }).click();
  await page.getByTestId("Choose a backup to restore").setInputFiles(REBUILD_BACKUP);
  await expect(page.getByRole("alert")).toContainText("This is a Rebuild Log backup. Use Import from Rebuild Log instead.");
  await page.getByTestId("Choose a Rebuild Log backup").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await expect(page.getByRole("alert").last()).toContainText("This isn't a Rebuild Log backup");
});

test("remove a person, after confirming", async ({ page }) => {
  await page.goto("./");
  await addPerson(page, "Andrew", "Blue");
  await addPerson(page, "Test", "Teal");
  await page.goto("./#/history");
  await page.getByRole("button", { name: "Remove Test" }).click();
  const dialog = page.getByRole("dialog", { name: "Remove Test?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Remove Test" }).click();
  await dialog.getByRole("button", { name: "Remove Test" }).click();
  await expect(page.getByText("Who's training?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Test" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Andrew" })).toBeVisible();
});
