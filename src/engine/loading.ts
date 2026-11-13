// What weights a gym can actually make, and snapping targets to them.
// A barbell is its bar plus matching plates on each side; dumbbells are fixed pairs, or loadable handles
// with plates on both ends of both dumbbells; a plate exercise is one of the gym's plate sizes; an exercise done
// with weighted kit (kettlebells, sandbags...) is one of that kit's weights. Anything else (machines, cables)
// isn't snapped.
import type { JFDIHouseholdEquipment } from "../formats/generated/equipment.ts";

export type BarType = "standard" | "junior" | "ez" | "ssb" | "trap" | "log" | "swiss";

export interface Kit {
  bars: Array<{ id: string; barType: BarType; kg: number; preferredFor: string[] }>;
  /** Every plate in the gym, by weight: how many there are */
  plates: Array<{ kg: number; count: number }>;
  /** Fixed dumbbell pairs that are there to use */
  dumbbellPairs: number[];
  /** Loadable dumbbell handles: the weight of one handle, when known */
  handleKg: number | null;
  /** Weighted kit that comes in fixed weights, such as kettlebells: each weight and how many there are */
  weights: Array<{ id: string; loads: Array<{ kg: number; count: number }> }>;
}

/** The gym's kit, as the engine needs it. Plates from every plate set are pooled. */
export function kitOf(gym: JFDIHouseholdEquipment): Kit {
  const plates = new Map<number, number>();
  const bars: Kit["bars"] = [];
  const dumbbellPairs = new Set<number>();
  let handleKg: number | null = null;
  const weights: Kit["weights"] = [];
  for (const i of gym.items) {
    if (i.kind === "weights") weights.push({ id: i.id, loads: i.weights!.map((w) => ({ ...w })) });
    if (i.kind === "bar" && i.barType && i.kg !== undefined) bars.push({ id: i.id, barType: i.barType as BarType, kg: i.kg, preferredFor: i.preferredFor ?? [] });
    if (i.kind === "plates") for (const p of i.plates!) plates.set(p.kg, (plates.get(p.kg) ?? 0) + p.count);
    if (i.kind === "dumbbells") {
      const gone = new Set(i.unavailableKg ?? []);
      for (const kg of i.pairsKg ?? []) if (!gone.has(kg)) dumbbellPairs.add(kg);
      if (!i.pairsKg && i.kg !== undefined) handleKg = i.kg;
    }
  }
  return {
    bars,
    plates: [...plates].map(([kg, count]) => ({ kg, count })).sort((a, b) => b.kg - a.kg),
    dumbbellPairs: [...dumbbellPairs].sort((a, b) => a - b),
    handleKg,
    weights,
  };
}

const UNIT = 0.25;
const toUnits = (kg: number) => Math.round(kg / UNIT);

/**
 * Every weight that can go on one side, given how many of each plate are available for that side.
 * Sorted, starting at 0.
 */
function sideLoads(plates: Kit["plates"], perSide: (count: number) => number): number[] {
  let sums = new Set<number>([0]);
  for (const p of plates) {
    const n = perSide(p.count);
    if (!n) continue;
    const next = new Set<number>();
    for (const s of sums) for (let k = 0; k <= n; k++) next.add(s + k * toUnits(p.kg));
    sums = next;
  }
  return [...sums].sort((a, b) => a - b).map((u) => u * UNIT);
}

/** Every total a bar can make with the plates: the bar alone, then matching plates on each side. */
export function barbellLoads(barKg: number, plates: Kit["plates"]): number[] {
  return sideLoads(plates, (c) => Math.floor(c / 2)).map((s) => barKg + 2 * s);
}

/** Every weight one dumbbell can be: fixed pairs, plus loadable handles with matching plates on both ends of both. */
export function dumbbellLoads(kit: Kit): number[] {
  const all = new Set(kit.dumbbellPairs);
  if (kit.handleKg !== null) for (const s of sideLoads(kit.plates, (c) => Math.floor(c / 4))) all.add(kit.handleKg + 2 * s);
  return [...all].sort((a, b) => a - b);
}

export type Direction = "up" | "down" | "nearest";

/** The loadable weight for a target: up for an increase, down for a drop, otherwise the nearest (the lower on a tie). */
export function snapKg(options: number[], kg: number, direction: Direction): number {
  const exact = options.find((o) => Math.abs(o - kg) < 1e-9);
  if (exact !== undefined) return exact;
  const below = options.filter((o) => o < kg).at(-1);
  const above = options.find((o) => o > kg);
  if (below === undefined) return above!;
  if (above === undefined) return below;
  if (direction === "up") return above;
  if (direction === "down") return below;
  return above - kg < kg - below ? above : below;
}

/** The bar an exercise would use in this gym: the one preferred for it, else the first of its type. */
export function barFor(kit: Kit, exercise: string, barType: BarType) {
  const ofType = kit.bars.filter((b) => b.barType === barType);
  return ofType.find((b) => b.preferredFor.includes(exercise)) ?? ofType[0] ?? null;
}

/**
 * The weights an exercise can be done at in this gym, or null when it isn't snapped (not a barbell, dumbbell,
 * plate or weighted kit exercise, or the gym has nothing to make it with). A plate exercise, such as a plate
 * front raise, is held as one plate, so it's one of the plate sizes. Weighted kit, such as kettlebells, is one
 * of its weights; done with two at once (`each`), only weights there are two of.
 */
export function loadsFor(kit: Kit, exercise: { id: string; implement: string; barType?: BarType; barKg?: number; weights?: string; each?: boolean }): number[] | null {
  if (exercise.weights) {
    const need = exercise.each ? 2 : 1;
    const loads = (kit.weights.find((w) => w.id === exercise.weights)?.loads ?? []).filter((l) => l.count >= need).map((l) => l.kg);
    return loads.length ? [...new Set(loads)].sort((a, b) => a - b) : null;
  }
  if (exercise.implement === "barbell" && exercise.barType) {
    const bar = barFor(kit, exercise.id, exercise.barType);
    const barKg = bar?.kg ?? exercise.barKg;
    if (barKg === undefined || !kit.plates.length) return null;
    return barbellLoads(barKg, kit.plates);
  }
  if (exercise.implement === "plate") return kit.plates.length ? kit.plates.map((p) => p.kg).sort((a, b) => a - b) : null;
  if (exercise.implement === "dumbbell") {
    const loads = dumbbellLoads(kit);
    return loads.length ? loads : null;
  }
  return null;
}
