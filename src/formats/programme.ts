// Hand-written types for the parts of a programme the app works with most: workouts, their items,
// and the plan. The generated types follow the schema's oneOf branches loosely; these say exactly
// which fields each kind of item has. The schema stays the source of truth.
import type {
  Exercise, JFDIProgrammeFile, Range, Slot,
} from "./generated/programme.ts";

export type { Exercise, Range, Slot };
export type Tier = "primary" | "secondary" | "tertiary";
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface SingleItem { type: "single"; tier: Tier; restSec?: number; slots: [Slot] }
export interface SupersetItem { type: "superset"; tier: Tier; rounds: number; restSec?: number; slots: [Slot, Slot] }
export interface GiantItem { type: "giant"; tier: Tier; rounds: number; transitionSec?: number; restSec?: number; slots: Slot[] }
export interface FinisherItem { type: "finisher"; tier: Tier; rounds: number; workSec: number; restSec: number; slots: Slot[] }
export type GroupItem = SupersetItem | GiantItem | FinisherItem;
export type Item = SingleItem | GroupItem;

export interface Workout {
  id: string;
  name: string;
  subtitle?: string;
  estimatedMinutes?: number;
  items: Item[];
}

export type OtherDay =
  | { type: "conditioning"; activity: string; minutes?: Range; notes?: string }
  | { type: "free" | "rest"; notes?: string };
export type Day = { type: "workout"; workout: string; notes?: string } | OtherDay;

export interface AdhocWeek { workouts: string[]; otherDays?: OtherDay }
export interface SetDaysWeek { days: Record<Weekday, Day> }
export type Plan =
  | { mode: "adhoc"; minRestDays?: number; weeks: AdhocWeek[] }
  | { mode: "setDays"; weeks: SetDaysWeek[] };

export type Programme = Omit<JFDIProgrammeFile, "workouts" | "plan"> & { workouts: Workout[]; plan: Plan };

/** The same file, seen through the exact types. Safe for any programme that has passed its checks. */
export const asProgramme = (p: JFDIProgrammeFile) => p as unknown as Programme;
export const asFile = (p: Programme) => p as unknown as JFDIProgrammeFile;

/** How many sets of a slot are done: its own sets when it stands alone, otherwise its group's rounds. */
export const setsOf = (item: Item, slot: Slot) => (item.type === "single" ? slot.sets : item.rounds);
