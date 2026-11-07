// Applying the day's readiness rules, and a deload week, to a workout (docs/programme-format.md, "Readiness").
import type { Exercise, Item, Slot, Tier, Workout } from "../formats/programme.ts";

export type Rule =
  | { rule: "setsPercent"; tier?: Tier; percent: number }
  | { rule: "setsTo"; tier: Tier; sets: number }
  | { rule: "dropTier"; tier: Tier }
  | { rule: "dropFlagged" | "swapFlagged"; flag: string }
  | { rule: "addRir"; reps: number }
  | { rule: "replaceWorkout"; workout: string }
  | { rule: "noLifting" };

export interface Applied {
  /** The workout to do, or null for no lifting today */
  workout: Workout | null;
  /** Extra reps in reserve asked for on every set */
  addRir: number;
  /** Exercises swapped, as [from, to] */
  swapped: Array<[string, string]>;
}

const sets = (item: Item) => (item.type === "single" ? item.slots[0].sets! : item.rounds);
function withSets(item: Item, n: number): Item {
  if (item.type === "single") return { ...item, slots: [{ ...item.slots[0], sets: n }] };
  return { ...item, rounds: n };
}

/** What an item becomes with some slots gone: none left drops it; one left of a group stands alone at the group's rounds. */
function keep(item: Item, slots: Slot[]): Item | null {
  // A single item has one slot, so it's either kept whole or gone
  if (slots.length === item.slots.length || item.type === "single") return slots.length ? ({ ...item, slots } as Item) : null;
  if (!slots.length) return null;
  const rest = item.restSec !== undefined ? { restSec: item.restSec } : {};
  if (slots.length === 1) return { type: "single", tier: item.tier, ...rest, slots: [{ ...slots[0]!, sets: item.rounds }] };
  if (slots.length === 2 && item.type === "giant") return { type: "superset", tier: item.tier, rounds: item.rounds, ...rest, slots: [slots[0]!, slots[1]!] };
  return { ...item, slots } as Item;
}

/**
 * Applies rules in order. `workouts` is every workout in the programme (for replaceWorkout);
 * `exercises` gives each exercise's flags.
 */
export function applyRules(workout: Workout, rules: Rule[], workouts: Workout[], exercises: Exercise[]): Applied {
  const flags = new Map(exercises.map((e) => [e.id, new Set<string>(e.flags ?? [])]));
  let w: Workout | null = structuredClone(workout);
  let addRir = 0;
  const swapped: Array<[string, string]> = [];
  const inTier = (item: Item, tier?: Tier) => !tier || item.tier === tier;

  for (const r of rules) {
    if (!w) break;
    switch (r.rule) {
      case "noLifting":
        w = null;
        break;
      case "replaceWorkout": {
        const other = workouts.find((x) => x.id === r.workout);
        if (other) w = structuredClone(other);
        break;
      }
      case "addRir":
        addRir += r.reps;
        break;
      case "setsPercent":
        w.items = w.items.map((i) => (inTier(i, r.tier) ? withSets(i, Math.max(1, Math.ceil((sets(i) * r.percent) / 100))) : i));
        break;
      case "setsTo":
        w.items = w.items.map((i) => (inTier(i, r.tier) ? withSets(i, r.sets) : i));
        break;
      case "dropTier":
        w.items = w.items.filter((i) => i.tier !== r.tier);
        break;
      case "dropFlagged":
      case "swapFlagged": {
        const flagged = (id: string) => flags.get(id)?.has(r.flag) ?? false;
        w.items = w.items.flatMap((item) => {
          const slots = item.slots.flatMap((s) => {
            if (!flagged(s.exercise)) return [s];
            if (r.rule === "dropFlagged") return [];
            const alt = (s.alternatives ?? []).find((a) => !flagged(a));
            if (!alt) return [];
            swapped.push([s.exercise, alt]);
            return [{ ...s, exercise: alt }];
          });
          const k = keep(item, slots);
          return k ? [k] : [];
        });
        break;
      }
    }
  }
  if (w && w.items.length === 0) w = null;
  return { workout: w, addRir, swapped };
}

/** A deload week: fewer sets (rounding up, at least 1). Load is reduced where weights are worked out. */
export function applyDeload(workout: Workout, setsPercent: number): Workout {
  return { ...workout, items: workout.items.map((i) => withSets(i, Math.max(1, Math.ceil((sets(i) * setsPercent) / 100)))) };
}
