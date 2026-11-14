// How someone has been over the last few weeks: their check-ins, how they felt in the days after each
// workout, and how much they trained and walked, in total and week by week.
import { addDays } from "./progress.ts";
import { mondayOf } from "./schedule.ts";

export type Level = "green" | "amber" | "red";
export type After = "same" | "settling" | "worse";

export interface SessionForWellbeing {
  id: string;
  date: string;
  status: "active" | "done";
  readiness?: Level | null;
  check48h?: { status: After } | null;
  /** The workout's name */
  name: string;
}

export interface DayForWellbeing {
  date: string;
  readiness?: Level;
  activities?: Array<{ minutes?: number }>;
}

export interface Week {
  /** The Monday it starts */
  monday: string;
  checkIns: Record<Level, number>;
  workouts: number;
  /** Workouts felt clearly worse after */
  worse: number;
}

export interface HowYouveBeen {
  /** The first and last day it covers */
  from: string;
  to: string;
  /** Days checked in at each level */
  checkIns: Record<Level, number>;
  /** Answers to the 48-hour check */
  after: Record<After, number>;
  /** Workouts felt clearly worse after, newest first */
  worse: Array<{ date: string; session: string; name: string }>;
  workouts: number;
  walks: number;
  walkMinutes: number;
  /** Week by week, oldest first */
  weeks: Week[];
}

const levels = (): Record<Level, number> => ({ green: 0, amber: 0, red: 0 });

/**
 * The last `weeks` weeks to `today`, a whole week each, starting on Mondays. A day's check-in is the one
 * saved for the day, or else its workout's; each day counts once.
 */
export function howYouveBeen(sessions: SessionForWellbeing[], days: DayForWellbeing[], today: string, weeks: number): HowYouveBeen {
  const from = addDays(mondayOf(today), -7 * (weeks - 1));
  const within = (d: string) => d >= from && d <= today;
  const done = sessions.filter((s) => s.status === "done" && within(s.date));
  const byWeek = new Map<string, Week>();
  for (let i = 0; i < weeks; i++) {
    const monday = addDays(from, 7 * i);
    byWeek.set(monday, { monday, checkIns: levels(), workouts: 0, worse: 0 });
  }
  const week = (date: string) => byWeek.get(mondayOf(date))!;

  const level = new Map<string, Level>();
  for (const s of done) if (s.readiness && !level.has(s.date)) level.set(s.date, s.readiness);
  for (const d of days) if (d.readiness && within(d.date)) level.set(d.date, d.readiness);
  const checkIns = levels();
  for (const [date, l] of level) {
    checkIns[l]++;
    week(date).checkIns[l]++;
  }

  const after: Record<After, number> = { same: 0, settling: 0, worse: 0 };
  const worse: HowYouveBeen["worse"] = [];
  for (const s of done) {
    week(s.date).workouts++;
    const a = s.check48h?.status;
    if (!a) continue;
    after[a]++;
    if (a === "worse") {
      week(s.date).worse++;
      worse.push({ date: s.date, session: s.id, name: s.name });
    }
  }
  worse.sort((a, b) => b.date.localeCompare(a.date));

  const walking = days.filter((d) => within(d.date)).flatMap((d) => d.activities ?? []);
  return {
    from, to: today, checkIns, after, worse, workouts: done.length,
    walks: walking.length, walkMinutes: walking.reduce((n, w) => n + (w.minutes ?? 0), 0),
    weeks: [...byWeek.values()],
  };
}
