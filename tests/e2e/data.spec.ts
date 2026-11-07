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

function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test("put someone on Block 1 with their own starting weights", async ({ page }) => {
  await page.goto("./");
  await addPerson(page, "Diane", "Purple");
  await expect(page.getByRole("heading", { name: "No programme yet" })).toBeVisible();
  await page.getByRole("link", { name: "Go to setup" }).click();
  await page.getByRole("button", { name: "Set up a programme" }).click();

  await expect(page.getByRole("combobox", { name: "Programme" })).toHaveValue("strength-block-1");
  await page.getByLabel("Start date").fill(inDays(30));
  await expect(page.getByLabel("Bench press weight")).toHaveValue("25");
  await page.getByLabel("Bench press weight").fill("27,5");
  await page.getByLabel("Barbell row sets").fill("1");
  await page.getByLabel("Barbell row reps").fill("7");
  await expect(page.getByText("Bars Diane can't use")).toHaveCount(0);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Strength Programme, Block 1")).toBeVisible();
  await expect(page.getByRole("row", { name: /Bench press/ })).toContainText("27.5kg");
  await expect(page.getByRole("row", { name: /Barbell row/ })).toContainText("15kg1 × 7");

  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByText("in 30 days")).toBeVisible();
});

test("a starting weight needs a weight, sets and reps", async ({ page }) => {
  await page.goto("./");
  await addPerson(page, "Diane", "Purple");
  await page.goto("./#/person");
  await page.getByRole("button", { name: "Set up a programme" }).click();
  const save = page.getByRole("button", { name: "Save" });
  await page.getByLabel("Back squat reps").fill("");
  await expect(save).toBeDisabled();
  await expect(page.getByText("whole numbers for sets and reps")).toBeVisible();
  await page.getByLabel("Back squat reps").fill("2.5");
  await expect(save).toBeDisabled();
  await page.getByLabel("Back squat reps").fill("5");
  await page.getByLabel("Deadlift weight", { exact: true }).fill("0");
  await expect(save).toBeDisabled();
  await page.getByLabel("Deadlift weight", { exact: true }).fill("57.5");
  await expect(save).toBeEnabled();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("No programme yet.")).toBeVisible();
});

test("import Rebuild Log history, then again without doubling it", async ({ page }) => {
  await page.goto("./");
  await addPerson(page, "Andrew", "Blue");
  await page.getByRole("link", { name: "Backup" }).click();
  await page.getByTestId("Choose a Rebuild Log backup").setInputFiles(REBUILD_BACKUP);
  await expect(page.getByRole("status")).toContainText("26 new sessions, 54 days, 9 weigh-ins");

  await page.getByTestId("Choose a Rebuild Log backup").setInputFiles(REBUILD_BACKUP);
  await expect(page.getByRole("status")).toContainText("0 new sessions, 26 updated");

  await page.getByRole("link", { name: "Setup & history" }).click();
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
  await tablet.getByRole("link", { name: "Setup & history" }).click();
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
  await page.goto("./#/person");
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
