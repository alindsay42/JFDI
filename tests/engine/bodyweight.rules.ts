import type { RuleTable } from "./rule-table.ts";

export const bodyweightPaceRules: RuleTable<{ start: number; goal: number; weeks: number; latest: number }, string> = {
  title: "Bodyweight target pace",
  summary:
    "The cone on the bodyweight chart: a reasonable range to land in, starting from the weigh-in when the first goal was set. " +
    "Gaining is +0.5 to +1kg a month. Losing is 0.5% to 1% of the starting bodyweight a week. " +
    "A goal within 0.5kg of the start is holding, with 1kg either side. A month is 30.44 days; edges are rounded to 0.1kg.",
  columns: { given: { start: "Start (kg)", goal: "Goal (kg)", weeks: "Weeks since start", latest: "Latest (kg)" }, expected: "Range then, and where the latest sits" },
  rows: [
    { case: "Andrew's Phase 1: 4 weeks in, up 0.6kg", given: { start: 75.7, goal: 77, weeks: 4, latest: 76.3 }, expected: "76.2 to 76.6kg: within" },
    { case: "Gaining, but faster than +1kg a month", given: { start: 75.7, goal: 77, weeks: 4, latest: 77 }, expected: "76.2 to 76.6kg: above" },
    { case: "Gaining, but nothing on yet", given: { start: 75.7, goal: 77, weeks: 4, latest: 75.7 }, expected: "76.2 to 76.6kg: below" },
    { case: "8 weeks of gaining", given: { start: 75.7, goal: 79.5, weeks: 8, latest: 77 }, expected: "76.6 to 77.5kg: within" },
    { case: "Losing from 80kg: 0.4 to 0.8kg a week", given: { start: 80, goal: 75, weeks: 4, latest: 78 }, expected: "76.8 to 78.4kg: within" },
    { case: "Losing faster than 1% a week", given: { start: 80, goal: 75, weeks: 4, latest: 76.5 }, expected: "76.8 to 78.4kg: below" },
    { case: "Holding: a goal within 0.5kg of the start", given: { start: 62, goal: 62.4, weeks: 6, latest: 62.8 }, expected: "61 to 63kg: within" },
    { case: "Holding, but 1.5kg up", given: { start: 62, goal: 62.4, weeks: 6, latest: 63.5 }, expected: "61 to 63kg: above" },
  ],
};
