import { describe, expect, it } from "vitest";
import { applyDeload, applyRules, type Applied, type Rule } from "../../src/engine/readiness.ts";
import { asProgramme, type Workout } from "../../src/formats/programme.ts";
import { BLOCK1 } from "../helpers/block1.ts";
import { readinessRules } from "./readiness.rules.ts";

const p = asProgramme(BLOCK1);
const A = p.workouts[0]!;
const SHORT: Record<string, string> = {
  "back-squat": "squat", "bench-press": "bench", "barbell-row": "row", "romanian-deadlift": "rdl", "db-lateral-raise": "lateral",
  plank: "plank", "battle-ropes": "ropes", deadlift: "deadlift", "overhead-press-ez": "press", "band-pull-up": "pullup",
  "chest-supported-db-row": "cs-row", "goblet-squat": "goblet", "db-curl": "curl", "cable-pushdown": "pushdown", "farmers-carry": "carry",
};

function parse(text: string): Rule[] {
  return text.split(";").map((t) => t.trim()).filter(Boolean).map((t): Rule => {
    const [rule, a, b] = t.split(" ");
    switch (rule) {
      case "setsTo": return { rule, tier: a as never, sets: Number(b) };
      case "setsPercent": return { rule, percent: Number(a), ...(b ? { tier: b as never } : {}) };
      case "dropTier": return { rule, tier: a as never };
      case "dropFlagged": case "swapFlagged": return { rule, flag: a! };
      case "addRir": return { rule, reps: Number(a) };
      case "replaceWorkout": return { rule, workout: a! };
      default: return { rule: "noLifting" };
    }
  });
}

export function show(r: Applied): string {
  if (!r.workout) return "no lifting";
  const parts = r.workout.items.map((i) => `${i.slots.map((s) => SHORT[s.exercise] ?? s.exercise).join("+")} ${i.type === "single" ? i.slots[0].sets : i.rounds}`);
  if (r.addRir) parts.push(`RIR +${r.addRir}`);
  if (r.swapped.length) parts.push(`swapped ${r.swapped.map(([a, b]) => `${SHORT[a]}→${SHORT[b]}`).join(", ")}`);
  return parts.join(" · ");
}

describe(readinessRules.title, () => {
  for (const row of readinessRules.rows) {
    it(row.case, () => {
      const w: Workout = structuredClone(A);
      // For the swap case, the row gets an alternative
      w.items[1]!.slots[1]!.alternatives = ["chest-supported-db-row"];
      expect(show(applyRules(w, parse(row.given.rules), p.workouts, p.exercises))).toBe(row.expected);
    });
  }

  it("ignores a replacement workout that doesn't exist, and never changes the original", () => {
    const before = structuredClone(A);
    expect(show(applyRules(A, [{ rule: "replaceWorkout", workout: "nope" }], p.workouts, p.exercises))).toBe("squat 5 · bench+row 5 · rdl 3 · lateral+plank+ropes 3");
    expect(A).toEqual(before);
  });

  it("a giant set losing one exercise becomes a superset", () => {
    const r = applyRules(A, [{ rule: "dropFlagged", flag: "spineLoading" }], p.workouts, [...p.exercises.map((e) => (e.id === "plank" ? { ...e, flags: ["spineLoading" as never] } : e))]);
    expect(r.workout!.items.map((i) => i.type)).toEqual(["single", "superset"]);
  });

  it("an exercise with no flags list is never flagged", () => {
    const bare = p.exercises.map(({ flags: _f, ...e }) => e);
    expect(show(applyRules(A, [{ rule: "dropFlagged", flag: "spineLoading" }], p.workouts, bare))).toBe("squat 5 · bench+row 5 · rdl 3 · lateral+plank+ropes 3");
  });

  it("a deload week cuts sets to a percentage, at least 1", () => {
    expect(show({ workout: applyDeload(A, 60), addRir: 0, swapped: [] })).toBe("squat 3 · bench+row 3 · rdl 2 · lateral+plank+ropes 2");
  });
});

describe("groups losing exercises", () => {
  const flagged = (ids: string[]) => p.exercises.map((e) => ({ ...e, flags: ids.includes(e.id) ? ["x" as never] : [] }));
  it("a finisher or a giant set of 4 keeps its kind with 3 left", () => {
    const w: Workout = structuredClone(A);
    w.items[3] = { type: "finisher", tier: "tertiary", rounds: 8, workSec: 15, restSec: 45, slots: [...w.items[3]!.slots, { exercise: "db-curl", progression: "none", reps: { min: 10, max: 10 } }] };
    const r = applyRules(w, [{ rule: "dropFlagged", flag: "x" }], p.workouts, flagged(["db-curl"]));
    expect(r.workout!.items[3]).toMatchObject({ type: "finisher", rounds: 8 });
    expect(r.workout!.items[3]!.slots).toHaveLength(3);
  });

  it("a group without its own rest leaves a single without one", () => {
    const w: Workout = structuredClone(A);
    delete w.items[1]!.restSec;
    const r = applyRules(w, [{ rule: "dropFlagged", flag: "x" }], p.workouts, flagged(["barbell-row"]));
    expect(r.workout!.items[1]).not.toHaveProperty("restSec");
    expect(r.workout!.items[1]).toMatchObject({ type: "single", slots: [{ exercise: "bench-press", sets: 5 }] });
  });

  it("a group losing every exercise goes, and exercises missing from the list are never flagged", () => {
    const r = applyRules(A, [{ rule: "dropFlagged", flag: "x" }], p.workouts, flagged(["bench-press", "barbell-row"]).filter((e) => e.id !== "plank"));
    expect(show(r)).toBe("squat 5 · rdl 3 · lateral+plank+ropes 3");
  });
});
