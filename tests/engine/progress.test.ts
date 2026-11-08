import { describe, expect, it } from "vitest";
import { addDays, calendarWeeks, liftSeries, liftsLogged, weeklyChange, type SessionForProgress } from "../../src/engine/progress.ts";

const s = (id: string, date: string, ex: Record<string, Array<[number | undefined, number | undefined, boolean?]>>, status: "done" | "active" = "done"): SessionForProgress => ({
  id, date, status,
  exercises: Object.entries(ex).map(([exercise, sets]) => ({ exercise, name: exercise === "back-squat" ? "Back squat" : exercise, sets: sets.map(([kg, reps, done = true]) => ({ kg, reps, done })) })),
});

const sessions = [
  s("c", "2027-01-08", { "back-squat": [[35, 5], [40, 3], [45, 1, false]] }),
  s("a", "2027-01-01", { "back-squat": [[30, 5], [30, 5]], deadlift: [[55, 5]] }),
  s("b", "2027-01-04", { "back-squat": [[60, 20]], plank: [[undefined, 30]] }),
  s("d", "2027-01-10", { "back-squat": [[50, 5]] }, "active"),
];

describe("lift progress", () => {
  it("takes each finished session's best estimated one-rep max, oldest first", () => {
    expect(liftSeries(sessions, "back-squat")).toEqual([
      { date: "2027-01-01", session: "a", e1rm: 35.3, heaviest: 30, best: { kg: 30, reps: 5 }, sets: 2 },
      { date: "2027-01-04", session: "b", e1rm: null, heaviest: 60, best: { kg: 60, reps: 20 }, sets: 1 },
      { date: "2027-01-08", session: "c", e1rm: 44.4, heaviest: 40, best: { kg: 40, reps: 3 }, sets: 2 },
    ]);
  });

  it("ignores sets without weight or reps, unticked sets, and sessions under way", () => {
    expect(liftSeries(sessions, "plank")).toEqual([]);
    expect(liftSeries([s("z", "2027-01-01", { deadlift: [[60, undefined]] })], "deadlift")).toEqual([]);
    expect(liftSeries([s("x", "2027-01-01", { deadlift: [[60, 5], [60, 5]] }), s("y", "2027-01-01", { deadlift: [[62.5, 5]] })], "deadlift").map((p) => p.session)).toEqual(["x", "y"]);
  });

  it("lists lifts logged, most recent first", () => {
    expect(liftsLogged(sessions)).toEqual([
      { exercise: "back-squat", name: "Back squat", sessions: 3, last: "2027-01-08" },
      { exercise: "deadlift", name: "deadlift", sessions: 1, last: "2027-01-01" },
    ]);
    expect(liftsLogged([s("p", "2027-01-02", { b: [[10, 5]] }), s("q", "2027-01-02", { a: [[10, 5]] })]).map((x) => x.exercise)).toEqual(["a", "b"]);
    const renamed = [s("new", "2027-02-01", { a: [[10, 5]] }), s("old", "2027-01-01", { a: [[10, 5]] })];
    renamed[0]!.exercises[0]!.name = "New name";
    renamed[1]!.exercises[0]!.name = "Old name";
    expect(liftsLogged(renamed)).toEqual([{ exercise: "a", name: "New name", sessions: 2, last: "2027-02-01" }]);
    const mixed = [s("1", "2027-01-02", { m: [[1, 1]] }), s("2", "2027-01-03", { n: [[1, 1]] }), s("3", "2027-01-01", { o: [[1, 1]] }), s("4", "2027-01-04", { p: [[1, 1]] })];
    expect(liftsLogged(mixed).map((x) => x.exercise)).toEqual(["p", "n", "m", "o"]);
    expect(liftsLogged([...renamed].reverse())).toEqual([{ exercise: "a", name: "New name", sessions: 2, last: "2027-02-01" }]);
  });
});

describe("calendar and change", () => {
  it("shows 4 weeks, Monday first, ending with this week", () => {
    const w = calendarWeeks("2027-01-07");
    expect(w).toHaveLength(4);
    expect(w[3]).toEqual(["2027-01-04", "2027-01-05", "2027-01-06", "2027-01-07", "2027-01-08", "2027-01-09", "2027-01-10"]);
    expect(w[0]![0]).toBe("2026-12-14");
    expect(addDays("2027-01-31", 1)).toBe("2027-02-01");
  });

  it("works out change per week over at least two weeks", () => {
    expect(weeklyChange([{ date: "2027-01-01", value: 70 }, { date: "2027-01-29", value: 72 }])).toBe(0.5);
    expect(weeklyChange([{ date: "2027-01-01", value: 70 }, { date: "2027-01-08", value: 72 }])).toBeNull();
    expect(weeklyChange([{ date: "2027-01-01", value: 70 }])).toBeNull();
  });
});
