import { describe, expect, it } from "vitest";
import {
  addDay, addExercises, copyWeek, group, groupOf, moveDay, moveItem, moveSlot, newProgramme, parseRange, formatRange, pruneWorkouts,
  removeDay, removeExercises, renameWorkout, setDay, setMinRestDays, setMode, setWeekCount, spreadDays, startKg, updateItem, updateSlot,
  weekWorkouts, duplicateWorkout, slug, placesOf, setCheckStyle, amberChoices, setAmber, setLevelDescription, setCheck48h, CHECK_TEMPLATE, setWeightsMode, deloadOf, setDeload, DEFAULT_DELOAD, slotProgression, setSlotProgression, progressionSummary, startingWeights, ownWeights,
} from "../../src/build/model.ts";
import { asFile, asProgramme, type Programme } from "../../src/formats/programme.ts";
import { checkAgainstLibrary, validateProgramme } from "../../src/formats/validate.js";
import { equipment, library } from "../../src/store/household.ts";
import { BLOCK1 } from "../helpers/block1.ts";

const block1 = () => structuredClone(asProgramme(BLOCK1));
const problems = (p: Programme) => [...validateProgramme(asFile(p)), ...checkAgainstLibrary(asFile(p), library, equipment)];
const now = new Date("2026-11-07T12:00:00Z");
const add = (p: Programme, w: string, ids: string[]) => addExercises(p, w, ids, library, equipment);
const shape = (p: Programme, w: string) =>
  p.workouts.find((x) => x.id === w)!.items.map((i) => `${i.type}:${i.slots.map((s) => s.exercise).join("+")}`);

describe("a new programme", () => {
  it("starts with one week and an empty Day 1, and is valid once it has an exercise", () => {
    let p = newProgramme("Andrew's strength", ["strength-block-1"], now);
    expect(p.id).toBe("andrew-s-strength");
    expect(p.plan).toEqual({ mode: "adhoc", weeks: [{ workouts: ["day-1"] }] });
    expect(problems(p).join()).toContain("/exercises must NOT have fewer than 1 items");
    p = add(p, "day-1", ["back-squat", "plank", "farmers-carry"]);
    expect(problems(p)).toEqual([]);
  });

  it("adds exercises standing alone, with 3 sets and a target for how they're measured", () => {
    const p = add(newProgramme("P", [], now), "day-1", ["back-squat", "plank", "farmers-carry", "back-squat"]);
    const [squat, plank, carry] = p.workouts[0]!.items;
    expect(squat).toEqual({ type: "single", tier: "secondary", slots: [{ exercise: "back-squat", sets: 3, progression: "linear-2-5", reps: { min: 8, max: 8 }, start: { kg: "bar" } }] });
    expect(plank!.slots[0]).toMatchObject({ seconds: { min: 30, max: 30 }, progression: "accessory" });
    expect(carry!.slots[0]).toMatchObject({ metres: { min: 20, max: 20 } });
    expect(p.workouts[0]!.items).toHaveLength(3);
    expect(p.equipment).toEqual([{ id: "bar-standard", name: "Standard barbell", barType: "standard", kg: 20 }]);
    expect(startKg(p, squat!.slots[0])).toBe(20);
  });

  it("refuses exercises that aren't in the library", () => {
    expect(() => add(newProgramme("P", [], now), "day-1", ["moon-squat"])).toThrow("isn't in the library");
  });
});

describe("pairing exercises", () => {
  const base = () => add(newProgramme("P", [], now), "day-1", ["back-squat", "bench-press", "barbell-row", "db-lateral-raise", "plank"]);

  it("two make a superset where the first of them was, in workout order", () => {
    const p = group(base(), "day-1", ["barbell-row", "bench-press"]);
    expect(shape(p, "day-1")).toEqual(["single:back-squat", "superset:bench-press+barbell-row", "single:db-lateral-raise", "single:plank"]);
    const ss = p.workouts[0]!.items[1]!;
    expect(ss).toMatchObject({ type: "superset", rounds: 3 });
    expect(ss.slots.every((s) => s.sets === undefined)).toBe(true);
    expect(problems(p)).toEqual([]);
  });

  it("three or more make a giant set", () => {
    const p = group(base(), "day-1", ["bench-press", "db-lateral-raise", "plank"]);
    expect(shape(p, "day-1")).toEqual(["single:back-squat", "giant:bench-press+db-lateral-raise+plank", "single:barbell-row"]);
    expect(problems(p)).toEqual([]);
  });

  it("taking one out of a giant set leaves a superset, and it stands alone again just after", () => {
    let p = group(base(), "day-1", ["bench-press", "db-lateral-raise", "plank"]);
    p = updateItem(p, "day-1", 1, { rounds: 4, restSec: 75 });
    p = group(p, "day-1", ["bench-press", "plank"]);
    expect(shape(p, "day-1")).toEqual(["single:back-squat", "superset:bench-press+plank", "single:db-lateral-raise", "single:barbell-row"]);
    expect(p.workouts[0]!.items[1]).toMatchObject({ rounds: 4, restSec: 75 });
    expect(p.workouts[0]!.items[2]!.slots[0].sets).toBe(4);
    expect(problems(p)).toEqual([]);
  });

  it("choosing one exercise of a superset splits it", () => {
    let p = group(base(), "day-1", ["bench-press", "barbell-row"]);
    p = group(p, "day-1", ["bench-press"]);
    expect(shape(p, "day-1")).toEqual(["single:back-squat", "single:barbell-row", "single:bench-press", "single:db-lateral-raise", "single:plank"]);
    expect(problems(p)).toEqual([]);
  });

  it("an exercise can move from one group to another", () => {
    let p = group(base(), "day-1", ["back-squat", "bench-press"]);
    p = group(p, "day-1", ["barbell-row", "db-lateral-raise", "bench-press"]);
    expect(shape(p, "day-1")).toEqual(["giant:bench-press+barbell-row+db-lateral-raise", "single:back-squat", "single:plank"]);
  });

  it("the group keeps the most important tier of what went in", () => {
    let p = updateItem(base(), "day-1", 0, { tier: "primary" });
    p = group(p, "day-1", ["back-squat", "plank"]);
    expect(p.workouts[0]!.items[0]).toMatchObject({ type: "superset", tier: "primary" });
  });

  it("choosing nothing changes nothing, and groupOf finds a group's exercises", () => {
    const p = group(base(), "day-1", ["bench-press", "barbell-row"]);
    expect(group(p, "day-1", [])).toEqual(p);
    expect(groupOf(p.workouts[0]!, "barbell-row")).toEqual(["bench-press", "barbell-row"]);
    expect(groupOf(p.workouts[0]!, "nope")).toEqual([]);
  });

  it("Block 1's groups survive an edit unchanged, finisher included", () => {
    const p = block1();
    const fin = structuredClone(p);
    fin.workouts[0]!.items[3] = { type: "finisher", tier: "tertiary", rounds: 8, workSec: 15, restSec: 45, slots: p.workouts[0]!.items[3]!.slots };
    const after = group(fin, "session-a", ["db-lateral-raise", "plank"]);
    expect(after.workouts[0]!.items[3]).toMatchObject({ type: "finisher", rounds: 8 });
  });
});

describe("removing and moving", () => {
  it("removing exercises shrinks groups, and drops exercises and bars nothing uses", () => {
    let p = block1();
    p = removeExercises(p, "session-a", ["barbell-row"]);
    expect(shape(p, "session-a")[1]).toBe("single:bench-press");
    expect(p.workouts[0]!.items[1]!.slots[0].sets).toBe(5);
    expect(p.exercises.some((e) => e.id === "barbell-row")).toBe(false);
    expect(p.targets?.some((t) => t.exercise === "barbell-row")).toBe(false);
    p = removeExercises(p, "session-a", ["db-lateral-raise", "plank", "battle-ropes"]);
    expect(shape(p, "session-a")).toHaveLength(3);
    expect(problems(p)).toEqual([]);
  });

  it("moves items, and exercises within a group", () => {
    let p = moveItem(block1(), "session-a", 0, 2);
    expect(shape(p, "session-a").slice(0, 3)).toEqual(["superset:bench-press+barbell-row", "single:romanian-deadlift", "single:back-squat"]);
    p = moveSlot(p, "session-a", 0, 1, 0);
    expect(shape(p, "session-a")[0]).toBe("superset:barbell-row+bench-press");
    expect(problems(p)).toEqual([]);
  });

  it("updates a slot's targets, and removes fields set to undefined", () => {
    let p = updateSlot(block1(), "session-a", { item: 0, slot: 0 }, { sets: 4, reps: { min: 3, max: 5 }, start: { kg: 32.5 } });
    expect(p.workouts[0]!.items[0]!.slots[0]).toMatchObject({ sets: 4, reps: { min: 3, max: 5 }, start: { kg: 32.5 } });
    p = updateSlot(p, "session-a", { item: 0, slot: 0 }, { start: undefined });
    expect("start" in p.workouts[0]!.items[0]!.slots[0]).toBe(false);
    p = updateItem(p, "session-a", 1, { restSec: null, tier: "primary" });
    expect(p.workouts[0]!.items[1]).not.toHaveProperty("restSec");
    p = updateItem(p, "session-a", 0, { rounds: 9 });
    expect(p.workouts[0]!.items[0]).not.toHaveProperty("rounds");
  });

  it("renames workouts, and complains about unknown ones", () => {
    expect(renameWorkout(block1(), "session-a", "Squat and bench").workouts[0]!.name).toBe("Squat and bench");
    expect(() => renameWorkout(block1(), "nope", "x")).toThrow('No workout "nope"');
    expect(() => duplicateWorkout(block1(), "nope")).toThrow('No workout "nope"');
  });
});

describe("the week planner", () => {
  it("ad hoc: adds, moves and removes days, up to 7", () => {
    let p = block1();
    p = addDay(p, 0);
    expect(weekWorkouts(p.plan, 0)).toEqual(["session-a", "session-b", "day-3"]);
    p = moveDay(p, 0, 2, 0);
    expect(weekWorkouts(p.plan, 0)).toEqual(["day-3", "session-a", "session-b"]);
    p = removeDay(p, 0, 0);
    expect(p.workouts.map((w) => w.id)).toEqual(["session-a", "session-b"]);
    for (let i = 0; i < 6; i++) p = addDay(p, 0);
    expect(weekWorkouts(p.plan, 0)).toHaveLength(7);
    expect(addDay(p, 0)).toBe(p);
  });

  it("set days: spreads ad hoc days through the week, and back again keeps the order", () => {
    let p = setMode(block1(), "setDays");
    expect(p.plan.mode).toBe("setDays");
    expect(weekWorkouts(p.plan, 0)).toEqual(["session-a", "session-b"]);
    if (p.plan.mode === "setDays") {
      expect(p.plan.weeks[0]!.days.mon).toEqual({ type: "workout", workout: "session-a" });
      expect(p.plan.weeks[0]!.days.thu).toEqual({ type: "workout", workout: "session-b" });
    }
    expect(problems(p)).toEqual([]);
    expect(setMode(p, "setDays")).toBe(p);
    p = setMode(p, "adhoc");
    expect(p.plan).toEqual({ mode: "adhoc", weeks: [{ workouts: ["session-a", "session-b"] }] });
  });

  it.each([[1, ["mon"]], [2, ["mon", "thu"]], [3, ["mon", "wed", "fri"]], [7, ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]])(
    "%i workouts spread over %j", (n, days) => { expect(spreadDays(n)).toEqual(days); },
  );

  it("set days: a weekday can be a new workout, an existing one, rest or a walk", () => {
    let p = setMode(block1(), "setDays");
    p = setDay(p, 0, "wed", { type: "workout" });
    expect(p.workouts.at(-1)).toMatchObject({ id: "wed", name: "Wed", items: [] });
    p = add(p, "wed", ["deadlift"]);
    p = setDay(p, 0, "sat", { type: "conditioning", activity: "Walk" });
    p = setDay(p, 0, "thu", { type: "rest" });
    expect(p.workouts.map((w) => w.id)).toEqual(["session-a", "wed"]);
    p = setDay(p, 0, "fri", { type: "workout", workout: "wed" });
    expect(problems(p)).toEqual([]);
    expect(() => setDay(block1(), 0, "mon", { type: "rest" })).toThrow("only exist in set days");
    expect(() => addDay(p, 0)).toThrow("added by weekday");
    expect(() => removeDay(p, 0, 0)).toThrow("Use setDay");
    expect(moveDay(p, 0, 0, 1)).toBe(p);
  });

  it("a second week copies the first, with its own workouts, so heavy and light weeks can differ", () => {
    let p = setWeekCount(block1(), 2);
    expect(weekWorkouts(p.plan, 1)).toEqual(["session-a-2", "session-b-2"]);
    p = removeExercises(p, "session-b-2", ["deadlift"]);
    p = add(p, "session-b-2", ["romanian-deadlift"]);
    expect(shape(p, "session-b")[0]).toBe("single:deadlift");
    expect(shape(p, "session-b-2").at(-1)).toBe("single:romanian-deadlift");
    expect(problems(p)).toEqual([]);
    p = setWeekCount(p, 9);
    expect(p.plan.weeks).toHaveLength(4);
    p = setWeekCount(p, 1);
    expect(p.workouts.map((w) => w.id)).toEqual(["session-a", "session-b"]);
  });

  it("copies a set-days week over another", () => {
    let p = setWeekCount(setMode(block1(), "setDays"), 2);
    p = setDay(p, 0, "sat", { type: "rest" });
    p = copyWeek(p, 0, 1);
    expect(weekWorkouts(p.plan, 1)).toHaveLength(2);
    expect(problems(p)).toEqual([]);
  });

  it("rest days between ad hoc workouts", () => {
    let p = setMinRestDays(block1(), 1);
    expect(p.plan).toMatchObject({ minRestDays: 1 });
    p = setMinRestDays(p, null);
    expect(p.plan).not.toHaveProperty("minRestDays");
    const sd = setMode(p, "setDays");
    expect(setMinRestDays(sd, 2)).toBe(sd);
  });

  it("keeps a workout used by a readiness rule", () => {
    const p = block1();
    p.readiness.levels!.red.rules = [{ rule: "replaceWorkout", workout: "session-b" } as never];
    (p.plan.weeks[0] as { workouts: string[] }).workouts = ["session-a"];
    expect(pruneWorkouts(p).workouts.map((w) => w.id)).toEqual(["session-a", "session-b"]);
  });
});

describe("reading what people type", () => {
  it.each([["8", { min: 8, max: 8 }], ["8-12", { min: 8, max: 12 }], [" 6 to 8 ", { min: 6, max: 8 }], ["30.5", { min: 30.5, max: 30.5 }], ["12-8", null], ["", null], ["lots", null]])(
    "%j", (text, range) => { expect(parseRange(text)).toEqual(range); },
  );
  it("shows ranges back", () => {
    expect([formatRange({ min: 5, max: 5 }), formatRange({ min: 8, max: 12 }), formatRange()]).toEqual(["5", "8-12", ""]);
    expect(slug("!!!", [], "x")).toBe("x");
  });
});

describe("default names follow the schedule", () => {
  it("Day 1, Day 2 become weekdays in set days, and back again; names you chose stay", () => {
    let p = addDay(addDay(newProgramme("P", [], now), 0), 0);
    p = renameWorkout(p, p.workouts[2]!.id, "Heavy deadlift");
    p = setMode(p, "setDays");
    expect(p.workouts.map((w) => w.name)).toEqual(["Mon", "Wed", "Heavy deadlift"]);
    expect(placesOf(p, p.workouts[1]!.id)).toEqual(["Wed"]);
    p = setMode(p, "adhoc");
    expect(p.workouts.map((w) => w.name)).toEqual(["Day 1", "Day 2", "Heavy deadlift"]);
    expect(placesOf(setWeekCount(p, 2), "day-1")).toEqual(["Week 1 Day 1"]);
  });
});

describe("the daily check", () => {
  it("starts from a template, matching Block 1's freshness check", () => {
    const p = setCheckStyle({ ...block1(), readiness: { preset: "off" } }, "freshness");
    const b = block1().readiness.levels!;
    expect({ ...p.readiness.levels!.amber, description: "" }).toEqual({ ...b.amber, description: "" });
    expect(p.readiness.levels!.green).toEqual(b.green);
    expect({ ...p.readiness.levels!.red, description: "" }).toEqual({ ...b.red, description: "" });
    expect(amberChoices(p)).toEqual({ mainSets: 3, halveAll: false, dropExtras: true, rir: 2, hold: false });
    expect(problems(p)).toEqual([]);
  });

  it("turns off, and back on from a fresh copy of the starting point", () => {
    const p = setCheckStyle(block1(), "freshness");
    expect(p.readiness.check48h).toBe(false);
    expect(setCheckStyle(p, "off").readiness).toEqual({ preset: "off" });
    expect(setCheckStyle(p, "freshness").readiness.levels).not.toBe(CHECK_TEMPLATE.levels);
    expect(setCheckStyle(p, "injury").readiness.preset).toBe("freshness");
  });

  it("Amber's choices write rules in a fixed order, keeping any others", () => {
    let p = setCheckStyle(block1(), "freshness");
    p.readiness.levels!.amber.rules.push({ rule: "swapFlagged", flag: "spineLoading" });
    p = setAmber(p, { mainSets: null, halveAll: true, dropExtras: false, rir: 1, hold: true });
    expect(p.readiness.levels!.amber.rules).toEqual([
      { rule: "setsPercent", percent: 50 }, { rule: "addRir", reps: 1 }, { rule: "swapFlagged", flag: "spineLoading" },
    ]);
    expect(p.readiness.levels!.amber.progressionOnThisDay).toBe("hold");
    expect(amberChoices(p)).toEqual({ mainSets: null, halveAll: true, dropExtras: false, rir: 1, hold: true });
  });

  it("wording and the 48-hour check can be changed; with the check off there's nothing to change", () => {
    let p = setLevelDescription(setCheckStyle(block1(), "freshness"), "green", "Go");
    p = setCheck48h(p, true);
    expect(p.readiness.levels!.green.description).toBe("Go");
    expect(p.readiness.check48h).toBe(true);
    const off = setCheckStyle(block1(), "off");
    expect(setAmber(off, amberChoices(off))).toBe(off);
    expect(setLevelDescription(off, "red", "x")).toBe(off);
    expect(amberChoices(off)).toEqual({ mainSets: null, halveAll: false, dropExtras: false, rir: null, hold: false });
  });
});

describe("weights and deloads", () => {
  it("switches between suggesting the next step and repeating last time", () => {
    const p = setWeightsMode(block1(), "repeat");
    expect(p.weights).toBe("repeat");
    expect(setWeightsMode(p, "progress")).not.toHaveProperty("weights");
  });

  it("reads and writes the deload", () => {
    expect(deloadOf(block1())).toEqual({ onDemand: false, everyWeeks: 6, loadPercent: 60, setsPercent: 60, restartWeek: null });
    let p = setDeload(block1(), { onDemand: true, everyWeeks: null, ...DEFAULT_DELOAD });
    expect(p.phases[0]!.blocks[0]!.deload).toEqual({ onDemand: true, setsPercent: 50, loadPercent: 60, restartWeek: 2 });
    expect(problems(p)).toEqual([]);
    expect(setDeload(p, { onDemand: true, everyWeeks: 5, loadPercent: 70, setsPercent: 40, restartWeek: null }).phases[0]!.blocks[0]!.deload)
      .toEqual({ onDemand: true, everyWeeks: 5, setsPercent: 40, loadPercent: 70 });
    p = setDeload(p, null);
    expect(p.phases[0]!.blocks[0]).not.toHaveProperty("deload");
    expect(deloadOf(p)).toBeNull();
    expect(deloadOf(setDeload(p, { onDemand: false, everyWeeks: null, ...DEFAULT_DELOAD }))).toBeNull();
    const none = { ...block1(), phases: [] } as unknown as Programme;
    expect(setDeload(none, null)).toBe(none);
  });
});

describe("how each exercise progresses", () => {
  const squat = { item: 0, slot: 0 };
  const row = { item: 1, slot: 1 };

  it("reads each exercise's progression", () => {
    expect(slotProgression(block1(), "session-a", squat)).toEqual({ style: "linear", jumpKg: 2.5, stall: { misses: 2, reducePercent: 10 } });
    expect(slotProgression(block1(), "session-a", row)).toMatchObject({ style: "double", jumpKg: 2.5 });
    expect(slotProgression(block1(), "session-a", { item: 9, slot: 0 })).toEqual({ style: "none", jumpKg: 2.5, stall: null });
  });

  it("changes one exercise, reusing a matching rule or adding one, and tidies unused rules away", () => {
    let p = setSlotProgression(block1(), "session-a", squat, { style: "linear", jumpKg: 5, stall: null });
    const id = p.workouts[0]!.items[0]!.slots[0]!.progression;
    expect(p.progressions.find((r) => r.id === id)).toEqual({ id, type: "linear", incrementKg: 5, holdIfRpeAtLeast: 9 });
    expect(slotProgression(p, "session-a", squat)).toEqual({ style: "linear", jumpKg: 5, stall: null });
    // The bench, still on the original rule, is untouched
    expect(slotProgression(p, "session-a", { item: 1, slot: 0 })).toMatchObject({ jumpKg: 2.5 });
    expect(problems(p)).toEqual([]);

    // Back to the original: the shared rule is reused and the one-off goes
    p = setSlotProgression(p, "session-a", squat, { style: "linear", jumpKg: 2.5, stall: { misses: 2, reducePercent: 10 } });
    expect(p.workouts[0]!.items[0]!.slots[0]!.progression).toBe("linear-2-5");
    expect(p.progressions.map((r) => r.id)).toEqual(block1().progressions.map((r) => r.id));

    p = setSlotProgression(p, "session-a", row, { style: "topSetBackoff", jumpKg: 2.5, stall: null });
    expect(p.progressions.at(-1)).toMatchObject({ type: "topSetBackoff", incrementKg: 2.5, topRpe: 8, backoffPercent: 85 });
    p = setSlotProgression(p, "session-a", row, { style: "topSetBackoff", jumpKg: 5, stall: { misses: 3, reducePercent: 5 } });
    expect(p.progressions.at(-1)).toMatchObject({ type: "topSetBackoff", incrementKg: 5, topRpe: 8, backoffPercent: 85, stall: { misses: 3, reducePercent: 5 } });
    p = setSlotProgression(p, "session-a", row, { style: "none", jumpKg: 5, stall: null });
    expect(p.workouts[0]!.items[1]!.slots[1]!.progression).toBe("none");
    expect(problems(p)).toEqual([]);
    expect(setSlotProgression(p, "nope", row, { style: "none", jumpKg: 1, stall: null })).toBe(p);
  });

  it("a per-exercise jump in the file is folded into the rule", () => {
    const p = block1();
    p.workouts[0]!.items[0]!.slots[0]!.incrementKg = 5;
    expect(slotProgression(p, "session-a", squat).jumpKg).toBe(5);
    const q = setSlotProgression(p, "session-a", squat, slotProgression(p, "session-a", squat));
    expect(q.workouts[0]!.items[0]!.slots[0]).not.toHaveProperty("incrementKg");
    expect(slotProgression(q, "session-a", squat).jumpKg).toBe(5);
  });

  it("says what happens next time", () => {
    expect(progressionSummary({ style: "linear", jumpKg: 2.5, stall: { misses: 2, reducePercent: 10 } })).toBe("+2.5kg when you hit your reps. After 2 misses, drop 10%");
    expect(progressionSummary({ style: "double", jumpKg: 1, stall: { misses: 1, reducePercent: 5 } })).toBe("Reps to the top of the range, then +1kg. After 1 miss, drop 5%");
    expect(progressionSummary({ style: "topSetBackoff", jumpKg: 2.5, stall: null })).toBe("Top set +2.5kg, then lighter sets");
    expect(progressionSummary({ style: "none", jumpKg: 2.5, stall: null })).toBe("Stays the same");
    expect(progressionSummary({ style: "double", jumpKg: 1, stall: null }, "seconds")).toBe("Time to the top of the range, then +1kg");
    expect(progressionSummary({ style: "linear", jumpKg: 5, stall: null }, "metres")).toBe("+5kg when you hit your distance");
    expect(progressionSummary({ style: "linear", jumpKg: 5, stall: null }, "other")).toBe("+5kg when you hit your reps");
  });
});

describe("each person's starting weights", () => {
  it("lists weighted exercises once, in order, with the programme's weight; just the bar is the bar", () => {
    const p = block1();
    const list = startingWeights(p);
    expect(list[0]).toEqual({ exercise: "back-squat", name: "Back squat", kg: 30 });
    expect(new Set(list.map((s) => s.exercise)).size).toBe(list.length);
    expect(list.every((s) => typeof s.kg === "number")).toBe(true);
    p.workouts[0]!.items[0]!.slots[0]!.start = { kg: "bar" };
    expect(startingWeights(p)[0]!.kg).toBe(20);
    p.workouts[0]!.items[0]!.slots[0]!.start = {};
    expect(startingWeights(p).some((s) => s.exercise === "back-squat")).toBe(false);
  });

  it("keeps only weights that differ, rounded to 0.5kg", () => {
    const p = block1();
    expect(ownWeights(p, { "back-squat": 30, "bench-press": 27.3, deadlift: -1, nope: 10 })).toEqual({ "bench-press": { kg: 27.5 } });
  });
});
