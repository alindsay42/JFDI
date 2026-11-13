import type { RuleTable } from "./rule-table.ts";

export const loadingRules: RuleTable<{ bar: number; plates: string; target: number; going: string }, number> = {
  title: "Weights the gym can make",
  summary:
    "Targets snap to what the gym can actually load. A barbell is its bar plus matching plates on each side, using pairs " +
    "of each plate size. A target going up rounds up to the next loadable weight, one going down (a drop after a stall, " +
    "or a deload) rounds down, and anything else goes to the nearest, the lower on a tie. Below the bar is the bar.",
  columns: { given: { bar: "Bar (kg)", plates: "Plates (kg × how many)", target: "Target (kg)", going: "Going" }, expected: "Loaded (kg)" },
  show: (kg) => `${kg}kg`,
  rows: [
    { case: "Already loadable", given: { bar: 20, plates: "20×2, 10×2, 2.5×2, 1.25×2", target: 42.5, going: "up" }, expected: 42.5 },
    { case: "No 1.25s: adding goes up to the next 5kg", given: { bar: 20, plates: "20×2, 10×2, 5×2, 2.5×2", target: 42.5, going: "up" }, expected: 45 },
    { case: "A drop goes down", given: { bar: 20, plates: "20×2, 10×2, 5×2, 2.5×2", target: 42.5, going: "down" }, expected: 40 },
    { case: "Otherwise the nearest, lower on a tie", given: { bar: 20, plates: "20×2, 10×2, 5×2, 2.5×2", target: 42.5, going: "nearest" }, expected: 40 },
    { case: "Nearest", given: { bar: 20, plates: "20×2, 10×2, 5×2, 2.5×2", target: 44, going: "nearest" }, expected: 45 },
    { case: "A deload below the bar is the bar", given: { bar: 20, plates: "10×2, 5×2", target: 18, going: "down" }, expected: 20 },
    { case: "Odd plates: only pairs count, so 60kg is the most here", given: { bar: 20, plates: "20×3, 2.5×1", target: 62.5, going: "up" }, expected: 60 },
    { case: "More than the plates can make is the most it can", given: { bar: 20, plates: "20×2", target: 100, going: "up" }, expected: 60 },
    { case: "A trap bar at its own weight", given: { bar: 25, plates: "20×2, 10×2, 1.25×2", target: 47, going: "nearest" }, expected: 47.5 },
  ],
};

export const weightedKitRules: RuleTable<{ weights: string; twoAtOnce: string; target: number; going: string }, number> = {
  title: "Weighted kit: kettlebells, sandbags and the like",
  summary:
    "Kit that comes in fixed weights rounds to the weights there are, the same way as a barbell: up for an increase, " +
    "down for a drop, otherwise the nearest. Done with two at once, only weights there are two of count.",
  columns: { given: { weights: "Weights (kg × how many)", twoAtOnce: "Two at once", target: "Target (kg)", going: "Going" }, expected: "Used (kg)" },
  show: (kg) => `${kg}kg`,
  rows: [
    { case: "Going up moves to the next bell", given: { weights: "8×1, 12×2, 16×2, 24×1", twoAtOnce: "No", target: 14, going: "up" }, expected: 16 },
    { case: "A drop moves down a bell", given: { weights: "8×1, 12×2, 16×2, 24×1", twoAtOnce: "No", target: 14, going: "down" }, expected: 12 },
    { case: "Otherwise the nearest", given: { weights: "8×1, 12×2, 16×2, 24×1", twoAtOnce: "No", target: 21, going: "nearest" }, expected: 24 },
    { case: "Two at once: only weights there are two of", given: { weights: "8×1, 12×2, 16×2, 24×1", twoAtOnce: "Yes", target: 20, going: "up" }, expected: 16 },
    { case: "Two at once, and below the lightest pair", given: { weights: "8×1, 12×2, 16×2, 24×1", twoAtOnce: "Yes", target: 8, going: "down" }, expected: 12 },
  ],
};
