// What weight and reps to aim for next time (docs/programme-format.md, "Progressions").
import type { Range } from "../formats/programme.ts";

export type ProgressionRule =
  | { type: "linear" | "double"; incrementKg: number; holdIfRpeAtLeast?: number; stall?: { misses: number; reducePercent: number } }
  | { type: "topSetBackoff"; incrementKg: number; topRpe: number; backoffPercent: number; stall?: { misses: number; reducePercent: number } }
  | { type: "none" };

export interface SetDone { kg?: number; reps?: number; rpe?: number; done: boolean }

/** One past session of this exercise, most recent first in a history. */
export interface Performance {
  /** The working sets, in order; unticked sets were planned but not done */
  sets: SetDone[];
  /** How readiness treated progression that day */
  day?: "normal" | "hold" | "skip";
}

export interface Next {
  /** Weight for the working sets; null when there's nothing to go on */
  kg: number | null;
  /** Back-off sets' weight, for top set and back-off */
  backoffKg?: number;
  /** Reps to aim for on each set */
  reps: Range;
  /** Why, in words */
  why: "start" | "add" | "repeat" | "build reps" | "hold: hard" | "hold: readiness" | "hold: sets skipped" | "reduce: stalled" | "no change" | "new block";
}

/** Rounds to the nearest 0.5kg, never below 0. */
export const roundKg = (kg: number) => Math.max(0, Math.round(kg * 2) / 2);
/** Rounds down to a half kilo, for reductions, so a drop is never smaller than asked. */
export const roundKgDown = (kg: number) => Math.max(0, Math.floor(kg * 2 + 1e-9) / 2);

export const workingKg = (p: Performance) => {
  const loaded = p.sets.filter((s) => s.done && s.kg !== undefined);
  return loaded.length ? Math.max(...loaded.map((s) => s.kg!)) : null;
};

type Outcome = "success" | "miss" | "incomplete";

/** Did a session hit its target? A set below `need` reps is a miss; a set not done (with none missed) is incomplete. */
function outcome(p: Performance, need: number, sets: SetDone[] = p.sets): Outcome {
  if (sets.some((s) => s.done && (s.reps ?? 0) < need)) return "miss";
  if (sets.some((s) => !s.done) || sets.length === 0) return "incomplete";
  return "success";
}

const hard = (p: Performance, rpe: number | undefined) => rpe !== undefined && p.sets.some((s) => s.done && (s.rpe ?? 0) >= rpe);

/** Sessions in a row, most recent first, missed at the same weight. */
function missesAt(history: Performance[], kg: number, need: number): number {
  let n = 0;
  for (const p of history) {
    if (workingKg(p) !== kg || outcome(p, need) !== "miss") break;
    n++;
  }
  return n;
}

/**
 * The next target for one exercise, from its history (most recent first, skipped days already left out
 * or marked) and where it starts when there's no history.
 */
export function nextTarget(rule: ProgressionRule, target: Range, history: Performance[], startKg: number | null): Next {
  const counted = history.filter((p) => p.day !== "skip" && p.sets.some((s) => s.done));
  const last = counted[0];
  if (!last) return { kg: startKg, reps: target, why: "start" };
  const kg = workingKg(last) ?? startKg;
  if (rule.type === "none") return { kg, reps: target, why: "no change" };
  if (kg === null) return { kg: null, reps: target, why: "repeat" };

  const stalled = () => {
    if (!rule.stall) return null;
    const n = missesAt(counted, kg, rule.type === "double" ? target.min : target.max);
    return n >= rule.stall.misses ? roundKgDown(kg * (1 - rule.stall.reducePercent / 100)) : null;
  };

  if (rule.type === "topSetBackoff") {
    const backoff = (top: number) => roundKg((top * rule.backoffPercent) / 100);
    const top = { ...last, sets: last.sets.slice(0, 1) };
    if (last.day === "hold") return { kg, backoffKg: backoff(kg), reps: target, why: "hold: readiness" };
    const o = outcome(top, target.max);
    if (o === "success" && !hard(top, rule.topRpe + 0.5)) return { kg: kg + rule.incrementKg, backoffKg: backoff(kg + rule.incrementKg), reps: target, why: "add" };
    const reduced = o === "miss" ? stalled() : null;
    if (reduced !== null) return { kg: reduced, backoffKg: backoff(reduced), reps: target, why: "reduce: stalled" };
    return { kg, backoffKg: backoff(kg), reps: target, why: o === "success" ? "hold: hard" : "repeat" };
  }

  if (last.day === "hold") return { kg, reps: target, why: "hold: readiness" };
  const o = outcome(last, target.max);
  if (o === "success") {
    if (hard(last, rule.holdIfRpeAtLeast)) return { kg, reps: target, why: "hold: hard" };
    return { kg: kg + rule.incrementKg, reps: target, why: "add" };
  }
  if (rule.type === "double") {
    const floor = outcome(last, target.min);
    if (floor === "miss") {
      const reduced = stalled();
      if (reduced !== null) return { kg: reduced, reps: target, why: "reduce: stalled" };
      return { kg, reps: target, why: "repeat" };
    }
    if (floor === "incomplete") return { kg, reps: target, why: "hold: sets skipped" };
    return { kg, reps: target, why: "build reps" };
  }
  if (o === "incomplete") return { kg, reps: target, why: "hold: sets skipped" };
  const reduced = stalled();
  if (reduced !== null) return { kg: reduced, reps: target, why: "reduce: stalled" };
  return { kg, reps: target, why: "repeat" };
}
