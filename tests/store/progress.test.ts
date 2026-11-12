import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { today } from "../../src/engine/prescription.ts";
import { asProgramme } from "../../src/formats/programme.ts";
import { JfdiDatabase } from "../../src/store/db.ts";
import { addProfile } from "../../src/store/profiles.ts";
import { assignProgramme } from "../../src/store/programmes.ts";
import { addBodyweightGoal, addWalk, answerCheck48h, clearGoal, deleteSession, deleteWeighIn, putWeighIn, removeActivity, removeBodyweightGoal, saveSession, setGoal } from "../../src/store/progress.ts";
import { validateProfile } from "../../src/formats/validate.js";
import { equipment, library } from "../../src/store/household.ts";
import { finishSession, startSession, updateSet } from "../../src/store/session.ts";
import { BLOCK1 } from "../helpers/block1.ts";

let db: JfdiDatabase;
const p = asProgramme(BLOCK1);
beforeEach(async () => {
  db = new JfdiDatabase(`progress-${Math.random()}`);
  await db.programmes.put(structuredClone(BLOCK1));
  await addProfile(db, "Diane", "#7c3aed");
  await assignProgramme(db, "diane", { programme: p.id, startDate: "2027-01-01", startingLoads: {}, unavailableEquipment: [] }, new Date("2026-12-01T10:00:00"));
});
afterEach(async () => { await db.delete(); });

async function finished() {
  const profile = (await db.profiles.get("diane"))!;
  const t = today({ programme: p, assignment: profile.programmes.active!, sessions: [], date: "2027-01-01", readiness: "green" });
  if (t.kind !== "workout") throw new Error(t.kind);
  let s = await startSession(db, profile, p, t, "green", new Date("2027-01-01T18:00:00"));
  s = await updateSet(db, s, 0, 0, { done: true });
  return finishSession(db, s, null, new Date("2027-01-01T19:00:00"));
}

describe("editing a finished workout", () => {
  it("saves changes to sets and notes", async () => {
    const s = await finished();
    const edited = structuredClone(s);
    edited.exercises[0]!.sets[0]!.kg = 32.5;
    edited.exercises[0]!.sets[1]!.done = true;
    edited.notes = "Felt good";
    await saveSession(db, edited);
    const saved = (await db.sessions.get(["diane", s.id]))!;
    expect(saved.notes).toBe("Felt good");
    expect(saved.exercises[0]!.sets.slice(0, 2)).toMatchObject([{ kg: 32.5, done: true }, { done: true }]);
  });

  it("refuses a change that would make the log wrong, keeping what was there", async () => {
    const s = await finished();
    const bad = structuredClone(s);
    bad.exercises[0]!.sets[0] = { done: true, kg: 30, seconds: 30 } as never;
    await expect(saveSession(db, bad)).rejects.toThrow("seconds");
    expect((await db.sessions.get(["diane", s.id]))?.exercises[0]!.sets[0]).toEqual(s.exercises[0]!.sets[0]);
    const unknown = { ...structuredClone(s), id: "brand-new", exercises: [{ ...s.exercises[0]!, exercise: "moon-squat" }] };
    await expect(saveSession(db, unknown)).rejects.toThrow("moon-squat");
    expect(await db.sessions.get(["diane", "brand-new"])).toBeUndefined();
  });

  it("still saves when the programme has since been deleted", async () => {
    const s = await finished();
    await db.programmes.clear();
    await saveSession(db, { ...s, notes: "Later" });
    expect((await db.sessions.get(["diane", s.id]))?.notes).toBe("Later");
  });

  it("deletes a workout", async () => {
    const s = await finished();
    await deleteSession(db, "diane", s.id);
    expect(await db.sessions.count()).toBe(0);
  });
});

describe("weigh-ins", () => {
  it("one per day, replaced by a second, and deleted", async () => {
    await putWeighIn(db, "diane", { date: "2027-01-01", kg: 62.456, fasted: true });
    await putWeighIn(db, "diane", { date: "2027-01-01", kg: 62.2 });
    expect(await db.weighIns.toArray()).toEqual([{ profile: "diane", date: "2027-01-01", kg: 62.2 }]);
    await putWeighIn(db, "diane", { date: "2027-01-02", kg: 62.456, fasted: true });
    expect(await db.weighIns.get(["diane", "2027-01-02"])).toEqual({ profile: "diane", date: "2027-01-02", kg: 62.46, fasted: true });
    await deleteWeighIn(db, "diane", "2027-01-01");
    expect(await db.weighIns.count()).toBe(1);
    await expect(putWeighIn(db, "diane", { date: "2027-01-03", kg: 6 })).rejects.toThrow("between 20 and 300");
  });
});

describe("goals", () => {
  it("one per lift, replaced, and cleared", async () => {
    await setGoal(db, "diane", { exercise: "back-squat", kg: 50 });
    await setGoal(db, "diane", { exercise: "deadlift", kg: 80, by: "2027-06-01" });
    await setGoal(db, "diane", { exercise: "back-squat", kg: 55 });
    expect((await db.profiles.get("diane"))?.targets).toEqual([{ exercise: "deadlift", kg: 80, by: "2027-06-01" }, { exercise: "back-squat", kg: 55 }]);
    await clearGoal(db, "diane", "back-squat");
    await clearGoal(db, "diane", "deadlift");
    expect(await db.profiles.get("diane")).not.toHaveProperty("targets");
    await clearGoal(db, "nobody", "x");
    await expect(setGoal(db, "nobody", { exercise: "x" })).rejects.toThrow('No profile "nobody"');
  });
});

describe("bodyweight goals", () => {
  const plan = async () => (await db.profiles.get("diane"))?.bodyweight;

  it("starts the pace from the latest weigh-in, keeps goals in date order and replaces one on the same date", async () => {
    await putWeighIn(db, "diane", { date: "2026-11-01", kg: 62 });
    await putWeighIn(db, "diane", { date: "2026-11-07", kg: 62.4 });
    await addBodyweightGoal(db, "diane", { kg: 64, by: "2027-03-01", label: "  Spring  " }, "2026-11-08");
    await addBodyweightGoal(db, "diane", { kg: 63.04, by: "2027-01-01" }, "2026-11-20");
    await addBodyweightGoal(db, "diane", { kg: 64.5, by: "2027-03-01", label: " " }, "2026-11-20");
    expect(await plan()).toEqual({ start: "2026-11-07", goals: [{ kg: 63, by: "2027-01-01" }, { kg: 64.5, by: "2027-03-01" }] });
    const profile = (await db.profiles.get("diane"))!;
    expect(validateProfile(profile, { programmes: new Map([[BLOCK1.id, BLOCK1]]), equipment, library })).toEqual([]);

    await removeBodyweightGoal(db, "diane", "2027-01-01");
    expect((await plan())?.goals).toHaveLength(1);
    await removeBodyweightGoal(db, "diane", "2027-03-01");
    expect(await db.profiles.get("diane")).not.toHaveProperty("bodyweight");
    await removeBodyweightGoal(db, "diane", "2027-03-01");
  });

  it("starts from today with no weigh-ins, allows up to 6, and explains bad input", async () => {
    await addBodyweightGoal(db, "diane", { kg: 60, by: "2027-01-01", label: "A name that is far too long to fit on the chart" }, "2026-11-08");
    expect(await plan()).toEqual({ start: "2026-11-08", goals: [{ kg: 60, by: "2027-01-01", label: "A name that is far too long to" }] });
    for (let m = 2; m <= 6; m++) await addBodyweightGoal(db, "diane", { kg: 60, by: `2027-0${m}-01` }, "2026-11-08");
    await expect(addBodyweightGoal(db, "diane", { kg: 60, by: "2027-07-01" }, "2026-11-08")).rejects.toThrow("Up to 6 goals");
    await expect(addBodyweightGoal(db, "diane", { kg: 10, by: "2027-07-01" }, "2026-11-08")).rejects.toThrow("between 20 and 300kg");
    await expect(addBodyweightGoal(db, "diane", { kg: 60, by: "" }, "2026-11-08")).rejects.toThrow("Choose the date");
    await expect(addBodyweightGoal(db, "nobody", { kg: 60, by: "2027-07-01" }, "2026-11-08")).rejects.toThrow('No profile "nobody"');
  });
});

describe("the 48-hour check", () => {
  it("answers, changes and clears it, never timed before the workout finished", async () => {
    const s = await finished();
    await answerCheck48h(db, "diane", s.id, "worse", new Date("2027-01-03T08:00:00"));
    expect((await db.sessions.get(["diane", s.id]))!.check48h).toEqual({ status: "worse", at: new Date("2027-01-03T08:00:00").toISOString() });
    await answerCheck48h(db, "diane", s.id, "same", new Date("2026-12-31T08:00:00"));
    expect((await db.sessions.get(["diane", s.id]))!.check48h).toEqual({ status: "same", at: s.finishedAt });
    await answerCheck48h(db, "diane", s.id, null);
    expect((await db.sessions.get(["diane", s.id]))!.check48h).toBeNull();
    await expect(answerCheck48h(db, "diane", "nope", "same")).rejects.toThrow("isn't here");
  });
});

describe("walks", () => {
  it("adds walks to a day, keeps the rest of the day, and removes them", async () => {
    await db.days.put({ profile: "diane", date: "2027-01-02", readiness: "green" });
    await addWalk(db, "diane", "2027-01-02", 30.4);
    await addWalk(db, "diane", "2027-01-02", 45);
    expect(await db.days.get(["diane", "2027-01-02"])).toMatchObject({
      readiness: "green", activities: [{ exercise: "walk", minutes: 30 }, { exercise: "walk", minutes: 45 }],
    });
    await removeActivity(db, "diane", "2027-01-02", 0);
    await removeActivity(db, "diane", "2027-01-02", 5);
    await removeActivity(db, "diane", "2027-01-02", 0);
    expect(await db.days.get(["diane", "2027-01-02"])).toEqual({ profile: "diane", date: "2027-01-02", readiness: "green" });

    await addWalk(db, "diane", "2027-01-03", 20);
    await removeActivity(db, "diane", "2027-01-03", 0);
    expect(await db.days.get(["diane", "2027-01-03"])).toBeUndefined();
    await removeActivity(db, "diane", "2027-01-04", 0);
  });

  it("explains bad input", async () => {
    await expect(addWalk(db, "diane", "2027-01-02", 0)).rejects.toThrow("between 1 and 1440");
    await expect(addWalk(db, "diane", "", 30)).rejects.toThrow("date of the walk");
  });
});

describe("the day's check-in", () => {
  it("records it straight away, keeps walks, and changes it", async () => {
    const { setDayReadiness } = await import("../../src/store/progress.ts");
    await addWalk(db, "diane", "2027-01-02", 30);
    await setDayReadiness(db, "diane", "2027-01-02", "red");
    await setDayReadiness(db, "diane", "2027-01-02", "red");
    expect(await db.days.get(["diane", "2027-01-02"])).toMatchObject({ readiness: "red", activities: [{ minutes: 30 }] });
    await setDayReadiness(db, "diane", "2027-01-03", "amber");
    expect((await db.days.get(["diane", "2027-01-03"]))?.readiness).toBe("amber");
  });
});

describe("each person's starting weights", () => {
  it("changes them on the programme they're using, keeping the start date", async () => {
    const { setStartingLoads } = await import("../../src/store/programmes.ts");
    await setStartingLoads(db, "diane", { "back-squat": { kg: 25 } });
    const active = (await db.profiles.get("diane"))!.programmes.active!;
    expect(active).toMatchObject({ programme: p.id, startDate: "2027-01-01", startingLoads: { "back-squat": { kg: 25 } } });
    await addProfile(db, "Nobody", "#0d9488");
    await expect(setStartingLoads(db, "nobody", {})).rejects.toThrow("Choose a programme first");
    await expect(setStartingLoads(db, "gone", {})).rejects.toThrow("Choose a programme first");
  });
});
