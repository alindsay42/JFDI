// Dates as people read them. Stored dates are local calendar dates (YYYY-MM-DD).
const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Noon on a calendar date, so time zones and clock changes can't move it to another day. */
export const fromDate = (d: string) => new Date(`${d}T12:00:00`);
export const formatLongDate = (d: string) => longDate.format(fromDate(d));
export const formatShortDate = (d: string) => shortDate.format(fromDate(d));
const dayMonth = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
/** "Fri 6 Nov", for recent dates */
export const formatDayMonth = (d: string) => dayMonth.format(fromDate(d)).replace(",", "");
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** Whole days from `today` to `date`, both calendar dates. Negative when `date` has passed. */
export function daysUntil(date: string, today: string): number {
  return Math.round((fromDate(date).getTime() - fromDate(today).getTime()) / 86_400_000);
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatKg(kg: number): string {
  return `${Number(kg.toFixed(2))}kg`;
}
