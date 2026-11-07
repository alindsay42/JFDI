// Generated from schema/*.schema.json by scripts/gen-types.mjs. Do not edit; run `npm run types`.

export type Id = string;
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
export type Date = string;
export type Kg = number;

/**
 * One person in the household: who they are, what they're running, and their own limits and starting points. See docs/profile-and-log.md.
 */
export interface JFDIProfile {
  format: "jfdi-profile";
  formatVersion: 1;
  id: Id;
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
  unavailableEquipment?: Id[];
  /**
   * Library exercises this person doesn't want offered, for any reason
   */
  excludedExercises?: Id[];
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
  startDate: Date;
  /**
   * Exercise id to starting load. Used until the log has history for that exercise
   */
  startingLoads?: {
    [k: string]: StartingLoad;
  };
}
export interface StartingLoad {
  kg: Kg;
  reps?: number;
  sets?: number;
  note?: string;
}
export interface PastAssignment {
  programme: Id;
  programmeUpdatedAt: string;
  startDate: Date;
  endDate: Date;
  ended: "completed" | "early";
  notes?: string;
}
export interface Target {
  exercise: Id;
  kg?: Kg;
  reps?: number;
  sets?: number;
  seconds?: number;
  metres?: number;
  by?: Date;
  label?: string;
}
