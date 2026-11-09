import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/** A fresh tablet with Block 1 restored (as a programme made here) and Diane on it from today. */
async function dianeOnBlock1(page: Page) {
  const block1 = JSON.parse(readFileSync("examples/programmes/strength-block-1.json", "utf8"));
  block1.updatedAt = "2026-11-07T17:00:00Z";
  const backup = { format: "jfdi-backup", formatVersion: 2, exportedAt: "2026-11-07T17:00:00Z", app: { version: "test" }, profiles: [], programmes: [block1], logs: [] };
  await page.goto("./");
  await page.getByRole("link", { name: "Restore a backup instead" }).click();
  await page.getByTestId("Choose a backup to restore").setInputFiles({ name: "b.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole("dialog").getByRole("button", { name: "Replace everything" }).click();
  await expect(page.getByRole("status")).toContainText("Restored");
  await page.getByRole("link", { name: "Back" }).click();
  await page.getByLabel("Name").fill("Diane");
  await page.getByRole("radio", { name: "Purple" }).check();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(".you-bar")).toContainText("Diane");
  await page.goto("./#/programme/strength-block-1");
  await page.getByRole("button", { name: "Use this programme" }).click();
  await expect(page.getByRole("heading", { name: "Diane is on this programme" })).toBeVisible();
  await page.getByRole("link", { name: "Today" }).click();
}

test("Today shows the next workout with its targets, after the daily check", async ({ page }) => {
  await dianeOnBlock1(page);
  await expect(page.getByRole("heading", { name: "Session A" })).toBeVisible();
  await expect(page.locator(".preview-row", { hasText: "Back squat" })).toContainText("30kg · 5 × 5");
  await expect(page.getByRole("button", { name: "Start workout" })).toBeDisabled();
  await page.getByRole("radio", { name: /Amber/ }).check();
  await expect(page.locator(".preview-row", { hasText: "Back squat" })).toContainText("30kg · 3 × 5");
  await expect(page.locator(".preview-row", { hasText: "Plank" })).toHaveCount(0);
  await page.getByRole("radio", { name: /Red/ }).check();
  await expect(page.getByRole("heading", { name: "No lifting today" })).toBeVisible();
  await page.getByRole("radio", { name: /Green/ }).check();
  await page.getByRole("button", { name: "Skip to next workout" }).click();
  await expect(page.getByRole("heading", { name: "Session B" })).toBeVisible();
});

test("do a workout: tick sets, change a weight, rest timer, remove and add exercises, finish", async ({ page }) => {
  await dianeOnBlock1(page);
  await page.getByRole("radio", { name: /Green/ }).check();
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page.getByRole("heading", { name: "Session A" })).toBeVisible();

  const squat = page.getByRole("region", { name: "Back squat" });
  await squat.getByLabel("Set 1 weight").fill("32.5");
  await squat.getByRole("button", { name: "Set 1 done" }).click();
  await expect(page.getByRole("timer")).toContainText("Rest 3:00");
  await page.getByRole("timer").getByRole("button", { name: "Skip" }).click();
  for (const n of [2, 3, 4, 5]) await squat.getByRole("button", { name: `Set ${n} done` }).click();
  await expect(page.getByText("5 of 27 sets done")).toBeVisible();

  // Leaving and coming back keeps everything
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByRole("heading", { name: "Session A is under way" })).toBeVisible();
  await page.getByRole("link", { name: "Carry on" }).click();
  await expect(squat.getByLabel("Set 1 weight")).toHaveValue("32.5");

  // Remove the RDL, add a curl
  await page.getByRole("region", { name: "Romanian deadlift" }).getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("dialog").getByRole("radio", { name: "Short on time" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("region", { name: "Romanian deadlift" })).toContainText("Removed: Short on time");
  await page.getByRole("button", { name: "+ Add an exercise" }).click();
  await page.getByLabel("Search exercises to add").fill("db curl");
  await page.getByRole("button", { name: "DB curl", exact: true }).click();
  await expect(page.getByRole("region", { name: "DB curl" })).toContainText("Added");

  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Finish" }).click();

  // Back on Today: Session B is next, after Diane's 2 rest days
  await expect(page.getByRole("heading", { name: "Rest day" })).toBeVisible();
  await page.getByRole("button", { name: "Train today anyway" }).click();
  await expect(page.getByRole("heading", { name: "Session B" })).toBeVisible();
  await page.getByRole("link", { name: "Progress" }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
});

test("a workout with nothing ticked can be thrown away, and stays next up", async ({ page }) => {
  await dianeOnBlock1(page);
  await page.getByRole("radio", { name: /Green/ }).check();
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Throw it away" }).click();
  await page.getByRole("radio", { name: /Green/ }).check();
  await expect(page.getByRole("heading", { name: "Session A" })).toBeVisible();
});

test("ending early records why", async ({ page }) => {
  await dianeOnBlock1(page);
  await page.getByRole("radio", { name: /Green/ }).check();
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("region", { name: "Back squat" }).getByRole("button", { name: "Set 1 done" }).click();
  await page.getByRole("button", { name: "End early" }).click();
  await page.getByRole("dialog").getByRole("radio", { name: "Feeling unwell" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "End workout" }).click();
  await page.getByRole("link", { name: "Progress" }).click();
  await expect(page.locator(".history-row")).toContainText("Ended early");
});

test("discard a workout part-way through; it stays next up", async ({ page }) => {
  await dianeOnBlock1(page);
  await page.getByRole("radio", { name: /Green/ }).check();
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("region", { name: "Back squat" }).getByRole("button", { name: "Set 1 done" }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Discard" }).click();
  await page.getByRole("radio", { name: /Green/ }).check();
  await expect(page.getByRole("heading", { name: "Session A" })).toBeVisible();
  await page.getByRole("link", { name: "Progress" }).click();
  await expect(page.locator(".history-row")).toHaveCount(0);
});

test("set days: today's workout shows as done after, and another day's can be done today", async ({ page }) => {
  await page.clock.install({ time: new Date("2027-01-04T10:00:00") }); // a Monday
  await dianeOnBlock1(page);
  await page.goto("./#/programme/strength-block-1");
  await page.getByRole("radio", { name: "Set days" }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.getByRole("link", { name: "Today" }).click();

  await page.getByRole("radio", { name: /Green/ }).check();
  await expect(page.getByRole("heading", { name: "Session A" })).toBeVisible();
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("region", { name: "Back squat" }).getByRole("button", { name: "Set 1 done" }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Finish" }).click();

  await expect(page.getByRole("heading", { name: "Session A is done" })).toBeVisible();
  await page.getByLabel("Do a different workout today").selectOption({ label: "Session B (Thu)" });
  await page.getByRole("radio", { name: /Green/ }).check();
  await expect(page.getByRole("heading", { name: "Session B" })).toBeVisible();
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page.getByRole("heading", { name: "Session B" })).toBeVisible();
});

test("supersets: drop a line from a round, add a round, remove and restore the whole group", async ({ page }) => {
  await dianeOnBlock1(page);
  await page.getByRole("radio", { name: /Green/ }).check();
  await page.getByRole("button", { name: "Start workout" }).click();
  const superset = page.getByRole("region", { name: "Superset" });
  await expect(superset.locator(".round")).toHaveCount(5);
  await expect(superset.getByRole("button", { name: "Remove", exact: true })).toHaveCount(1);

  // Drop the row from round 5, then add a round back
  await superset.locator(".round").nth(4).getByRole("button", { name: "Remove Barbell row" }).click();
  await expect(superset.locator(".round").nth(4).locator(".set-row")).toHaveCount(1);
  await superset.getByRole("button", { name: "+ Round" }).click();
  await expect(superset.locator(".round")).toHaveCount(6);

  // Remove the whole superset, then undo
  await superset.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("dialog").getByRole("radio", { name: "Equipment busy" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(superset).toContainText("Superset removed");
  await expect(superset.locator(".round")).toHaveCount(0);
  await superset.getByRole("button", { name: "Undo remove" }).click();
  await expect(superset.locator(".round")).toHaveCount(6);
});

test("48-hour check: asked the day after, a wrong tap can be changed, and it shows in the day's log", async ({ page }) => {
  await page.clock.install({ time: new Date("2027-01-01T10:00:00") }); // a Friday
  await dianeOnBlock1(page);
  await page.goto("./#/programme/strength-block-1");
  await page.getByRole("checkbox", { name: /48 hours later/ }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.getByRole("link", { name: "Today" }).click();
  await page.getByRole("radio", { name: /Green/ }).check();
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("region", { name: "Back squat" }).getByRole("button", { name: "Set 1 done" }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Finish" }).click();
  // Not asked on the day itself
  await expect(page.getByRole("heading", { name: /sit\?/ })).toHaveCount(0);

  await page.clock.setSystemTime(new Date("2027-01-02T09:00:00"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "How did Friday's Session A sit?" })).toBeVisible();
  await page.getByRole("button", { name: "Up a bit but settling" }).click();
  const done = page.getByRole("region", { name: "48-hour check" });
  await expect(done).toContainText("Friday's Session A: Up a bit but settling.");
  await done.getByRole("button", { name: "Change" }).click();
  await page.getByRole("button", { name: "Clearly worse" }).click();
  await expect(done).toContainText("Clearly worse. Its weights go back a step next time.");

  await page.getByRole("link", { name: "Progress" }).click();
  await page.getByRole("gridcell", { name: /Friday, 1 January 2027/ }).click();
  await expect(page.locator(".day-log")).toContainText("48-hour check: Clearly worse");
  await page.locator(".day-log").getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("48-hour check")).toHaveValue("worse");
});

test("walks: log one from Today, and add one to an earlier day", async ({ page }) => {
  await page.clock.install({ time: new Date("2027-01-02T10:00:00") });
  await dianeOnBlock1(page);
  const walks = page.getByRole("region", { name: "Walks" });
  await walks.getByRole("button", { name: "Log a walk" }).click();
  await walks.getByLabel("Walk minutes").fill("40");
  await walks.getByRole("button", { name: "Log walk" }).click();
  await expect(walks).toContainText("Walk, 40 minutes");

  await page.getByRole("link", { name: "Progress" }).click();
  await expect(page.getByRole("gridcell", { name: /Saturday, 2 January 2027.*walk/ })).toBeVisible();
  await page.getByRole("gridcell", { name: /Friday, 1 January 2027/ }).click();
  const log = page.locator(".day-log");
  await log.getByRole("button", { name: "Log a walk" }).click();
  await log.getByLabel("Walk minutes").fill("25");
  await log.getByRole("button", { name: "Log walk" }).click();
  await expect(log).toContainText("Walk, 25 minutes");
  await log.getByRole("button", { name: "Remove Walk, 25 minutes" }).click();
  await expect(log).not.toContainText("Walk, 25 minutes");
});
