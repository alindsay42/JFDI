import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { upgradeBackup, upgradeLog, upgradeProgramme, upgradeSession } from "../../src/formats/upgrade.js";
import { checkAgainstLibrary, validateLog, validateProgramme } from "../../src/formats/validate.js";
import { parseBackup } from "../../src/store/backup.ts";
import { JfdiDatabase } from "../../src/store/db.ts";
import { equipment, library } from "../../src/store/household.ts";

const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const v1 = json("tests/fixtures/strength-block-1-v1.json");
const v1log = json("tests/fixtures/diane-week-1-v1.json");
const current = json("examples/programmes/strength-block-1.json");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const v1Programme = (weeks: Any[]) => ({ ...v1, weeks, phases: [{ ...v1.phases[0], blocks: [{ ...v1.phases[0].blocks[0], week: weeks[0].id }] }] });

describe("programme format 1 to 2", () => {
  it("gives Block 1 exactly as it is now, apart from the date it was last changed", () => {
    const up = upgradeProgramme(v1);
    expect(validateProgramme(up)).toEqual([]);
    expect(checkAgainstLibrary(up, library, equipment)).toEqual([]);
    expect({ ...up, updatedAt: current.updatedAt }).toEqual(current);
  });

  it("keeps each block's tier, and runs supersets in rounds of their most sets", () => {
    const items = upgradeProgramme(v1).workouts[0].items;
    expect(items.map((i: Any) => [i.type, i.tier, i.rounds])).toEqual([
      ["single", "primary", undefined], ["superset", "secondary", 5], ["single", "secondary", undefined], ["giant", "tertiary", 3],
    ]);
    expect(items[1].slots.every((s: Any) => s.sets === undefined)).toBe(true);
  });

  it.each([
    ["2 lifting days, A and B", ["a", "b"], 2, [["a", "b"]]],
    ["3 lifting days, A and B: alternates over 2 weeks", ["a", "b"], 3, [["a", "b", "a"], ["b", "a", "b"]]],
    ["2 lifting days, 5 sessions: stops at 4 weeks", ["a", "b", "c", "d", "e"], 2, [["a", "b"], ["c", "d"], ["e", "a"], ["b", "c"]]],
  ])("ad hoc: %s", (_name, rotation, liftDays, weeks) => {
    const up = upgradeProgramme(v1Programme([{ id: "w", name: "W", rotation, perWeek: { liftDays } }]));
    expect(up.plan).toEqual({ mode: "adhoc", weeks: weeks.map((workouts) => ({ workouts })) });
  });

  it("set days: lifting days take the rotation in turn, other days stay as they were", () => {
    const rest = { type: "rest" }, walk = { type: "conditioning", activity: "Walk", minutes: { min: 30, max: 40 } };
    const up = upgradeProgramme(v1Programme([{
      id: "w", name: "W", rotation: ["a", "b"],
      days: { mon: { type: "lift" }, tue: walk, wed: { type: "lift", notes: "Heavy" }, thu: rest, fri: { type: "lift" }, sat: walk, sun: rest },
    }]));
    expect(up.plan.mode).toBe("setDays");
    expect(up.plan.weeks.map((w: Any) => [w.days.mon.workout, w.days.wed.workout, w.days.fri.workout])).toEqual([["a", "b", "a"], ["b", "a", "b"]]);
    expect(up.plan.weeks[0].days.wed).toEqual({ type: "workout", workout: "b", notes: "Heavy" });
    expect(up.plan.weeks[1].days.tue).toEqual(walk);
  });

  it("renames the replace-session readiness rule", () => {
    const red = { ...v1.readiness.levels.red, rules: [{ rule: "replaceSession", session: "session-b" }] };
    const up = upgradeProgramme({ ...v1, readiness: { ...v1.readiness, levels: { ...v1.readiness.levels, red } } });
    expect(up.readiness.levels.red.rules).toEqual([{ rule: "replaceWorkout", workout: "session-b" }]);
  });

  it("leaves current files, and things that aren't programmes, alone", () => {
    expect(upgradeProgramme(current)).toBe(current);
    expect(upgradeProgramme(null)).toBeNull();
    const noLevels = { ...v1, readiness: { preset: "off" } };
    expect(upgradeProgramme(noLevels).readiness).toEqual({ preset: "off" });
  });
});

describe("log format 1 to 2", () => {
  it("gives Diane's example week exactly as it is now, apart from the programme date", () => {
    const up = upgradeLog(v1log);
    for (const s of up.sessions) if (s.programme) s.programme.updatedAt = current.updatedAt;
    expect(up).toEqual(json("examples/logs/diane-week-1.json"));
    expect(validateLog(up, { profiles: null, programmes: new Map([[current.id, current]]), library })).toEqual([]);
  });

  it("moves each exercise to its new slot", () => {
    const up = upgradeLog(v1log);
    expect(v1log.sessions[0].exercises.map((e: Any) => e.slot)).toContain("tertiary.0.2");
    expect(up.sessions[0].exercises.map((e: Any) => e.slot)).toContain("3.2");
  });

  it("leaves sessions without a prescription, current logs and other things alone", () => {
    const imported = { id: "x", prescribed: null, exercises: [] };
    expect(upgradeSession(imported)).toBe(imported);
    const log = json("examples/logs/diane-week-1.json");
    expect(upgradeLog(log)).toBe(log);
    expect(upgradeLog(undefined)).toBeUndefined();
    const added = { ...v1log.sessions[0], exercises: [{ ...v1log.sessions[0].exercises[0], slot: null, added: true }] };
    expect(upgradeSession(added).exercises[0].slot).toBeNull();
  });
});

describe("backups from earlier versions", () => {
  const v1backup = {
    format: "jfdi-backup", formatVersion: 1, exportedAt: "2026-11-07T10:00:00Z", app: { version: "0.2.0" },
    profiles: [{ ...json("examples/profiles/diane.json"), programmes: { active: { ...json("examples/profiles/diane.json").programmes.active, programmeUpdatedAt: v1.updatedAt }, history: [] } }],
    programmes: [v1],
    logs: [v1log],
  };

  it("restore after upgrading", () => {
    const b = parseBackup(JSON.stringify(v1backup));
    expect(b.formatVersion).toBe(2);
    expect(b.programmes[0]!.formatVersion).toBe(2);
    expect(b.logs[0]!.formatVersion).toBe(2);
  });

  it("upgrade only when they're version 1 backups", () => {
    const b = upgradeBackup(v1backup);
    expect(upgradeBackup(b)).toBe(b);
    expect((upgradeBackup({ format: "jfdi-backup", formatVersion: 1 }) as Any).programmes).toEqual([]);
  });
});

describe("the database on a device that ran an earlier version", () => {
  it("upgrades stored programmes and logged sessions when the app opens", async () => {
    const name = `old-${Math.random()}`;
    const old = new Dexie(name);
    old.version(1).stores({ profiles: "id, name", settings: "key" });
    old.version(2).stores({ programmes: "id", sessions: "[profile+id], profile, date", days: "[profile+date], profile", weighIns: "[profile+date], profile" });
    await old.table("programmes").put(v1);
    await old.table("sessions").bulkPut(v1log.sessions.map((s: Any) => ({ ...s, profile: "diane" })));
    old.close();

    const db = new JfdiDatabase(name);
    try {
      const p = await db.programmes.get("strength-block-1");
      expect(p?.formatVersion).toBe(2);
      const sessions = await db.sessions.toArray();
      expect(sessions.every((s) => s.exercises.every((e) => !e.slot || /^\d+\.\d+$/.test(e.slot)))).toBe(true);
    } finally {
      await db.delete();
    }
  });
});
