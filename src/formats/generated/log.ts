// Generated from schema/*.schema.json by scripts/gen-types.mjs. Do not edit; run `npm run types`.

export type Id = string;
export type Date = string;
export type Time = string;
export type Level = "green" | "amber" | "red";
/**
 * One item in a workout: a single exercise, or a group that runs in rounds
 */
export type Block =
  | {
      type?: "single";
      tier?: "primary" | "secondary" | "tertiary";
      restSec?: number;
      /**
       * @minItems 1
       * @maxItems 1
       */
      slots?: [Slot];
    }
  | {
      type?: "superset";
      tier?: "primary" | "secondary" | "tertiary";
      rounds: number;
      restSec?: number;
      /**
       * @minItems 2
       * @maxItems 2
       */
      slots?: [Slot, Slot];
    }
  | {
      type?: "giant";
      tier?: "primary" | "secondary" | "tertiary";
      rounds: number;
      transitionSec?: number;
      restSec?: number;
      /**
       * @minItems 3
       */
      slots?: [Slot, Slot, Slot, ...Slot[]];
    }
  | {
      type?: "finisher";
      tier?: "primary" | "secondary" | "tertiary";
      rounds: number;
      workSec: number;
      restSec: number;
      /**
       * @minItems 1
       */
      slots?: [Slot, ...Slot[]];
    };
export type Kg = number;

/**
 * Everything one person has done: sessions as performed, daily check-ins and activities, and bodyweight. See docs/profile-and-log.md.
 */
export interface JFDITrainingLog {
  format: "jfdi-log";
  formatVersion: 2;
  profile: Id;
  /**
   * Optional, for example files and imports
   */
  description?: string;
  sessions: Session[];
  days: Day[];
  bodyweight: WeighIn[];
}
export interface Session {
  id: Id;
  date: Date;
  startedAt: Time;
  finishedAt?: Time | null;
  status: "active" | "done";
  programme?: null | {
    id: Id;
    updatedAt: Time;
    phase?: Id;
    block?: Id;
    week?: number;
  };
  session: {
    id: Id;
    name: string;
    subtitle?: string;
  };
  /**
   * null when the daily check is off
   */
  readiness: Level | null;
  deload?: boolean;
  prescribed?: Workout;
  exercises: ExerciseEntry[];
  notes?: string;
  endedEarly?: string | null;
  check48h?: null | {
    status: "same" | "settling" | "worse";
    at: Time;
  };
  /**
   * Set on sessions brought in from another app, such as rebuild-log
   */
  importedFrom?: string;
}
/**
 * The workout as prescribed on the day, after readiness and deload rules. A copy, so editing the programme never rewrites history
 */
export interface Workout {
  id: string;
  name: string;
  subtitle?: string;
  estimatedMinutes?: number;
  /**
   * @minItems 1
   */
  items: [Block, ...Block[]];
}
export interface Slot {
  exercise: string;
  sets?: number;
  reps?: Range;
  seconds?: Range;
  metres?: Range;
  calories?: Range;
  progression: string;
  incrementKg?: number;
  start?: {
    kg?: number | "bar";
    note?: string;
  };
  restSec?: number;
  alternatives?: string[];
  optional?: {
    unlock: {
      fromWeek?: number;
    };
  };
  notes?: string;
}
export interface Range {
  min: number;
  max: number;
}
export interface ExerciseEntry {
  exercise: Id;
  /**
   * Copied at the time, so history reads correctly even if the library renames it
   */
  name: string;
  /**
   * Where it sits in the prescription, as item.slot (both counted from 0). null for an exercise added during the session
   */
  slot?: string | null;
  loadPer?: "total" | "each";
  added?: boolean;
  swappedFrom?: Id;
  removed?: {
    reason?: string | null;
  };
  sets: Set[];
  notes?: string;
}
export interface Set {
  kg?: Kg;
  reps?: number;
  seconds?: number;
  metres?: number;
  calories?: number;
  rpe?: number;
  /**
   * Chains hung on the bar, counted separately from kg
   */
  chains?: number;
  /**
   * For per-side exercises logged one side at a time
   */
  side?: "left" | "right";
  /**
   * Ticked as completed. Unticked sets are kept so the log shows what was planned but not done
   */
  done: boolean;
}
export interface Day {
  date: Date;
  readiness?: Level;
  activities?: Activity[];
  notes?: string;
}
export interface Activity {
  /**
   * A library exercise, such as walk or ruck-walk
   */
  exercise: string;
  minutes?: number;
  kg?: Kg;
  metres?: number;
  notes?: string;
}
export interface WeighIn {
  date: Date;
  kg: number;
  /**
   * Morning, before food and drink
   */
  fasted?: boolean;
}
