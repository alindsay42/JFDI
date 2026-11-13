// Generated from schema/*.schema.json by scripts/gen-types.mjs. Do not edit; run `npm run types`.

export type Id = string;
export type Pattern =
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
 * Exercise families and their variations. Each variation is its own exercise with its own history. See docs/equipment-and-library.md.
 */
export interface JFDIExerciseLibrary {
  format: "jfdi-library";
  formatVersion: 1;
  updatedAt: string;
  /**
   * @minItems 1
   */
  families: [Family, ...Family[]];
  /**
   * @minItems 1
   */
  exercises: [Exercise, ...Exercise[]];
}
export interface Family {
  id: Id;
  name: string;
  pattern: Pattern;
  /**
   * The ways exercises in this family differ, in plain words
   */
  variations: string;
}
export interface Exercise {
  id: Id;
  name: string;
  family: Id;
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
  pattern: Pattern;
  /**
   * Equipment ids needed, apart from the bar itself
   */
  requires: Id[];
  muscles?: string[];
  flags?: ("spineLoading" | "rotation" | "overhead" | "impact")[];
  restSec?: number;
  notes?: string;
}
