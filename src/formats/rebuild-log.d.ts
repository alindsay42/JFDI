import type { JFDIExerciseLibrary } from "./generated/library.ts";
import type { JFDITrainingLog } from "./generated/log.ts";

/**
 * Converts a Rebuild Log backup into a J.F.D.I log for one profile. Throws if the file isn't a Rebuild Log
 * backup. `problems` lists anything that couldn't be brought across, such as an exercise with no match.
 */
export function convertRebuildLog(
  backup: unknown,
  profileId: string,
  library: JFDIExerciseLibrary,
): { log: JFDITrainingLog; problems: string[] };
