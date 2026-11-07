import type { RuleTable } from "./rule-table.ts";

// Weeks are separated by " | ", workouts within a week by ",". Places are "week.day", counted from 1.
export const adhocRules: RuleTable<{ weeks: string; last: string }, string> = {
  title: "Ad hoc: which workout is next",
  summary: "Workouts go in order through the cycle. A missed workout stays next up, whatever the date. After the last day of the last week, the cycle starts again.",
  columns: { given: { weeks: "Cycle", last: "Last done (week.day)" }, expected: "Next (week.day: workout)" },
  rows: [
    { case: "Nothing done yet: the first workout", given: { weeks: "A,B", last: "none" }, expected: "1.1: A" },
    { case: "Day 1 done: day 2", given: { weeks: "A,B", last: "1.1" }, expected: "1.2: B" },
    { case: "One-week cycle: back to day 1", given: { weeks: "A,B", last: "1.2" }, expected: "1.1: A" },
    { case: "End of week 1 in a 2-week cycle: week 2 starts", given: { weeks: "A,B | A2,B2", last: "1.2" }, expected: "2.1: A2" },
    { case: "End of the cycle: back to week 1", given: { weeks: "A,B | A2,B2", last: "2.2" }, expected: "1.1: A" },
    { case: "Weeks can have different numbers of days", given: { weeks: "A | B,C,D", last: "1.1" }, expected: "2.1: B" },
    { case: "A place the plan no longer has: start of the next week", given: { weeks: "A,B | C,D", last: "1.5" }, expected: "2.1: C" },
    { case: "A week the plan no longer has: back to the start", given: { weeks: "A,B", last: "3.1" }, expected: "1.1: A" },
  ],
};

export const restRules: RuleTable<{ minRest: number | null; lastDone: string; today: string }, number> = {
  title: "Ad hoc: rest days between workouts",
  summary: "With a minimum number of rest days set, the next workout waits until that many full days have passed since the last one.",
  columns: { given: { minRest: "Rest days", lastDone: "Last workout", today: "Today" }, expected: "Days still to rest" },
  rows: [
    { case: "No rest days set", given: { minRest: null, lastDone: "2027-01-01", today: "2027-01-02" }, expected: 0 },
    { case: "2 rest days, the next day: 2 more", given: { minRest: 2, lastDone: "2027-01-01", today: "2027-01-02" }, expected: 2 },
    { case: "2 rest days, Friday then Sunday: 1 more", given: { minRest: 2, lastDone: "2027-01-01", today: "2027-01-03" }, expected: 1 },
    { case: "2 rest days, Friday then Monday: ready", given: { minRest: 2, lastDone: "2027-01-01", today: "2027-01-04" }, expected: 0 },
    { case: "Nothing done yet: ready", given: { minRest: 2, lastDone: "", today: "2027-01-04" }, expected: 0 },
  ],
};

export const setDaysRules: RuleTable<{ weeks: number; start: string; date: string }, string> = {
  title: "Set days: which week and day a date is",
  summary: "Weeks run Monday to Sunday. Week 1 is the week the start date falls in, and the cycle repeats from there. Nothing is planned before the start date.",
  columns: { given: { weeks: "Weeks in cycle", start: "Start date", date: "Date" }, expected: "Week, day" },
  rows: [
    { case: "The start date itself", given: { weeks: 2, start: "2027-01-04", date: "2027-01-04" }, expected: "1, mon" },
    { case: "Later the same week", given: { weeks: 2, start: "2027-01-04", date: "2027-01-08" }, expected: "1, fri" },
    { case: "The next Monday starts week 2", given: { weeks: 2, start: "2027-01-04", date: "2027-01-11" }, expected: "2, mon" },
    { case: "After the last week, back to week 1", given: { weeks: 2, start: "2027-01-04", date: "2027-01-18" }, expected: "1, mon" },
    { case: "Starting on a Friday: that week is week 1, and Monday starts week 2", given: { weeks: 2, start: "2027-01-01", date: "2027-01-04" }, expected: "2, mon" },
    { case: "A 1-week cycle is always week 1", given: { weeks: 1, start: "2027-01-01", date: "2027-03-17" }, expected: "1, wed" },
    { case: "Before the start date: nothing", given: { weeks: 2, start: "2027-01-04", date: "2027-01-03" }, expected: "not started" },
  ],
};
