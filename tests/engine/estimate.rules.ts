import type { RuleTable } from "./rule-table.ts";

export const estimateRules: RuleTable<{ kg: number; reps: number }, number | null> = {
  title: "Estimated one-rep max",
  summary:
    "Turns a set into an estimated one-rep max, so sets of different reps can share one chart and be compared with targets. " +
    "Uses the dos Remedios table, with reps between its rows worked out proportionally. Sets of more than 15 reps aren't estimated.",
  columns: { given: { kg: "Weight (kg)", reps: "Reps" }, expected: "Estimated one-rep max (kg)" },
  show: (v) => (v === null ? "no estimate" : v.toFixed(1)),
  rows: [
    { case: "A single is the max itself", given: { kg: 100, reps: 1 }, expected: 100 },
    { case: "2 reps is 92% of max", given: { kg: 92, reps: 2 }, expected: 100 },
    { case: "5 reps is 85% of max", given: { kg: 100, reps: 5 }, expected: 117.6 },
    { case: "7 reps falls between 6 (82%) and 8 (75%), so 78.5%", given: { kg: 100, reps: 7 }, expected: 127.4 },
    { case: "15 reps is 60%, the last row", given: { kg: 60, reps: 15 }, expected: 100 },
    { case: "Diane's starting squat: 30kg for 5", given: { kg: 30, reps: 5 }, expected: 35.3 },
    { case: "Diane's best squat set: 40kg for 7", given: { kg: 40, reps: 7 }, expected: 51 },
    { case: "More than 15 reps isn't estimated", given: { kg: 20, reps: 16 }, expected: null },
    { case: "No reps, no estimate", given: { kg: 100, reps: 0 }, expected: null },
    { case: "No weight (bodyweight only), no estimate", given: { kg: 0, reps: 5 }, expected: null },
  ],
};
