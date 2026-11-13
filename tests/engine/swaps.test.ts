import { describe, expect, it } from "vitest";
import { canDo, swapOptions } from "../../src/engine/swaps.ts";
import type { JFDIHouseholdEquipment } from "../../src/formats/generated/equipment.ts";
import type { Exercise } from "../../src/formats/generated/library.ts";
import { bundledLibrary, equipment } from "../../src/store/household.ts";

const all = bundledLibrary.exercises;
const known = new Set(equipment.items.map((i) => i.id));
const ids = (xs: Exercise[]) => xs.map((x) => x.id);
const gym = (keep: (i: JFDIHouseholdEquipment["items"][number]) => boolean, extra: unknown[] = []): JFDIHouseholdEquipment =>
  ({ ...equipment, items: [...equipment.items.filter(keep), ...extra] } as JFDIHouseholdEquipment);

describe("swaps", () => {
  it("bench press: its own family first, then other pushes; never a squat", () => {
    const o = swapOptions("bench-press", all, equipment, known, new Set());
    expect(ids(o.family)).toEqual(["pause-bench-press", "close-grip-bench-press", "incline-bench-press", "floor-press", "db-bench-press", "incline-db-press"]);
    expect(ids(o.movement)).toContain("push-up");
    expect(ids(o.movement)).toContain("overhead-press");
    expect([...o.family, ...o.movement].every((e) => e.pattern === "push")).toBe(true);
  });

  it("leaves out what's already in the workout, and what the gym can't do", () => {
    // A hotel gym: dumbbells, a bench and a bar, but no rack
    const hotel = gym((i) => ["dumbbells", "abx-bench", "bar-beater", "plates-iron"].includes(i.id));
    const o = swapOptions("bench-press", all, hotel, known, new Set(["db-bench-press"]));
    expect(ids(o.family)).toEqual(["incline-db-press"]);
    expect(ids(o.movement)).toContain("push-up");
    expect(ids(o.movement)).not.toContain("dip");
  });

  it("what a gym can do: bars of the right type, dumbbells, plates, weighted kit and needed kit", () => {
    const byId = (id: string) => all.find((e) => e.id === id)!;
    const empty = gym(() => false);
    expect(canDo(byId("push-up"), empty, known)).toBe(true);
    expect(canDo(byId("overhead-press-ez"), empty, known)).toBe(false);
    expect(canDo(byId("overhead-press-ez"), gym((i) => i.id === "bar-ez"), known)).toBe(true);
    expect(canDo(byId("standing-db-press"), empty, known)).toBe(false);
    const own = { id: "own-x", name: "X", family: "own", measure: "load", implement: "plate", pattern: "push", requires: [] } as Exercise;
    expect(canDo(own, empty, known)).toBe(false);
    expect(canDo(own, gym((i) => i.kind === "plates"), known)).toBe(true);
    // A bar exercise with no bar types listed takes a standard bar
    expect(canDo({ ...own, implement: "barbell" }, gym((i) => i.id === "bar-ez"), known)).toBe(false);
    expect(canDo({ ...own, implement: "barbell" }, gym((i) => i.id === "bar-beater"), known)).toBe(true);
    const bells = { ...own, implement: "other", weights: "weights-kettlebells" } as Exercise;
    expect(canDo(bells, empty, known)).toBe(false);
    expect(canDo(bells, gym(() => false, [{ id: "weights-kettlebells", name: "Kettlebells", kind: "weights", weights: [] }]), known)).toBe(true);
    // Kit no gym has heard of isn't held against it
    expect(canDo({ ...own, implement: "other", requires: ["mystery"] }, empty, known)).toBe(true);
    expect(canDo({ ...own, implement: "other", requires: ["rack"] }, empty, known)).toBe(false);
  });

  it("an added exercise matches on movement unless it's like one of the app's", () => {
    const own = { id: "own-rollout", name: "Ab wheel rollout", family: "own", measure: "reps", implement: "other", pattern: "core", requires: [] } as Exercise;
    const other = { ...own, id: "own-other", name: "Other" };
    const lib = [...all, own, other];
    const o = swapOptions("own-rollout", lib, equipment, known, new Set());
    expect(o.family).toEqual([]);
    expect(ids(o.movement)).toContain("plank");
    expect(ids(o.movement)).toContain("own-other");
    const like = { ...own, family: "flexion-core" };
    expect(swapOptions("own-rollout", [...all, like], equipment, known, new Set()).family.length).toBeGreaterThan(0);
    expect(swapOptions("nothing", all, equipment, known, new Set())).toEqual({ family: [], movement: [] });
  });
});
