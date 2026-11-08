import { describe, expect, it } from "vitest";
import { addDays, bodyweightView, calendarWeeks, liftSeries, liftsLogged, paceRange, paceStatus, targetPace, weeklyChange, type SessionForProgress } from "../../src/engine/progress.ts";
import { bodyweightPaceRules } from "./bodyweight.rules.ts";

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

describe(bodyweightPaceRules.title, () => {
  for (const r of bodyweightPaceRules.rows) {
    it(r.case, () => {
      const start = { date: "2026-11-07", kg: r.given.start };
      const pace = targetPace(r.given.start, r.given.goal);
      const latest = { date: addDays(start.date, r.given.weeks * 7), kg: r.given.latest };
      const [lo, hi] = paceRange(pace, start, latest.date);
      expect(`${lo} to ${hi}kg: ${paceStatus(pace, start, latest)}`).toBe(r.expected);
    });
  }
});

describe("bodyweight view", () => {
  const w = (date: string, kg: number) => ({ date, kg });
  const phase1 = { kg: 77, by: "2026-12-27", label: "End Phase 1" };
  const phase2 = { kg: 79.5, by: "2027-03-28", label: "End Phase 2" };

  it("has nothing to draw without goals", () => {
    const none = { anchor: null, pace: null, until: null, band: [], shown: [], next: null, status: null };
    expect(bodyweightView([w("2026-11-07", 75.7)], undefined, "2026-11-08")).toEqual(none);
    expect(bodyweightView([w("2026-11-07", 75.7)], { start: "2026-11-07", goals: [] }, "2026-11-08")).toEqual(none);
  });

  it("starts the cone at the weigh-in when the goal was set and runs a week past the next goal", () => {
    const v = bodyweightView([w("2026-11-07", 75.7)], { start: "2026-11-07", goals: [phase2, phase1] }, "2026-11-08");
    expect(v.anchor).toEqual(w("2026-11-07", 75.7));
    expect(v.pace).toEqual({ aim: "gain", low: 0.5, high: 1, spread: 0 });
    expect(v.until).toBe("2027-01-03");
    expect(v.shown).toEqual([phase1]);
    expect(v.band).toEqual([{ date: "2026-11-07", lo: 75.7, hi: 75.7 }, { date: "2027-01-03", lo: 76.6, hi: 77.6 }]);
    expect(v.next).toEqual({ goal: phase1, toGo: 1.3, weeks: 7, perWeek: 0.19, reached: false });
    expect(v.status).toBeNull();
  });

  it("says where the latest weigh-in sits, and when a goal is reached", () => {
    const list = [w("2026-10-01", 74), w("2026-11-07", 75.7), w("2026-12-05", 77.2)];
    const v = bodyweightView(list, { start: "2026-11-08", goals: [phase1] }, "2026-12-06");
    expect(v.anchor).toEqual(w("2026-11-07", 75.7));
    expect(v.status).toBe("above");
    expect(v.next).toMatchObject({ toGo: -0.2, reached: true });
    expect(v.until).toBe("2027-01-03");
  });

  it("uses the first weigh-in after the start when there was none before", () => {
    const v = bodyweightView([w("2026-11-10", 80), w("2026-11-24", 79)], { start: "2026-11-08", goals: [{ kg: 75, by: "2026-11-24" }] }, "2026-11-24");
    expect(v.anchor).toEqual(w("2026-11-10", 80));
    expect(v.pace?.aim).toBe("lose");
    expect(v.status).toBe("within");
    expect(v.next).toEqual({ goal: { kg: 75, by: "2026-11-24" }, toGo: -4, weeks: 0, perWeek: null, reached: false });
  });

  it("still lists goals with no weigh-ins yet, and keeps past goals on the chart", () => {
    const v = bodyweightView([], { start: "2026-11-08", goals: [phase1] }, "2026-11-08");
    expect(v).toMatchObject({ anchor: null, band: [], next: null, shown: [phase1], until: "2027-01-03" });
    const later = bodyweightView([w("2026-11-07", 75.7), w("2027-02-01", 77.5)], { start: "2026-11-07", goals: [phase1] }, "2027-02-01");
    expect(later.next).toBeNull();
    expect(later.shown).toEqual([phase1]);
    expect(later.until).toBe("2027-02-22");
    const future = bodyweightView([w("2027-02-10", 77.5)], { start: "2027-02-10", goals: [phase1] }, "2027-02-01");
    expect(future.until).toBe("2027-03-24");
  });
});
