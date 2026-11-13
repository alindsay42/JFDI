// Generated from schema/*.schema.json by scripts/gen-types.mjs. Do not edit; run `npm run types`.

export type Id = string;
export type Text = string;
export type Kg = number;
export type Flag = "spineLoading" | "rotation" | "overhead" | "impact";
export type Seconds = number;
export type Progression =
  | {
      id?: Id;
      type?: "linear" | "double";
      incrementKg: Kg;
      holdIfRpeAtLeast?: number;
      stall?: Stall;
    }
  | {
      id?: Id;
      type?: "topSetBackoff";
      incrementKg: Kg;
      topRpe: number;
      backoffPercent: Percent;
      stall?: Stall;
    }
  | {
      id?: Id;
      type?: "none";
    };
export type Percent = number;
/**
 * One item in a workout: a single exercise, or a group that runs in rounds
 */
export type Block =
  | {
      type?: "single";
      tier?: TierName;
      restSec?: Seconds;
      /**
       * @minItems 1
       * @maxItems 1
       */
      slots?: [Slot];
    }
  | {
      type?: "superset";
      tier?: TierName;
      rounds: number;
      restSec?: Seconds;
      /**
       * @minItems 2
       * @maxItems 2
       */
      slots?: [Slot, Slot];
    }
  | {
      type?: "giant";
      tier?: TierName;
      rounds: number;
      transitionSec?: Seconds;
      restSec?: Seconds;
      /**
       * @minItems 3
       */
      slots?: [Slot, Slot, Slot, ...Slot[]];
    }
  | {
      type?: "finisher";
      tier?: TierName;
      rounds: number;
      workSec: Seconds;
      restSec: Seconds;
      /**
       * @minItems 1
       */
      slots?: [Slot, ...Slot[]];
    };
export type TierName = "primary" | "secondary" | "tertiary";
/**
 * A cycle of 1 to 4 weeks that repeats. Ad hoc: workouts in order, on whichever days suit. Set days: workouts on weekdays, with the calendar deciding the week
 */
export type Plan =
  | {
      mode?: "adhoc";
      /**
       * Full days off between workouts
       */
      minRestDays?: number;
      /**
       * @minItems 1
       * @maxItems 4
       */
      weeks?:
        | [AdhocWeek]
        | [AdhocWeek, AdhocWeek]
        | [AdhocWeek, AdhocWeek, AdhocWeek]
        | [AdhocWeek, AdhocWeek, AdhocWeek, AdhocWeek];
    }
  | {
      mode?: "setDays";
      /**
       * @minItems 1
       * @maxItems 4
       */
      weeks?:
        | [SetDaysWeek]
        | [SetDaysWeek, SetDaysWeek]
        | [SetDaysWeek, SetDaysWeek, SetDaysWeek]
        | [SetDaysWeek, SetDaysWeek, SetDaysWeek, SetDaysWeek];
    };
/**
 * What the days without a workout are
 */
export type OtherDay =
  | {
      type?: "conditioning";
      activity: Text;
      minutes?: Range;
      notes?: string;
    }
  | {
      type?: "free" | "rest";
      notes?: string;
    };
export type Day =
  | {
      type?: "workout";
      workout: Id;
      notes?: string;
    }
  | {
      type?: "conditioning";
      activity: Text;
      minutes?: Range;
      notes?: string;
    }
  | {
      type?: "free" | "rest";
      notes?: string;
    };
export type Gate =
  | {
      type?: "text";
      text: Text;
    }
  | {
      type?: "lift";
      exercise: Id;
      kg: Kg;
      reps: number;
      sets?: number;
    };
export type Rule =
  | {
      rule?: "setsPercent";
      tier?: TierName;
      percent: Percent;
    }
  | {
      rule?: "setsTo";
      tier: TierName;
      sets: number;
    }
  | {
      rule?: "dropTier";
      tier: TierName;
    }
  | {
      rule?: "dropFlagged" | "swapFlagged";
      flag: Flag;
    }
  | {
      rule?: "addRir";
      reps: number;
    }
  | {
      rule?: "replaceWorkout";
      workout: Id;
    }
  | {
      rule?: "noLifting";
    };

/**
 * A training programme as data. See docs/programme-format.md. Cross-references between ids are checked by scripts/validate.mjs, not by this schema.
 */
export interface JFDIProgrammeFile {
  $schema?: string;
  format: "jfdi-programme";
  formatVersion: 2;
  id: Id;
  name: Text;
  description?: string;
  goal?: string;
  createdAt: string;
  updatedAt: string;
  equipment: Equipment[];
  /**
   * @minItems 1
   */
  exercises: [Exercise, ...Exercise[]];
  /**
   * @minItems 1
   */
  progressions: [Progression, ...Progression[]];
  /**
   * @minItems 1
   */
  workouts: [Workout, ...Workout[]];
  plan: Plan;
  /**
   * @minItems 1
   */
  phases: [Phase, ...Phase[]];
  readiness: Readiness;
  /**
   * progress (the default): each exercise's progression rule suggests the next weight. repeat: the target is what was lifted last time, and the person decides when to go up
   */
  weights?: "progress" | "repeat";
  targets?: Target[];
}
export interface Equipment {
  id: Id;
  name: Text;
  kg: Kg;
  /**
   * Matched against the household's bars when the file is imported
   */
  barType: "standard" | "junior" | "ez" | "ssb" | "trap" | "log" | "swiss";
}
export interface Exercise {
  id: Id;
  name: Text;
  family?: Id;
  measure: "load" | "reps" | "time" | "distance" | "calories";
  implement:
    | "barbell"
    | "dumbbell"
    | "kettlebell"
    | "plate"
    | "cable"
    | "machine"
    | "band"
    | "bodyweight"
    | "other";
  bar?: Id;
  loadPer?: "total" | "each";
  perSide?: boolean;
  pattern:
    | "squat"
    | "hinge"
    | "push"
    | "pull"
    | "lunge"
    | "carry"
    | "core"
    | "isolation"
    | "conditioning"
    | "mobility";
  muscles?: string[];
  flags?: Flag[];
  restSec?: Seconds;
  notes?: string;
}
export interface Stall {
  misses: number;
  reducePercent: Percent;
}
export interface Workout {
  id: Id;
  name: Text;
  subtitle?: string;
  estimatedMinutes?: number;
  /**
   * @minItems 1
   */
  items: [Block, ...Block[]];
}
export interface Slot {
  exercise: Id;
  sets?: number;
  reps?: Range;
  seconds?: Range;
  metres?: Range;
  calories?: Range;
  progression: Id;
  incrementKg?: Kg;
  start?: {
    kg?: Kg | "bar";
    note?: string;
  };
  restSec?: Seconds;
  alternatives?: Id[];
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
export interface AdhocWeek {
  /**
   * Day 1, Day 2 and so on, in order
   *
   * @minItems 1
   * @maxItems 7
   */
  workouts:
    | [Id]
    | [Id, Id]
    | [Id, Id, Id]
    | [Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id]
    | [Id, Id, Id, Id, Id, Id, Id];
  otherDays?: OtherDay;
}
export interface SetDaysWeek {
  days: {
    mon: Day;
    tue: Day;
    wed: Day;
    thu: Day;
    fri: Day;
    sat: Day;
    sun: Day;
  };
}
export interface Phase {
  id: Id;
  name: Text;
  focus?: string;
  /**
   * @minItems 1
   */
  blocks: [TrainingBlock, ...TrainingBlock[]];
  gates?: {
    entry?: Gate[];
    exit?: Gate[];
  };
}
export interface TrainingBlock {
  id: Id;
  name: Text;
  weeks: number | null;
  deload?: (
    | {
        [k: string]: unknown;
      }
    | {
        [k: string]: unknown;
      }
    | {
        [k: string]: unknown;
      }
  ) & {
    /**
     * The person can start a deload week from Today
     */
    onDemand?: boolean;
    /**
     * Blocks of this many trained weeks, the last a deload. Weeks without a workout don't count
     */
    everyWeeks?: number;
    /**
     * After a deload, each exercise starts from what was lifted in this week of the last block. Without it, weights carry on from before the deload
     */
    restartWeek?: number;
    afterStalls?: number;
    setsPercent: Percent;
    loadPercent: Percent;
  };
  endWhen?: string;
}
export interface Readiness {
  preset: "freshness" | "injury" | "off";
  check48h?: boolean;
  levels?: {
    green: Level;
    amber: Level;
    red: Level;
  };
}
export interface Level {
  label: Text;
  description: string;
  rules: Rule[];
  progressionOnThisDay: "normal" | "hold" | "skip";
}
export interface Target {
  exercise: Id;
  kg?: Kg;
  reps?: number;
  sets?: number;
  seconds?: number;
  metres?: number;
  label?: string;
}
