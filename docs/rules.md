# Training rules

Generated from the rule tables in `tests/engine/` by `npm run rules`. Do not edit by hand.

Each row is a test: the app must give exactly this answer, or the change can't be merged.

## Estimated one-rep max

Turns a set into an estimated one-rep max, so sets of different reps can share one chart and be compared with targets. Uses the dos Remedios table, with reps between its rows worked out proportionally. Sets of more than 15 reps aren't estimated.

| Case | Weight (kg) | Reps | Estimated one-rep max (kg) |
| --- | --- | --- | --- |
| A single is the max itself | 100 | 1 | 100.0 |
| 2 reps is 92% of max | 92 | 2 | 100.0 |
| 5 reps is 85% of max | 100 | 5 | 117.6 |
| 7 reps falls between 6 (82%) and 8 (75%), so 78.5% | 100 | 7 | 127.4 |
| 15 reps is 60%, the last row | 60 | 15 | 100.0 |
| Diane's starting squat: 30kg for 5 | 30 | 5 | 35.3 |
| Diane's best squat set: 40kg for 7 | 40 | 7 | 51.0 |
| More than 15 reps isn't estimated | 20 | 16 | no estimate |
| No reps, no estimate | 100 | 0 | no estimate |
| No weight (bodyweight only), no estimate | 0 | 5 | no estimate |
