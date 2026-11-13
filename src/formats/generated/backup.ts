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
      rule?: "replaceWorkout";
      workout: string;
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
      activity: string;
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
      workout: string;
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
export type Item = {
  id: string;
  name: string;
  kind:
    | "bar"
    | "plates"
    | "collars"
    | "chains"
    | "dumbbells"
    | "odd-object"
    | "rack"
    | "attachment"
    | "handle"
    | "cable"
    | "bench"
    | "station"
    | "conditioning"
    | "accessory"
    | "weights";
  barType?: "standard" | "junior" | "ez" | "ssb" | "trap" | "log" | "swiss";
  /**
   * Measured weights can be any value, such as a 19.2kg bar or 0.28kg collars
   */
  kg?: number;
  /**
   * Measured weights can be any value, such as a 19.2kg bar or 0.28kg collars
   */
  kgEach?: number;
  /**
   * How many, for chains, loadable handles and the like
   */
  count?: number;
  /**
   * Each plate size and how many single plates there are
   */
  plates?: {
    /**
     * Measured weights can be any value, such as a 19.2kg bar or 0.28kg collars
     */
    kg: number;
    count: number;
  }[];
  /**
   * Weighted kit that comes in fixed weights, such as kettlebells or sandbags: each weight and how many there are
   */
  weights?: {
    /**
     * Measured weights can be any value, such as a 19.2kg bar or 0.28kg collars
     */
    kg: number;
    count: number;
  }[];
  /**
   * Fixed dumbbell pairs, by weight of one dumbbell
   *
   * Items: Measured weights can be any value, such as a 19.2kg bar or 0.28kg collars
   */
  pairsKg?: number[];
  /**
   * Pairs owned but not available right now, such as lent out
   *
   * Items: Measured weights can be any value, such as a 19.2kg bar or 0.28kg collars
   */
  unavailableKg?: number[];
  /**
   * Library exercises this bar should be used for when there's a choice
   */
  preferredFor?: string[];
  attachesTo?: string;
  /**
   * Some details still to confirm
   */
  tbc?: boolean;
  notes?: string;
};

/**
 * Everything the app holds for the household, in one file: every profile, every programme in use, each person's training log, the household's gyms and their equipment, and any exercises the household added. The exercise library comes with the app, so it isn't included. See docs/backup.md.
 */
export interface JFDIBackup {
  format: "jfdi-backup";
  formatVersion: 2;
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
   * The places the household trains, each with its equipment. The first is home. Older backups don't have this; restoring one gives home the kit the app came with
   */
  gyms?: {
    id: string;
    kit: JFDIHouseholdEquipment;
  }[];
  /**
   * Exercises the household added to the library, such as an ab wheel rollout. Their ids start own-
   */
  exercises?: Exercise1[];
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
  /**
   * Bodyweight goals. The target pace on the chart starts from the weigh-in on or before start
   */
  bodyweight?: {
    start: string;
    /**
     * Up to 6, in date order
     */
    goals: {
      kg: number;
      by: string;
      label?: string;
    }[];
  };
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
  formatVersion: 2;
  id: string;
  name: string;
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
  readiness: Readiness1;
  /**
   * progress (the default): each exercise's progression rule suggests the next weight. repeat: the target is what was lifted last time, and the person decides when to go up
   */
  weights?: "progress" | "repeat";
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
    | "barbell"
    | "dumbbell"
    | "kettlebell"
    | "plate"
    | "cable"
    | "machine"
    | "band"
    | "bodyweight"
    | "other";
  bar?: string;
  loadPer?: "total" | "each";
  /**
   * The household's weighted kit it's done with, such as kettlebells, by equipment id. Its targets round to the weights in that kit
   */
  weights?: string;
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
export interface AdhocWeek {
  /**
   * Day 1, Day 2 and so on, in order
   *
   * @minItems 1
   * @maxItems 7
   */
  workouts:
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string];
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
 * Everything in the gym, with the details that matter for planning. See docs/equipment-and-library.md.
 */
export interface JFDIHouseholdEquipment {
  format: "jfdi-equipment";
  formatVersion: 1;
  name: string;
  updatedAt: string;
  items: Item[];
}
export interface Exercise1 {
  id: string;
  name: string;
  family: string;
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
  /**
   * Bars this exercise can be done with. The first is the default
   *
   * @minItems 1
   */
  barTypes?: [
    "standard" | "junior" | "ez" | "ssb" | "trap" | "log" | "swiss",
    ...("standard" | "junior" | "ez" | "ssb" | "trap" | "log" | "swiss")[]
  ];
  loadPer?: "total" | "each";
  /**
   * The household's weighted kit it's done with, such as kettlebells, by equipment id. Its targets round to the weights in that kit
   */
  weights?: string;
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
  /**
   * Equipment ids needed, apart from the bar itself
   */
  requires: string[];
  muscles?: string[];
  flags?: ("spineLoading" | "rotation" | "overhead" | "impact")[];
  restSec?: number;
  notes?: string;
}
/**
 * Everything one person has done: sessions as performed, daily check-ins and activities, and bodyweight. See docs/profile-and-log.md.
 */
export interface JFDITrainingLog {
  format: "jfdi-log";
  formatVersion: 2;
  profile: string;
  /**
   * Optional, for example files and imports
   */
  description?: string;
  sessions: Session[];
  days: Day1[];
  bodyweight: WeighIn[];
}
export interface Session {
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
  prescribed?: Workout1;
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
 * The workout as prescribed on the day, after readiness and deload rules. A copy, so editing the programme never rewrites history
 */
export interface Workout1 {
  id: string;
  name: string;
  subtitle?: string;
  estimatedMinutes?: number;
  /**
   * @minItems 1
   */
  items: [Block, ...Block[]];
}
export interface ExerciseEntry {
  exercise: string;
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
