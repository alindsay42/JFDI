import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/** Block 1 as a programme someone made on this device, so it isn't removed as a retired built-in. */
function block1Backup() {
  const block1 = JSON.parse(readFileSync("examples/programmes/strength-block-1.json", "utf8"));
  block1.updatedAt = "2026-11-07T17:00:00Z";
  const backup = { format: "jfdi-backup", formatVersion: 2, exportedAt: "2026-11-07T17:00:00Z", app: { version: "test" }, profiles: [], programmes: [block1], logs: [] };
  return { name: "block-1.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) };
}

async function start(page: Page, { withBlock1 = false } = {}) {
  await page.goto("./");
  if (withBlock1) {
    await page.getByRole("link", { name: "Restore a backup instead" }).click();
    await page.getByTestId("Choose a backup to restore").setInputFiles(block1Backup());
    await page.getByRole("dialog").getByRole("button", { name: "Replace everything" }).click();
    await expect(page.getByRole("status")).toContainText("Restored");
    await page.getByRole("link", { name: "Back" }).click();
  }
  await page.getByLabel("Name").fill("Diane");
  await page.getByRole("radio", { name: "Purple" }).check();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(".you-bar")).toContainText("Diane");
  await page.getByRole("link", { name: "Programme", exact: true }).click();
}

const rowNames = (page: Page) => page.locator(".workout-items .ex-name").allInnerTexts();

test("build a new programme from scratch, pair exercises, save it and set someone up on it", async ({ page }) => {
  await start(page);
  await page.getByLabel("Name").fill("Andrew's strength");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Not saved yet.")).toBeVisible();
  await page.getByRole("link", { name: /Day 1/ }).click();

  const all = page.getByRole("listbox", { name: "All exercises" });
  await page.getByLabel("Search exercises").fill("back squat");
  await all.getByRole("option", { name: "Back squat", exact: true }).click();
  await page.getByLabel("Search exercises").fill("bench press");
  await all.getByRole("option", { name: "Bench press", exact: true }).click();
  await page.getByRole("button", { name: "Add highlighted" }).click();
  await page.getByLabel("Search exercises").fill("barbell row");
  await all.getByRole("option", { name: "Barbell row", exact: true }).click();
  await page.getByRole("button", { name: "Add highlighted" }).click();
  await expect(page.getByRole("listbox", { name: "In this workout" }).getByRole("option")).toHaveCount(3);

  await page.getByRole("button", { name: "Pair exercises" }).click();
  await page.getByRole("checkbox", { name: "Barbell row" }).click();
  await page.getByRole("checkbox", { name: "Back squat" }).click();
  await expect(page.getByText("2 chosen: a superset.")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await expect(page.locator(".group-superset")).toContainText("Back squat");
  await expect(page.locator(".group-superset")).toContainText("Barbell row");

  await page.getByLabel("Back squat weight").fill("60");
  await page.getByLabel("Back squat reps").fill("5");
  await page.getByLabel("Rounds").fill("4");

  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  // Saving a workout goes back to the plan, and says so
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await expect(page.getByRole("link", { name: /Day 1/ })).toBeVisible();

  await page.getByRole("button", { name: "Use this programme" }).click();
  await expect(page.getByRole("heading", { name: "Diane is on this programme" })).toBeVisible();
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByRole("link", { name: "Andrew's strength" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Day 1" })).toBeVisible();
  await page.getByRole("link", { name: "Programme", exact: true }).click();
  await expect(page.getByRole("region", { name: "Diane's programme" }).or(page.locator(".card", { hasText: "Diane's programme" }))).toContainText("Andrew's strength");
});

test("no programmes come with the app", async ({ page }) => {
  await start(page);
  await expect(page.getByText("No programmes yet.")).toBeVisible();
  await expect(page.getByText("None yet.")).toBeVisible();
});

test("change Block 1: reorder by dragging, split a group, switch to set days with two weeks", async ({ page }) => {
  await start(page, { withBlock1: true });
  await page.getByRole("link", { name: /Strength Programme, Block 1/ }).click();
  await page.getByRole("link", { name: /Day 1/ }).click();
  expect(await rowNames(page)).toEqual(["Back squat", "Bench press", "Barbell row", "Romanian deadlift", "DB lateral raise", "Plank", "Battle ropes, double waves"]);

  // Drag Romanian deadlift (4th item) to the top
  await page.locator(".workout-items").evaluate((e) => e.scrollIntoView());
  const handle = page.getByRole("button", { name: "Move 3 of 4 in Workout" });
  const target = page.getByRole("button", { name: "Move 1 of 4 in Workout" });
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + 2, { steps: 8 });
  await page.mouse.up();
  expect((await rowNames(page))[0]).toBe("Romanian deadlift");

  // Keyboard works too
  await page.getByRole("button", { name: "Move 1 of 4 in Workout" }).press("ArrowDown");
  expect((await rowNames(page)).slice(0, 2)).toEqual(["Back squat", "Romanian deadlift"]);

  // Take plank out of the giant set: it leaves a superset of the other two
  await page.locator(".group-giant").getByRole("button", { name: "Change group" }).click();
  await page.getByRole("checkbox", { name: "Plank" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await expect(page.locator(".group-superset")).toHaveCount(2);

  await page.getByRole("link", { name: "Strength Programme, Block 1" }).click();
  await page.getByRole("radio", { name: "Set days" }).check();
  await page.getByRole("radio", { name: "2", exact: true }).check();
  await expect(page.getByRole("heading", { name: "Week 2" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Mon is" }).first()).toHaveValue("workout");
  await page.getByRole("combobox", { name: "Sat is" }).first().selectOption("conditioning");
  await expect(page.locator(".weekday-conditioning").first()).toContainText("Walk");

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Unsaved changes.")).toBeHidden();
});

test("unsaved changes survive closing the app, and can be discarded", async ({ page }) => {
  await start(page, { withBlock1: true });
  await page.getByRole("link", { name: /Strength Programme, Block 1/ }).click();
  await page.getByRole("button", { name: "+ Add day" }).click();
  const day3 = page.locator(".day-card", { hasText: "Day 3" });
  await expect(day3).toBeVisible();
  await page.reload();
  await expect(page.getByText("Unsaved changes.")).toBeVisible();
  await expect(day3).toBeVisible();
  await page.getByRole("link", { name: "Programmes", exact: true }).click();
  await expect(page.locator(".programme-row", { hasText: "Block 1" })).toContainText("Unsaved changes");

  await page.getByRole("link", { name: /Strength Programme, Block 1/ }).click();
  await page.getByRole("button", { name: "Discard" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Discard" }).click();
  await expect(day3).toBeHidden();
});

test("a programme that can't be saved explains why", async ({ page }) => {
  await start(page);
  await page.getByLabel("Name").fill("Empty");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Day 1 has no exercises yet. Open it and choose some.");
});

test("changing something and changing it back leaves nothing to save", async ({ page }) => {
  await start(page);
  await page.getByLabel("Name").fill("Set days test");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("radio", { name: "Set days" }).check();
  await page.getByRole("link", { name: /Day 1/ }).click();
  await page.getByLabel("Search exercises").fill("deadlift");
  await page.getByRole("option", { name: "Deadlift", exact: true }).click();
  await page.getByRole("button", { name: "Add highlighted" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  await page.getByRole("radio", { name: "2", exact: true }).check();
  await expect(page.getByText("Unsaved changes.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use this programme" })).toBeDisabled();
  await page.getByRole("radio", { name: "1", exact: true }).check();
  await expect(page.getByText("Unsaved changes.")).toBeHidden();
  await expect(page.getByRole("button", { name: "Use this programme" })).toBeEnabled();
  await page.reload();
  await expect(page.getByText("Unsaved changes.")).toBeHidden();
});
