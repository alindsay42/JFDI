// Stand-ins for an exercise, for one workout: close variations first (the same family), then anything else
// with the same movement. Only what the gym can do is offered.
import type { JFDIHouseholdEquipment } from "../formats/generated/equipment.ts";
import type { Exercise } from "../formats/generated/library.ts";

export interface SwapOptions {
  /** Close variations: the same family, such as DB bench for bench press */
  family: Exercise[];
  /** Other exercises with the same movement, such as push-ups for bench press */
  movement: Exercise[];
}

/**
 * Whether a gym has what an exercise needs. Kit that no gym has heard of (another household's ids, say)
 * isn't held against it; kit some gym has but this one doesn't is.
 */
export function canDo(ex: Exercise, gym: JFDIHouseholdEquipment, knownKit: Set<string>): boolean {
  const items = gym.items;
  if (ex.weights) return items.some((i) => i.id === ex.weights);
  if (ex.implement === "barbell") {
    const types = new Set(ex.barTypes ?? ["standard"]);
    if (!items.some((i) => i.kind === "bar" && types.has(i.barType as never))) return false;
  }
  if (ex.implement === "dumbbell" && !items.some((i) => i.kind === "dumbbells")) return false;
  if (ex.implement === "plate" && !items.some((i) => i.kind === "plates")) return false;
  const here = new Set(items.map((i) => i.id));
  return ex.requires.every((r) => here.has(r) || !knownKit.has(r));
}

/**
 * What an exercise could be swapped for. `leaveOut` is anything not to offer: exercises already in the
 * workout, and any the person doesn't do.
 */
export function swapOptions(
  exercise: string, exercises: Exercise[], gym: JFDIHouseholdEquipment, knownKit: Set<string>, leaveOut: Set<string>,
): SwapOptions {
  const ex = exercises.find((e) => e.id === exercise);
  if (!ex) return { family: [], movement: [] };
  const offer = exercises.filter((e) => e.id !== exercise && !leaveOut.has(e.id) && canDo(e, gym, knownKit));
  // An added exercise that isn't like any of the app's sits in a family of its own
  const sameFamily = (e: Exercise) => ex.family !== "own" && e.family === ex.family;
  return {
    family: offer.filter(sameFamily),
    movement: offer.filter((e) => !sameFamily(e) && e.pattern === ex.pattern),
  };
}
