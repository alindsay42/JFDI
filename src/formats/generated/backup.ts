// Generated from schema/*.schema.json by scripts/gen-types.mjs. Do not edit; run `npm run types`.

export type Rule =
  | {
      rule?: "setsPercent";
      tier?: "primary" | "secondary" | "tertiary";
      percent: number;
    }
  | {
      rule?: "setsTo";
      tier: "primary" | "secondary" | "tertiary";
      sets: number;
    }
  | {
      rule?: "dropTier";
      tier: "primary" | "secondary" | "tertiary";
    }
  | {
      rule?: "dropFlagged" | "swapFlagged";
      flag: "spineLoading" | "rotation" | "overhead" | "impact";
    }
  | {
      rule?: "addRir";
      reps: number;
    }
  | {
      rule?: "replaceSession";
      session: string;
    }
  | {
      rule?: "noLifting";
    };
export type Progression =
  | {
      id?: string;
      type?: "linear" | "double";
      incrementKg: number;
      holdIfRpeAtLeast?: number;
      stall?: Stall;
    }
  | {
      id?: string;
      type?: "topSetBackoff";
      incrementKg: number;
      topRpe: number;
      backoffPercent: number;
      stall?: Stall;
    }
  | {
      id?: string;
      type?: "none";
    };
export type Block =
  | {
      type?: "straight";
      restSec?: number;
      /**
       * @minItems 1
       * @maxItems 1
       */
      slots?: [Slot];
    }
  | {
      type?: "superset";
      restSec?: number;
      /**
       * @minItems 2
       * @maxItems 2
       */
      slots?: [Slot, Slot];
    }
  | {
      type?: "giant";
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
      rounds: number;
      workSec: number;
      restSec: number;
      /**
       * @minItems 1
       */
      slots?: [Slot, ...Slot[]];
    };
export type Week = {
  id: string;
  name: string;
  /**
   * @minItems 1
   */
  rotation: [string, ...string[]];
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
} & (
  | {
      [k: string]: unknown;
    }
  | {
      [k: string]: unknown;
    }
) & {
    id: string;
    name: string;
    /**
     * @minItems 1
     */
    rotation: [string, ...string[]];
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
  } & (
    | {
        [k: string]: unknown;
      }
    | {
        [k: string]: unknown;
      }
  );
export type Day =
  | {
      type?: "lift";
      notes?: string;
    }
  | {
      type?: "conditioning";
      activity: string;
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
      text: string;
    }
  | {
      type?: "lift";
      exercise: string;
      kg: number;
      reps: number;
      sets?: number;
    };

/**
 * Everything the app holds for the household, in one file: every profile, every programme in use, and each person's training log. The equipment list and exercise library come with the app, so they aren't included. See docs/backup.md.
 */
export interface JFDIBackup {
  format: "jfdi-backup";
  formatVersion: 1;
  exportedAt: string;
  /**
   * The version of J.F.D.I that made the backup
   */
  app: {
    version: string;
    commit?: string;
  };
  profiles: JFDIProfile[];
  programmes: JFDIProgrammeFile[];
  /**
   * One training log per profile
   */
  logs: JFDITrainingLog[];
}
/**
 * One person in the household: who they are, what they're running, and their own limits and starting points. See docs/profile-and-log.md.
 */
export interface JFDIProfile {
  format: "jfdi-profile";
  formatVersion: 1;
  id: string;
  name: string;
  /**
   * Shown on every Train screen so nobody logs into the wrong profile
   */
  colour: string;
  createdAt: string;
  updatedAt: string;
  display?: {
    /**
     * Everything is stored in kg. This only changes what's shown
     */
    weightUnits?: "kg" | "kg-and-lb";
    theme?: "device" | "light" | "dark";
  };
  /**
   * Household equipment this person can't use, such as bar-ssb. Exercises that need it are never offered
   */
  unavailableEquipment?: string[];
  /**
   * Library exercises this person doesn't want offered, for any reason
   */
  excludedExercises?: string[];
  readiness?: Readiness;
  programmes: {
    active?: Assignment;
    history: PastAssignment[];
  };
  targets?: Target[];
}
/**
 * Optional override of the active programme's daily check, in the same shape as a programme's readiness
 */
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
  label: string;
  description: string;
  rules: Rule[];
  progressionOnThisDay: "normal" | "hold" | "skip";
}
export interface Assignment {
  /**
   * Programme id
   */
  programme: string;
  /**
   * Which version of the programme is being run
   */
  programmeUpdatedAt: string;
  startDate: string;
  /**
   * Exercise id to starting load. Used until the log has history for that exercise
   */
  startingLoads?: {
    [k: string]: StartingLoad;
  };
}
export interface StartingLoad {
  kg: number;
  reps?: number;
  sets?: number;
  note?: string;
}
export interface PastAssignment {
  programme: string;
  programmeUpdatedAt: string;
  startDate: string;
  endDate: string;
  ended: "completed" | "early";
  notes?: string;
}
export interface Target {
  exercise: string;
  kg?: number;
  reps?: number;
  sets?: number;
  seconds?: number;
  metres?: number;
  by?: string;
  label?: string;
}
/**
 * A training programme as data. See docs/programme-format.md. Cross-references between ids are checked by scripts/validate.mjs, not by this schema.
 */
export interface JFDIProgrammeFile {
  $schema?: string;
  format: "jfdi-programme";
  formatVersion: 1;
  id: string;
  name: string;
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
  readiness: Readiness1;
  targets?: Target1[];
}
export interface Equipment {
  id: string;
  name: string;
  kg: number;
  /**
   * Matched against the household's bars when the file is imported
   */
  barType: "standard" | "junior" | "ez" | "ssb" | "trap" | "log" | "swiss";
}
export interface Exercise {
  id: string;
  name: string;
  family?: string;
  measure: "load" | "reps" | "time" | "distance" | "calories";
  implement:
    "barbell" | "dumbbell" | "kettlebell" | "cable" | "machine" | "band" | "bodyweight" | "other";
  bar?: string;
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
  flags?: ("spineLoading" | "rotation" | "overhead" | "impact")[];
  restSec?: number;
  notes?: string;
}
export interface Stall {
  misses: number;
  reducePercent: number;
}
export interface Session {
  id: string;
  name: string;
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
export interface Phase {
  id: string;
  name: string;
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
  id: string;
  name: string;
  week: string;
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
    setsPercent: number;
    loadPercent: number;
  };
  endWhen?: string;
}
export interface Readiness1 {
  preset: "freshness" | "injury" | "off";
  check48h?: boolean;
  levels?: {
    green: Level;
    amber: Level;
    red: Level;
  };
}
export interface Target1 {
  exercise: string;
  kg?: number;
  reps?: number;
  sets?: number;
  seconds?: number;
  metres?: number;
  label?: string;
}
/**
 * Everything one person has done: sessions as performed, daily check-ins and activities, and bodyweight. See docs/profile-and-log.md.
 */
export interface JFDITrainingLog {
  format: "jfdi-log";
  formatVersion: 1;
  profile: string;
  /**
   * Optional, for example files and imports
   */
  description?: string;
  sessions: Session1[];
  days: Day1[];
  bodyweight: WeighIn[];
}
export interface Session1 {
  id: string;
  date: string;
  startedAt: string;
  finishedAt?: string | null;
  status: "active" | "done";
  programme?: null | {
    id: string;
    updatedAt: string;
    phase?: string;
    block?: string;
    week?: number;
  };
  session: {
    id: string;
    name: string;
    subtitle?: string;
  };
  /**
   * null when the daily check is off
   */
  readiness: ("green" | "amber" | "red") | null;
  deload?: boolean;
  prescribed?: Session2;
  exercises: ExerciseEntry[];
  notes?: string;
  endedEarly?: string | null;
  check48h?: null | {
    status: "same" | "settling" | "worse";
    at: string;
  };
  /**
   * Set on sessions brought in from another app, such as rebuild-log
   */
  importedFrom?: string;
}
/**
 * The session as prescribed on the day, after readiness and deload rules. A copy, so editing the programme never rewrites history
 */
export interface Session2 {
  id: string;
  name: string;
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
export interface ExerciseEntry {
  exercise: string;
  /**
   * Copied at the time, so history reads correctly even if the library renames it
   */
  name: string;
  /**
   * Where it sits in the prescription, as tier.block.slot. null for an exercise added during the session
   */
  slot?: string | null;
  loadPer?: "total" | "each";
  added?: boolean;
  swappedFrom?: string;
  removed?: {
    reason?: string | null;
  };
  sets: Set[];
  notes?: string;
}
export interface Set {
  kg?: number;
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
export interface Day1 {
  date: string;
  readiness?: "green" | "amber" | "red";
  activities?: Activity[];
  notes?: string;
}
export interface Activity {
  /**
   * A library exercise, such as walk or ruck-walk
   */
  exercise: string;
  minutes?: number;
  kg?: number;
  metres?: number;
  notes?: string;
}
export interface WeighIn {
  date: string;
  kg: number;
  /**
   * Morning, before food and drink
   */
  fasted?: boolean;
}
