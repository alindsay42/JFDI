import type { JFDIHouseholdEquipment as JFDIEquipment } from "./generated/equipment.ts";
import type { JFDIExerciseLibrary } from "./generated/library.ts";
import type { JFDIProgrammeFile as JFDIProgramme } from "./generated/programme.ts";
import type { JFDIProfile } from "./generated/profile.ts";

/** Each function returns a list of problems, in words. An empty list means the data is fine. */
export function validateEquipment(eq: unknown): string[];
export function validateLibrary(lib: unknown, eq: JFDIEquipment): string[];
export function checkAgainstLibrary(p: JFDIProgramme, lib: JFDIExerciseLibrary, eq: JFDIEquipment): string[];
export function validateProgramme(p: unknown): string[];
export function validateProfile(
  profile: unknown,
  context: { programmes: Map<string, JFDIProgramme>; equipment: JFDIEquipment; library: JFDIExerciseLibrary },
): string[];
export function validateLog(
  log: unknown,
  context: {
    profiles: Map<string, JFDIProfile> | null;
    programmes: Map<string, JFDIProgramme>;
    library: JFDIExerciseLibrary;
  },
): string[];
export function validateBackup(
  backup: unknown,
  context: { equipment: JFDIEquipment; library: JFDIExerciseLibrary },
): string[];
