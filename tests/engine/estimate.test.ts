import { describe, expect, it } from "vitest";
import { estimateOneRepMax, percentOfMax } from "../../src/engine/estimate.ts";
import { estimateRules } from "./estimate.rules.ts";

describe(estimateRules.title, () => {
  for (const row of estimateRules.rows) {
    it(row.case, () => {
      const got = estimateOneRepMax(row.given.kg, row.given.reps);
      if (row.expected === null) expect(got).toBeNull();
      else expect(got).toBeCloseTo(row.expected, 1);
    });
  }

  it("percent falls as reps rise, across the whole range", () => {
    let last = Infinity;
    for (let r = 1; r <= 15; r += 0.5) {
      const p = percentOfMax(r)!;
      expect(p).toBeLessThanOrEqual(last);
      last = p;
    }
  });

  it("rejects reps that aren't a number", () => {
    expect(percentOfMax(Number.NaN)).toBeNull();
  });
});
