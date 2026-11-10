// Progress: each lift's best set per session, and the calendar's weeks.
import { estimateOneRepMax } from "./estimate.ts";
import { daysBetween, mondayOf } from "./schedule.ts";

export interface LoggedSet { kg?: number; reps?: number; seconds?: number; metres?: number; calories?: number; done: boolean }
export interface SessionForProgress {
  id: string;
  date: string;
  status: "active" | "done";
  /** Done in a deload week */
  deload?: boolean;
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

// ----- Bodyweight goals and the target pace -----

export interface BodyweightGoal { kg: number; by: string; label?: string }
export interface BodyweightPlan { start: string; goals: BodyweightGoal[] }
export interface WeighInPoint { date: string; kg: number }

const MONTH_DAYS = 30.44;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * How fast is reasonable, in kg a month, as the lower and upper edge of the cone.
 * Gaining: +0.5 to +1kg a month, as in the Rebuild Log. Losing: 0.5% to 1% of bodyweight a week.
 * A goal within 0.5kg of the start is holding: a flat band 1kg either side.
 */
export interface Pace { aim: "gain" | "lose" | "hold"; low: number; high: number; spread: number }

export function targetPace(startKg: number, goalKg: number): Pace {
  const diff = goalKg - startKg;
  if (Math.abs(diff) < 0.5) return { aim: "hold", low: 0, high: 0, spread: 1 };
  if (diff > 0) return { aim: "gain", low: 0.5, high: 1, spread: 0 };
  const perMonth = (share: number) => round1(((startKg * share) / 7) * MONTH_DAYS);
  return { aim: "lose", low: -perMonth(0.01), high: -perMonth(0.005), spread: 0 };
}

/** The cone's lower and upper edge on a date, starting from a weigh-in. */
export function paceRange(pace: Pace, start: WeighInPoint, date: string): [number, number] {
  const months = daysBetween(start.date, date) / MONTH_DAYS;
  return [round1(start.kg + pace.low * months - pace.spread), round1(start.kg + pace.high * months + pace.spread)];
}

export type PaceStatus = "within" | "above" | "below";

/** Where a weigh-in sits against the cone. */
export function paceStatus(pace: Pace, start: WeighInPoint, w: WeighInPoint): PaceStatus {
  const [lo, hi] = paceRange(pace, start, w.date);
  return w.kg < lo ? "below" : w.kg > hi ? "above" : "within";
}

export interface BodyweightView {
  /** The weigh-in the cone starts from */
  anchor: WeighInPoint | null;
  pace: Pace | null;
  /** Last date the chart shows */
  until: string | null;
  band: Array<{ date: string; lo: number; hi: number }>;
  /** Goals that fall on the chart */
  shown: BodyweightGoal[];
  /** The next goal still ahead, and what it takes to get there from the latest weigh-in */
  next: { goal: BodyweightGoal; toGo: number; weeks: number; perWeek: number | null; reached: boolean } | null;
  /** Where the latest weigh-in sits, once there's one after the start */
  status: PaceStatus | null;
}

const byDate = (a: BodyweightGoal, b: BodyweightGoal) => a.by.localeCompare(b.by);

/**
 * Everything the bodyweight chart needs. The cone starts at the last weigh-in on or before the plan's start
 * (or the first after it), runs to the furthest goal's direction, and the chart shows up to a week past the
 * next goal (at least three weeks past today).
 */
export function bodyweightView(weighIns: WeighInPoint[], plan: BodyweightPlan | undefined, today: string): BodyweightView {
  const none: BodyweightView = { anchor: null, pace: null, until: null, band: [], shown: [], next: null, status: null };
  if (!plan || !plan.goals.length) return none;
  const goals = [...plan.goals].sort(byDate);
  const first = weighIns[0]?.date ?? today;
  const latest = weighIns.at(-1);
  const end = latest && latest.date > today ? latest.date : today;
  const ahead = goals.find((g) => g.by >= today);
  const candidates = [addDays(end, 21), addDays(first, 42), ...(ahead ? [addDays(ahead.by, 7)] : [])];
  const until = candidates.reduce((a, b) => (b > a ? b : a));
  const shown = goals.filter((g) => g.by >= first && g.by <= until);
  const anchor = [...weighIns].reverse().find((w) => w.date <= plan.start) ?? weighIns.find((w) => w.date > plan.start) ?? null;

  let next: BodyweightView["next"] = null;
  if (ahead && latest) {
    const toGo = round1(ahead.kg - latest.kg);
    const days = daysBetween(today, ahead.by);
    // With any weigh-in there is always an anchor
    const up = ahead.kg >= anchor!.kg;
    next = {
      goal: ahead, toGo, weeks: Math.round(days / 7),
      perWeek: days > 0 ? Math.round((toGo / days) * 7 * 100) / 100 : null,
      reached: up ? latest.kg >= ahead.kg : latest.kg <= ahead.kg,
    };
  }
  if (!anchor) return { ...none, until, shown, next };

  const pace = targetPace(anchor.kg, goals.at(-1)!.kg);
  const [lo0, hi0] = paceRange(pace, anchor, anchor.date);
  const [lo1, hi1] = paceRange(pace, anchor, until);
  const band = [{ date: anchor.date, lo: lo0, hi: hi0 }, { date: until, lo: lo1, hi: hi1 }];
  const status = latest!.date > anchor.date ? paceStatus(pace, anchor, latest!) : null;
  return { anchor, pace, until, band, shown, next, status };
}

// ----- Last time -----

export interface LastTime {
  date: string; session: string; sets: LoggedSet[];
  /** A deload week done since, which was passed over: its date */
  deloadSince?: string;
}

/**
 * The ticked sets from the most recent finished workout with this exercise, leaving out one workout
 * (the one in progress) and deload weeks, which targets leave out too. Removed exercises' done sets count;
 * a workout with none ticked is passed over.
 */
export function lastTime(sessions: SessionForProgress[], exercise: string, leaveOut?: string): LastTime | null {
  let found: LastTime | null = null;
  let deload: string | undefined;
  for (const s of sessions) {
    if (s.status !== "done" || s.id === leaveOut) continue;
    const sets = s.exercises.filter((e) => e.exercise === exercise).flatMap((e) => e.sets).filter((x) => x.done);
    if (!sets.length) continue;
    if (s.deload) { if (!deload || s.date > deload) deload = s.date; continue; }
    if (!found || s.date > found.date || (s.date === found.date && s.id > found.session)) found = { date: s.date, session: s.id, sets };
  }
  if (found && deload && deload > found.date) found.deloadSince = deload;
  return found;
}

const one = (x: LoggedSet): string =>
  x.seconds !== undefined ? `${x.seconds}s` : x.metres !== undefined ? `${x.metres}m` : x.calories !== undefined ? `${x.calories} cal` : `${x.reps ?? 0}`;

/** "52.5kg × 5, 5, 4" when every set had the same weight, "50kg × 5, 52.5kg × 4" when it changed, "30s, 30s" for timed. */
export function setsText(sets: LoggedSet[]): string {
  const weights = sets.map((x) => x.kg ?? null);
  if (weights.every((w) => w === null)) return sets.map(one).join(", ") + (sets.every((x) => x.reps !== undefined && x.seconds === undefined && x.metres === undefined && x.calories === undefined) ? " reps" : "");
  if (weights.every((w) => w === weights[0])) return `${weights[0]}kg × ${sets.map(one).join(", ")}`;
  return sets.map((x) => (x.kg !== undefined ? `${x.kg}kg × ${one(x)}` : one(x))).join(", ");
}
