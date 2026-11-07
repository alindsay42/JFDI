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
export type Block =
  | {
      type?: "straight";
      restSec?: Seconds;
      /**
       * @minItems 1
       * @maxItems 1
       */
      slots?: [Slot];
    }
  | {
      type?: "superset";
      restSec?: Seconds;
      /**
       * @minItems 2
       * @maxItems 2
       */
      slots?: [Slot, Slot];
    }
  | {
      type?: "giant";
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
      rounds: number;
      workSec: Seconds;
      restSec: Seconds;
      /**
       * @minItems 1
       */
      slots?: [Slot, ...Slot[]];
    };
export type Week = {
  id: Id;
  name: Text;
  /**
   * @minItems 1
   */
  rotation: [Id, ...Id[]];
  perWeek?: {
    liftDays: number;
    /**
     * Full days off between lifting days
     */
    minRestDays?: number;
  };
  otherDays?: Day;
  days?: {
    mon: Day;
    tue: Day;
    wed: Day;
    thu: Day;
    fri: Day;
    sat: Day;
    sun: Day;
  };
} & Week1 & {
    id: Id;
    name: Text;
    /**
     * @minItems 1
     */
    rotation: [Id, ...Id[]];
    perWeek?: {
      liftDays: number;
      /**
       * Full days off between lifting days
       */
      minRestDays?: number;
    };
    otherDays?: Day;
    days?: {
      mon: Day;
      tue: Day;
      wed: Day;
      thu: Day;
      fri: Day;
      sat: Day;
      sun: Day;
    };
  } & Week1;
export type Day =
  | {
      type?: "lift";
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
export type Week1 =
  | {
      [k: string]: unknown;
    }
  | {
      [k: string]: unknown;
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
      rule?: "replaceSession";
      session: Id;
    }
  | {
      rule?: "noLifting";
    };
export type TierName = "primary" | "secondary" | "tertiary";

/**
 * A training programme as data. See docs/programme-format.md. Cross-references between ids are checked by scripts/validate.mjs, not by this schema.
 */
export interface JFDIProgrammeFile {
  $schema?: string;
  format: "jfdi-programme";
  formatVersion: 1;
  id: Id;
  name: Text;
  description?: string;
  goal?: string;
  daysPerWeek?: number;
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
  sessions: [Session, ...Session[]];
  /**
   * @minItems 1
   */
  weeks: [Week, ...Week[]];
  /**
   * @minItems 1
   */
  phases: [Phase, ...Phase[]];
  readiness: Readiness;
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
    "barbell" | "dumbbell" | "kettlebell" | "cable" | "machine" | "band" | "bodyweight" | "other";
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
export interface Session {
  id: Id;
  name: Text;
  subtitle?: string;
  estimatedMinutes?: number;
  inRotation?: boolean;
  tiers: {
    /**
     * @minItems 1
     */
    primary?: [Block, ...Block[]];
    /**
     * @minItems 1
     */
    secondary?: [Block, ...Block[]];
    /**
     * @minItems 1
     */
    tertiary?: [Block, ...Block[]];
  };
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
  week: Id;
  weeks: number | null;
  deload?: (
    | {
        [k: string]: unknown;
      }
    | {
        [k: string]: unknown;
      }
  ) & {
    everyWeeks?: number;
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
