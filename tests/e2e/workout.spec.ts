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
  await page.getByRole("checkbox", { name: /48-hour check/ }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.getByRole("link", { name: "Today" }).click();
  await page.getByRole("radio", { name: /Green/ }).check();
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("region", { name: "Back squat" }).getByRole("button", { name: "Set 1 done" }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Finish" }).click();
  // Not asked on the day itself
  await expect(page.getByRole("heading", { name: /felt since/ })).toHaveCount(0);

  await page.clock.setSystemTime(new Date("2027-01-02T09:00:00"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "How have you felt since Friday's Session A?" })).toBeVisible();
  await page.getByRole("button", { name: "A bit worn but settling" }).click();
  const done = page.getByRole("region", { name: "48-hour check" });
  await expect(done).toContainText("Friday's Session A: A bit worn but settling.");
  await done.getByRole("button", { name: "Change" }).click();
  await page.getByRole("button", { name: "Clearly worse" }).click();
  await expect(done).toContainText("Friday's Session A: Clearly worse.");

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

test("the check-in is kept for the day, Red included, and shows on the calendar", async ({ page }) => {
  await page.clock.install({ time: new Date("2027-01-01T10:00:00") });
  await dianeOnBlock1(page);
  await page.getByRole("radio", { name: /Red/ }).check();
  await expect(page.getByRole("heading", { name: "No lifting today" })).toBeVisible();
  // Saved: the calendar shows it, so it's safe to close and reopen
  await page.getByRole("link", { name: "Progress" }).click();
  await expect(page.getByRole("gridcell", { name: /Friday, 1 January 2027/ })).toHaveAccessibleName(/Red day/);
  await page.getByRole("link", { name: "Today" }).click();
  await page.reload();
  await expect(page.getByRole("radio", { name: /Red/ })).toBeChecked();
  await page.getByRole("link", { name: "Progress" }).click();
  await page.getByRole("gridcell", { name: /Friday, 1 January 2027/ }).click();
  await expect(page.locator(".day-log")).toContainText("Red day");
});

test("last time: each set can copy its numbers from last time, or all of them at once", async ({ page }) => {
  await page.clock.install({ time: new Date("2027-01-01T10:00:00") });
  await dianeOnBlock1(page);
  await page.getByRole("radio", { name: /Green/ }).check();
  await page.getByRole("button", { name: "Start workout" }).click();
  const squat = page.getByRole("region", { name: "Back squat" });
  await expect(squat.locator(".last-chip")).toHaveCount(0);
  await squat.getByLabel("Set 1 weight").fill("32.5");
  await squat.getByLabel("Set 1 reps").fill("6");
  await squat.getByRole("button", { name: "Set 1 done" }).click();
  await squat.getByRole("button", { name: "Set 2 done" }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Finish/ }).click();
  // Saved: Today has moved on to the rest day
  await expect(page.getByRole("heading", { name: "Rest day" })).toBeVisible();

  await page.clock.setSystemTime(new Date("2027-01-04T10:00:00"));
  await page.reload();
  await page.getByRole("button", { name: "Skip to next workout" }).click();
  await page.getByRole("radio", { name: /Green/ }).check();
  await page.getByRole("button", { name: "Start workout" }).click();
  const again = page.getByRole("region", { name: "Back squat" });
  // Set 3 wasn't done last time, so it has nothing to show
  await expect(again.getByRole("button", { name: /Set 3: use last time/ })).toHaveCount(0);
  const chip1 = again.getByRole("button", { name: "Set 1: use last time, 32.5kg × 6" });
  await chip1.click();
  await expect(again.getByLabel("Set 1 reps")).toHaveValue("6");
  // Once a set matches last time, its note stays as a reminder but there's nothing to copy
  await expect(chip1).toBeDisabled();
  // Set 2 is untouched; Use last time fills it (and any others) in one go
  await again.getByRole("button", { name: "Use last time", exact: true }).click();
  await expect(again.getByLabel("Set 2 weight")).toHaveValue("30");
  await expect(again.getByLabel("Set 2 reps")).toHaveValue("5");
  await expect(again.getByRole("button", { name: "Use last time", exact: true })).toHaveCount(0);
});

test("deload when you choose: started from Today, lighter for 7 days, and can be ended", async ({ page }) => {
  await page.clock.install({ time: new Date("2027-01-01T10:00:00") });
  await dianeOnBlock1(page);
  await page.goto("./#/programme/strength-block-1");
  await page.getByRole("checkbox", { name: "Let me start a deload week from Today" }).check();
  await expect(page.getByLabel("Deload weight, percent of normal")).toHaveValue("60");
  await page.getByRole("radio", { name: /Show what I did last time/ }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.reload();
  await expect(page.getByRole("radio", { name: /Show what I did last time/ })).toBeChecked();

  await page.getByRole("link", { name: "Today" }).click();
  await page.getByRole("radio", { name: /Green/ }).check();
  const squat = page.locator(".preview-row", { hasText: "Back squat" });
  await expect(squat.locator(".preview-target")).toContainText("30kg");
  await page.getByRole("button", { name: "Make this a deload week" }).click();
  await expect(page.getByText("Deload week until Thu 7 Jan.")).toBeVisible();
  // 60% of 30kg is 18kg, less than the empty bar, so the bar it is
  await expect(squat.locator(".preview-target")).toContainText("20kg");
  await page.reload();
  await expect(page.getByText("Deload week until Thu 7 Jan.")).toBeVisible();
  await page.getByRole("button", { name: "End deload" }).click();
  await expect(squat.locator(".preview-target")).toContainText("30kg");
  await expect(page.getByRole("button", { name: "Make this a deload week" })).toBeVisible();
});

test("after a deload week, last time skips it and says so", async ({ page }) => {
  await page.clock.install({ time: new Date("2027-01-01T10:00:00") });
  await dianeOnBlock1(page);
  await page.goto("./#/programme/strength-block-1");
  await page.getByRole("checkbox", { name: "Let me start a deload week from Today" }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.getByRole("link", { name: "Today" }).click();

  const squatSet1 = async () => {
    await page.getByRole("radio", { name: /Green/ }).check();
    await page.getByRole("button", { name: "Start workout" }).click();
    await page.getByRole("region", { name: "Back squat" }).getByRole("button", { name: "Set 1 done" }).click();
    await page.getByRole("button", { name: "Finish workout" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Finish/ }).click();
    await expect(page.getByRole("heading", { name: "Rest day" })).toBeVisible();
  };
  await squatSet1();
  await page.clock.setSystemTime(new Date("2027-01-04T10:00:00"));
  await page.reload();
  await page.getByRole("button", { name: "Skip to next workout" }).click();
  await page.getByRole("button", { name: "Make this a deload week" }).click();
  await squatSet1();

  await page.clock.setSystemTime(new Date("2027-01-11T10:00:00"));
  await page.reload();
  await page.getByRole("button", { name: "Skip to next workout" }).click();
  await page.getByRole("radio", { name: /Green/ }).check();
  await page.getByRole("button", { name: "Start workout" }).click();
  const squat = page.getByRole("region", { name: "Back squat" });
  await expect(squat.getByText("Last numbers are from before your deload week (Mon 4 Jan).")).toBeVisible();
  await expect(squat.getByRole("button", { name: "Set 1: use last time, 30kg × 5" })).toBeVisible();
});

test("training blocks: after a deload, the next block starts from week 2's numbers and can skip to week 3's", async ({ page }) => {
  await page.clock.install({ time: new Date("2027-01-01T10:00:00") });
  await dianeOnBlock1(page);
  await page.goto("./#/programme/strength-block-1");
  const blocks = page.locator("section", { has: page.getByRole("heading", { name: "Training blocks" }) });
  await expect(blocks.getByLabel("Weeks in a block")).toHaveValue("6");
  await blocks.getByLabel("Weeks in a block").fill("8");
  await blocks.getByRole("checkbox", { name: "Let me start a deload week from Today" }).check();
  await blocks.getByRole("radio", { name: "Start the next block from an earlier week's numbers" }).check();
  await expect(blocks.getByLabel("Week of the last block to start from")).toHaveValue("2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.getByRole("link", { name: "Today" }).click();

  // One Session A a week, squat set 1 only, at the weight given
  const week = async (date: string, kg: string | null, deload = false) => {
    await page.clock.setSystemTime(new Date(`${date}T10:00:00`));
    await page.reload();
    await page.getByRole("button", { name: "Start workout" }).waitFor();
    if (await page.getByRole("heading", { name: "Session B" }).isVisible()) await page.getByRole("button", { name: "Skip to next workout" }).click();
    if (deload) await page.getByRole("button", { name: "Make this a deload week" }).click();
    await page.getByRole("radio", { name: /Green/ }).check();
    await page.getByRole("button", { name: "Start workout" }).click();
    const squat = page.getByRole("region", { name: "Back squat" });
    if (kg) await squat.getByLabel("Set 1 weight").fill(kg);
    await squat.getByRole("button", { name: "Set 1 done" }).click();
    await page.getByRole("button", { name: "Finish workout" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Finish/ }).click();
    await expect(page.getByRole("heading", { name: "Rest day" })).toBeVisible();
  };
  await expect(page.locator(".block-place")).toHaveText(" · Block 1 · Week 1 of 8");
  await week("2027-01-01", "30");
  await week("2027-01-04", "32.5");
  await week("2027-01-11", "35");
  await week("2027-01-18", null, true);

  await page.clock.setSystemTime(new Date("2027-01-25T10:00:00"));
  await page.reload();
  await page.getByRole("button", { name: "Skip to next workout" }).click();
  await page.getByRole("radio", { name: /Green/ }).check();
  await expect(page.locator(".block-place")).toHaveText(" · Block 2 · Week 1 of 8");
  await expect(page.getByText("New block: starting from week 2's numbers of the last block.")).toBeVisible();
  const squat = page.locator(".preview-row", { hasText: "Back squat" });
  await expect(squat.locator(".preview-target")).toContainText("32.5kg");
  await expect(squat).toContainText("new block");
  await page.getByRole("button", { name: "Use week 3's numbers" }).click();
  await expect(page.getByText("New block: starting from week 3's numbers of the last block.")).toBeVisible();
  await expect(squat.locator(".preview-target")).toContainText("35kg");
  await expect(page.getByRole("button", { name: /Use week 4's numbers/ })).toHaveCount(0);
});

test("gyms: a hotel gym with its own kit, picked on Today, and targets round to what it can load", async ({ page }) => {
  await page.clock.install({ time: new Date("2027-01-01T10:00:00") });
  await dianeOnBlock1(page);
  await page.getByRole("radio", { name: /Green/ }).check();
  const squat = page.locator(".preview-row", { hasText: "Back squat" });
  await expect(squat.locator(".preview-target")).toContainText("30kg");
  // One gym, so no choice to make
  await expect(page.getByLabel("Training at")).toHaveCount(0);

  await page.getByRole("link", { name: "Programme", exact: true }).click();
  await page.getByRole("link", { name: "Edit equipment" }).click();
  await page.getByRole("button", { name: "+ Add a gym" }).click();
  await page.getByLabel("New gym name").fill("Hotel");
  await page.getByLabel("Start the new gym from").selectOption({ label: "Nothing" });
  await page.getByRole("button", { name: "Add gym" }).click();
  await expect(page.getByRole("link", { name: "Hotel" })).toHaveAttribute("aria-current", "page");
  // A 15kg hotel bar, and only 10kg plates
  await page.getByRole("button", { name: "+ Add a bar" }).click();
  await page.getByLabel("Barbell: weight").fill("15");
  await page.getByLabel("Barbell: weight").blur();
  await page.getByRole("button", { name: "+ Add a plate set" }).click();
  await page.getByLabel("Plates: new plate size").fill("10");
  await page.getByRole("button", { name: "Add a pair" }).click();
  await page.getByRole("button", { name: "Remove 20kg plates from Plates" }).click();
  await expect(page.getByLabel("Plates: how many 10kg")).toHaveValue("2");
  await page.getByLabel("Plates: how many 10kg").fill("4");
  await page.getByLabel("Plates: how many 10kg").blur();

  await page.getByRole("link", { name: "Today" }).click();
  await page.getByLabel("Training at").selectOption({ label: "Hotel" });
  await page.getByRole("radio", { name: /Green/ }).check();
  // 30kg can't be made from a 15kg bar and 10kg plates: 15, 35, 55. Nearest is 35
  await expect(squat.locator(".preview-target")).toContainText("35kg");
  await page.reload();
  await expect(page.getByLabel("Training at")).toHaveValue("hotel");

  await page.getByLabel("Training at").selectOption({ label: "Home gym" });
  await expect(squat.locator(".preview-target")).toContainText("30kg");

  // Removing the hotel sends anyone there back home
  await page.getByLabel("Training at").selectOption({ label: "Hotel" });
  await page.getByRole("link", { name: "Edit gyms" }).click();
  await page.getByRole("link", { name: "Hotel" }).click();
  await page.getByRole("button", { name: "Remove this gym" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("link", { name: "Hotel" })).toHaveCount(0);
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByLabel("Training at")).toHaveCount(0);
});

test("equipment: bars, dumbbells and other kit can be changed, and a bad value is explained", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Name").fill("Andrew");
  await page.getByRole("radio", { name: "Blue" }).check();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(".you-bar")).toContainText("Andrew");
  await page.goto("./#/equipment");
  await expect(page.getByRole("link", { name: "Home gym (home)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove this gym" })).toHaveCount(0);
  await page.getByLabel("Barbell: type").selectOption({ label: "Trap bar" });
  await page.getByLabel("Barbell: weight").fill("25");
  await page.getByLabel("Barbell: weight").blur();
  await page.getByLabel("Barbell: name").fill("Hex trap bar");
  await page.getByLabel("Barbell: name").blur();
  await expect(page.getByLabel("Hex trap bar: weight")).toHaveValue("25");

  // Saved as you go, so the box changes once the save is done
  await page.getByRole("checkbox", { name: "7.5kg", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "7.5kg", exact: true })).not.toBeChecked();
  await page.getByLabel("Dumbbells: new pair").fill("32.5");
  await page.getByRole("button", { name: "Add a pair" }).last().click();
  await expect(page.getByRole("checkbox", { name: "32.5kg", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "+ Add loadable handles" }).click();
  await expect(page.getByText("Weigh a handle and enter it here")).toBeVisible();
  await page.getByLabel("Loadable handles: handle weight").fill("2.5");
  await page.getByLabel("Loadable handles: handle weight").blur();
  await expect(page.getByText("Weigh a handle and enter it here")).toBeHidden();

  await page.getByLabel("New kit name").fill("Cable machine");
  await page.getByLabel("New kit type").selectOption({ label: "Cable" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Cable machine")).toBeVisible();
  await page.getByRole("button", { name: "Remove Squat rack" }).click();
  await expect(page.getByText("Squat rack")).toHaveCount(0);

  await page.getByLabel("Gym name").fill("Garage");
  await page.getByLabel("Gym name").blur();
  await expect(page.getByRole("link", { name: "Garage (home)" })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Hex trap bar: type")).toHaveValue("trap");
  await expect(page.getByRole("checkbox", { name: "7.5kg", exact: true })).not.toBeChecked();
});
