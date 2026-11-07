import { readFileSync } from "node:fs";
import type { JFDIProgrammeFile } from "../../src/formats/generated/programme.ts";

/** Diane's Block 1, kept as an example programme (not built into the app). */
export const BLOCK1 = JSON.parse(readFileSync("examples/programmes/strength-block-1.json", "utf8")) as JFDIProgrammeFile;
