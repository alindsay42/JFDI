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

/** Removes a set that hasn't been done. */
export const removeSet = (db: JfdiDatabase, s: SessionRecord, entry: number, set: number) =>
  change(db, s, (x) => {
    const sets = x.exercises[entry]!.sets;
    if (!sets[set]?.done) sets.splice(set, 1);
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

/** Removes an exercise for the rest of the session. Sets already done stay; the rest go. Progression isn't affected. */
export const removeExercise = (db: JfdiDatabase, s: SessionRecord, entry: number, reason: string | null) =>
  change(db, s, (x) => {
    const e = x.exercises[entry]!;
    if (e.added && !e.sets.some((set) => set.done)) { x.exercises.splice(entry, 1); return; }
    e.removed = { reason };
    e.sets = e.sets.filter((set) => set.done);
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
