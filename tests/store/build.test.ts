import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addExercises, newProgramme, removeExercises } from "../../src/build/model.ts";
import { asProgramme } from "../../src/formats/programme.ts";
import { deleteProgramme, discardDraft, getDraft, listDrafts, putDraft, saveProgramme, SaveError } from "../../src/store/build.ts";
import { JfdiDatabase } from "../../src/store/db.ts";
import { readFileSync } from "node:fs";
import { equipment, library } from "../../src/store/household.ts";
import type { JFDIProgrammeFile } from "../../src/formats/generated/programme.ts";
import { addProfile } from "../../src/store/profiles.ts";
import { assignProgramme, defaultStartingLoads, stopProgramme, syncBundledProgrammes } from "../../src/store/programmes.ts";

let db: JfdiDatabase;
beforeEach(async () => {
  db = new JfdiDatabase(`build-${Math.random()}`);
  await db.programmes.put(structuredClone(BLOCK1));
});
afterEach(async () => { await db.delete(); });

const BLOCK1 = JSON.parse(readFileSync("examples/programmes/strength-block-1.json", "utf8")) as JFDIProgrammeFile;
const block1 = () => structuredClone(asProgramme(BLOCK1));

describe("saving a programme", () => {
  it("moves the people running it onto the new version, dropping starting loads for removed exercises", async () => {
    await addProfile(db, "Diane", "#7c3aed");
    await assignProgramme(db, "diane", { programme: "strength-block-1", startDate: "2027-01-01", startingLoads: defaultStartingLoads(BLOCK1), unavailableEquipment: [] });
    const edited = removeExercises(block1(), "session-b", ["goblet-squat"]);
    await putDraft(db, { programme: edited, basedOn: edited.updatedAt });
    const saved = await saveProgramme(db, edited, new Date("2026-11-08T10:00:00Z"));
    expect(saved.updatedAt).toBe("2026-11-08T10:00:00.000Z");
    const diane = await db.profiles.get("diane");
    expect(diane?.programmes.active?.programmeUpdatedAt).toBe(saved.updatedAt);
    expect(diane?.programmes.active?.startingLoads).not.toHaveProperty("goblet-squat");
    expect(await getDraft(db, "strength-block-1")).toBeUndefined();
    // Changed here, so it's never retired
    await syncBundledProgrammes(db);
    expect((await db.programmes.get("strength-block-1"))?.updatedAt).toBe(saved.updatedAt);
  });

  it("refuses a programme with problems, saving nothing", async () => {
    const empty = newProgramme("Empty", []);
    await expect(saveProgramme(db, empty)).rejects.toBeInstanceOf(SaveError);
    expect(await db.programmes.get(empty.id)).toBeUndefined();
  });

  it("saves a new programme", async () => {
    const p = addExercises(newProgramme("Andrew", ["strength-block-1"]), "day-1", ["deadlift"], library, equipment);
    await saveProgramme(db, p);
    expect((await db.programmes.get("andrew"))?.workouts).toHaveLength(1);
  });
});

describe("drafts", () => {
  it("are kept per programme until saved or discarded", async () => {
    const a = newProgramme("A", []);
    const b = newProgramme("B", []);
    await putDraft(db, { programme: a, basedOn: null });
    await putDraft(db, { programme: b, basedOn: null });
    expect((await listDrafts(db)).map((d) => d.programme.id).sort()).toEqual(["a", "b"]);
    await discardDraft(db, "a");
    expect((await listDrafts(db)).map((d) => d.programme.id)).toEqual(["b"]);
  });
});

describe("deleting a programme", () => {
  it("is refused while someone runs it", async () => {
    await addProfile(db, "Diane", "#7c3aed");
    await assignProgramme(db, "diane", { programme: "strength-block-1", startDate: "2027-01-01", startingLoads: {}, unavailableEquipment: [] });
    await expect(deleteProgramme(db, "strength-block-1")).rejects.toThrow("Diane is running it");
  });

  it("removes it and its draft otherwise", async () => {
    await putDraft(db, { programme: block1(), basedOn: block1().updatedAt });
    await deleteProgramme(db, "strength-block-1");
    expect(await db.programmes.count()).toBe(0);
    expect(await listDrafts(db)).toEqual([]);
  });
});

describe("programmes that no longer come with the app", () => {
  it("are removed, with their drafts, when nobody runs them and they were never changed", async () => {
    await putDraft(db, { programme: block1(), basedOn: BLOCK1.updatedAt });
    await syncBundledProgrammes(db);
    expect(await db.programmes.count()).toBe(0);
    expect(await listDrafts(db)).toEqual([]);
  });

  it("stay while someone runs them", async () => {
    await addProfile(db, "Diane", "#7c3aed");
    await assignProgramme(db, "diane", { programme: "strength-block-1", startDate: "2027-01-01", startingLoads: {}, unavailableEquipment: [] });
    await syncBundledProgrammes(db);
    expect(await db.programmes.count()).toBe(1);
  });
});

describe("stopping a programme", () => {
  it("files one that had started under history, and forgets one that hadn't", async () => {
    await addProfile(db, "Andrew", "#2563eb");
    const a = { programme: "strength-block-1", startDate: "2026-11-01", startingLoads: {}, unavailableEquipment: [] };
    await assignProgramme(db, "andrew", a, new Date("2026-11-01T10:00:00"));
    let p = await stopProgramme(db, "andrew", new Date("2026-11-07T10:00:00"));
    expect(p.programmes).toEqual({ history: [{ programme: "strength-block-1", programmeUpdatedAt: BLOCK1.updatedAt, startDate: "2026-11-01", endDate: "2026-11-07", ended: "early" }] });
    await assignProgramme(db, "andrew", { ...a, startDate: "2027-01-01" }, new Date("2026-11-07T10:00:00"));
    p = await stopProgramme(db, "andrew", new Date("2026-11-08T10:00:00"));
    expect(p.programmes.history).toHaveLength(1);
    expect(p.programmes.active).toBeUndefined();
    expect(await stopProgramme(db, "andrew")).toEqual(p);
    await expect(stopProgramme(db, "nobody")).rejects.toThrow('No profile "nobody"');
  });
});
