// Today's workout for one person: which workout, after readiness, deload and unlocks, with a target for each exercise.
import type { Day, Exercise, Item, Programme, Slot, Workout } from "../formats/programme.ts";
import { nextTarget, roundKg, type Next, type Performance, type ProgressionRule, type SetDone } from "./progression.ts";
import { applyDeload, applyRules, type Rule } from "./readiness.ts";
import { daysBetween, mondayOf, nextAdhoc, restDaysLeft, setDaysOn, WEEKDAYS as WEEKDAY_LIST, type Position } from "./schedule.ts";

export type Readiness = "green" | "amber" | "red";

/** What the engine needs from a logged session. */
export interface LoggedSession {
  date: string;
  status: "active" | "done";
  readiness: Readiness | null;
  programme: { id: string; week: number } | null;
  workout: string;
  exercises: Array<{ exercise: string; removed?: unknown; sets: SetDone[] }>;
}

export interface Assignment {
  startDate: string;
  startingLoads?: Record<string, { kg: number }>;
}

export type Today =
  | { kind: "notStarted"; startDate: string }
  | { kind: "day"; day: Exclude<Day, { type: "workout" }>; week: number }
  | { kind: "resting"; daysLeft: number; next: Position & { workout: string } }
  | { kind: "noLifting" }
  /** Set days: this weekday's workout is already done this week (today, or earlier on another day) */
  | { kind: "done"; workout: string; date: string }
  | {
      kind: "workout";
      position: Position;
      /** The workout as prescribed today: after readiness, deload and unlocks */
      workout: Workout;
      /** Target for each slot, by "item.slot" */
      targets: Record<string, Next>;
      addRir: number;
      deload: boolean;
      swapped: Array<[string, string]>;
    };

/** Ad hoc: where the last workout done for this programme sits in the cycle. */
export function lastPosition(p: Programme, sessions: LoggedSession[]): Position | null {
  if (p.plan.mode !== "adhoc") return null;
  const mine = sessions.filter((s) => s.status === "done" && s.programme?.id === p.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = mine[0];
  if (!last) return null;
  const week = Math.min(last.programme!.week, p.plan.weeks.length) - 1;
  const day = p.plan.weeks[week]!.workouts.indexOf(last.workout);
  return { week, day };
}

const progressionDay = (p: Programme, r: Readiness | null) =>
  r && p.readiness.preset !== "off" ? (p.readiness.levels?.[r].progressionOnThisDay ?? "normal") : "normal";

/** One exercise's history in this programme, most recent first. Removed exercises don't count. */
export function historyOf(p: Programme, a: Assignment, sessions: LoggedSession[], exercise: string): Performance[] {
  return sessions
    .filter((s) => s.status === "done" && s.programme?.id === p.id && s.date >= a.startDate)
    .sort((x, y) => (x.date < y.date ? 1 : -1))
    .flatMap((s) => s.exercises
      .filter((e) => e.exercise === exercise && !e.removed)
      .map((e) => ({ sets: e.sets, day: progressionDay(p, s.readiness) })));
}

function startKg(p: Programme, a: Assignment, slot: Slot): number | null {
  const own = a.startingLoads?.[slot.exercise]?.kg;
  if (own !== undefined) return own;
  const kg = slot.start?.kg;
  if (kg === "bar") {
    const ex = p.exercises.find((e) => e.id === slot.exercise);
    return p.equipment.find((b) => b.id === ex?.bar)?.kg ?? null;
  }
  return kg ?? null;
}

/** Optional slots appear from their unlock week (counted from 1). Groups that lose slots reshape. */
function unlocked(w: Workout, weekNumber: number): Workout {
  const items = w.items.flatMap((item): Item[] => {
    const slots = item.slots.filter((s) => !s.optional?.unlock.fromWeek || weekNumber >= s.optional.unlock.fromWeek);
    if (slots.length === item.slots.length) return [item];
    // A single item has one slot, so it's either kept above or gone here
    if (!slots.length || item.type === "single") return [];
    if (slots.length === 1) return [{ type: "single", tier: item.tier, slots: [{ ...slots[0]!, sets: item.rounds }] }];
    return [{ ...item, slots } as Item];
  });
  return { ...w, items };
}

/** The training block in force: the first block of the first phase. Phases and gates come later. */
const block = (p: Programme) => p.phases[0]?.blocks[0];

export function today(input: {
  programme: Programme;
  assignment: Assignment;
  sessions: LoggedSession[];
  date: string;
  readiness: Readiness | null;
  /** Ad hoc: the person chose to skip to the workout after this one */
  skippedTo?: Position | null;
  /** Ad hoc: start the next workout even though the rest days aren't up */
  ignoreRest?: boolean;
  /** Set days: do this workout today instead of the day's own, or again after it's done */
  chosen?: string | null;
}): Today {
  const { programme: p, assignment: a, sessions, date, readiness } = input;
  if (date < a.startDate) return { kind: "notStarted", startDate: a.startDate };

  let position: Position;
  let workoutId: string;
  if (p.plan.mode === "adhoc") {
    const last = input.skippedTo ?? lastPosition(p, sessions);
    const next = nextAdhoc(p.plan, last);
    const lastDone = sessions.filter((s) => s.status === "done" && s.programme?.id === p.id).map((s) => s.date).sort().at(-1) ?? null;
    const wait = restDaysLeft(p.plan.minRestDays, lastDone, date);
    if (wait > 0 && !input.ignoreRest) return { kind: "resting", daysLeft: wait, next };
    position = { week: next.week, day: next.day };
    workoutId = next.workout;
  } else {
    const on = setDaysOn(p.plan, a.startDate, date)!;
    const chosen = input.chosen && p.workouts.some((w) => w.id === input.chosen) ? input.chosen : null;
    if (chosen) {
      // The chosen workout's own week of the cycle, this week's if it's in it
      const weeks = p.plan.weeks.map((w, i) => (WEEKDAY_LIST.some((d) => { const x = w.days[d]; return x.type === "workout" && x.workout === chosen; }) ? i : -1)).filter((i) => i >= 0);
      position = { week: weeks.includes(on.week) ? on.week : (weeks[0] ?? on.week), day: 0 };
      workoutId = chosen;
    } else {
      if (on.type !== "workout") {
        const { week, ...day } = on;
        return { kind: "day", day: day as Exclude<Day, { type: "workout" }>, week };
      }
      // Done already this week, today or earlier (when done early on another day)
      const monday = mondayOf(date);
      const doneOn = sessions
        .filter((s) => s.status === "done" && s.programme?.id === p.id && s.workout === on.workout && s.date >= monday && s.date <= date)
        .map((s) => s.date).sort().at(-1);
      if (doneOn) return { kind: "done", workout: on.workout, date: doneOn };
      position = { week: on.week, day: 0 };
      workoutId = on.workout;
    }
  }

  const base = p.workouts.find((w) => w.id === workoutId)!;
  const level = readiness && p.readiness.preset !== "off" ? p.readiness.levels?.[readiness] : undefined;
  const applied = applyRules(base, (level?.rules ?? []) as Rule[], p.workouts, p.exercises);
  if (!applied.workout) return { kind: "noLifting" };

  const weekNumber = Math.floor(daysBetween(a.startDate, date) / 7) + 1;
  const deloadRule = block(p)?.deload;
  const deload = !!deloadRule?.everyWeeks && weekNumber % deloadRule.everyWeeks === 0;
  let workout = unlocked(applied.workout, weekNumber);
  if (deload) workout = applyDeload(workout, deloadRule!.setsPercent);

  const progressions = new Map(p.progressions.map((x) => [x.id, x]));
  const exercises = new Map<string, Exercise>(p.exercises.map((e) => [e.id, e]));
  const targets: Record<string, Next> = {};
  workout.items.forEach((item, i) => item.slots.forEach((slot, j) => {
    const prog = progressions.get(slot.progression) as ProgressionRule | undefined;
    const rule: ProgressionRule = !prog || prog.type === "none" ? { type: "none" } : { ...prog, incrementKg: slot.incrementKg ?? prog.incrementKg } as ProgressionRule;
    const ex = exercises.get(slot.exercise);
    const field = ex?.measure === "time" ? "seconds" : ex?.measure === "distance" ? "metres" : ex?.measure === "calories" ? "calories" : "reps";
    const target = slot[field] ?? { min: 1, max: 1 };
    const next = nextTarget(rule, target, historyOf(p, a, sessions, slot.exercise), startKg(p, a, slot));
    if (deload && next.kg !== null) next.kg = roundKg((next.kg * deloadRule!.loadPercent) / 100);
    targets[`${i}.${j}`] = next;
  }));

  return { kind: "workout", position, workout, targets, addRir: applied.addRir, deload, swapped: applied.swapped };
}
