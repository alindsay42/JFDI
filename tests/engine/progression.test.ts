import { describe, expect, it } from "vitest";
import { nextTarget, roundKg, roundKgDown, type Next, type Performance, type ProgressionRule } from "../../src/engine/progression.ts";
import { progressionRules } from "./progression.rules.ts";

/** "linear 2.5 hold 9 stall 2", "double 2.5", "top 2.5 @8 85% stall 2", "none" */
export function parseRule(text: string): ProgressionRule {
  const [kind, inc] = text.split(" ");
  const stall = /stall (\d+)/.exec(text);
  const extra = stall ? { stall: { misses: Number(stall[1]), reducePercent: 10 } } : {};
  if (kind === "none") return { type: "none" };
  if (kind === "top") {
    const m = /@(\d+(?:\.\d+)?) (\d+)%/.exec(text)!;
    return { type: "topSetBackoff", incrementKg: Number(inc), topRpe: Number(m[1]), backoffPercent: Number(m[2]), ...extra };
  }
  const hold = /hold (\d+(?:\.\d+)?)/.exec(text);
  return { type: kind as "linear" | "double", incrementKg: Number(inc), ...(hold ? { holdIfRpeAtLeast: Number(hold[1]) } : {}), ...extra };
}

/** "hold: 40: 5,5,5@9 | 37.5: 5,-,5" as performances, most recent first. "x" is no weight. */
export function parseHistory(text: string): Performance[] {
  if (!text.trim()) return [];
  return text.split("|").map((part) => {
    let s = part.trim();
    let day: Performance["day"] = "normal";
    const d = /^(hold|skip): (.*)$/.exec(s);
    if (d) { day = d[1] as Performance["day"]; s = d[2]!; }
    const [kg, sets] = s.split(":").map((x) => x.trim());
    return {
      day,
      sets: sets!.split(",").map((t) => {
        if (t === "-") return { done: false, ...(kg !== "x" ? { kg: Number(kg) } : {}) };
        const [reps, rpe] = t.split("@");
        return { done: true, reps: Number(reps), ...(rpe ? { rpe: Number(rpe) } : {}), ...(kg !== "x" ? { kg: Number(kg) } : {}) };
      }),
    };
  });
}

const range = (t: string) => { const [a, b] = t.split("-").map(Number); return { min: a!, max: b ?? a! }; };
const show = (n: Next) => `${n.kg === null ? "no weight" : `${n.kg}kg`}${n.backoffKg !== undefined ? `, back-off ${n.backoffKg}kg` : ""} · ${n.why}`;

describe(progressionRules.title, () => {
  for (const row of progressionRules.rows) {
    it(row.case, () => {
      const g = row.given;
      expect(show(nextTarget(parseRule(g.rule), range(g.target), parseHistory(g.history), g.start))).toBe(row.expected);
    });
  }

  it("keeps the reps target it was given", () => {
    expect(nextTarget({ type: "double", incrementKg: 2.5 }, { min: 8, max: 12 }, [], 20).reps).toEqual({ min: 8, max: 12 });
  });

  it("rounds to the nearest half kilo (reductions round down), never below zero", () => {
    expect([roundKg(36.24), roundKg(36.26), roundKg(-3)]).toEqual([36, 36.5, 0]);
    expect([roundKgDown(20.25), roundKgDown(36), roundKgDown(-1)]).toEqual([20, 36, 0]);
  });
});

describe("sets logged without reps", () => {
  it("count as a miss", () => {
    expect(nextTarget({ type: "linear", incrementKg: 2.5 }, { min: 5, max: 5 }, [{ sets: [{ done: true, kg: 40 }] }], 30).why).toBe("repeat");
  });
});
