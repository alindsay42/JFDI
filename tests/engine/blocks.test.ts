import { describe, expect, it } from "vitest";
import { blockInfo, restartKg } from "../../src/engine/blocks.ts";
import { today, type LoggedSession } from "../../src/engine/prescription.ts";
import { BLOCK1 } from "../helpers/block1.ts";
import { asProgramme, type Programme } from "../../src/formats/programme.ts";

const block1 = () => structuredClone(asProgramme(BLOCK1));

const P = "strength-block-1";
function s(date: string, kg: number | null, opts: { deload?: boolean; workout?: string; exercise?: string; status?: "done" | "active"; programme?: string; done?: boolean } = {}): LoggedSession {
  return {
    date, status: opts.status ?? "done", readiness: "green", programme: { id: opts.programme ?? P, week: 1 }, workout: opts.workout ?? "session-a",
    ...(opts.deload ? { deload: true } : {}),
    exercises: [{ exercise: opts.exercise ?? "back-squat", sets: [{ done: opts.done ?? true, reps: 5, ...(kg !== null ? { kg } : {}) }] }],
  };
}

describe("training blocks", () => {
  it("counts only trained weeks, and the last week of a block is its deload", () => {
    const list = [s("2027-01-04", 30), s("2027-01-06", 30), s("2027-01-11", 32.5), s("2027-01-25", 35)];
    const info = blockInfo(list, P, "2027-01-01", "2027-02-01", 4);
    expect(info).toMatchObject({ block: 1, week: 4, scheduledDeload: true, previous: [] });
    expect(info.current).toHaveLength(4);
    // A normal workout already done this week means it isn't the deload
    expect(blockInfo([...list, s("2027-02-01", 37.5)], P, "2027-01-01", "2027-02-03", 4).scheduledDeload).toBe(false);
    // Deloads only when chosen
    expect(blockInfo(list, P, "2027-01-01", "2027-02-01", null)).toMatchObject({ week: 4, length: null, scheduledDeload: false });
  });

  it("a deload ends a block; back-to-back deload weeks are one deload; other programmes, active and old workouts don't count", () => {
    const list = [
      s("2027-01-04", 30), s("2027-01-11", 32.5), s("2027-01-18", 35),
      s("2027-01-27", 21, { deload: true }), s("2027-02-01", 21, { deload: true }),
      s("2026-12-20", 99), s("2027-01-12", 99, { programme: "other" }), s("2027-01-13", 99, { status: "active" }),
    ];
    // Partway through a deload that started last week: still the same block
    expect(blockInfo(list, P, "2027-01-01", "2027-02-03", 6)).toMatchObject({ block: 1, scheduledDeload: false });
    const next = blockInfo(list, P, "2027-01-01", "2027-02-08", 6);
    expect(next).toMatchObject({ block: 2, week: 1, current: [] });
    expect(next.previous.map((w) => w.monday)).toEqual(["2027-01-04", "2027-01-11", "2027-01-18"]);
    // A third block: the second is now the one to restart from
    const third = blockInfo([...list, s("2027-02-08", 33), s("2027-02-15", 35), s("2027-02-22", 21, { deload: true })], P, "2027-01-01", "2027-03-01", 6);
    expect(third).toMatchObject({ block: 3, week: 1 });
    expect(third.previous.map((w) => w.monday)).toEqual(["2027-02-08", "2027-02-15"]);
  });

  it("restarts each exercise from what was lifted in the chosen week of the last block, until it's done in the new one", () => {
    const list = [
      s("2027-01-04", 30), s("2027-01-07", 50, { exercise: "deadlift" }),
      s("2027-01-13", 31), s("2027-01-11", 32.5), s("2027-01-14", null, { exercise: "plank" }),
      s("2027-01-18", 35), s("2027-01-19", 34), s("2027-01-20", 55, { exercise: "deadlift", done: false }),
      s("2027-01-25", 21, { deload: true }),
    ];
    const info = blockInfo(list, P, "2027-01-01", "2027-02-01", null);
    expect(restartKg(info, "back-squat", 2)).toEqual({ kg: 32.5, week: 2 });
    expect(restartKg(info, "back-squat", 3)).toEqual({ kg: 35, week: 3 });
    expect(restartKg(info, "back-squat", 9)).toBeNull();
    expect(restartKg(info, "deadlift", 2)).toBeNull();
    expect(restartKg(info, "deadlift", 1)).toEqual({ kg: 50, week: 1 });
    expect(restartKg(info, "plank", 1)).toBeNull();
    expect(restartKg(blockInfo(list, P, "2027-01-01", "2027-01-19", null), "back-squat", 2)).toBeNull();
    const after = blockInfo([...list, s("2027-02-01", 33)], P, "2027-01-01", "2027-02-03", null);
    expect(restartKg(after, "back-squat", 2)).toBeNull();
  });
});

describe("blocks in the day's targets", () => {
  const assignment = { startDate: "2027-01-01" };
  const withBlocks = (deload: object): Programme => {
    const p = block1();
    p.phases[0]!.blocks[0]!.deload = deload as never;
    return p;
  };
  // Session A and B alternate; B on Mondays, A on Thursdays, then a deload week
  const history = [
    s("2027-01-04", 40, { workout: "session-b", exercise: "deadlift" }), s("2027-01-07", 30),
    s("2027-01-11", 40, { workout: "session-b", exercise: "deadlift" }), s("2027-01-14", 32.5),
    s("2027-01-18", 40, { workout: "session-b", exercise: "deadlift" }), s("2027-01-21", 35),
    s("2027-01-25", 24, { workout: "session-b", exercise: "deadlift", deload: true }), s("2027-01-28", 21, { deload: true }),
    s("2027-02-01", 40, { workout: "session-b", exercise: "deadlift" }),
  ];
  const squat = (t: ReturnType<typeof today>) => (t.kind === "workout" ? t.targets["0.0"] : undefined);

  it("a new block starts from week 2's numbers, can skip on a week at a time, and says where it is", () => {
    const p = withBlocks({ onDemand: true, restartWeek: 2, setsPercent: 50, loadPercent: 60 });
    const t = today({ programme: p, assignment, sessions: history, date: "2027-02-04", readiness: "green" });
    expect(squat(t)).toMatchObject({ kg: 32.5, why: "new block" });
    expect(t.kind === "workout" && t.block).toEqual({ number: 2, week: 1, length: null, restartFrom: 2, canSkip: true });
    const skipped = today({ programme: p, assignment, sessions: history, date: "2027-02-04", readiness: "green", restartSkip: 1 });
    expect(squat(skipped)).toMatchObject({ kg: 35, why: "new block" });
    expect(skipped.kind === "workout" && skipped.block).toMatchObject({ restartFrom: 3, canSkip: false });
  });

  it("without a restart week, weights carry on from before the deload; with no deload there's no block", () => {
    const carry = today({ programme: withBlocks({ onDemand: true, setsPercent: 50, loadPercent: 60 }), assignment, sessions: history, date: "2027-02-04", readiness: "green" });
    expect(squat(carry)).toMatchObject({ kg: 37.5, why: "add" });
    expect(carry.kind === "workout" && carry.block).toEqual({ number: 2, week: 1, length: null, restartFrom: null, canSkip: false });
    const p = block1();
    delete p.phases[0]!.blocks[0]!.deload;
    const none = today({ programme: p, assignment, sessions: history, date: "2027-02-04", readiness: "green" });
    expect(none.kind === "workout" && none.block).toBeNull();
  });

  it("a top set restarts with its back-off sets to match", () => {
    const p = withBlocks({ onDemand: true, restartWeek: 1, setsPercent: 50, loadPercent: 60 });
    p.progressions.push({ id: "top", type: "topSetBackoff", incrementKg: 2.5, topRpe: 8, backoffPercent: 80 });
    p.workouts.find((w) => w.id === "session-a")!.items[0]!.slots[0]!.progression = "top";
    const t = today({ programme: p, assignment, sessions: history, date: "2027-02-04", readiness: "green" });
    expect(squat(t)).toMatchObject({ kg: 30, backoffKg: 24, why: "new block" });
  });
});
