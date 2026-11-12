// The household's own exercises: anything the library doesn't have, such as an ab wheel rollout, with the
// kit it needs. They're chosen like any other exercise. Once one has been used (in a programme or a
// workout) what it counts and what it's done with are fixed, since history depends on them, and it can't
// be removed; its name, movement, kit and notes can still change.
import type { Exercise } from "../formats/generated/library.ts";
import type { JFDIProgrammeFile } from "../formats/generated/programme.ts";
import { validateOwnExercises } from "../formats/validate.js";
import { markChanged, type JfdiDatabase } from "./db.ts";
import { bundledLibrary, setOwnExercises } from "./household.ts";

export type OwnExercise = Exercise;
export type Measure = Exercise["measure"];
export type Implement = Exercise["implement"];
export type Pattern = Exercise["pattern"];
export type BarType = NonNullable<Exercise["barTypes"]>[number];

export interface ExerciseInput {
  name: string;
  pattern: Pattern;
  measure: Measure;
  implement: Implement;
  /** Barbell exercises: which bar */
  barType?: BarType;
  /** Dumbbells, kettlebells or plates: two at once, so the weight is for each */
  each?: boolean;
  /** Kit it needs, by id from the gyms */
  requires: string[];
  notes?: string;
}

const KEY = "exercises";

export async function getOwnExercises(db: JfdiDatabase): Promise<OwnExercise[]> {
  return ((await db.settings.get(KEY))?.value as OwnExercise[] | undefined) ?? [];
}

/** Brings this device's own exercises into the library. Run when the app opens. */
export async function loadOwnExercises(db: JfdiDatabase): Promise<OwnExercise[]> {
  const own = await getOwnExercises(db);
  setOwnExercises(own);
  return own;
}

async function write(db: JfdiDatabase, own: OwnExercise[]) {
  const problems = validateOwnExercises(own, bundledLibrary);
  if (problems.length) throw new Error(problems[0]!.replace(/^exercise "[^"]+": /, ""));
  await db.settings.put({ key: KEY, value: own });
  await markChanged(db);
}

/** Runs a change, then brings the library up to date with what was saved. */
async function changing<T>(db: JfdiDatabase, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } finally {
    await loadOwnExercises(db);
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "exercise";

/** What an exercise is, from what was filled in. */
export function exerciseOf(id: string, input: ExerciseInput): OwnExercise {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Give the exercise a name");
  const ex: OwnExercise = {
    id, name, family: "own", measure: input.measure, implement: input.implement, pattern: input.pattern,
    requires: [...new Set(input.requires)],
  };
  if (input.implement === "barbell") ex.barTypes = [input.barType ?? "standard"];
  if (input.each && input.measure !== "reps" && ["dumbbell", "kettlebell", "plate"].includes(input.implement)) ex.loadPer = "each";
  if (input.notes?.trim()) ex.notes = input.notes.trim();
  return ex;
}

/** The form's values for an exercise. */
export function inputOf(ex: OwnExercise): ExerciseInput {
  return {
    name: ex.name, pattern: ex.pattern, measure: ex.measure, implement: ex.implement, requires: [...ex.requires],
    ...(ex.barTypes ? { barType: ex.barTypes[0] } : {}), ...(ex.loadPer === "each" ? { each: true } : {}), ...(ex.notes ? { notes: ex.notes } : {}),
  };
}

/** Adds an exercise. Returns it, with its id. */
export async function addOwnExercise(db: JfdiDatabase, input: ExerciseInput): Promise<OwnExercise> {
  return changing(db, () => db.transaction("rw", db.settings, async () => {
    const own = await getOwnExercises(db);
    const base = `own-${slug(input.name)}`;
    let id = base;
    for (let n = 2; own.some((e) => e.id === id); n++) id = `${base}-${n}`;
    const ex = exerciseOf(id, input);
    if (own.some((e) => e.name.toLowerCase() === ex.name.toLowerCase())) throw new Error(`There's already an exercise called "${ex.name}"`);
    await write(db, [...own, ex]);
    return ex;
  }));
}

export interface Uses {
  /** Names of programmes (saved or being built) that have it */
  programmes: string[];
  /** Whether anyone has done it in a workout, or set a goal for it */
  history: boolean;
}

/** Where an exercise has been used. */
export async function usesOf(db: JfdiDatabase, id: string): Promise<Uses> {
  const has = (p: Pick<JFDIProgrammeFile, "exercises">) => p.exercises.some((e) => e.id === id);
  const saved = (await db.programmes.toArray()).filter(has).map((p) => p.name);
  const drafts = (await db.settings.where("key").startsWith("draft:").toArray())
    .map((r) => (r.value as { programme: JFDIProgrammeFile }).programme).filter(has).map((p) => p.name);
  const done = await db.sessions.filter((s) => s.exercises.some((e) => e.exercise === id || e.swappedFrom === id)).count();
  const goals = await db.profiles.filter((p) => (p.targets ?? []).some((t) => t.exercise === id)).count();
  return { programmes: [...new Set([...saved, ...drafts])].sort(), history: done + goals > 0 };
}

export const isUsed = (u: Uses) => u.programmes.length > 0 || u.history;

/**
 * Changes an exercise. Once it's been used, what it counts, what it's done with and its bar stay as they
 * were. Programmes that have it take the new name, movement and notes.
 */
export async function updateOwnExercise(db: JfdiDatabase, id: string, input: ExerciseInput): Promise<OwnExercise> {
  return changing(db, () => db.transaction("rw", [db.settings, db.programmes, db.sessions, db.profiles], async () => {
    const own = await getOwnExercises(db);
    const before = own.find((e) => e.id === id);
    if (!before) throw new Error("That exercise isn't here any more");
    let next = exerciseOf(id, input);
    if (isUsed(await usesOf(db, id))) {
      const fixed = inputOf(before);
      next = exerciseOf(id, { ...input, measure: fixed.measure, implement: fixed.implement, barType: fixed.barType, each: fixed.each });
    }
    if (own.some((e) => e.id !== id && e.name.toLowerCase() === next.name.toLowerCase())) throw new Error(`There's already an exercise called "${next.name}"`);
    await write(db, own.map((e) => (e.id === id ? next : e)));

    // Programmes keep their own copy of each exercise; bring the descriptive parts up to date
    const refresh = (p: JFDIProgrammeFile) => {
      const copy = p.exercises.find((e) => e.id === id);
      if (!copy) return false;
      copy.name = next.name;
      copy.pattern = next.pattern;
      if (next.notes) copy.notes = next.notes;
      else delete copy.notes;
      return true;
    };
    for (const p of await db.programmes.toArray()) if (refresh(p)) await db.programmes.put(p);
    for (const r of await db.settings.where("key").startsWith("draft:").toArray()) {
      if (refresh((r.value as { programme: JFDIProgrammeFile }).programme)) await db.settings.put(r);
    }
    return next;
  }));
}

/** Removes an exercise nobody has used. */
export async function removeOwnExercise(db: JfdiDatabase, id: string): Promise<void> {
  await changing(db, () => db.transaction("rw", [db.settings, db.programmes, db.sessions, db.profiles], async () => {
    const uses = await usesOf(db, id);
    if (uses.programmes.length) throw new Error(`It's in ${new Intl.ListFormat("en-GB").format(uses.programmes)}. Take it out of ${uses.programmes.length === 1 ? "that programme" : "those programmes"} first.`);
    if (uses.history) throw new Error("It's in someone's history, so it stays.");
    await write(db, (await getOwnExercises(db)).filter((e) => e.id !== id));
  }));
}
