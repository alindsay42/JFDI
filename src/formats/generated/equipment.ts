// Generated from schema/*.schema.json by scripts/gen-types.mjs. Do not edit; run `npm run types`.

export type Item = {
  id: Id;
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
  kg?: Kg;
  kgEach?: Kg;
  /**
   * How many, for chains, loadable handles and the like
   */
  count?: number;
  /**
   * Each plate size and how many single plates there are
   */
  plates?: {
    kg: Kg;
    count: number;
  }[];
  /**
   * Weighted kit that comes in fixed weights, such as kettlebells or sandbags: each weight and how many there are
   */
  weights?: {
    kg: Kg;
    count: number;
  }[];
  /**
   * Fixed dumbbell pairs, by weight of one dumbbell
   */
  pairsKg?: Kg[];
  /**
   * Pairs owned but not available right now, such as lent out
   */
  unavailableKg?: Kg[];
  /**
   * Library exercises this bar should be used for when there's a choice
   */
  preferredFor?: Id[];
  attachesTo?: Id;
  /**
   * Some details still to confirm
   */
  tbc?: boolean;
  notes?: string;
};
export type Id = string;
/**
 * Measured weights can be any value, such as a 19.2kg bar or 0.28kg collars
 */
export type Kg = number;

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
