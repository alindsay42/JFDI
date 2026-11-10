// Training blocks (mesocycles): runs of trained weeks ended by a deload week. Only weeks with a workout in
// them count, so a week away doesn't use up a block. A block of N weeks has its deload in week N.
import { workingKg } from "./progression.ts";
import { mondayOf } from "./schedule.ts";
import type { LoggedSession } from "./prescription.ts";

export interface TrainedWeek { monday: string; sessions: LoggedSession[] }

export interface BlockInfo {
  /** 1 for the first block, 2 after the first deload, and so on */
  block: number;
  /** This week's place in the block, counting trained weeks */
  week: number;
  /** Weeks in a block, the last a deload; null for deloads only when chosen */
  length: number | null;
  /** This week is the block's scheduled deload */
  scheduledDeload: boolean;
  /** The last block's trained weeks, deload left out: where a new block restarts from */
  previous: TrainedWeek[];
  /** This block's workouts so far, deloads left out */
  current: LoggedSession[];
}

/** Where today sits in the blocks, from the programme's finished workouts. */
export function blockInfo(sessions: LoggedSession[], programme: string, startDate: string, date: string, length: number | null): BlockInfo {
  const thisWeek = mondayOf(date);
  const byWeek = new Map<string, LoggedSession[]>();
  for (const s of sessions) {
    if (s.status !== "done" || s.programme?.id !== programme || s.date < startDate || s.date > date) continue;
    const m = mondayOf(s.date);
    byWeek.set(m, [...(byWeek.get(m) ?? []), s]);
  }
  const weeks = [...byWeek.keys()].filter((m) => m < thisWeek).sort().map((monday) => ({ monday, sessions: byWeek.get(monday)! }));
  const blocks: TrainedWeek[][] = [];
  let normal: TrainedWeek[] = [];
  let inDeload = false;
  for (const w of weeks) {
    // A week with any deload workout in it is a deload week; back-to-back deload weeks are one deload
    if (w.sessions.some((s) => s.deload)) { inDeload = true; continue; }
    if (inDeload) { blocks.push(normal); normal = []; inDeload = false; }
    normal.push(w);
  }
  const now = byWeek.get(thisWeek) ?? [];
  if (inDeload && !now.some((s) => s.deload)) { blocks.push(normal); normal = []; inDeload = false; }
  const week = normal.length + 1;
  const scheduledDeload = !inDeload && !!length && week >= length && !now.some((s) => !s.deload);
  return {
    block: blocks.length + 1, week, length, scheduledDeload,
    previous: blocks.at(-1) ?? [],
    current: [...normal.flatMap((w) => w.sessions), ...now.filter((s) => !s.deload)],
  };
}

/**
 * The weight to restart an exercise at in a new block: what was lifted in the given week of the last block
 * (or the nearest week after it with that exercise). Only until the exercise has been done in this block.
 */
export function restartKg(info: BlockInfo, exercise: string, fromWeek: number): { kg: number; week: number } | null {
  if (info.block < 2) return null;
  const has = (s: LoggedSession) => s.exercises.some((e) => e.exercise === exercise && e.sets.some((x) => x.done));
  if (info.current.some(has)) return null;
  for (let i = fromWeek - 1; i < info.previous.length; i++) {
    const first = [...info.previous[i]!.sessions].filter(has).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    if (!first) continue;
    const kg = workingKg({ sets: first.exercises.filter((e) => e.exercise === exercise).flatMap((e) => e.sets) });
    if (kg !== null) return { kg, week: i + 1 };
  }
  return null;
}
