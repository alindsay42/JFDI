import { describe, expect, it } from "vitest";
import { daysBetween, mondayOf, nextAdhoc, restDaysLeft, setDaysOn, setDaysWeek, weekdayOf } from "../../src/engine/schedule.ts";
import type { Plan } from "../../src/formats/programme.ts";
import { adhocRules, restRules, setDaysRules } from "./schedule.rules.ts";

const adhoc = (weeks: string): Extract<Plan, { mode: "adhoc" }> => ({ mode: "adhoc", weeks: weeks.split("|").map((w) => ({ workouts: w.trim().split(",") })) });

describe(adhocRules.title, () => {
  for (const row of adhocRules.rows) {
    it(row.case, () => {
      const last = row.given.last === "none" ? null : { week: Number(row.given.last.split(".")[0]) - 1, day: Number(row.given.last.split(".")[1]) - 1 };
      const n = nextAdhoc(adhoc(row.given.weeks), last);
      expect(`${n.week + 1}.${n.day + 1}: ${n.workout}`).toBe(row.expected);
    });
  }
});

describe(restRules.title, () => {
  for (const row of restRules.rows) {
    it(row.case, () => {
      expect(restDaysLeft(row.given.minRest ?? undefined, row.given.lastDone || null, row.given.today)).toBe(row.expected);
    });
  }
});

describe(setDaysRules.title, () => {
  for (const row of setDaysRules.rows) {
    it(row.case, () => {
      const w = setDaysWeek(row.given.weeks, row.given.start, row.given.date);
      expect(w === null ? "not started" : `${w + 1}, ${weekdayOf(row.given.date)}`).toBe(row.expected);
    });
  }

  it("gives the day's plan, with its week", () => {
    const free = { type: "free" as const };
    const week = (wed: string) => ({ days: { mon: free, tue: free, wed: { type: "workout" as const, workout: wed }, thu: free, fri: free, sat: { type: "rest" as const }, sun: free } });
    const plan: Extract<Plan, { mode: "setDays" }> = { mode: "setDays", weeks: [week("heavy"), week("rdl")] };
    expect(setDaysOn(plan, "2027-01-04", "2027-01-06")).toEqual({ type: "workout", workout: "heavy", week: 0 });
    expect(setDaysOn(plan, "2027-01-04", "2027-01-13")).toEqual({ type: "workout", workout: "rdl", week: 1 });
    expect(setDaysOn(plan, "2027-01-04", "2027-01-09")).toEqual({ type: "rest", week: 0 });
    expect(setDaysOn(plan, "2027-01-04", "2027-01-01")).toBeNull();
  });

  it("counts days across months, years and clock changes", () => {
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
    expect(weekdayOf("1969-12-31")).toBe("wed");
    expect([mondayOf("2027-01-07"), mondayOf("2027-01-04"), mondayOf("2027-01-03")]).toEqual(["2027-01-04", "2027-01-04", "2026-12-28"]);
  });
});
