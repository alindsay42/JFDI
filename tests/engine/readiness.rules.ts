import type { RuleTable } from "./rule-table.ts";

// Applied to Block 1's Session A: squat 5 sets (main); bench and row superset, 5 rounds; RDL 3 sets;
// a giant set of lateral raise, plank and battle ropes, 3 rounds (extras). Squat, row and RDL load the spine;
// the row can be swapped for a chest-supported row.
export const readinessRules: RuleTable<{ rules: string }, string> = {
  title: "Readiness rules on the day",
  summary:
    "On Amber and Red days, a programme's readiness rules change the workout before it starts, in the order listed. " +
    "Main, Supporting and Extra are the tiers. When a group loses exercises, what's left runs as a smaller group, or on its own.",
  columns: { given: { rules: "Rules" }, expected: "Workout (sets or rounds)" },
  rows: [
    { case: "No rules: as planned", given: { rules: "" }, expected: "squat 5 · bench+row 5 · rdl 3 · lateral+plank+ropes 3" },
    { case: "Diane's Amber: main lifts to 3 sets, extras dropped, 2 more reps in reserve", given: { rules: "setsTo primary 3; dropTier tertiary; addRir 2" }, expected: "squat 3 · bench+row 5 · rdl 3 · RIR +2" },
    { case: "Diane's Red: no lifting", given: { rules: "noLifting" }, expected: "no lifting" },
    { case: "Sets to 60%, rounding up", given: { rules: "setsPercent 60" }, expected: "squat 3 · bench+row 3 · rdl 2 · lateral+plank+ropes 2" },
    { case: "Sets to 60% for supporting work only", given: { rules: "setsPercent 60 secondary" }, expected: "squat 5 · bench+row 3 · rdl 2 · lateral+plank+ropes 3" },
    { case: "Never fewer than 1 set", given: { rules: "setsPercent 1" }, expected: "squat 1 · bench+row 1 · rdl 1 · lateral+plank+ropes 1" },
    { case: "Drop spine-loading exercises: the row leaves, bench stands alone at the superset's rounds", given: { rules: "dropFlagged spineLoading" }, expected: "bench 5 · lateral+plank+ropes 3" },
    { case: "Swap spine-loading exercises: row swaps for its alternative, others with none are dropped", given: { rules: "swapFlagged spineLoading" }, expected: "bench+cs-row 5 · lateral+plank+ropes 3 · swapped row→cs-row" },
    { case: "Replace with another workout, then apply the rest to it", given: { rules: "replaceWorkout session-b; dropTier tertiary" }, expected: "deadlift 3 · press+pullup 5 · goblet 2" },
    { case: "Nothing after no lifting applies", given: { rules: "noLifting; addRir 2" }, expected: "no lifting" },
    { case: "Dropping everything means no lifting", given: { rules: "dropTier primary; dropTier secondary; dropTier tertiary" }, expected: "no lifting" },
  ],
};
