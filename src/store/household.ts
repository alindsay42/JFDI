// Data that comes with the app: the household equipment list and the exercise library.
// No programmes come with the app: everyone builds their own (Andrew, 7 November 2026).
import equipmentJson from "../../data/equipment.json" with { type: "json" };
import libraryJson from "../../data/library.json" with { type: "json" };
import type { JFDIHouseholdEquipment } from "../formats/generated/equipment.ts";
import type { JFDIExerciseLibrary } from "../formats/generated/library.ts";
import type { JFDIProgrammeFile } from "../formats/generated/programme.ts";

export const equipment = equipmentJson as unknown as JFDIHouseholdEquipment;
export const library = libraryJson as unknown as JFDIExerciseLibrary;
export const BUNDLED_PROGRAMMES: JFDIProgrammeFile[] = [];

/**
 * Programmes that used to come with the app, by id and the versions that shipped. Each is removed from
 * a device when nobody is running it and it was never changed there.
 */
export const RETIRED_PROGRAMMES: Record<string, string[]> = {
  "strength-block-1": ["2026-11-06T23:30:00Z", "2026-11-07T16:00:00Z"],
};
