import type { RuleTable } from "./rule-table.ts";

// History is most recent first, sessions separated by " | ". Each session is "weight: reps per set".
//   "-" is a set not done; "@9" after a set is its RPE; "hold:" or "skip:" in front is the readiness day;
//   "worse:" in front means the 48-hour check said that workout left things clearly worse.
export const progressionRules: RuleTable<{ rule: string; target: string; history: string; start: number | null }, string> = {
  title: "Next weight and reps",
  summary:
    "What each exercise asks for next time, from its last sessions in this programme. Linear adds weight when every set hits the reps; " +
    "double builds reps to the top of the range first. Two misses in a row at the same weight drop it 10%. " +
    "A hard set (RPE at or above the hold level), skipped sets, or a readiness hold keep the weight where it is. " +
    "When the 48-hour check says a workout left things clearly worse, each of its exercises goes back one jump.",
  columns: {
    given: { rule: "Progression", target: "Reps", history: "Last sessions (most recent first)", start: "Starting weight" },
    expected: "Next time",
  },
  rows: [
    { case: "No history: the starting weight", given: { rule: "linear 2.5", target: "5", history: "", start: 30 }, expected: "30kg · start" },
    { case: "No history and no starting weight", given: { rule: "linear 2.5", target: "5", history: "", start: null }, expected: "no weight · start" },
    { case: "Every set done: add weight", given: { rule: "linear 2.5", target: "5", history: "30: 5,5,5,5,5", start: 30 }, expected: "32.5kg · add" },
    { case: "A set short: same weight", given: { rule: "linear 2.5", target: "5", history: "32.5: 5,5,5,4,4", start: 30 }, expected: "32.5kg · repeat" },
    { case: "Two misses in a row: drop 10%", given: { rule: "linear 2.5 stall 2", target: "5", history: "40: 5,5,4 | 40: 5,4,4", start: 30 }, expected: "36kg · reduce: stalled" },
    { case: "Misses at different weights don't count as a stall", given: { rule: "linear 2.5 stall 2", target: "5", history: "40: 5,5,4 | 37.5: 5,4,4", start: 30 }, expected: "40kg · repeat" },
    { case: "Every set done, but the last at RPE 9: hold", given: { rule: "linear 2.5 hold 9", target: "5", history: "40: 5,5,5@9", start: 30 }, expected: "40kg · hold: hard" },
    { case: "Every set done at RPE 8: add", given: { rule: "linear 2.5 hold 9", target: "5", history: "40: 5,5,5@8", start: 30 }, expected: "42.5kg · add" },
    { case: "Sets skipped, none missed: hold, no penalty", given: { rule: "linear 2.5 stall 2", target: "5", history: "40: 5,5,- | 40: 5,4,4", start: 30 }, expected: "40kg · hold: sets skipped" },
    { case: "Amber day set to hold: same weight", given: { rule: "linear 2.5", target: "5", history: "hold: 40: 5,5,5", start: 30 }, expected: "40kg · hold: readiness" },
    { case: "A skipped day doesn't count: goes by the one before", given: { rule: "linear 2.5", target: "5", history: "skip: 40: 5,5,5 | 37.5: 5,5,5", start: 30 }, expected: "40kg · add" },
    { case: "Nothing ticked doesn't count either", given: { rule: "linear 2.5", target: "5", history: "40: -,-,- | 37.5: 5,5,5", start: 30 }, expected: "40kg · add" },
    { case: "Double: top of the range on every set: add, back to the bottom", given: { rule: "double 2.5", target: "8-12", history: "20: 12,12,12", start: 20 }, expected: "22.5kg · add" },
    { case: "Double: in the range: build reps", given: { rule: "double 2.5", target: "8-12", history: "20: 12,10,9", start: 20 }, expected: "20kg · build reps" },
    { case: "Double: below the range twice: drop 10%", given: { rule: "double 2.5 stall 2", target: "8-12", history: "22.5: 8,7,6 | 22.5: 8,7,7", start: 20 }, expected: "20kg · reduce: stalled" },
    { case: "Double: below the range once: repeat", given: { rule: "double 2.5 stall 2", target: "8-12", history: "22.5: 8,7,6", start: 20 }, expected: "22.5kg · repeat" },
    { case: "Double: sets skipped: hold", given: { rule: "double 2.5", target: "8-12", history: "20: 10,9,-", start: 20 }, expected: "20kg · hold: sets skipped" },
    { case: "Slot's own increment: 1kg on the press", given: { rule: "linear 1", target: "5", history: "15.5: 5,5,5", start: 15.5 }, expected: "16.5kg · add" },
    { case: "None: stays where it was", given: { rule: "none", target: "10", history: "12.5: 10,10", start: 10 }, expected: "12.5kg · no change" },
    { case: "Bodyweight sets: nothing to add", given: { rule: "linear 2.5", target: "8", history: "x: 8,8,8", start: null }, expected: "no weight · repeat" },
    { case: "Top set at RPE 8 or less: add to top and back-off", given: { rule: "top 2.5 @8 85%", target: "3", history: "100: 3@8,3,3", start: 90 }, expected: "102.5kg, back-off 87kg · add" },
    { case: "Top set harder than planned: hold", given: { rule: "top 2.5 @8 85%", target: "3", history: "100: 3@9,3,3", start: 90 }, expected: "100kg, back-off 85kg · hold: hard" },
    { case: "Top set missed twice: drop 10%", given: { rule: "top 2.5 @8 85% stall 2", target: "3", history: "100: 2,3,3 | 100: 2,3,3", start: 90 }, expected: "90kg, back-off 76.5kg · reduce: stalled" },
    { case: "Top set missed once: repeat", given: { rule: "top 2.5 @8 85% stall 2", target: "3", history: "100: 2,3,3", start: 90 }, expected: "100kg, back-off 85kg · repeat" },
    { case: "48-hour check clearly worse: back one jump", given: { rule: "linear 2.5", target: "5", history: "worse: 40: 5,5,5", start: 30 }, expected: "37.5kg · back off: 48-hour check" },
    { case: "Clearly worse beats a stall drop, and isn't counted as a miss", given: { rule: "double 2.5 stall 2", target: "8-12", history: "worse: 22.5: 8,7,6 | 22.5: 8,7,7", start: 20 }, expected: "20kg · back off: 48-hour check" },
    { case: "Clearly worse can't go below nothing", given: { rule: "linear 5", target: "5", history: "worse: 2.5: 5,5,5", start: 0 }, expected: "0kg · back off: 48-hour check" },
    { case: "Clearly worse on a top set: back one jump, back-off follows", given: { rule: "top 2.5 @8 85%", target: "3", history: "worse: 100: 3@8,3,3", start: 90 }, expected: "97.5kg, back-off 83kg · back off: 48-hour check" },
    { case: "Clearly worse, no weight to take off", given: { rule: "linear 2.5", target: "8", history: "worse: x: 8,8,8", start: null }, expected: "no weight · repeat" },
    { case: "Clearly worse on a none-progression: stays put", given: { rule: "none", target: "10", history: "worse: 12.5: 10,10", start: 10 }, expected: "12.5kg · no change" },
    { case: "Top set on a hold day", given: { rule: "top 2.5 @8 85%", target: "3", history: "hold: 100: 3,3,3", start: 90 }, expected: "100kg, back-off 85kg · hold: readiness" },
  ],
};
