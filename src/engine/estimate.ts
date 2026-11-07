// Estimated one-rep max, from the dos Remedios table (programme-format.md, "Targets").
// Percent of one-rep max that can be lifted for a given number of reps.
const TABLE: ReadonlyArray<readonly [reps: number, percent: number]> = [
  [1, 100], [2, 92], [3, 90], [4, 87], [5, 85], [6, 82], [8, 75], [10, 70], [12, 65], [15, 60],
];

export const MAX_REPS_FOR_ESTIMATE = 15;

/** Percent of one-rep max for this many reps, interpolating between table rows. Null outside 1 to 15. */
export function percentOfMax(reps: number): number | null {
  if (!Number.isFinite(reps) || reps < 1 || reps > MAX_REPS_FOR_ESTIMATE) return null;
  let i = 1;
  while (reps > TABLE[i]![0]) i++;
  const [r0, p0] = TABLE[i - 1]!;
  const [r1, p1] = TABLE[i]!;
  return p0 + ((reps - r0) / (r1 - r0)) * (p1 - p0);
}

/** Estimated one-rep max in kg, or null when it can't be estimated (no load, or reps outside 1 to 15). */
export function estimateOneRepMax(kg: number, reps: number): number | null {
  if (!(kg > 0)) return null;
  const pct = percentOfMax(reps);
  return pct === null ? null : (kg * 100) / pct;
}
