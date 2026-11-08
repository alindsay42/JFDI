// Progress: each lift's best set per session, and the calendar's weeks.
import { estimateOneRepMax } from "./estimate.ts";
import { daysBetween, mondayOf } from "./schedule.ts";

export interface LoggedSet { kg?: number; reps?: number; seconds?: number; metres?: number; done: boolean }
export interface SessionForProgress {
  id: string;
  date: string;
  status: "active" | "done";
  exercises: Array<{ exercise: string; name: string; removed?: unknown; sets: LoggedSet[] }>;
}

export interface LiftPoint {
  date: string;
  session: string;
  /** Best estimated one-rep max of the session's sets, or null when no set could be estimated */
  e1rm: number | null;
  /** Heaviest weight lifted for at least one rep */
  heaviest: number;
  /** The set behind the estimate (or the heaviest set when nothing could be estimated) */
  best: { kg: number; reps: number };
  sets: number;
}

/** Every finished session's best for one exercise, oldest first. Only ticked sets with weight and reps count. */
export function liftSeries(sessions: SessionForProgress[], exercise: string): LiftPoint[] {
  const points: LiftPoint[] = [];
  for (const s of sessions) {
    if (s.status !== "done") continue;
    const sets = s.exercises
      .filter((e) => e.exercise === exercise)
      .flatMap((e) => e.sets)
      .filter((x) => x.done && (x.kg ?? 0) > 0 && (x.reps ?? 0) > 0)
      .map((x) => ({ kg: x.kg!, reps: x.reps! }));
    if (!sets.length) continue;
    let best: { kg: number; reps: number } | null = null;
    let e1rm: number | null = null;
    for (const x of sets) {
      const e = estimateOneRepMax(x.kg, x.reps);
      if (e !== null && (e1rm === null || e > e1rm)) { e1rm = e; best = x; }
    }
    const heaviest = Math.max(...sets.map((x) => x.kg));
    points.push({
      date: s.date, session: s.id, e1rm: e1rm === null ? null : Math.round(e1rm * 10) / 10, heaviest,
      best: best ?? sets.find((x) => x.kg === heaviest)!, sets: sets.length,
    });
  }
  return points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Exercises with weighted sets logged, most recently done first, with how many sessions each. */
export function liftsLogged(sessions: SessionForProgress[]): Array<{ exercise: string; name: string; sessions: number; last: string }> {
  const seen = new Map<string, { exercise: string; name: string; sessions: number; last: string }>();
  for (const s of sessions) {
    if (s.status !== "done") continue;
    for (const e of s.exercises) {
      if (!e.sets.some((x) => x.done && (x.kg ?? 0) > 0)) continue;
      const have = seen.get(e.exercise);
      if (!have) seen.set(e.exercise, { exercise: e.exercise, name: e.name, sessions: 1, last: s.date });
      else { have.sessions++; if (s.date > have.last) { have.last = s.date; have.name = e.name; } }
    }
  }
  return [...seen.values()].sort((a, b) => (a.last === b.last ? a.name.localeCompare(b.name) : a.last < b.last ? 1 : -1));
}

/** Four weeks of dates, Monday first, ending with the week of `anchor`. */
export function calendarWeeks(anchor: string, weeks = 4): string[][] {
  const lastMonday = mondayOf(anchor);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(lastMonday, (w - weeks + 1) * 7 + d)));
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Change per week between the first and last point, for a short summary. Null with fewer than 2 weeks apart. */
export function weeklyChange(points: Array<{ date: string; value: number }>): number | null {
  if (points.length < 2) return null;
  const first = points[0]!;
  const last = points.at(-1)!;
  const days = daysBetween(first.date, last.date);
  if (days < 14) return null;
  return Math.round(((last.value - first.value) / days) * 7 * 100) / 100;
}
