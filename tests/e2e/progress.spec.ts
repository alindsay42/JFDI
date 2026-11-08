import { expect, test, type Page } from "@playwright/test";

/** Andrew, with the sample Rebuild Log history imported, on 5 November 2026. */
async function withHistory(page: Page) {
  await page.clock.install({ time: new Date("2026-11-05T10:00:00") });
  await page.goto("./");
  await page.getByLabel("Name").fill("Andrew");
  await page.getByRole("radio", { name: "Blue" }).check();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(".you-bar")).toContainText("Andrew");
  await page.getByRole("link", { name: "Backup" }).click();
  await page.getByTestId("Choose a Rebuild Log backup").setInputFiles("tests/fixtures/rebuild-log-backup-sample.json");
  await expect(page.getByRole("status")).toContainText("26 new sessions");
  await page.getByRole("link", { name: "Progress" }).click();
}

test("the calendar shows workouts and walks, and a day's log opens", async ({ page }) => {
  await withHistory(page);
  await expect(page.getByText("12 Oct to 8 Nov")).toBeVisible();
  const wed = page.getByRole("gridcell", { name: /Wednesday, 4 November 2026, 1 workout, walk/ });
  await wed.click();
  await expect(page.getByRole("heading", { name: "Wednesday, 4 November 2026" })).toBeVisible();
  await expect(page.locator(".day-log")).toContainText("Session B");
  await page.getByRole("button", { name: "4 weeks earlier" }).click();
  await expect(page.getByText("14 Sept to 11 Oct")).toBeVisible();
  await page.getByRole("button", { name: "This week" }).click();
  await expect(page.getByText("12 Oct to 8 Nov")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("amend a finished workout: Save changes only once something changes; delete one", async ({ page }) => {
  await withHistory(page);
  await page.getByRole("gridcell", { name: /Wednesday, 4 November 2026/ }).click();
  const log = page.locator(".day-log");
  await log.getByRole("button", { name: "Edit" }).click();
  const save = log.getByRole("button", { name: "Save changes" });
  await expect(save).toBeDisabled();
  const weight = log.getByRole("textbox", { name: /set 1 weight/ }).first();
  const before = await weight.inputValue();
  await weight.fill(String(Number(before) + 2.5));
  await expect(save).toBeEnabled();
  await weight.fill(before);
  await expect(save).toBeDisabled();
  await weight.fill(String(Number(before) + 2.5));
  await save.click();
  await expect(log.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(log.locator(".log-sets").first()).toContainText(`${Number(before) + 2.5}kg`);

  await log.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(log.locator(".session-log")).toHaveCount(0);
  await expect(log).toContainText("Walk, 55 minutes");
  await expect(page.getByText("25 sessions,")).toBeVisible();
});

test("lift progress: pick a lift, switch to heaviest weight, set and clear a goal", async ({ page }) => {
  await withHistory(page);
  const lift = page.getByRole("region", { name: "Lift progress" }).or(page.locator(".card", { has: page.getByRole("heading", { name: "Lift progress" }) }));
  await lift.getByLabel("Lift").selectOption({ index: 1 });
  await expect(lift.getByRole("img")).toBeVisible();
  await lift.getByRole("radio", { name: "Heaviest weight" }).check();
  await expect(lift.getByRole("img")).toHaveAttribute("aria-label", /heaviest weight/);
  await lift.getByRole("button", { name: "Set a goal" }).click();
  await lift.getByLabel("Goal weight").fill("100");
  await lift.getByRole("button", { name: "Save goal" }).click();
  await expect(lift.locator(".chart-goal")).toContainText("Goal 100kg");
  await lift.getByRole("button", { name: "Clear goal" }).click();
  await expect(lift.locator(".chart-goal")).toHaveCount(0);
  await lift.getByText(/Every session/).click();
  await expect(lift.locator("tbody tr").first()).toBeVisible();
});

test("bodyweight: add a weigh-in and delete it", async ({ page }) => {
  await withHistory(page);
  const bw = page.locator(".card", { has: page.getByRole("heading", { name: "Bodyweight" }) });
  await bw.getByRole("textbox", { name: "Bodyweight" }).fill("76.2");
  await bw.getByRole("button", { name: "Save weigh-in" }).click();
  await expect(bw.locator(".lift-summary")).toContainText("76.2kg");
  await bw.getByRole("button", { name: "Delete weigh-in on Thu, 5 Nov 2026" }).click();
  await expect(bw.locator(".lift-summary")).toContainText("75.3kg");
});
