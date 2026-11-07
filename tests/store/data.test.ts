import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { JFDIProgrammeFile } from "../../src/formats/generated/programme.ts";
import { validateBackup } from "../../src/formats/validate.js";
import {
  backupDue, BackupError, backupFileName, buildBackup, importRebuildLog, logFor, parseBackup, recordBackup, restoreBackup,
} from "../../src/store/backup.ts";
import { JfdiDatabase } from "../../src/store/db.ts";
import { BUNDLED_PROGRAMMES, equipment, library } from "../../src/store/household.ts";
import { addProfile, deleteProfile, getCurrentProfileId, setCurrentProfileId } from "../../src/store/profiles.ts";
import { assignProgramme, defaultStartingLoads, ProfileError, syncBundledProgrammes } from "../../src/store/programmes.ts";

const read = (path: string) => readFileSync(path, "utf8");
const json = (path: string) => JSON.parse(read(path));
const block1 = BUNDLED_PROGRAMMES[0]!;
const rebuildBackup = read("tests/fixtures/rebuild-log-backup-sample.json");
const app = { version: "0.2.0", commit: "abc1234" };

let db: JfdiDatabase;
beforeEach(async () => {
  db = new JfdiDatabase(`test-${Math.random()}`);
  await syncBundledProgrammes(db);
});
afterEach(async () => { await db.delete(); });

async function setUpDiane() {
  await addProfile(db, "Diane", "#7c3aed");
  return assignProgramme(db, "diane", {
    programme: "strength-block-1",
    startDate: "2027-01-01",
    startingLoads: defaultStartingLoads(block1),
    unavailableEquipment: ["bar-ssb"],
  }, new Date("2026-11-07T10:00:00Z"));
}

describe("programmes that come with the app", () => {
  it("are added on first run", async () => {
    expect((await db.programmes.get("strength-block-1"))?.updatedAt).toBe(block1.updatedAt);
  });

  it("are updated to a newer version, and so is anyone running them", async () => {
    await setUpDiane();
    const newer: JFDIProgrammeFile = { ...block1, updatedAt: "2026-12-01T09:00:00Z" };
    await syncBundledProgrammes(db, [newer]);
    expect((await db.programmes.get("strength-block-1"))?.updatedAt).toBe("2026-12-01T09:00:00Z");
    expect((await db.profiles.get("diane"))?.programmes.active?.programmeUpdatedAt).toBe("2026-12-01T09:00:00Z");
  });

  it("never go back to an older version", async () => {
    await syncBundledProgrammes(db, [{ ...block1, updatedAt: "2020-01-01T00:00:00Z" }]);
    expect((await db.programmes.get("strength-block-1"))?.updatedAt).toBe(block1.updatedAt);
  });
});

describe("putting someone on a programme", () => {
  it("suggests Block 1's first weights as starting loads", () => {
    expect(defaultStartingLoads(block1)).toEqual({
      "back-squat": { kg: 30, reps: 5, sets: 5 },
      "bench-press": { kg: 25, reps: 5, sets: 5 },
      "barbell-row": { kg: 15, reps: 6, sets: 3 },
      "romanian-deadlift": { kg: 30, reps: 6, sets: 3 },
      deadlift: { kg: 55, reps: 5, sets: 3 },
      "overhead-press-ez": { kg: 15.5, reps: 5, sets: 5 },
      "goblet-squat": { kg: 12.5, reps: 10, sets: 2 },
    });
  });

  it("sets Diane up as in her example profile", async () => {
    const diane = await setUpDiane();
    const example = json("examples/profiles/diane.json");
    expect(diane.unavailableEquipment).toEqual(example.unavailableEquipment);
    expect(diane.programmes.active).toMatchObject({
      programme: "strength-block-1",
      programmeUpdatedAt: block1.updatedAt,
      startDate: "2027-01-01",
    });
    for (const [id, load] of Object.entries(example.programmes.active.startingLoads) as [string, { kg: number }][]) {
      expect(diane.programmes.active?.startingLoads?.[id]?.kg, id).toBe(load.kg);
    }
  });

  it("refuses a setup the person can't do, and saves nothing", async () => {
    await addProfile(db, "Diane", "#7c3aed");
    const attempt = assignProgramme(db, "diane", {
      programme: "strength-block-1",
      startDate: "2027-01-01",
      startingLoads: {},
      unavailableEquipment: ["bar-beater", "bar-bastard"],
    });
    await expect(attempt).rejects.toBeInstanceOf(ProfileError);
    await expect(attempt).rejects.toThrow("needs a standard bar");
    expect((await db.profiles.get("diane"))?.programmes.active).toBeUndefined();
  });

  it("files a started programme under history when switching to another", async () => {
    await setUpDiane();
    const other: JFDIProgrammeFile = { ...block1, id: "strength-block-2", name: "Block 2" };
    await db.programmes.put(other);
    const after = await assignProgramme(db, "diane", {
      programme: "strength-block-2", startDate: "2027-03-01", startingLoads: {}, unavailableEquipment: [],
    }, new Date("2027-02-26T12:00:00"));
    expect(after.programmes.history).toEqual([
      { programme: "strength-block-1", programmeUpdatedAt: block1.updatedAt, startDate: "2027-01-01", endDate: "2027-02-26", ended: "early" },
    ]);
    expect(after.unavailableEquipment).toBeUndefined();
  });

  it("doesn't file a programme that hadn't started yet", async () => {
    await setUpDiane();
    await db.programmes.put({ ...block1, id: "strength-block-2" });
    const after = await assignProgramme(db, "diane", {
      programme: "strength-block-2", startDate: "2027-01-01", startingLoads: {}, unavailableEquipment: [],
    }, new Date("2026-11-08T12:00:00"));
    expect(after.programmes.history).toEqual([]);
  });

  it("explains unknown people and programmes", async () => {
    const a = { programme: "strength-block-1", startDate: "2027-01-01", startingLoads: {}, unavailableEquipment: [] };
    await expect(assignProgramme(db, "nobody", a)).rejects.toThrow('No profile "nobody"');
    await addProfile(db, "Diane", "#7c3aed");
    await expect(assignProgramme(db, "diane", { ...a, programme: "nope" })).rejects.toThrow('No programme "nope"');
  });
});

describe("importing from Rebuild Log", () => {
  it("brings across every session, day and weigh-in", async () => {
    await addProfile(db, "Andrew", "#2563eb");
    const s = await importRebuildLog(db, "andrew", rebuildBackup);
    expect(s).toMatchObject({ sessionsAdded: 26, sessionsUpdated: 0, daysAdded: 54, weighInsAdded: 9, skipped: 0, problems: [] });
    const log = await logFor(db, "andrew");
    expect(log.sessions.map((x) => x.startedAt)).toEqual([...log.sessions.map((x) => x.startedAt)].sort());
    expect(log.sessions.every((x) => x.importedFrom === "rebuild-log")).toBe(true);
  });

  it("can be repeated with a newer backup without doubling anything", async () => {
    await addProfile(db, "Andrew", "#2563eb");
    await importRebuildLog(db, "andrew", rebuildBackup);
    const again = await importRebuildLog(db, "andrew", rebuildBackup);
    expect(again).toMatchObject({ sessionsAdded: 0, sessionsUpdated: 26, daysAdded: 0, weighInsAdded: 0, skipped: 63 });
    expect(await db.sessions.where("profile").equals("andrew").count()).toBe(26);
  });

  it("never overwrites a session logged in J.F.D.I", async () => {
    await addProfile(db, "Andrew", "#2563eb");
    await importRebuildLog(db, "andrew", rebuildBackup);
    const first = (await db.sessions.where("profile").equals("andrew").first())!;
    await db.sessions.put({ ...first, importedFrom: undefined, notes: "Logged in J.F.D.I" } as typeof first);
    const again = await importRebuildLog(db, "andrew", rebuildBackup);
    expect(again.sessionsUpdated).toBe(25);
    expect((await db.sessions.get(["andrew", first.id]))?.notes).toBe("Logged in J.F.D.I");
  });

  it("explains files that aren't Rebuild Log backups", async () => {
    await addProfile(db, "Andrew", "#2563eb");
    await expect(importRebuildLog(db, "andrew", "not json")).rejects.toThrow("can't be read");
    await expect(importRebuildLog(db, "andrew", '{"format":"jfdi-backup"}')).rejects.toThrow("Use Restore instead");
    await expect(importRebuildLog(db, "andrew", '{"hello":1}')).rejects.toThrow("isn't a Rebuild Log backup");
    await expect(importRebuildLog(db, "nobody", rebuildBackup)).rejects.toThrow('No profile "nobody"');
  });
});

describe("backup and restore", () => {
  async function household() {
    await setUpDiane();
    await addProfile(db, "Andrew", "#2563eb");
    await importRebuildLog(db, "andrew", rebuildBackup);
  }

  it("a backup passes every check and names its file by date", async () => {
    await household();
    const backup = await buildBackup(db, app, new Date("2026-11-07T10:00:00Z"));
    expect(validateBackup(backup, { equipment, library })).toEqual([]);
    expect(backup.profiles.map((p) => p.id)).toEqual(["andrew", "diane"]);
    expect(backup.logs.find((l) => l.profile === "andrew")?.sessions).toHaveLength(26);
    expect(backupFileName(new Date("2026-11-07T10:00:00"))).toBe("jfdi-backup-2026-11-07.json");
  });

  it("restoring a backup on another device gives back exactly the same data", async () => {
    await household();
    const backup = await buildBackup(db, app);
    const other = new JfdiDatabase(`test-other-${Math.random()}`);
    try {
      await addProfile(other, "Someone else", "#dc2626");
      await setCurrentProfileId(other, "someone-else");
      await restoreBackup(other, parseBackup(JSON.stringify(backup)));
      const copy = await buildBackup(other, app, new Date(backup.exportedAt));
      expect(copy).toEqual(backup);
      expect(await getCurrentProfileId(other)).toBeNull();
      const settings = await other.settings.bulkGet(["lastChangeAt", "lastBackupAt"]);
      expect(backupDue(settings[1]!.value as string, settings[0]!.value as string)).toBe(false);
    } finally {
      await other.delete();
    }
  });

  it("the example profile, log and Block 1 make a valid backup", () => {
    const backup = {
      format: "jfdi-backup", formatVersion: 1, exportedAt: "2027-01-05T20:00:00Z", app,
      profiles: [json("examples/profiles/diane.json")],
      programmes: [block1],
      logs: [json("examples/logs/diane-week-1.json")],
    };
    expect(validateBackup(backup, { equipment, library })).toEqual([]);
    expect(validateBackup({ ...backup, logs: [...backup.logs, backup.logs[0]] }, { equipment, library }))
      .toContain('more than one log for profile "diane"');
    expect(validateBackup({ ...backup, programmes: [] }, { equipment, library }).join()).toContain('active programme "strength-block-1" not found');
    const broken = structuredClone(block1);
    broken.sessions[0]!.tiers.primary![0]!.slots![0]!.exercise = "front-squat";
    expect(validateBackup({ ...backup, programmes: [broken] }, { equipment, library }).join())
      .toContain('programme "strength-block-1": session "session-a" primary block 1 slot 1: unknown exercise "front-squat"');
    expect(validateBackup({ ...backup, programmes: [{ ...block1, sessions: [] }] }, { equipment, library }).join())
      .toContain("backup schema: /programmes/0/sessions");
  });

  it("rejects files that aren't backups, in words", () => {
    expect(() => parseBackup("{")).toThrow("can't be read as JSON");
    expect(() => parseBackup('{"app":"rebuild-log","sessions":{}}')).toThrow("Use Import from Rebuild Log");
    expect(() => parseBackup("null")).toThrow("isn't a J.F.D.I backup");
    try {
      parseBackup('{"format":"jfdi-backup"}');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(BackupError);
      expect((e as BackupError).problems.length).toBeGreaterThan(0);
    }
  });

  it("a backup with problems changes nothing", async () => {
    await household();
    const bad = await buildBackup(db, app);
    bad.programmes = [];
    expect(() => parseBackup(JSON.stringify(bad))).toThrow("nothing was restored");
    expect(await db.profiles.count()).toBe(2);
  });
});

describe("backup reminder", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  it.each([
    ["nothing ever changed", null, null, false],
    ["changes, never backed up", null, "2026-11-19T10:00:00Z", true],
    ["changes since a backup 8 days ago", "2026-11-12T10:00:00Z", "2026-11-19T10:00:00Z", true],
    ["changes since a backup 2 days ago", "2026-11-18T10:00:00Z", "2026-11-19T10:00:00Z", false],
    ["no changes since a backup a month ago", "2026-10-20T10:00:00Z", "2026-10-19T10:00:00Z", false],
  ])("%s", (_name, lastBackup, lastChange, due) => {
    expect(backupDue(lastBackup, lastChange, now)).toBe(due);
  });

  it("recording a backup clears it", async () => {
    await addProfile(db, "Diane", "#7c3aed");
    await recordBackup(db, new Date(Date.now() + 1000));
    const [change, backup] = await db.settings.bulkGet(["lastChangeAt", "lastBackupAt"]);
    expect(backupDue(backup!.value as string, change!.value as string)).toBe(false);
  });
});

describe("deleting a person", () => {
  it("removes them and everything they logged, and only them", async () => {
    await setUpDiane();
    await addProfile(db, "Andrew", "#2563eb");
    await importRebuildLog(db, "andrew", rebuildBackup);
    await setCurrentProfileId(db, "andrew");
    await deleteProfile(db, "andrew");
    expect(await db.profiles.toCollection().primaryKeys()).toEqual(["diane"]);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.days.count()).toBe(0);
    expect(await db.weighIns.count()).toBe(0);
    expect(await getCurrentProfileId(db)).toBeNull();
  });
});
