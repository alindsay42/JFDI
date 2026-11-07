// Which workout is next (docs/programme-editor.md, "The week planner").
//   Ad hoc: workouts in order through the cycle; a missed one stays next up; a week ends when its workouts are done.
//   Set days: the calendar decides the week, counted from the start date; each weekday has its own plan.
import type { Day, Plan, Weekday } from "../formats/programme.ts";

export const WEEKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_MS = 86_400_000;

/** Whole days from one calendar date (YYYY-MM-DD) to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function weekdayOf(date: string): Weekday {
  // 1970-01-05 was a Monday
  const n = ((daysBetween("1970-01-05", date) % 7) + 7) % 7;
  return WEEKDAYS[n]!;
}

/** A place in the cycle: week and day, both counted from 0. */
export interface Position { week: number; day: number }

/** Ad hoc: the workouts in the cycle, in order, each with its place. */
export function adhocOrder(plan: Extract<Plan, { mode: "adhoc" }>): Array<Position & { workout: string }> {
  return plan.weeks.flatMap((w, week) => w.workouts.map((workout, day) => ({ week, day, workout })));
}

/**
 * Ad hoc: the workout after the last one done (or skipped). Nothing done yet starts at week 1, day 1.
 * After the last day of the last week, the cycle goes back to the start.
 */
export function nextAdhoc(plan: Extract<Plan, { mode: "adhoc" }>, last: Position | null): Position & { workout: string } {
  const order = adhocOrder(plan);
  if (!last) return order[0]!;
  const at = order.findIndex((o) => o.week === last.week && o.day === last.day);
  // A place that no longer exists (the plan was changed) carries on from the start of the next week
  if (at < 0) return order.find((o) => o.week > last.week) ?? order[0]!;
  return order[(at + 1) % order.length]!;
}

/** Ad hoc: days still to rest before the next workout, given the last one's date. 0 means ready. */
export function restDaysLeft(minRestDays: number | undefined, lastDate: string | null, today: string): number {
  if (!minRestDays || !lastDate) return 0;
  return Math.max(0, minRestDays + 1 - daysBetween(lastDate, today));
}

/** Set days: the week of the cycle a date falls in, counted from the Monday of the start date's week. Null before the start. */
export function setDaysWeek(weeks: number, startDate: string, date: string): number | null {
  if (date < startDate) return null;
  const monday = daysBetween("1970-01-05", startDate) - (((daysBetween("1970-01-05", startDate) % 7) + 7) % 7);
  const weeksIn = Math.floor((daysBetween("1970-01-05", date) - monday) / 7);
  return weeksIn % weeks;
}

/** Set days: what a date holds. Null before the start date. */
export function setDaysOn(plan: Extract<Plan, { mode: "setDays" }>, startDate: string, date: string): (Day & { week: number }) | null {
  const week = setDaysWeek(plan.weeks.length, startDate, date);
  if (week === null) return null;
  return { ...plan.weeks[week]!.days[weekdayOf(date)], week };
}
