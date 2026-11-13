// A workout being done: started from today's prescription, saved on every tick, then finished.
import type { Next } from "../engine/progression.ts";
import type { Today } from "../engine/prescription.ts";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import type { ExerciseEntry, Set as LoggedSet } from "../formats/generated/log.ts";
import type { Item, Programme } from "../formats/programme.ts";
import type { Position } from "../engine/schedule.ts";
import { markChanged, type JfdiDatabase, type SessionRecord } from "./db.ts";
import { library } from "./household.ts";
import { localDate } from "./programmes.ts";

export type { ExerciseEntry, LoggedSet };
type Workout = Extract<Today, { kind: "workout" }>;

const FIELD = { load: "reps", reps: "reps", time: "seconds", distance: "metres", calories: "calories" } as const;
export type SetField = "reps" | "seconds" | "metres" | "calories";

/** What a set measures, from the exercise: reps, seconds, metres or calories. */
export function fieldOf(p: Programme | null, exercise: string): SetField {
  const measure = p?.exercises.find((e) => e.id === exercise)?.measure ?? library.exercises.find((e) => e.id === exercise)?.measure ?? "load";
  return FIELD[measure];
}

/** A planned set, filled in with the target so a set done as planned is one tap. */
function plannedSet(next: Next | undefined, field: SetField): LoggedSet {
  const s: LoggedSet = { done: false };
  if (next?.kg !== null && next?.kg !== undefined) s.kg = next.kg;
  if (next) s[field] = next.reps.min === next.reps.max ? next.reps.max : next.reps.min;
  return s;
}

const setsIn = (item: Item, j: number) => (item.type === "single" ? item.slots[j]!.sets ?? 1 : item.rounds);

/** Starts today's workout. Nothing in it is ticked yet. */
export async function startSession(
  db: JfdiDatabase, profile: JFDIProfile, p: Programme, t: Workout, readiness: SessionRecord["readiness"], now = new Date(),
): Promise<SessionRecord> {
  const date = localDate(now);
  const names = new Map(p.exercises.map((e) => [e.id, e]));
  const exercises: ExerciseEntry[] = [];
  t.workout.items.forEach((item, i) => item.slots.forEach((slot, j) => {
    const ex = names.get(slot.exercise);
    const field = fieldOf(p, slot.exercise);
    const next = t.targets[`${i}.${j}`];
    const entry: ExerciseEntry = {
      exercise: slot.exercise,
      name: ex?.name ?? slot.exercise,
      slot: `${i}.${j}`,
      sets: Array.from({ length: setsIn(item, j) }, () => plannedSet(next, field)),
    };
    if (ex?.loadPer) entry.loadPer = ex.loadPer;
    exercises.push(entry);
  }));
  const taken = new Set((await db.sessions.where("profile").equals(profile.id).primaryKeys()).map((k) => (k as [string, string])[1]));
  let id = `${date}-${t.workout.id}`.slice(0, 64);
  for (let n = 2; taken.has(id); n++) id = `${date}-${t.workout.id}-${n}`.slice(0, 64);
  const session: SessionRecord = {
    profile: profile.id,
    id,
    date,
    startedAt: now.toISOString(),
    finishedAt: null,
    status: "active",
    programme: {
      id: p.id, updatedAt: p.updatedAt, phase: p.phases[0]!.id, block: p.phases[0]!.blocks[0]!.id, week: t.position.week + 1,
    },
    session: { id: t.workout.id, name: t.workout.name, ...(t.workout.subtitle ? { subtitle: t.workout.subtitle } : {}) },
    readiness,
    deload: t.deload,
    prescribed: t.workout as never,
    exercises,
    endedEarly: null,
    check48h: null,
  } as SessionRecord;
  await db.transaction("rw", db.sessions, db.settings, async () => {
    await db.sessions.add(session);
    await db.settings.delete(`skip:${profile.id}`);
    await markChanged(db, now);
  });
  return session;
}

export async function activeSession(db: JfdiDatabase, profileId: string): Promise<SessionRecord | undefined> {
  return db.sessions.where("profile").equals(profileId).filter((s) => s.status === "active").first();
}

async function change(db: JfdiDatabase, s: SessionRecord, edit: (s: SessionRecord) => void): Promise<SessionRecord> {
  const next = structuredClone(s);
  edit(next);
  await db.transaction("rw", db.sessions, db.settings, async () => {
    await db.sessions.put(next);
    await markChanged(db);
  });
  return next;
}

/** Changes one set: weight, reps, RPE, or ticking it done. */
export const updateSet = (db: JfdiDatabase, s: SessionRecord, entry: number, set: number, values: Partial<LoggedSet>) =>
  change(db, s, (x) => {
    const target = x.exercises[entry]!.sets[set]!;
    Object.assign(target, values);
    for (const [k, v] of Object.entries(values)) if (v === undefined) delete (target as unknown as Record<string, unknown>)[k];
  });

/** Another set like the last one, not ticked. */
export const addSet = (db: JfdiDatabase, s: SessionRecord, entry: number) =>
  change(db, s, (x) => {
    const sets = x.exercises[entry]!.sets;
    const last = sets.at(-1);
    const { done: _d, rpe: _r, ...copy } = last ?? { done: false };
    sets.push({ ...copy, done: false });
  });

/**
 * Removes a set that hasn't been done. Removing an exercise's last set removes the exercise instead
 * (keeping that set for Undo), so it never sits there with nothing to do.
 */
export const removeSet = (db: JfdiDatabase, s: SessionRecord, entry: number, set: number) =>
  change(db, s, (x) => {
    const e = x.exercises[entry]!;
    if (e.sets[set]?.done) return;
    if (e.sets.length === 1) {
      if (e.added) { x.exercises.splice(entry, 1); return; }
      e.removed = { reason: null };
      return;
    }
    e.sets.splice(set, 1);
  });

/** Another round of a superset or giant set: one more set for each exercise in it. */
export const addRound = (db: JfdiDatabase, s: SessionRecord, entries: number[]) =>
  change(db, s, (x) => {
    for (const k of entries) {
      const e = x.exercises[k]!;
      if (e.removed) continue;
      const { done: _d, rpe: _r, ...copy } = e.sets.at(-1) ?? { done: false };
      e.sets.push({ ...copy, done: false });
    }
  });

/** Adds an exercise from the library at the end. It has no place in the prescription. */
export const addExercise = (db: JfdiDatabase, s: SessionRecord, exerciseId: string) =>
  change(db, s, (x) => {
    const lib = library.exercises.find((e) => e.id === exerciseId);
    if (!lib) throw new Error(`"${exerciseId}" isn't in the library`);
    x.exercises.push({
      exercise: lib.id, name: lib.name, slot: null, added: true,
      ...(lib.loadPer ? { loadPer: lib.loadPer } : {}),
      sets: Array.from({ length: 3 }, () => ({ done: false } as LoggedSet)),
    });
  });

const SWAPPED = "Swapped for ";

/** The entry a stand-in replaced, if it is one: same place in the workout, set aside when it was swapped. */
function replacedBy(exercises: ExerciseEntry[], k: number): number {
  const e = exercises[k]!;
  if (!e.swappedFrom) return -1;
  return exercises.findIndex((o) => o.exercise === e.swappedFrom && o.slot === e.slot && o.removed?.reason?.startsWith(SWAPPED));
}

/** Whether an entry was swapped out for a stand-in: it's kept in the log, but not shown. */
export function swappedOut(exercises: ExerciseEntry[], k: number): boolean {
  return exercises.some((_, j) => replacedBy(exercises, j) === k);
}

/** The name of the exercise a stand-in replaced. */
export function insteadOf(exercises: ExerciseEntry[], k: number): string | null {
  const e = exercises[k]!;
  if (!e.swappedFrom) return null;
  const was = replacedBy(exercises, k);
  return was >= 0 ? exercises[was]!.name : library.exercises.find((x) => x.id === e.swappedFrom)?.name ?? e.swappedFrom;
}

/**
 * Swaps an exercise for a stand-in, for this workout only. The planned one is set aside, its progression
 * untouched, and the stand-in takes its place with the same number of sets and, if it counts the same
 * thing, the same reps; its weight is left for you, since it's a different lift. Swapping a stand-in for
 * the planned exercise brings that back as it was. Only for planned exercises, before any of their sets are done.
 */
export const swapExercise = (db: JfdiDatabase, s: SessionRecord, entry: number, exerciseId: string) =>
  change(db, s, (x) => {
    const e = x.exercises[entry]!;
    if (e.sets.some((set) => set.done)) throw new Error("Some sets are already done");
    const was = replacedBy(x.exercises, entry);
    if (was >= 0 && x.exercises[was]!.exercise === exerciseId) {
      delete x.exercises[was]!.removed;
      x.exercises.splice(entry, 1);
      return;
    }
    const lib = library.exercises.find((l) => l.id === exerciseId);
    if (!lib) throw new Error(`"${exerciseId}" isn't in the library`);
    const from = fieldOf(null, e.exercise);
    const to = FIELD[lib.measure];
    const standIn: ExerciseEntry = {
      exercise: lib.id, name: lib.name, slot: e.slot ?? null, swappedFrom: e.swappedFrom ?? e.exercise,
      ...(lib.loadPer ? { loadPer: lib.loadPer } : {}),
      sets: e.sets.map((set) => ({ done: false, ...(from === to && set[from] !== undefined ? { [to]: set[from] } : {}) } as LoggedSet)),
    };
    if (e.added) throw new Error("An added exercise can be removed instead");
    if (e.swappedFrom) { x.exercises[entry] = standIn; return; }
    e.removed = { reason: `${SWAPPED}${lib.name}` };
    x.exercises.splice(entry + 1, 0, standIn);
  });

/**
 * Removes an exercise for the rest of the session. Progression isn't affected. Its sets not done are kept
 * until the session finishes, so Undo brings them back; finishing drops them.
 */
export const removeExercise = (db: JfdiDatabase, s: SessionRecord, entry: number, reason: string | null) =>
  change(db, s, (x) => {
    const e = x.exercises[entry]!;
    if (e.added && !e.sets.some((set) => set.done)) { x.exercises.splice(entry, 1); return; }
    e.removed = { reason };
  });

/** Brings back an exercise removed by mistake, with its planned sets. */
export const restoreExercise = (db: JfdiDatabase, s: SessionRecord, entry: number) =>
  change(db, s, (x) => {
    const e = x.exercises[entry]!;
    delete e.removed;
  });

export const setNotes = (db: JfdiDatabase, s: SessionRecord, notes: string) =>
  change(db, s, (x) => { if (notes.trim()) x.notes = notes; else delete x.notes; });

/** Finishes the session, or ends it early with a reason. Sets never ticked are kept as planned but not done. */
export const finishSession = (db: JfdiDatabase, s: SessionRecord, endedEarly: string | null = null, now = new Date()) =>
  change(db, s, (x) => {
    x.status = "done";
    x.finishedAt = now.toISOString();
    for (const e of x.exercises) if (e.removed) e.sets = e.sets.filter((set) => set.done);
    x.endedEarly = endedEarly;
  });

export async function discardSession(db: JfdiDatabase, s: SessionRecord): Promise<void> {
  await db.sessions.delete([s.profile, s.id]);
}

/** How long to rest after a set: the slot's, the item's, the exercise's, or 90 seconds. */
export function restAfter(p: Programme | null, prescribed: SessionRecord["prescribed"], slotPath: string | null | undefined, exercise: string): number {
  const ex = p?.exercises.find((e) => e.id === exercise) ?? library.exercises.find((e) => e.id === exercise);
  if (!slotPath || !prescribed) return ex?.restSec ?? 90;
  const [i, j] = slotPath.split(".").map(Number);
  const item = (prescribed as unknown as { items: Item[] }).items[i!];
  return item?.slots[j!]?.restSec ?? item?.restSec ?? ex?.restSec ?? 90;
}

// ----- Skipping (ad hoc) -----

export interface Skip { programme: string; position: Position; date: string }

/** Ad hoc: skip the next workout. The one after it becomes next. */
export async function skipWorkout(db: JfdiDatabase, profileId: string, programme: string, position: Position, now = new Date()): Promise<void> {
  await db.settings.put({ key: `skip:${profileId}`, value: { programme, position, date: localDate(now) } satisfies Skip });
}

/** The skip in force: for this programme, and not overtaken by a workout done since. */
export function skipInForce(skip: Skip | undefined, programme: string, lastDone: string | null): Position | null {
  if (!skip || skip.programme !== programme) return null;
  if (lastDone && lastDone > skip.date) return null;
  return skip.position;
}

export async function getSkip(db: JfdiDatabase, profileId: string): Promise<Skip | undefined> {
  return (await db.settings.get(`skip:${profileId}`))?.value as Skip | undefined;
}

/** A deload week the person started from Today: 7 days from the day it was started. */
export interface DeloadWeek { programme: string; from: string; until: string }

export async function startDeloadWeek(db: JfdiDatabase, profileId: string, programme: string, now = new Date()): Promise<void> {
  const from = localDate(now);
  const end = new Date(`${from}T12:00:00`);
  end.setDate(end.getDate() + 6);
  await db.settings.put({ key: `deload:${profileId}`, value: { programme, from, until: localDate(end) } satisfies DeloadWeek });
}

export async function endDeloadWeek(db: JfdiDatabase, profileId: string): Promise<void> {
  await db.settings.delete(`deload:${profileId}`);
}

export async function getDeloadWeek(db: JfdiDatabase, profileId: string): Promise<DeloadWeek | undefined> {
  return (await db.settings.get(`deload:${profileId}`))?.value as DeloadWeek | undefined;
}

/** Whether a started deload week covers this date, for this programme. */
export const deloadInForce = (w: DeloadWeek | undefined, programme: string, date: string): boolean =>
  !!w && w.programme === programme && date >= w.from && date <= w.until;

/** "Use next week's numbers" at the start of a new block: how many weeks on from the restart week, for that block. */
export interface RestartSkip { programme: string; block: number; skip: number }

export async function setRestartSkip(db: JfdiDatabase, profileId: string, value: RestartSkip): Promise<void> {
  await db.settings.put({ key: `restart:${profileId}`, value });
}

export async function getRestartSkip(db: JfdiDatabase, profileId: string): Promise<RestartSkip | undefined> {
  return (await db.settings.get(`restart:${profileId}`))?.value as RestartSkip | undefined;
}

/** The skip for this programme's current block; one saved for an earlier block no longer applies. */
export const restartSkipFor = (v: RestartSkip | undefined, programme: string, block: number): number =>
  v && v.programme === programme && v.block === block ? v.skip : 0;
