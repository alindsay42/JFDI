// Data that comes with the app: the household equipment list, the exercise library, and programmes.
import equipmentJson from "../../data/equipment.json" with { type: "json" };
import libraryJson from "../../data/library.json" with { type: "json" };
import block1 from "../../data/programmes/strength-block-1.json" with { type: "json" };
import type { JFDIHouseholdEquipment } from "../formats/generated/equipment.ts";
import type { JFDIExerciseLibrary } from "../formats/generated/library.ts";
import type { JFDIProgrammeFile } from "../formats/generated/programme.ts";

export const equipment = equipmentJson as unknown as JFDIHouseholdEquipment;
export const library = libraryJson as unknown as JFDIExerciseLibrary;
export const BUNDLED_PROGRAMMES = [block1 as unknown as JFDIProgrammeFile];
