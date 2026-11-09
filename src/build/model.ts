// Editing a programme in Build mode (docs/programme-editor.md). Pure functions: each takes a programme
// and returns a changed copy, so screens stay simple and every edit can be tested on its own.
import type { JFDIHouseholdEquipment } from "../formats/generated/equipment.ts";
import type { Exercise as LibraryExercise, JFDIExerciseLibrary } from "../formats/generated/library.ts";
import {
  WEEKDAYS, type Day, type Exercise, type GroupItem, type Item, type Plan, type Programme, type Range, type SetDaysWeek, type Slot,
  type Tier, type Weekday, type Workout,
} from "../formats/programme.ts";
import type { Rule as EngineRule } from "../engine/readiness.ts";

export const MAX_WEEKS = 4;
export const DAY_NAMES: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
export const MAX_DAYS = 7;
export const DEFAULT_PROGRESSIONS: Programme["progressions"] = [
  { id: "linear-2-5", type: "linear", incrementKg: 2.5, holdIfRpeAtLeast: 9, stall: { misses: 2, reducePercent: 10 } },
  { id: "double-2-5", type: "double", incrementKg: 2.5, holdIfRpeAtLeast: 9 },
  { id: "accessory", type: "double", incrementKg: 1 },
  { id: "none", type: "none" },
];

/** Where an exercise sits in a workout: item index, then position within the item. */
export interface SlotRef { item: number; slot: number }

const clone = <T>(x: T): T => structuredClone(x);

export function slug(text: string, taken: Iterable<string>, fallback = "item"): string {
  const base = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || fallback;
  const used = new Set(taken);
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}

function emptyWorkout(p: Programme, name: string): Workout {
  return { id: slug(name, p.workouts.map((w) => w.id), "workout"), name, items: [] };
}

/** A new programme: one week, one empty workout, ad hoc unless set days are asked for. */
export function newProgramme(name: string, takenIds: Iterable<string>, now = new Date()): Programme {
  const stamp = now.toISOString();
  const p: Programme = {
    format: "jfdi-programme",
    formatVersion: 2,
    id: slug(name, takenIds, "programme"),
    name: name.trim(),
    createdAt: stamp,
    updatedAt: stamp,
    equipment: [],
    exercises: [],
    progressions: clone(DEFAULT_PROGRESSIONS),
    workouts: [],
    plan: { mode: "adhoc", weeks: [{ workouts: [] }] },
    phases: [{ id: "main", name: "Main", blocks: [{ id: "block-1", name: "Block 1", weeks: null }] }],
    readiness: { preset: "off" },
  } as unknown as Programme;
  return addDay(p, 0);
}

// ----- Plan -----

/** The workout ids in a week, in order: Day 1, Day 2... for ad hoc, Monday to Sunday for set days. */
export function weekWorkouts(plan: Plan, week: number): string[] {
  if (plan.mode === "adhoc") return [...plan.weeks[week]!.workouts];
  const days = plan.weeks[week]!.days;
  return WEEKDAYS.flatMap((d) => { const day = days[d]; return day.type === "workout" ? [day.workout] : []; });
}

const freeWeek = (): SetDaysWeek => ({ days: Object.fromEntries(WEEKDAYS.map((d) => [d, { type: "free" }])) as Record<Weekday, Day> });

/** Switches between ad hoc and set days, keeping every workout. Ad hoc to set days spreads them through the week. */
export function setMode(p: Programme, mode: Plan["mode"]): Programme {
  if (p.plan.mode === mode) return p;
  const q = clone(p);
  // Workouts still called by their default names follow the switch: "Day 2" becomes "Wed", and back.
  const rename = (id: string, to: string, from: RegExp) => {
    const w = q.workouts.find((x) => x.id === id);
    if (w && from.test(w.name)) w.name = to;
  };
  if (mode === "adhoc") {
    q.plan = { mode: "adhoc", weeks: q.plan.weeks.map((_, w) => ({ workouts: weekWorkouts(p.plan, w) })) };
    q.plan.weeks.forEach((w) => w.workouts.forEach((id, d) => rename(id, `Day ${d + 1}`, /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/)));
  } else {
    q.plan = {
      mode: "setDays",
      weeks: q.plan.weeks.map((_, w) => {
        const ids = weekWorkouts(p.plan, w);
        const week = freeWeek();
        const spread = spreadDays(ids.length);
        ids.forEach((id, i) => {
          week.days[spread[i]!] = { type: "workout", workout: id };
          rename(id, DAY_NAMES[spread[i]!], /^Day \d+$/);
        });
        return week;
      }),
    };
  }
  return q;
}

/** Weekdays for n workouts, as evenly spread as a week allows: 1 Mon; 2 Mon, Thu; 3 Mon, Wed, Fri... */
export function spreadDays(n: number): Weekday[] {
  return Array.from({ length: n }, (_, i) => WEEKDAYS[Math.floor((i * 7) / n)]!);
}

/** Changes how many weeks the cycle has. New weeks copy the last week (with their own copies of its workouts). */
export function setWeekCount(p: Programme, count: number): Programme {
  const n = Math.max(1, Math.min(MAX_WEEKS, Math.round(count)));
  let q = clone(p);
  while (q.plan.weeks.length < n) q = copyWeek(q, q.plan.weeks.length - 1, q.plan.weeks.length);
  if (q.plan.weeks.length > n) {
    q.plan.weeks = q.plan.weeks.slice(0, n) as typeof q.plan.weeks;
    q = pruneWorkouts(q);
  }
  return q;
}

/** Copies one week over another (or onto a new week at the end). Every workout is copied, so each can be changed on its own. */
export function copyWeek(p: Programme, from: number, to: number): Programme {
  let q = clone(p);
  const copies = new Map<string, string>();
  for (const id of weekWorkouts(q.plan, from)) {
    if (copies.has(id)) continue;
    const r = duplicateWorkout(q, id, `${to + 1}`);
    q = r.programme;
    copies.set(id, r.id);
  }
  const src = clone(q.plan.weeks[from]!);
  if (q.plan.mode === "adhoc") {
    const w = src as { workouts: string[] };
    w.workouts = w.workouts.map((id) => copies.get(id)!);
  } else {
    const w = src as SetDaysWeek;
    for (const d of WEEKDAYS) { const day = w.days[d]; if (day.type === "workout") day.workout = copies.get(day.workout)!; }
  }
  (q.plan.weeks as unknown[])[to] = src;
  return pruneWorkouts(q);
}

/** A copy of a workout under a new id, not yet placed in the plan. */
export function duplicateWorkout(p: Programme, id: string, suffix = "copy"): { programme: Programme; id: string } {
  const q = clone(p);
  const w = q.workouts.find((x) => x.id === id);
  if (!w) throw new Error(`No workout "${id}"`);
  const copy = clone(w);
  copy.id = slug(`${w.id}-${suffix}`, q.workouts.map((x) => x.id), "workout");
  q.workouts.push(copy);
  return { programme: q, id: copy.id };
}

/** Ad hoc: adds a new empty workout as the next day of the week. */
export function addDay(p: Programme, week: number): Programme {
  if (p.plan.mode !== "adhoc") throw new Error("Days are added by weekday in set days");
  const w = p.plan.weeks[week]!;
  if (w.workouts.length >= MAX_DAYS) return p;
  const q = clone(p);
  const workout = emptyWorkout(q, `Day ${w.workouts.length + 1}`);
  if (q.plan.weeks.length > 1) workout.id = slug(`week-${week + 1}-day-${w.workouts.length + 1}`, q.workouts.map((x) => x.id));
  q.workouts.push(workout);
  (q.plan.weeks[week] as { workouts: string[] }).workouts.push(workout.id);
  return q;
}

/** Ad hoc: removes a day and its workout. */
export function removeDay(p: Programme, week: number, day: number): Programme {
  if (p.plan.mode !== "adhoc") throw new Error("Use setDay in set days");
  const q = clone(p);
  (q.plan.weeks[week] as { workouts: string[] }).workouts.splice(day, 1);
  return pruneWorkouts(q);
}

/** Ad hoc: moves a day earlier or later in the week. */
export function moveDay(p: Programme, week: number, from: number, to: number): Programme {
  if (p.plan.mode !== "adhoc") return p;
  const q = clone(p);
  const list = (q.plan.weeks[week] as { workouts: string[] }).workouts;
  const [id] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(list.length, to)), 0, id!);
  return q;
}

/** Set days: what a weekday is. "workout" makes a new empty workout there unless one is given. */
export function setDay(
  p: Programme, week: number, weekday: Weekday,
  day: { type: "workout"; workout?: string } | { type: "rest" | "free" } | { type: "conditioning"; activity: string },
): Programme {
  if (p.plan.mode !== "setDays") throw new Error("Weekdays only exist in set days");
  let q = clone(p);
  const w = q.plan.weeks[week] as SetDaysWeek;
  if (day.type === "workout") {
    let id = day.workout;
    if (!id) {
      const name = DAY_NAMES[weekday];
      const workout = emptyWorkout(q, q.plan.weeks.length > 1 ? `Week ${week + 1} ${name}` : name);
      workout.name = name;
      q.workouts.push(workout);
      id = workout.id;
    }
    w.days[weekday] = { type: "workout", workout: id };
  } else {
    w.days[weekday] = day.type === "conditioning" ? { type: "conditioning", activity: day.activity } : { type: day.type };
  }
  q = pruneWorkouts(q);
  return q;
}

export function setMinRestDays(p: Programme, days: number | null): Programme {
  if (p.plan.mode !== "adhoc") return p;
  const q = clone(p);
  const plan = q.plan as { minRestDays?: number };
  if (days === null) delete plan.minRestDays;
  else plan.minRestDays = Math.max(0, Math.min(6, Math.round(days)));
  return q;
}

/** Drops workouts no longer in the plan or used by a readiness rule, then exercises no workout uses. */
export function pruneWorkouts(p: Programme): Programme {
  const used = new Set<string>();
  p.plan.weeks.forEach((_, w) => weekWorkouts(p.plan, w).forEach((id) => used.add(id)));
  for (const level of Object.values(p.readiness.levels ?? {})) {
    for (const r of level.rules) if (r.rule === "replaceWorkout") used.add((r as { workout: string }).workout);
  }
  const q = { ...p, workouts: p.workouts.filter((w) => used.has(w.id)) };
  return pruneExercises(q);
}

/** Drops exercises and bars nothing uses any more. Targets for dropped exercises go too. */
export function pruneExercises(p: Programme): Programme {
  const used = new Set(p.workouts.flatMap((w) => w.items.flatMap((i) => i.slots.flatMap((s) => [s.exercise, ...(s.alternatives ?? [])]))));
  for (const ph of p.phases) for (const g of [...(ph.gates?.entry ?? []), ...(ph.gates?.exit ?? [])]) if (g.type === "lift") used.add(g.exercise!);
  const exercises = p.exercises.filter((e) => used.has(e.id));
  const bars = new Set(exercises.map((e) => e.bar).filter(Boolean));
  return {
    ...p,
    exercises,
    equipment: p.equipment.filter((b) => bars.has(b.id)),
    ...(p.targets ? { targets: p.targets.filter((t) => used.has(t.exercise)) } : {}),
  };
}

// ----- Workouts -----

function editWorkout(p: Programme, id: string, change: (w: Workout, q: Programme) => void): Programme {
  const q = clone(p);
  const w = q.workouts.find((x) => x.id === id);
  if (!w) throw new Error(`No workout "${id}"`);
  change(w, q);
  return q;
}

export const renameWorkout = (p: Programme, id: string, name: string) => editWorkout(p, id, (w) => { w.name = name; });

/** Every exercise in a workout, in order, with where it sits. */
export function workoutSlots(w: Workout): Array<SlotRef & { slot_: Slot }> {
  return w.items.flatMap((item, i) => item.slots.map((s, j) => ({ item: i, slot: j, slot_: s })));
}

const BAR_NAMES: Record<string, string> = {
  standard: "Standard barbell", junior: "Junior barbell", ez: "EZ bar", ssb: "Safety squat bar", trap: "Trap bar", log: "Log", swiss: "Swiss bar",
};

/** The programme's copy of a library exercise, adding the bar it needs to the programme if it isn't there. */
function ensureExercise(q: Programme, lib: LibraryExercise, equipment: JFDIHouseholdEquipment): Exercise {
  const have = q.exercises.find((e) => e.id === lib.id);
  if (have) return have;
  const ex: Exercise = { id: lib.id, name: lib.name, family: lib.family, measure: lib.measure, implement: lib.implement, pattern: lib.pattern } as Exercise;
  for (const f of ["loadPer", "perSide", "muscles", "flags", "restSec", "notes"] as const) {
    const v = (lib as unknown as Record<string, unknown>)[f];
    if (v !== undefined) (ex as unknown as Record<string, unknown>)[f] = clone(v);
  }
  const barType = lib.barTypes?.[0];
  if (barType) {
    let bar = q.equipment.find((b) => b.barType === barType);
    if (!bar) {
      const household = equipment.items.find((i) => i.kind === "bar" && i.barType === barType);
      bar = { id: slug(`bar-${barType}`, q.equipment.map((b) => b.id)), name: BAR_NAMES[barType] ?? `${barType} bar`, barType, kg: household?.kg ?? 20 } as Programme["equipment"][number];
      q.equipment.push(bar);
    }
    ex.bar = bar.id;
  }
  q.exercises.push(ex);
  return ex;
}

const MEASURE_FIELD = { load: "reps", reps: "reps", time: "seconds", distance: "metres", calories: "calories" } as const;
const DEFAULT_TARGET: Record<string, Range> = { reps: { min: 8, max: 8 }, seconds: { min: 30, max: 30 }, metres: { min: 20, max: 20 }, calories: { min: 10, max: 10 } };

export const targetField = (ex: Pick<Exercise, "measure">) => MEASURE_FIELD[ex.measure];

/** A new slot for an exercise: 3 sets of 8 (or 30 seconds, 20 metres...), starting at the empty bar for barbell lifts. */
export function newSlot(ex: Exercise, p: Programme): Slot {
  const field = targetField(ex);
  const progression = ex.measure === "load" ? (p.progressions.find((x) => x.type === "linear") ?? p.progressions[0]!) : (p.progressions.find((x) => x.id === "accessory") ?? p.progressions.find((x) => x.type === "none") ?? p.progressions[0]!);
  const slot = { exercise: ex.id, sets: 3, progression: progression.id, [field]: { ...DEFAULT_TARGET[field]! } } as Slot;
  if (ex.bar) slot.start = { kg: "bar" };
  return slot;
}

/** Adds library exercises to the end of a workout, each standing alone. Exercises already in it are skipped. */
export function addExercises(
  p: Programme, workoutId: string, ids: string[], library: JFDIExerciseLibrary, equipment: JFDIHouseholdEquipment,
): Programme {
  return editWorkout(p, workoutId, (w, q) => {
    const present = new Set(w.items.flatMap((i) => i.slots.map((s) => s.exercise)));
    for (const id of ids) {
      if (present.has(id)) continue;
      const lib = library.exercises.find((e) => e.id === id);
      if (!lib) throw new Error(`"${id}" isn't in the library`);
      if (!q.progressions.length) q.progressions = clone(DEFAULT_PROGRESSIONS);
      const ex = ensureExercise(q, lib, equipment);
      w.items.push({ type: "single", tier: "secondary", slots: [newSlot(ex, q)] });
      present.add(id);
    }
  });
}

/** What a group becomes when it changes size: 1 exercise stands alone, 2 is a superset, 3 or more a giant set. */
function reshape(item: Item, slots: Slot[]): Item | null {
  if (slots.length === 0) return null;
  const rounds = item.type === "single" ? (item.slots[0].sets ?? 3) : item.rounds;
  const restSec = item.restSec;
  const rest = restSec !== undefined ? { restSec } : {};
  if (slots.length === 1) {
    const [only] = slots;
    return { type: "single", tier: item.tier, ...rest, slots: [{ ...only!, sets: only!.sets ?? rounds }] };
  }
  const grouped = slots.map(({ sets: _s, ...s }) => s as Slot);
  if (item.type === "finisher") return { ...item, slots: grouped };
  if (slots.length === 2) return { type: "superset", tier: item.tier, rounds, ...rest, slots: grouped as [Slot, Slot] };
  return { type: "giant", tier: item.tier, rounds, ...rest, ...(item.type === "giant" && item.transitionSec !== undefined ? { transitionSec: item.transitionSec } : {}), slots: grouped };
}

/** Removes exercises from a workout. A group left with one exercise goes back to standing alone. */
export function removeExercises(p: Programme, workoutId: string, exerciseIds: string[]): Programme {
  const drop = new Set(exerciseIds);
  const q = editWorkout(p, workoutId, (w) => {
    w.items = w.items.flatMap((item) => {
      const left = item.slots.filter((s) => !drop.has(s.exercise));
      if (left.length === item.slots.length) return [item];
      const r = reshape(item, left);
      return r ? [r] : [];
    });
  });
  return pruneExercises(q);
}

/** Moves an item (a single exercise or a whole group) to a new position in the workout. */
export function moveItem(p: Programme, workoutId: string, from: number, to: number): Programme {
  return editWorkout(p, workoutId, (w) => {
    const [it] = w.items.splice(from, 1);
    w.items.splice(Math.max(0, Math.min(w.items.length, to)), 0, it!);
  });
}

/** Moves an exercise within its group. */
export function moveSlot(p: Programme, workoutId: string, item: number, from: number, to: number): Programme {
  return editWorkout(p, workoutId, (w) => {
    const slots = w.items[item]!.slots;
    const [s] = slots.splice(from, 1);
    slots.splice(Math.max(0, Math.min(slots.length, to)), 0, s!);
  });
}

/**
 * Pair exercises: makes the chosen exercises one group, in workout order, where the first of them was.
 * Chosen exercises leave any group they were in; groups left with one exercise stand alone again.
 * Choosing one exercise (or none) just takes them out of their groups.
 */
export function group(p: Programme, workoutId: string, exerciseIds: string[]): Programme {
  const chosen = new Set(exerciseIds);
  return editWorkout(p, workoutId, (w) => {
    const picked: Array<{ slot: Slot; from: Item }> = [];
    let at = -1;
    const items: Item[] = [];
    for (const item of w.items) {
      const inside = item.slots.filter((s) => chosen.has(s.exercise));
      if (inside.length && at < 0) at = items.length;
      for (const s of inside) picked.push({ slot: s, from: item });
      const left = item.slots.filter((s) => !chosen.has(s.exercise));
      if (left.length === item.slots.length) { items.push(item); continue; }
      const r = reshape(item, left);
      if (r) items.push(r);
    }
    if (!picked.length) return;
    // An existing group keeps its settings when exercises join or leave it.
    const base: Item = picked.find((x) => x.from.type !== "single")?.from ?? picked[0]!.from;
    const tiers: Tier[] = ["primary", "secondary", "tertiary"];
    const tier = tiers.find((t) => picked.some((x) => x.from.tier === t))!;
    const made = reshape({ ...base, tier } as Item, picked.map((x) => x.slot))!;
    if (picked.length === 1) {
      // Taken out of its group: stands alone just after where the group is.
      items.splice(Math.min(items.length, at + 1), 0, made);
    } else {
      items.splice(at, 0, made);
    }
    w.items = items;
  });
}

/** The exercises in the same group as this one, or just this one. Used to start Pair exercises with a group chosen. */
export function groupOf(w: Workout, exerciseId: string): string[] {
  const item = w.items.find((i) => i.slots.some((s) => s.exercise === exerciseId));
  return item ? item.slots.map((s) => s.exercise) : [];
}

export function updateSlot(p: Programme, workoutId: string, ref: SlotRef, change: Partial<Slot>): Programme {
  return editWorkout(p, workoutId, (w) => {
    const slot = w.items[ref.item]!.slots[ref.slot]!;
    Object.assign(slot, change);
    for (const [k, v] of Object.entries(change)) if (v === undefined) delete (slot as unknown as Record<string, unknown>)[k];
  });
}

export function updateItem(p: Programme, workoutId: string, index: number, change: { rounds?: number; restSec?: number | null; tier?: Tier }): Programme {
  return editWorkout(p, workoutId, (w) => {
    const item = w.items[index]!;
    if (change.tier) item.tier = change.tier;
    if (change.rounds !== undefined && item.type !== "single") (item as GroupItem).rounds = change.rounds;
    if (change.restSec === null) delete item.restSec;
    else if (change.restSec !== undefined) (item as { restSec?: number }).restSec = change.restSec;
  });
}

// ----- Reading -----

/** "8", "8-12" or "8 to 12" as a range; null if it isn't one. */
export function parseRange(text: string): Range | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*$/.exec(text);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] !== undefined ? Number(m[2]) : min;
  return min <= max ? { min, max } : null;
}

export const formatRange = (r?: Range) => (!r ? "" : r.min === r.max ? `${r.min}` : `${r.min}-${r.max}`);

/** The starting weight shown for a slot: its own, or the bar for "bar". */
export function startKg(p: Programme, slot: Slot): number | undefined {
  const kg = slot.start?.kg;
  if (kg === "bar") {
    const ex = p.exercises.find((e) => e.id === slot.exercise);
    return p.equipment.find((b) => b.id === ex?.bar)?.kg;
  }
  return kg;
}

/** Where a workout sits in the plan, in words: "Mon", "Week 2 Wed", "Day 1", "Week 2 Day 1". */
export function placesOf(p: Programme, id: string): string[] {
  const many = p.plan.weeks.length > 1;
  const places: string[] = [];
  p.plan.weeks.forEach((_, w) => {
    const prefix = many ? `Week ${w + 1} ` : "";
    if (p.plan.mode === "adhoc") {
      p.plan.weeks[w]!.workouts.forEach((x, d) => { if (x === id) places.push(`${prefix}Day ${d + 1}`); });
    } else {
      const days = (p.plan.weeks[w] as SetDaysWeek).days;
      for (const d of WEEKDAYS) { const day = days[d]; if (day.type === "workout" && day.workout === id) places.push(`${prefix}${DAY_NAMES[d]}`); }
    }
  });
  return places;
}

// ----- The daily check (readiness) -----

type Readiness = Programme["readiness"];
type Level = NonNullable<Readiness["levels"]>["green"];
// The engine's rule type, which narrows on `rule`
type Rule = EngineRule;
export type CheckStyle = Readiness["preset"];

export const TIER_NAMES: Record<Tier, string> = { primary: "Main", secondary: "Supporting", tertiary: "Extra" };

const RED: Level = {
  label: "Red", description: "Not today. No lifting, and the workout moves to next time.", rules: [{ rule: "noLifting" }], progressionOnThisDay: "skip",
};

/** The two starting points. Each can be changed afterwards. */
export const CHECK_TEMPLATES: Record<Exclude<CheckStyle, "off">, Required<Pick<Readiness, "check48h" | "levels">>> = {
  freshness: {
    check48h: false,
    levels: {
      green: { label: "Green", description: "Feeling 90 to 100%. Hit it full on.", rules: [], progressionOnThisDay: "normal" },
      amber: {
        label: "Amber", description: "Feeling 60 to 89%. A bit off but still want to train.",
        rules: [{ rule: "setsTo", tier: "primary", sets: 3 }, { rule: "dropTier", tier: "tertiary" }, { rule: "addRir", reps: 2 }],
        progressionOnThisDay: "normal",
      },
      red: { ...RED, description: "Under 60%. No lifting today. The workout moves to next time." },
    },
  },
  injury: {
    check48h: true,
    levels: {
      green: { label: "Green", description: "No more than usual. Train as written.", rules: [], progressionOnThisDay: "normal" },
      amber: {
        label: "Amber", description: "Niggly or stiff. Take the load off your back and do half.",
        rules: [{ rule: "swapFlagged", flag: "spineLoading" }, { rule: "setsPercent", percent: 50 }, { rule: "dropTier", tier: "tertiary" }],
        progressionOnThisDay: "hold",
      },
      red: { ...RED, description: "Flared up. No lifting today; a walk if it helps. The workout moves to next time." },
    },
  },
};

/** Turns the daily check off, or starts it from one of the two templates. */
export function setCheckStyle(p: Programme, style: CheckStyle): Programme {
  if (style === "off") return { ...p, readiness: { preset: "off" } };
  return { ...p, readiness: { preset: style, ...structuredClone(CHECK_TEMPLATES[style]) } };
}

/** What Amber does, as the choices on screen. */
export interface AmberChoices {
  /** Main exercises down to this many sets */
  mainSets: number | null;
  halveAll: boolean;
  dropExtras: boolean;
  /** More reps left in the tank on every set */
  rir: number | null;
  dropSpine: boolean;
  /** The next workout repeats Amber's weights */
  hold: boolean;
}

export function amberChoices(p: Programme): AmberChoices {
  const amber = p.readiness.levels?.amber;
  const rules = (amber?.rules ?? []) as Rule[];
  const find = <K extends Rule["rule"]>(k: K, when: (r: Extract<Rule, { rule: K }>) => boolean = () => true) =>
    rules.find((r): r is Extract<Rule, { rule: K }> => r.rule === k && when(r as Extract<Rule, { rule: K }>));
  return {
    mainSets: find("setsTo", (r) => r.tier === "primary")?.sets ?? null,
    halveAll: !!find("setsPercent", (r) => !r.tier && r.percent === 50),
    dropExtras: !!find("dropTier", (r) => r.tier === "tertiary"),
    rir: find("addRir")?.reps ?? null,
    dropSpine: rules.some((r) => r.rule === "swapFlagged" && r.flag === "spineLoading"),
    hold: amber?.progressionOnThisDay === "hold",
  };
}

const isChoice = (r: Rule) =>
  (r.rule === "setsTo" && r.tier === "primary") || (r.rule === "setsPercent" && !r.tier && r.percent === 50) ||
  (r.rule === "dropTier" && r.tier === "tertiary") || r.rule === "addRir" || (r.rule === "swapFlagged" && r.flag === "spineLoading");

/** Writes Amber's rules from the choices, in a fixed order. Any other rules in the file are kept after them. */
export function setAmber(p: Programme, c: AmberChoices): Programme {
  const levels = p.readiness.levels;
  if (!levels) return p;
  const rules: Rule[] = [];
  if (c.dropSpine) rules.push({ rule: "swapFlagged", flag: "spineLoading" });
  if (c.halveAll) rules.push({ rule: "setsPercent", percent: 50 });
  if (c.mainSets) rules.push({ rule: "setsTo", tier: "primary", sets: c.mainSets });
  if (c.dropExtras) rules.push({ rule: "dropTier", tier: "tertiary" });
  if (c.rir) rules.push({ rule: "addRir", reps: c.rir });
  rules.push(...(levels.amber.rules as Rule[]).filter((r) => !isChoice(r)));
  const amber = { ...levels.amber, rules: rules as Level["rules"], progressionOnThisDay: c.hold ? "hold" as const : "normal" as const };
  return { ...p, readiness: { ...p.readiness, levels: { ...levels, amber } } };
}

export function setLevelDescription(p: Programme, level: "green" | "amber" | "red", description: string): Programme {
  const levels = p.readiness.levels;
  if (!levels) return p;
  return { ...p, readiness: { ...p.readiness, levels: { ...levels, [level]: { ...levels[level], description } } } };
}

export const setCheck48h = (p: Programme, on: boolean): Programme => ({ ...p, readiness: { ...p.readiness, check48h: on } });
