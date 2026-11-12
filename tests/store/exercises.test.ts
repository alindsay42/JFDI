import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addExercises } from "../../src/build/model.ts";
import type { JFDIProgrammeFile } from "../../src/formats/generated/programme.ts";
import { asProgramme } from "../../src/formats/programme.ts";
import { validateBackup, validateOwnExercises } from "../../src/formats/validate.js";
import { buildBackup, parseBackup, restoreBackup } from "../../src/store/backup.ts";
import { putDraft, saveProgramme } from "../../src/store/build.ts";
import { JfdiDatabase } from "../../src/store/db.ts";
import {
  addOwnExercise, exerciseOf, getOwnExercises, inputOf, loadOwnExercises, removeOwnExercise, updateOwnExercise, usesOf,
  type ExerciseInput,
} from "../../src/store/exercises.ts";
import { bundledLibrary, equipment, library, setOwnExercises } from "../../src/store/household.ts";
import { addProfile } from "../../src/store/profiles.ts";
import { setGoal } from "../../src/store/progress.ts";

let db: JfdiDatabase;
beforeEach(async () => {
  db = new JfdiDatabase(`exercises-${Math.random()}`);
  await db.open();
  setOwnExercises([]);
});
afterEach(async () => { await db.delete(); setOwnExercises([]); });

const BLOCK1 = JSON.parse(readFileSync("examples/programmes/strength-block-1.json", "utf8")) as JFDIProgrammeFile;
const ROLLOUT: ExerciseInput = { name: " Ab  wheel rollout ", pattern: "core", measure: "reps", implement: "other", requires: ["ab-wheel", "ab-wheel"] };

describe("your own exercises", () => {
  it("are added with an own- id, the kit they need, and join the library", async () => {
    const ex = await addOwnExercise(db, ROLLOUT);
    expect(ex).toEqual({ id: "own-ab-wheel-rollout", name: "Ab wheel rollout", family: "own", measure: "reps", implement: "other", pattern: "core", requires: ["ab-wheel"] });
    expect(library.exercises.at(-1)).toEqual(ex);
    expect(library.exercises).toHaveLength(bundledLibrary.exercises.length + 1);
    // Another with the same id base gets its own id; names must differ from every exercise there is
    const again = await addOwnExercise(db, { ...ROLLOUT, name: "Ab wheel rollout!" });
    expect(again.id).toBe("own-ab-wheel-rollout-2");
    await expect(addOwnExercise(db, { ...ROLLOUT, name: "ab WHEEL rollout" })).rejects.toThrow(`There's already an exercise called "ab WHEEL rollout"`);
    await expect(addOwnExercise(db, { ...ROLLOUT, name: "Back squat" })).rejects.toThrow(`there's already an exercise called "Back squat"`);
    await expect(addOwnExercise(db, { ...ROLLOUT, name: "  " })).rejects.toThrow("Give the exercise a name");
    expect((await getOwnExercises(db)).map((e) => e.id)).toEqual(["own-ab-wheel-rollout", "own-ab-wheel-rollout-2"]);

    // Opening the app on another load brings them in
    setOwnExercises([]);
    await loadOwnExercises(db);
    expect(library.exercises).toHaveLength(bundledLibrary.exercises.length + 2);
  });

  it("take a bar, or a weight for each of two, only when it makes sense", () => {
    const base = { name: "X", pattern: "push" as const, requires: [] as string[] };
    expect(exerciseOf("own-x", { ...base, measure: "load", implement: "barbell" }).barTypes).toEqual(["standard"]);
    expect(exerciseOf("own-x", { ...base, measure: "load", implement: "barbell", barType: "ssb", each: true })).toMatchObject({ barTypes: ["ssb"] });
    expect(exerciseOf("own-x", { ...base, measure: "load", implement: "barbell", each: true }).loadPer).toBeUndefined();
    expect(exerciseOf("own-x", { ...base, measure: "load", implement: "kettlebell", each: true }).loadPer).toBe("each");
    expect(exerciseOf("own-x", { ...base, measure: "load", implement: "plate", each: true }).loadPer).toBe("each");
    expect(exerciseOf("own-x", { ...base, measure: "reps", implement: "dumbbell", each: true }).loadPer).toBeUndefined();
    expect(exerciseOf("own-x", { ...base, measure: "time", implement: "dumbbell", barType: "ez" }).barTypes).toBeUndefined();
    const full = exerciseOf("own-x", { ...base, measure: "distance", implement: "dumbbell", each: true, notes: "  Tall  " });
    expect(inputOf(full)).toEqual({ ...base, measure: "distance", implement: "dumbbell", each: true, notes: "Tall", requires: [] });
    expect(inputOf(exerciseOf("own-x", { ...base, measure: "load", implement: "barbell", barType: "trap" })).barType).toBe("trap");
  });

  it("can change freely until used; then what it counts and what it's done with stay, and programmes take the new name", async () => {
    const ex = await addOwnExercise(db, ROLLOUT);
    const changed = await updateOwnExercise(db, ex.id, { ...ROLLOUT, measure: "time", implement: "bodyweight" });
    expect(changed).toMatchObject({ measure: "time", implement: "bodyweight" });
    expect(await usesOf(db, ex.id)).toEqual({ programmes: [], history: false });

    // In a programme, and another still being built
    const p = addExercises(structuredClone(asProgramme(BLOCK1)), "session-a", [ex.id], library, equipment);
    await saveProgramme(db, p);
    const draft = { ...structuredClone(p), id: "draft-one", name: "Draft one" };
    await putDraft(db, { programme: draft, basedOn: null });
    expect(await usesOf(db, ex.id)).toEqual({ programmes: ["Draft one", "Strength Programme, Block 1"], history: false });

    const renamed = await updateOwnExercise(db, ex.id, { ...ROLLOUT, name: "Rollout", pattern: "isolation", measure: "load", implement: "barbell", notes: "Knees" });
    expect(renamed).toMatchObject({ name: "Rollout", pattern: "isolation", measure: "time", implement: "bodyweight", notes: "Knees" });
    expect(renamed.barTypes).toBeUndefined();
    const copy = (await db.programmes.get(p.id))!.exercises.find((e) => e.id === ex.id);
    expect(copy).toMatchObject({ name: "Rollout", pattern: "isolation", notes: "Knees" });
    const draftCopy = ((await db.settings.get("draft:draft-one"))!.value as { programme: JFDIProgrammeFile }).programme.exercises.find((e) => e.id === ex.id);
    expect(draftCopy).toMatchObject({ name: "Rollout" });
    await updateOwnExercise(db, ex.id, { ...ROLLOUT, name: "Rollout" });
    expect((await db.programmes.get(p.id))!.exercises.find((e) => e.id === ex.id)!.notes).toBeUndefined();

    await expect(removeOwnExercise(db, ex.id)).rejects.toThrow("It's in Draft one and Strength Programme, Block 1. Take it out of those programmes first.");
    await db.settings.delete("draft:draft-one");
    await expect(removeOwnExercise(db, ex.id)).rejects.toThrow("Take it out of that programme first.");
    await expect(updateOwnExercise(db, "own-nope", ROLLOUT)).rejects.toThrow("isn't here any more");
    const other = await addOwnExercise(db, { ...ROLLOUT, name: "Other" });
    await expect(updateOwnExercise(db, other.id, { ...ROLLOUT, name: "rollout" })).rejects.toThrow("already an exercise called");
  });

  it("stays once it's in someone's history or goals, and goes when it isn't", async () => {
    const ex = await addOwnExercise(db, ROLLOUT);
    await addProfile(db, "Sam", "#0d9488");
    await setGoal(db, "sam", { exercise: ex.id, kg: 10 });
    expect(await usesOf(db, ex.id)).toEqual({ programmes: [], history: true });
    await expect(removeOwnExercise(db, ex.id)).rejects.toThrow("It's in someone's history, so it stays.");

    const spare = await addOwnExercise(db, { ...ROLLOUT, name: "Spare" });
    await removeOwnExercise(db, spare.id);
    expect((await getOwnExercises(db)).map((e) => e.id)).toEqual([ex.id]);
    expect(library.exercises.some((e) => e.id === spare.id)).toBe(false);
  });

  it("go in backups and come back with them; a backup without any clears them", async () => {
    const ex = await addOwnExercise(db, ROLLOUT);
    const backup = await buildBackup(db, { version: "test" });
    expect(backup.exercises).toEqual([ex]);
    const text = JSON.stringify(backup);

    const other = new JfdiDatabase(`exercises-other-${Math.random()}`);
    setOwnExercises([]);
    await restoreBackup(other, parseBackup(text));
    expect(await getOwnExercises(other)).toEqual([ex]);
    expect(library.exercises.at(-1)).toEqual(ex);

    const { exercises: _e, ...without } = backup;
    await restoreBackup(other, parseBackup(JSON.stringify(without)));
    expect(await getOwnExercises(other)).toEqual([]);
    expect(library.exercises).toHaveLength(bundledLibrary.exercises.length);
    expect((await buildBackup(other, { version: "test" })).exercises).toBeUndefined();
    await other.delete();
  });

  it("are checked in a backup: their own ids, names and family, and only barbells take bars", async () => {
    const backup = await buildBackup(db, { version: "test" });
    const ex = exerciseOf("own-x", { name: "X", pattern: "core", measure: "reps", implement: "other", requires: [] });
    const check = (exercises: unknown[]) => validateBackup({ ...backup, exercises }, { equipment, library: bundledLibrary });
    expect(check([ex])).toEqual([]);
    expect(check([{ ...ex, id: "x", family: "core", name: "Plank" }])).toEqual([
      `exercise "x": an added exercise's id starts own-`,
      `exercise "x": an added exercise's family is "own"`,
      `exercise "x": there's already an exercise called "Plank"`,
    ]);
    expect(check([ex, { ...ex, barTypes: ["standard"] }])).toEqual([`duplicate exercise id "own-x"`, `exercise "own-x": only barbell exercises take bar types`]);
    expect(check([{ ...ex, measure: "lots" }])).toEqual(["backup schema: /exercises/0/measure must be equal to one of the allowed values"]);
    expect(validateOwnExercises([{ ...ex, measure: "lots" }], bundledLibrary)).toEqual([`exercise "own-x" schema: /measure must be equal to one of the allowed values`]);
    // A programme or log can use one, but only when the backup has it
    const p = addExercises(structuredClone(asProgramme(BLOCK1)), "session-a", ["own-x"], { ...bundledLibrary, exercises: [...bundledLibrary.exercises, ex] }, equipment);
    const withProgramme = { ...backup, programmes: [JSON.parse(JSON.stringify(p))] };
    expect(validateBackup({ ...withProgramme, exercises: [ex] }, { equipment, library: bundledLibrary })).toEqual([]);
    expect(validateBackup(withProgramme, { equipment, library: bundledLibrary })).toContain(`programme "strength-block-1": exercise "own-x" isn't in the library`);
  });
});
