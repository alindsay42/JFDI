import { describe, expect, it } from "vitest";
import { historyOf, lastPosition, today, type LoggedSession } from "../../src/engine/prescription.ts";
import { asProgramme, type Programme } from "../../src/formats/programme.ts";
import { setMode, setWeekCount } from "../../src/build/model.ts";
import { BLOCK1 } from "../helpers/block1.ts";

const block1 = () => structuredClone(asProgramme(BLOCK1));
const diane = { startDate: "2027-01-01", startingLoads: { "back-squat": { kg: 30 }, "bench-press": { kg: 25 } } };

/** A finished session: every set of every exercise as given. */
function done(date: string, workout: string, lifts: Record<string, [number | null, number[]]>, extra: Partial<LoggedSession> = {}): LoggedSession {
  return {
    date, status: "done", readiness: "green", programme: { id: "strength-block-1", week: 1 }, workout,
    exercises: Object.entries(lifts).map(([exercise, [kg, reps]]) => ({
      exercise, sets: reps.map((r) => ({ done: r > 0, ...(r > 0 ? { reps: r } : {}), ...(kg !== null ? { kg } : {}) })),
    })),
    ...extra,
  };
}

const workoutOf = (t: ReturnType<typeof today>) => (t.kind === "workout" ? t : null);
const target = (t: ReturnType<typeof today>, exercise: string) => {
  const w = workoutOf(t)!;
  for (const [i, item] of w.workout.items.entries()) for (const [j, s] of item.slots.entries()) if (s.exercise === exercise) return w.targets[`${i}.${j}`]!;
  throw new Error(`${exercise} not in today's workout`);
};

describe("today, ad hoc (Diane's Block 1)", () => {
  it("nothing before the start date", () => {
    expect(today({ programme: block1(), assignment: diane, sessions: [], date: "2026-12-31", readiness: null })).toEqual({ kind: "notStarted", startDate: "2027-01-01" });
  });

  it("day 1: Session A, at her starting weights, or the programme's where she has none", () => {
    const t = today({ programme: block1(), assignment: diane, sessions: [], date: "2027-01-01", readiness: "green" });
    expect(workoutOf(t)?.workout.id).toBe("session-a");
    expect(workoutOf(t)?.position).toEqual({ week: 0, day: 0 });
    expect(target(t, "back-squat")).toMatchObject({ kg: 30, why: "start" });
    expect(target(t, "barbell-row")).toMatchObject({ kg: 15, why: "start" });
    expect(target(t, "plank")).toMatchObject({ reps: { min: 30, max: 45 } });
  });

  it("after Session A, Session B, once her 2 rest days are up", () => {
    const sessions = [done("2027-01-01", "session-a", { "back-squat": [30, [5, 5, 5, 5, 5]] })];
    expect(today({ programme: block1(), assignment: diane, sessions, date: "2027-01-02", readiness: "green" })).toMatchObject({ kind: "resting", daysLeft: 2, next: { workout: "session-b" } });
    const t = today({ programme: block1(), assignment: diane, sessions, date: "2027-01-04", readiness: "green" });
    expect(workoutOf(t)?.workout.id).toBe("session-b");
    const anyway = today({ programme: block1(), assignment: diane, sessions, date: "2027-01-02", readiness: "green", ignoreRest: true });
    expect(workoutOf(anyway)?.workout.id).toBe("session-b");
  });

  it("the squat goes up after all 5 sets of 5, and the next A asks for it", () => {
    const sessions = [
      done("2027-01-01", "session-a", { "back-squat": [30, [5, 5, 5, 5, 5]] }),
      done("2027-01-04", "session-b", { deadlift: [55, [5, 5, 5]] }),
    ];
    const t = today({ programme: block1(), assignment: diane, sessions, date: "2027-01-07", readiness: "green" });
    expect(target(t, "back-squat")).toMatchObject({ kg: 32.5, why: "add" });
  });

  it("Amber: main lifts 3 sets, extras dropped, 2 more reps in reserve", () => {
    const t = workoutOf(today({ programme: block1(), assignment: diane, sessions: [], date: "2027-01-01", readiness: "amber" }))!;
    expect(t.workout.items.map((i) => i.tier)).not.toContain("tertiary");
    expect(t.workout.items[0]!.slots[0]!.sets).toBe(3);
    expect(t.addRir).toBe(2);
  });

  it("Red: no lifting", () => {
    expect(today({ programme: block1(), assignment: diane, sessions: [], date: "2027-01-01", readiness: "red" })).toEqual({ kind: "noLifting" });
  });

  it("readiness rules don't apply when the programme has the check off", () => {
    const p = block1();
    p.readiness = { preset: "off" } as Programme["readiness"];
    expect(workoutOf(today({ programme: p, assignment: diane, sessions: [], date: "2027-01-01", readiness: "red" }))?.workout.id).toBe("session-a");
  });

  it("a chosen skip moves on past the workout skipped", () => {
    const t = today({ programme: block1(), assignment: diane, sessions: [], date: "2027-01-01", readiness: null, skippedTo: { week: 0, day: 0 } });
    expect(workoutOf(t)?.workout.id).toBe("session-b");
  });

  it("the 6th trained week is a deload: 60% of the sets at 60% of the weight", () => {
    // Five trained weeks, with a week away in the middle that doesn't count
    const sessions = ["2027-01-01", "2027-01-04", "2027-01-11", "2027-01-25", "2027-02-01"]
      .map((d) => done(d, "session-b", { "back-squat": [40, [5, 5, 5, 5, 5]] }));
    const t = workoutOf(today({ programme: block1(), assignment: diane, sessions, date: "2027-02-08", readiness: "green" }))!;
    expect(t.block).toEqual({ number: 1, week: 6, length: 6, restartFrom: null, canSkip: false });
    expect(t.deload).toBe(true);
    expect(t.workout.items[0]!.slots[0]!.sets).toBe(3);
    expect(target(t, "back-squat").kg).toBe(25.5);
    expect(target(t, "plank").kg).toBeNull();
  });

  it("a deload week the person started applies the programme's deload, only if it has one", () => {
    const sessions = [done("2027-01-01", "session-a", { "back-squat": [40, [5, 5, 5, 5, 5]] }), done("2027-01-04", "session-b", {})];
    const t = today({ programme: block1(), assignment: diane, sessions, date: "2027-01-08", readiness: "green", deloadWeek: true });
    expect(workoutOf(t)!.deload).toBe(true);
    expect(target(t, "back-squat")).toMatchObject({ kg: 25.5 });
    const none = { ...block1(), phases: block1().phases.map((ph) => ({ ...ph, blocks: ph.blocks.map(({ deload: _d, ...b }) => b) })) } as Programme;
    const u = today({ programme: none, assignment: diane, sessions, date: "2027-01-08", readiness: "green", deloadWeek: true });
    expect(workoutOf(u)!.deload).toBe(false);
  });

  it("programmes set to repeat the weights target what was lifted last time", () => {
    const sessions = [done("2027-01-01", "session-a", { "back-squat": [42.5, [5, 5, 5, 5, 5]] }), done("2027-01-04", "session-b", {})];
    const t = today({ programme: { ...block1(), weights: "repeat" }, assignment: diane, sessions, date: "2027-01-08", readiness: "green" });
    expect(target(t, "back-squat")).toMatchObject({ kg: 42.5, why: "no change" });
  });

  it("after a deload week, weights pick up from before it, not from the lighter deload sessions", () => {
    const sessions = [
      done("2027-02-05", "session-a", { "back-squat": [40, [5, 5, 5, 5, 5]] }),
      done("2027-02-08", "session-b", { "back-squat": [25.5, [5, 5, 5]] }, { deload: true }),
    ];
    const t = today({ programme: block1(), assignment: diane, sessions, date: "2027-02-15", readiness: "green" });
    expect(workoutOf(t)!.deload).toBe(false);
    expect(target(t, "back-squat")).toMatchObject({ kg: 42.5, why: "add" });
  });

  it("optional exercises appear from their unlock week; a group that loses some reshapes", () => {
    const p = block1();
    p.workouts[0]!.items[3]!.slots[1]!.optional = { unlock: { fromWeek: 3 } };
    p.workouts[0]!.items[3]!.slots[2]!.optional = { unlock: { fromWeek: 3 } };
    p.workouts[0]!.items[1]!.slots[1]!.optional = { unlock: { fromWeek: 3 } };
    p.workouts[0]!.items[2]!.slots[0]!.optional = { unlock: { fromWeek: 3 } };
    const early = workoutOf(today({ programme: p, assignment: diane, sessions: [], date: "2027-01-01", readiness: null }))!;
    expect(early.workout.items.map((i) => `${i.type}:${i.slots.length}`)).toEqual(["single:1", "single:1", "single:1"]);
    expect(early.workout.items[1]!.slots[0]!.sets).toBe(5);
    p.workouts[0]!.items[3]!.slots[2]!.optional = undefined;
    const mid = workoutOf(today({ programme: p, assignment: diane, sessions: [], date: "2027-01-01", readiness: null }))!;
    expect(mid.workout.items.at(-1)!.type).toBe("giant");
    const later = workoutOf(today({ programme: p, assignment: diane, sessions: [], date: "2027-01-15", readiness: null }))!;
    expect(later.workout.items).toHaveLength(4);
  });

  it("uses a slot's own increment, and none-progressions stay put", () => {
    const p = block1();
    p.workouts[0]!.items[0]!.slots[0]!.incrementKg = 5;
    p.workouts[0]!.items[2]!.slots[0]!.progression = "nope";
    const sessions = [done("2027-01-01", "session-b", { "back-squat": [30, [5, 5, 5, 5, 5]], "romanian-deadlift": [30, [6, 6, 6]] })];
    const t = today({ programme: p, assignment: { startDate: "2027-01-01" }, sessions, date: "2027-01-05", readiness: null });
    expect(target(t, "back-squat")).toMatchObject({ kg: 35, why: "add" });
    expect(target(t, "romanian-deadlift")).toMatchObject({ kg: 30, why: "no change" });
  });

  it("a slot starting at the empty bar starts at that bar's weight", () => {
    const p = block1();
    p.workouts[0]!.items[0]!.slots[0]!.start = { kg: "bar" };
    p.workouts[0]!.items[1]!.slots[0]!.start = { kg: "bar" };
    p.exercises.find((e) => e.id === "bench-press")!.bar = "bar-missing";
    const t = today({ programme: p, assignment: { startDate: "2027-01-01" }, sessions: [], date: "2027-01-01", readiness: null });
    expect(target(t, "back-squat").kg).toBe(20);
    expect(target(t, "bench-press").kg).toBeNull();
  });

  it("an exercise measured by distance or calories aims for its metres or calories", () => {
    const p = block1();
    p.exercises.find((e) => e.id === "plank")!.measure = "calories";
    p.workouts[0]!.items[3]!.slots[1] = { exercise: "plank", progression: "none", calories: { min: 10, max: 12 } };
    const t = today({ programme: p, assignment: diane, sessions: [], date: "2027-01-01", readiness: null });
    expect(target(t, "plank").reps).toEqual({ min: 10, max: 12 });
    const carryDay = today({ programme: p, assignment: diane, sessions: [done("2027-01-01", "session-a", {})], date: "2027-01-04", readiness: null });
    expect(target(carryDay, "farmers-carry").reps).toEqual({ min: 30, max: 30 });
    p.workouts[0]!.items[3]!.slots[1] = { exercise: "plank", progression: "none" };
    expect(target(today({ programme: p, assignment: diane, sessions: [], date: "2027-01-01", readiness: null }), "plank").reps).toEqual({ min: 1, max: 1 });
  });
});

describe("today, set days", () => {
  const p = () => setMode(block1(), "setDays");

  it("a workout day, and a day without one", () => {
    expect(workoutOf(today({ programme: p(), assignment: diane, sessions: [], date: "2027-01-04", readiness: null }))?.workout.id).toBe("session-a");
    expect(today({ programme: p(), assignment: diane, sessions: [], date: "2027-01-05", readiness: null })).toEqual({ kind: "day", day: { type: "free" }, week: 0 });
  });
});

describe("history in this programme", () => {
  const sessions: LoggedSession[] = [
    done("2027-01-04", "session-b", { "back-squat": [32.5, [5, 5, 5, 5, 5]] }),
    done("2027-01-01", "session-a", { "back-squat": [30, [5, 5, 5, 5, 5]] }),
    done("2026-12-20", "session-a", { "back-squat": [50, [5]] }),
    done("2027-01-02", "other", { "back-squat": [80, [5]] }, { programme: { id: "other", week: 1 } }),
    done("2027-01-03", "session-a", { "back-squat": [90, [5]] }, { status: "active" }),
    { ...done("2027-01-05", "session-a", { "back-squat": [99, [5]] }), exercises: [{ exercise: "back-squat", removed: true, sets: [] }] },
  ];

  it("counts only finished sessions of this programme since the start, most recent first, ignoring removed exercises", () => {
    expect(historyOf(block1(), diane, sessions, "back-squat").map((h) => h.sets[0]!.kg)).toEqual([32.5, 30]);
  });

  it("marks days by what readiness did to progression", () => {
    const red = [done("2027-01-02", "session-a", { "back-squat": [30, [5]] }, { readiness: "red" })];
    expect(historyOf(block1(), diane, red, "back-squat")[0]!.day).toBe("skip");
    const none = [done("2027-01-02", "session-a", { "back-squat": [30, [5]] }, { readiness: null })];
    expect(historyOf(block1(), diane, none, "back-squat")[0]!.day).toBe("normal");
    const noLevels = block1();
    noLevels.readiness = { preset: "freshness" } as Programme["readiness"];
    expect(historyOf(noLevels, diane, red, "back-squat")[0]!.day).toBe("normal");
  });

  it("finds where the last ad hoc workout sat, newest first; none for set days", () => {
    expect(lastPosition(block1(), [])).toBeNull();
    expect(lastPosition(block1(), sessions)).toEqual({ week: 0, day: 0 });
    const later = [done("2027-02-01", "session-b", {}, { programme: { id: "strength-block-1", week: 9 } }), ...sessions];
    expect(lastPosition(block1(), later)).toEqual({ week: 0, day: 1 });
    expect(lastPosition(setMode(block1(), "setDays"), sessions)).toBeNull();
  });
});

describe("set days: another day's workout, and workouts already done", () => {
  const p = () => {
    const q = setMode(block1(), "setDays");
    return q;
  };

  it("a workout done today shows as done, and can be done again", () => {
    const sessions = [done("2027-01-04", "session-a", {})];
    expect(today({ programme: p(), assignment: diane, sessions, date: "2027-01-04", readiness: null })).toEqual({ kind: "done", workout: "session-a", date: "2027-01-04" });
    const again = today({ programme: p(), assignment: diane, sessions, date: "2027-01-04", readiness: null, chosen: "session-a" });
    expect(workoutOf(again)?.workout.id).toBe("session-a");
  });

  it("Thursday's workout done early on Tuesday shows as done on Thursday; last week's doesn't count", () => {
    const sessions = [done("2027-01-05", "session-b", {}), done("2026-12-31", "session-b", {})];
    expect(today({ programme: p(), assignment: diane, sessions, date: "2027-01-07", readiness: null })).toEqual({ kind: "done", workout: "session-b", date: "2027-01-05" });
    expect(workoutOf(today({ programme: p(), assignment: diane, sessions: [sessions[1]!], date: "2027-01-07", readiness: null }))?.workout.id).toBe("session-b");
  });

  it("any workout can be chosen on a day without one, in its own week of the cycle", () => {
    let q = setWeekCount(p(), 2);
    const t = workoutOf(today({ programme: q, assignment: diane, sessions: [], date: "2027-01-05", readiness: null, chosen: "session-b-2" }))!;
    expect(t.workout.id).toBe("session-b-2");
    expect(t.position.week).toBe(1);
    q = p();
    expect(workoutOf(today({ programme: q, assignment: diane, sessions: [], date: "2027-01-05", readiness: null, chosen: "session-b" }))?.position.week).toBe(0);
    q.workouts.push({ id: "spare", name: "Spare", items: q.workouts[0]!.items });
    expect(workoutOf(today({ programme: q, assignment: diane, sessions: [], date: "2027-01-05", readiness: null, chosen: "spare" }))?.position.week).toBe(0);
    expect(today({ programme: p(), assignment: diane, sessions: [], date: "2027-01-05", readiness: null, chosen: "nope" }).kind).toBe("day");
  });
});
