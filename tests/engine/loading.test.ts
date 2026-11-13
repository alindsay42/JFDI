import { describe, expect, it } from "vitest";
import { barbellLoads, barFor, dumbbellLoads, kitOf, loadsFor, snapKg, type Kit } from "../../src/engine/loading.ts";
import type { JFDIHouseholdEquipment } from "../../src/formats/generated/equipment.ts";
import { loadingRules } from "./loading.rules.ts";

const platesOf = (s: string) => s.split(", ").map((x) => { const [kg, count] = x.split("×").map(Number); return { kg: kg!, count: count! }; });

describe(loadingRules.title, () => {
  for (const r of loadingRules.rows) {
    it(r.case, () => {
      const loads = barbellLoads(r.given.bar, platesOf(r.given.plates).sort((a, b) => b.kg - a.kg));
      expect(snapKg(loads, r.given.target, r.given.going as "up" | "down" | "nearest")).toBe(r.expected);
    });
  }
});

const gym = (items: unknown[]): JFDIHouseholdEquipment => ({ format: "jfdi-equipment", formatVersion: 1, name: "Gym", items } as unknown as JFDIHouseholdEquipment);

describe("a gym's kit", () => {
  const home = gym([
    { id: "bar-a", name: "Bar", kind: "bar", barType: "standard", kg: 20 },
    { id: "bar-b", name: "Deadlift bar", kind: "bar", barType: "standard", kg: 20.5, preferredFor: ["deadlift"] },
    { id: "trap", name: "Trap", kind: "bar", barType: "trap", kg: 25 },
    { id: "p1", name: "Bumpers", kind: "plates", plates: [{ kg: 20, count: 4 }, { kg: 5, count: 2 }] },
    { id: "p2", name: "Iron", kind: "plates", plates: [{ kg: 5, count: 2 }, { kg: 1.25, count: 4 }] },
    { id: "db", name: "Dumbbells", kind: "dumbbells", pairsKg: [5, 7.5, 10, 12.5], unavailableKg: [7.5] },
    { id: "h", name: "Handles", kind: "dumbbells", kg: 2, count: 2 },
    { id: "h2", name: "Handles to weigh", kind: "dumbbells", count: 2 },
    { id: "rack", name: "Rack", kind: "rack" },
  ]);
  const kit = kitOf(home);

  it("pools plates across sets, and keeps the dumbbells that are there", () => {
    expect(kit.plates).toEqual([{ kg: 20, count: 4 }, { kg: 5, count: 4 }, { kg: 1.25, count: 4 }]);
    expect(kit.dumbbellPairs).toEqual([5, 10, 12.5]);
    expect(kit.handleKg).toBe(2);
    expect(kit.bars.map((b) => b.id)).toEqual(["bar-a", "bar-b", "trap"]);
  });

  it("picks the bar preferred for an exercise, else the first of its type", () => {
    expect(barFor(kit, "deadlift", "standard")?.kg).toBe(20.5);
    expect(barFor(kit, "back-squat", "standard")?.kg).toBe(20);
    expect(barFor(kit, "ssb-squat", "ssb")).toBeNull();
  });

  it("dumbbells: fixed pairs and loaded handles, with plates on both ends of both", () => {
    // 4 × 1.25kg is one per end of two dumbbells; 4 × 5kg likewise
    expect(dumbbellLoads(kit)).toEqual([2, 4.5, 5, 10, 12, 12.5, 14.5, 42, 44.5, 52, 54.5]);
  });

  it("which weights an exercise can be done at", () => {
    expect(loadsFor(kit, { id: "back-squat", implement: "barbell", barType: "standard" })?.slice(0, 4)).toEqual([20, 22.5, 25, 30]);
    expect(loadsFor(kit, { id: "ssb-squat", implement: "barbell", barType: "ssb", barKg: 32 })?.[0]).toBe(32);
    expect(loadsFor(kit, { id: "ssb-squat", implement: "barbell", barType: "ssb" })).toBeNull();
    expect(loadsFor(kit, { id: "x", implement: "barbell" })).toBeNull();
    expect(loadsFor(kit, { id: "curl", implement: "dumbbell" })).toEqual(dumbbellLoads(kit));
    expect(loadsFor(kit, { id: "pulldown", implement: "cable" })).toBeNull();
    expect(loadsFor(kit, { id: "plate-raise", implement: "plate" })).toEqual(kit.plates.map((p) => p.kg).sort((a, b) => a - b));
    const bare: Kit = { bars: [], plates: [], dumbbellPairs: [], handleKg: null };
    expect(loadsFor(bare, { id: "back-squat", implement: "barbell", barType: "standard", barKg: 20 })).toBeNull();
    expect(loadsFor(bare, { id: "curl", implement: "dumbbell" })).toBeNull();
    expect(loadsFor(bare, { id: "plate-raise", implement: "plate" })).toBeNull();
  });

  it("snaps up past the top or down below the bottom to what there is", () => {
    expect(snapKg([20, 25], 10, "down")).toBe(20);
    expect(snapKg([20, 25], 30, "up")).toBe(25);
  });
});

describe("targets snap to the gym's kit", async () => {
  const { today } = await import("../../src/engine/prescription.ts");
  const { asProgramme } = await import("../../src/formats/programme.ts");
  const { BLOCK1 } = await import("../helpers/block1.ts");
  const block1 = () => structuredClone(asProgramme(BLOCK1));
  const assignment = { startDate: "2027-01-01" };
  // No 1.25kg plates, so a barbell goes up in 5kg steps
  const fives = kitOf(gym([
    { id: "bar", name: "Bar", kind: "bar", barType: "standard", kg: 20 },
    { id: "light", name: "Squat bar", kind: "bar", barType: "standard", kg: 15, preferredFor: ["back-squat"] },
    { id: "p", name: "Plates", kind: "plates", plates: [{ kg: 20, count: 2 }, { kg: 10, count: 2 }, { kg: 5, count: 2 }, { kg: 2.5, count: 2 }] },
  ]));
  const squatAt = (kg: number, reps: number[], date: string) => ({
    date, status: "done" as const, readiness: "green" as const, programme: { id: "strength-block-1", week: 1 }, workout: "session-a",
    exercises: [{ exercise: "back-squat", sets: reps.map((r) => ({ kg, reps: r, done: true })) }],
  });
  const b = (date: string) => ({ ...squatAt(0, [], date), workout: "session-b", exercises: [] });
  const squat = (t: ReturnType<typeof today>) => (t.kind === "workout" ? t.targets["0.0"] : undefined);

  it("an increase rounds up, a stall drop rounds down", () => {
    const up = today({ programme: block1(), assignment, sessions: [squatAt(40, [5, 5, 5, 5, 5], "2027-01-01"), b("2027-01-04")], date: "2027-01-07", readiness: "green", kit: fives });
    expect(squat(up)).toMatchObject({ kg: 45, why: "add" });
    const stalled = [squatAt(45, [5, 5, 4, 4, 3], "2027-01-01"), b("2027-01-04"), squatAt(45, [5, 4, 4, 3, 3], "2027-01-07"), b("2027-01-10")];
    const down = today({ programme: block1(), assignment, sessions: stalled, date: "2027-01-13", readiness: "green", kit: fives });
    expect(squat(down)).toMatchObject({ kg: 40, why: "reduce: stalled" });
  });

  it("a deload rounds down; a just-the-bar start uses the gym's own bar", () => {
    const deload = today({ programme: block1(), assignment, sessions: [squatAt(42.5, [5, 5, 5, 5, 5], "2027-01-01"), b("2027-01-04")], date: "2027-01-07", readiness: "green", kit: fives, deloadWeek: true });
    expect(squat(deload)).toMatchObject({ kg: 25 });
    const p = block1();
    p.workouts[0]!.items[0]!.slots[0]!.start = { kg: "bar" };
    expect(squat(today({ programme: p, assignment, sessions: [], date: "2027-01-01", readiness: "green", kit: fives }))).toMatchObject({ kg: 15 });
    expect(squat(today({ programme: p, assignment, sessions: [], date: "2027-01-01", readiness: "green" }))).toMatchObject({ kg: 20 });
  });

  it("a top set's back-off sets snap too", () => {
    const p = block1();
    p.progressions.push({ id: "top", type: "topSetBackoff", incrementKg: 2.5, topRpe: 8, backoffPercent: 85 });
    p.workouts[0]!.items[0]!.slots[0]!.progression = "top";
    const sessions = [{ ...squatAt(40, [5, 5, 5], "2027-01-01"), exercises: [{ exercise: "back-squat", sets: [{ kg: 40, reps: 5, rpe: 7, done: true }, { kg: 34, reps: 5, done: true }] }] }, b("2027-01-04")];
    const t = today({ programme: p, assignment, sessions, date: "2027-01-07", readiness: "green", kit: fives });
    expect(squat(t)).toMatchObject({ kg: 45, backoffKg: 40 });
  });
});
