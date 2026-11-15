import { describe, expect, it } from "vitest";
import { howYouveBeen, type SessionForWellbeing } from "../../src/engine/wellbeing.ts";

const s = (date: string, extra: Partial<SessionForWellbeing> = {}): SessionForWellbeing =>
  ({ id: `s-${date}`, date, status: "done", name: "Session A", ...extra });

describe("how you've been", () => {
  // Saturday 14 November 2026: 4 weeks runs from Monday 19 October
  const today = "2026-11-14";

  it("covers whole weeks from a Monday, to today", () => {
    const h = howYouveBeen([], [], today, 4);
    expect(h).toMatchObject({ from: "2026-10-19", to: today, workouts: 0, walks: 0, walkMinutes: 0, worse: [] });
    expect(h.weeks.map((w) => w.monday)).toEqual(["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(howYouveBeen([], [], today, 1).from).toBe("2026-11-09");
  });

  it("counts each day's check-in once, the day's own before its workout's, and leaves out days outside", () => {
    const sessions = [
      s("2026-11-02", { readiness: "green" }),
      s("2026-11-04", { readiness: "amber" }),
      // Two workouts one day: counted once
      s("2026-11-06", { readiness: "green" }), s("2026-11-06", { id: "second", readiness: "amber" }),
      // Not finished, or too early
      s("2026-11-10", { status: "active", readiness: "green" }),
      s("2026-10-12", { readiness: "red" }),
    ];
    const days = [
      { date: "2026-11-04", readiness: "red" as const }, // changed to Red on the day: the day's own counts
      { date: "2026-11-11", readiness: "red" as const }, // a Red day, no workout
      { date: "2026-10-01", readiness: "red" as const },
      { date: "2026-11-12" },
    ];
    const h = howYouveBeen(sessions, days, today, 4);
    expect(h.checkIns).toEqual({ green: 2, amber: 0, red: 2 });
    expect(h.workouts).toBe(4);
    expect(h.weeks.map((w) => w.checkIns)).toEqual([
      { green: 0, amber: 0, red: 0 },
      { green: 0, amber: 0, red: 0 },
      { green: 2, amber: 0, red: 1 },
      { green: 0, amber: 0, red: 1 },
    ]);
    expect(h.weeks.map((w) => w.workouts)).toEqual([0, 0, 4, 0]);
  });

  it("sums the 48-hour answers and lists the clearly worse ones, newest first", () => {
    const sessions = [
      s("2026-10-27", { check48h: { status: "worse" }, name: "Session A" }),
      s("2026-10-29", { check48h: { status: "same" } }),
      s("2026-11-03", { check48h: { status: "settling" } }),
      s("2026-11-05", { check48h: { status: "worse" }, name: "Session B" }),
      s("2026-11-09", { check48h: null }),
    ];
    const h = howYouveBeen(sessions, [], today, 4);
    expect(h.after).toEqual({ same: 1, settling: 1, worse: 2 });
    expect(h.worse).toEqual([
      { date: "2026-11-05", session: "s-2026-11-05", name: "Session B" },
      { date: "2026-10-27", session: "s-2026-10-27", name: "Session A" },
    ]);
    expect(h.weeks.map((w) => w.worse)).toEqual([0, 1, 1, 0]);
  });

  it("counts walks and their minutes", () => {
    const days = [
      { date: "2026-11-01", activities: [{ minutes: 30 }, { minutes: 20 }] },
      { date: "2026-11-08", activities: [{}] },
      { date: "2026-10-01", activities: [{ minutes: 60 }] },
    ];
    expect(howYouveBeen([], days, today, 4)).toMatchObject({ walks: 3, walkMinutes: 50 });
  });
});
