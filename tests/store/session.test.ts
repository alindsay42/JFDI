import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { today, type LoggedSession } from "../../src/engine/prescription.ts";
import { asProgramme } from "../../src/formats/programme.ts";
import { validateLog } from "../../src/formats/validate.js";
import { logFor } from "../../src/store/backup.ts";
import { JfdiDatabase, type SessionRecord } from "../../src/store/db.ts";
import { library } from "../../src/store/household.ts";
import { addProfile } from "../../src/store/profiles.ts";
import { assignProgramme } from "../../src/store/programmes.ts";
import {
  activeSession, addExercise, addRound, addSet, discardSession, fieldOf, finishSession, getSkip, removeExercise, removeSet, restAfter, restoreExercise,
  setNotes, skipInForce, skipWorkout, startSession, updateSet,
} from "../../src/store/session.ts";
import { BLOCK1 } from "../helpers/block1.ts";

let db: JfdiDatabase;
const p = asProgramme(BLOCK1);
const at = (d: string, t = "18:00") => new Date(`${d}T${t}:00`);

beforeEach(async () => {
  db = new JfdiDatabase(`session-${Math.random()}`);
  await db.programmes.put(structuredClone(BLOCK1));
  await addProfile(db, "Diane", "#7c3aed");
  await assignProgramme(db, "diane", { programme: p.id, startDate: "2027-01-01", startingLoads: {}, unavailableEquipment: [] }, at("2026-12-01"));
});
afterEach(async () => { await db.delete(); });

const profile = async () => (await db.profiles.get("diane"))!;
const sessions = async () => (await db.sessions.where("profile").equals("diane").toArray()) as unknown as LoggedSession[];
const plan = async (date: string) => {
  const t = today({ programme: p, assignment: (await profile()).programmes.active!, sessions: (await sessions()).map(toLogged), date, readiness: "green" });
  if (t.kind !== "workout") throw new Error(t.kind);
  return t;
};
function toLogged(s: unknown): LoggedSession {
  const r = s as SessionRecord;
  return { date: r.date, status: r.status, readiness: r.readiness, programme: r.programme as LoggedSession["programme"], workout: r.session.id, exercises: r.exercises };
}
const valid = async () => validateLog(await logFor(db, "diane"), { profiles: new Map([["diane", await profile()]]), programmes: new Map([[p.id, BLOCK1]]), library });

describe("starting a workout", () => {
  it("lays out every set as planned, with the target weight and reps filled in, nothing ticked", async () => {
    const s = await startSession(db, await profile(), p, await plan("2027-01-01"), "green", at("2027-01-01"));
    expect(s).toMatchObject({ id: "2027-01-01-session-a", status: "active", programme: { id: p.id, week: 1 }, session: { id: "session-a", name: "Session A" } });
    expect(s.exercises.map((e) => [e.exercise, e.slot, e.sets.length])).toEqual([
      ["back-squat", "0.0", 5], ["bench-press", "1.0", 5], ["barbell-row", "1.1", 5], ["romanian-deadlift", "2.0", 3],
      ["db-lateral-raise", "3.0", 3], ["plank", "3.1", 3], ["battle-ropes", "3.2", 3],
    ]);
    expect(s.exercises[0]!.sets[0]).toEqual({ done: false, kg: 30, reps: 5 });
    expect(s.exercises[2]!.sets[0]).toEqual({ done: false, kg: 15, reps: 6 });
    expect(s.exercises[5]!.sets[0]).toEqual({ done: false, seconds: 30 });
    expect(s.exercises[4]).toMatchObject({ loadPer: "each" });
    expect(await activeSession(db, "diane")).toEqual(s);
    expect(await valid()).toEqual([]);
  });

  it("gives a second workout on the same day its own id", async () => {
    await startSession(db, await profile(), p, await plan("2027-01-01"), "green", at("2027-01-01"));
    const again = await startSession(db, await profile(), p, await plan("2027-01-01"), "green", at("2027-01-01", "19:00"));
    expect(again.id).toBe("2027-01-01-session-a-2");
  });
});

describe("during a workout", () => {
  it("ticks sets, changes weights and reps, adds and removes sets, and keeps notes", async () => {
    let s = await startSession(db, await profile(), p, await plan("2027-01-01"), "green", at("2027-01-01"));
    s = await updateSet(db, s, 0, 0, { done: true, rpe: 7 });
    s = await updateSet(db, s, 0, 1, { kg: 32.5, reps: 4, done: true });
    s = await updateSet(db, s, 0, 1, { rpe: undefined });
    expect(s.exercises[0]!.sets.slice(0, 2)).toEqual([{ done: true, kg: 30, reps: 5, rpe: 7 }, { done: true, kg: 32.5, reps: 4 }]);
    s = await addSet(db, s, 0);
    expect(s.exercises[0]!.sets.at(-1)).toEqual({ done: false, kg: 30, reps: 5 });
    s = await removeSet(db, s, 0, 5);
    s = await removeSet(db, s, 0, 0);
    expect(s.exercises[0]!.sets).toHaveLength(5);
    s = await setNotes(db, s, "Felt strong");
    expect(s.notes).toBe("Felt strong");
    s = await setNotes(db, s, "  ");
    expect(s).not.toHaveProperty("notes");
    expect(await valid()).toEqual([]);
  });

  it("removing an exercise keeps sets already done, and can be undone", async () => {
    let s = await startSession(db, await profile(), p, await plan("2027-01-01"), "green", at("2027-01-01"));
    s = await updateSet(db, s, 3, 0, { done: true });
    s = await removeExercise(db, s, 3, "Lower back tight");
    expect(s.exercises[3]).toMatchObject({ removed: { reason: "Lower back tight" } });
    expect(s.exercises[3]!.sets).toHaveLength(3);
    s = await restoreExercise(db, s, 3);
    expect(s.exercises[3]).not.toHaveProperty("removed");
    expect(s.exercises[3]!.sets).toHaveLength(3);
    s = await removeExercise(db, s, 3, "Lower back tight");
    s = await finishSession(db, s, null, at("2027-01-01", "19:00"));
    expect(s.exercises[3]!.sets).toEqual([{ done: true, kg: 30, reps: 6 }]);
    expect(await valid()).toEqual([]);
  });

  it("adds an exercise from the library with 3 empty sets; removing it before doing any takes it away", async () => {
    let s = await startSession(db, await profile(), p, await plan("2027-01-01"), "green", at("2027-01-01"));
    s = await addExercise(db, s, "db-curl");
    expect(s.exercises.at(-1)).toMatchObject({ exercise: "db-curl", name: "DB curl", slot: null, added: true, loadPer: "each" });
    expect(await valid()).toEqual([]);
    s = await addExercise(db, s, "plank");
    s = await removeExercise(db, s, s.exercises.length - 1, null);
    expect(s.exercises.at(-1)!.exercise).toBe("db-curl");
    await expect(addExercise(db, s, "moon-squat")).rejects.toThrow("isn't in the library");
  });
});

describe("rounds of a group", () => {
  it("+ Round adds a set to each exercise still in it; dropping an exercise's last set removes it", async () => {
    let s = await startSession(db, await profile(), p, await plan("2027-01-01"), "green", at("2027-01-01"));
    s = await addRound(db, s, [1, 2]);
    expect([s.exercises[1]!.sets.length, s.exercises[2]!.sets.length]).toEqual([6, 6]);
    expect(s.exercises[2]!.sets[5]).toEqual({ done: false, kg: 15, reps: 6 });
    for (let i = 0; i < 5; i++) s = await removeSet(db, s, 2, 0);
    expect(s.exercises[2]!.sets).toHaveLength(1);
    s = await removeSet(db, s, 2, 0);
    expect(s.exercises[2]).toMatchObject({ removed: { reason: null } });
    s = await addRound(db, s, [1, 2]);
    expect([s.exercises[1]!.sets.length, s.exercises[2]!.sets.length]).toEqual([7, 1]);
    s = await updateSet(db, s, 1, 0, { done: true });
    s = await removeSet(db, s, 1, 0);
    expect(s.exercises[1]!.sets).toHaveLength(7);
    s = await addExercise(db, s, "db-curl");
    s = await removeSet(db, s, 7, 0);
    s = await removeSet(db, s, 7, 0);
    s = await removeSet(db, s, 7, 0);
    expect(s.exercises.some((e) => e.exercise === "db-curl")).toBe(false);
  });
});

describe("finishing", () => {
  it("a finished workout moves the plan on, and its sets count for progression", async () => {
    let s = await startSession(db, await profile(), p, await plan("2027-01-01"), "green", at("2027-01-01"));
    for (let i = 0; i < 5; i++) s = await updateSet(db, s, 0, i, { done: true });
    s = await finishSession(db, s, null, at("2027-01-01", "19:00"));
    expect(s).toMatchObject({ status: "done", finishedAt: at("2027-01-01", "19:00").toISOString(), endedEarly: null });
    expect(await activeSession(db, "diane")).toBeUndefined();
    expect(await valid()).toEqual([]);
    const b = await startSession(db, await profile(), p, await plan("2027-01-04"), "green", at("2027-01-04"));
    expect(b.session.id).toBe("session-b");
    await finishSession(db, b, null, at("2027-01-04", "19:00"));
    const nextA = await startSession(db, await profile(), p, await plan("2027-01-07"), "green", at("2027-01-07"));
    expect(nextA.exercises[0]!.sets[0]!.kg).toBe(32.5);
  });

  it("ending early records why", async () => {
    const s = await startSession(db, await profile(), p, await plan("2027-01-01"), "green", at("2027-01-01"));
    expect((await finishSession(db, s, "Light-headed")).endedEarly).toBe("Light-headed");
  });

  it("discarding removes it altogether", async () => {
    const s = await startSession(db, await profile(), p, await plan("2027-01-01"), "green", at("2027-01-01"));
    await discardSession(db, s);
    expect(await db.sessions.count()).toBe(0);
  });
});

describe("rest between sets", () => {
  it("comes from the slot, then the item, then the exercise, then 90 seconds", () => {
    const w = structuredClone(p.workouts[0]!);
    w.items[0]!.slots[0]!.restSec = 200;
    expect(restAfter(p, w as never, "0.0", "back-squat")).toBe(200);
    expect(restAfter(p, w as never, "1.0", "bench-press")).toBe(w.items[1]!.restSec);
    delete w.items[2]!.restSec;
    const rdl = p.exercises.find((e) => e.id === "romanian-deadlift")!;
    expect(restAfter(p, w as never, "2.0", "romanian-deadlift")).toBe(rdl.restSec ?? 90);
    expect(restAfter(null, undefined, null, "db-curl")).toBe(library.exercises.find((e) => e.id === "db-curl")!.restSec);
    expect(restAfter(null, undefined, null, "nope")).toBe(90);
    expect(restAfter(p, w as never, "9.0", "nope")).toBe(90);
  });

  it("knows what each exercise's sets measure", () => {
    expect([fieldOf(p, "back-squat"), fieldOf(p, "plank"), fieldOf(p, "farmers-carry"), fieldOf(null, "walk"), fieldOf(null, "nope")]).toEqual(["reps", "seconds", "metres", "seconds", "reps"]);
  });
});

describe("skipping (ad hoc)", () => {
  it("is in force until a workout is done after it, and only for its programme", async () => {
    await skipWorkout(db, "diane", p.id, { week: 0, day: 0 }, at("2027-01-01"));
    const skip = await getSkip(db, "diane");
    expect(skipInForce(skip, p.id, null)).toEqual({ week: 0, day: 0 });
    expect(skipInForce(skip, p.id, "2027-01-01")).toEqual({ week: 0, day: 0 });
    expect(skipInForce(skip, p.id, "2027-01-02")).toBeNull();
    expect(skipInForce(skip, "other", null)).toBeNull();
    expect(skipInForce(undefined, p.id, null)).toBeNull();
  });

  it("is cleared when a workout starts", async () => {
    await skipWorkout(db, "diane", p.id, { week: 0, day: 0 }, at("2027-01-01"));
    await startSession(db, await profile(), p, await plan("2027-01-01"), "green", at("2027-01-01"));
    expect(await getSkip(db, "diane")).toBeUndefined();
  });
});
