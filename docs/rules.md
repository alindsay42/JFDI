# Training rules

Generated from the rule tables in `tests/engine/` by `npm run rules`. Do not edit by hand.

Each row is a test: the app must give exactly this answer, or the change can't be merged.

## Bodyweight target pace

The cone on the bodyweight chart: a reasonable range to land in, starting from the weigh-in when the first goal was set. Gaining is +0.5 to +1kg a month. Losing is 0.5% to 1% of the starting bodyweight a week. A goal within 0.5kg of the start is holding, with 1kg either side. A month is 30.44 days; edges are rounded to 0.1kg.

| Case | Start (kg) | Goal (kg) | Weeks since start | Latest (kg) | Range then, and where the latest sits |
| --- | --- | --- | --- | --- | --- |
| Andrew's Phase 1: 4 weeks in, up 0.6kg | 75.7 | 77 | 4 | 76.3 | 76.2 to 76.6kg: within |
| Gaining, but faster than +1kg a month | 75.7 | 77 | 4 | 77 | 76.2 to 76.6kg: above |
| Gaining, but nothing on yet | 75.7 | 77 | 4 | 75.7 | 76.2 to 76.6kg: below |
| 8 weeks of gaining | 75.7 | 79.5 | 8 | 77 | 76.6 to 77.5kg: within |
| Losing from 80kg: 0.4 to 0.8kg a week | 80 | 75 | 4 | 78 | 76.8 to 78.4kg: within |
| Losing faster than 1% a week | 80 | 75 | 4 | 76.5 | 76.8 to 78.4kg: below |
| Holding: a goal within 0.5kg of the start | 62 | 62.4 | 6 | 62.8 | 61 to 63kg: within |
| Holding, but 1.5kg up | 62 | 62.4 | 6 | 63.5 | 61 to 63kg: above |

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

## Next weight and reps

What each exercise asks for next time, from its last sessions in this programme. Linear adds weight when every set hits the reps; double builds reps to the top of the range first. Two misses in a row at the same weight drop it 10%. A hard set (RPE at or above the hold level), skipped sets, or a readiness hold keep the weight where it is.

| Case | Progression | Reps | Last sessions (most recent first) | Starting weight | Next time |
| --- | --- | --- | --- | --- | --- |
| No history: the starting weight | linear 2.5 | 5 |  | 30 | 30kg · start |
| No history and no starting weight | linear 2.5 | 5 |  | none | no weight · start |
| Every set done: add weight | linear 2.5 | 5 | 30: 5,5,5,5,5 | 30 | 32.5kg · add |
| A set short: same weight | linear 2.5 | 5 | 32.5: 5,5,5,4,4 | 30 | 32.5kg · repeat |
| Two misses in a row: drop 10% | linear 2.5 stall 2 | 5 | 40: 5,5,4 \| 40: 5,4,4 | 30 | 36kg · reduce: stalled |
| Misses at different weights don't count as a stall | linear 2.5 stall 2 | 5 | 40: 5,5,4 \| 37.5: 5,4,4 | 30 | 40kg · repeat |
| Every set done, but the last at RPE 9: hold | linear 2.5 hold 9 | 5 | 40: 5,5,5@9 | 30 | 40kg · hold: hard |
| Every set done at RPE 8: add | linear 2.5 hold 9 | 5 | 40: 5,5,5@8 | 30 | 42.5kg · add |
| Sets skipped, none missed: hold, no penalty | linear 2.5 stall 2 | 5 | 40: 5,5,- \| 40: 5,4,4 | 30 | 40kg · hold: sets skipped |
| Amber day set to hold: same weight | linear 2.5 | 5 | hold: 40: 5,5,5 | 30 | 40kg · hold: readiness |
| A skipped day doesn't count: goes by the one before | linear 2.5 | 5 | skip: 40: 5,5,5 \| 37.5: 5,5,5 | 30 | 40kg · add |
| Nothing ticked doesn't count either | linear 2.5 | 5 | 40: -,-,- \| 37.5: 5,5,5 | 30 | 40kg · add |
| Double: top of the range on every set: add, back to the bottom | double 2.5 | 8-12 | 20: 12,12,12 | 20 | 22.5kg · add |
| Double: in the range: build reps | double 2.5 | 8-12 | 20: 12,10,9 | 20 | 20kg · build reps |
| Double: below the range twice: drop 10% | double 2.5 stall 2 | 8-12 | 22.5: 8,7,6 \| 22.5: 8,7,7 | 20 | 20kg · reduce: stalled |
| Double: below the range once: repeat | double 2.5 stall 2 | 8-12 | 22.5: 8,7,6 | 20 | 22.5kg · repeat |
| Double: sets skipped: hold | double 2.5 | 8-12 | 20: 10,9,- | 20 | 20kg · hold: sets skipped |
| Slot's own increment: 1kg on the press | linear 1 | 5 | 15.5: 5,5,5 | 15.5 | 16.5kg · add |
| None: stays where it was | none | 10 | 12.5: 10,10 | 10 | 12.5kg · no change |
| Bodyweight sets: nothing to add | linear 2.5 | 8 | x: 8,8,8 | none | no weight · repeat |
| Top set at RPE 8 or less: add to top and back-off | top 2.5 @8 85% | 3 | 100: 3@8,3,3 | 90 | 102.5kg, back-off 87kg · add |
| Top set harder than planned: hold | top 2.5 @8 85% | 3 | 100: 3@9,3,3 | 90 | 100kg, back-off 85kg · hold: hard |
| Top set missed twice: drop 10% | top 2.5 @8 85% stall 2 | 3 | 100: 2,3,3 \| 100: 2,3,3 | 90 | 90kg, back-off 76.5kg · reduce: stalled |
| Top set missed once: repeat | top 2.5 @8 85% stall 2 | 3 | 100: 2,3,3 | 90 | 100kg, back-off 85kg · repeat |
| Top set on a hold day | top 2.5 @8 85% | 3 | hold: 100: 3,3,3 | 90 | 100kg, back-off 85kg · hold: readiness |

## Readiness rules on the day

On Amber and Red days, a programme's readiness rules change the workout before it starts, in the order listed. Main, Supporting and Extra are the tiers. When a group loses exercises, what's left runs as a smaller group, or on its own.

| Case | Rules | Workout (sets or rounds) |
| --- | --- | --- |
| No rules: as planned |  | squat 5 · bench+row 5 · rdl 3 · lateral+plank+ropes 3 |
| Diane's Amber: main lifts to 3 sets, extras dropped, 2 more reps in reserve | setsTo primary 3; dropTier tertiary; addRir 2 | squat 3 · bench+row 5 · rdl 3 · RIR +2 |
| Diane's Red: no lifting | noLifting | no lifting |
| Sets to 60%, rounding up | setsPercent 60 | squat 3 · bench+row 3 · rdl 2 · lateral+plank+ropes 2 |
| Sets to 60% for supporting work only | setsPercent 60 secondary | squat 5 · bench+row 3 · rdl 2 · lateral+plank+ropes 3 |
| Never fewer than 1 set | setsPercent 1 | squat 1 · bench+row 1 · rdl 1 · lateral+plank+ropes 1 |
| Drop spine-loading exercises: the row leaves, bench stands alone at the superset's rounds | dropFlagged spineLoading | bench 5 · lateral+plank+ropes 3 |
| Swap spine-loading exercises: row swaps for its alternative, others with none are dropped | swapFlagged spineLoading | bench+cs-row 5 · lateral+plank+ropes 3 · swapped row→cs-row |
| Replace with another workout, then apply the rest to it | replaceWorkout session-b; dropTier tertiary | deadlift 3 · press+pullup 5 · goblet 2 |
| Nothing after no lifting applies | noLifting; addRir 2 | no lifting |
| Dropping everything means no lifting | dropTier primary; dropTier secondary; dropTier tertiary | no lifting |

## Ad hoc: which workout is next

Workouts go in order through the cycle. A missed workout stays next up, whatever the date. After the last day of the last week, the cycle starts again.

| Case | Cycle | Last done (week.day) | Next (week.day: workout) |
| --- | --- | --- | --- |
| Nothing done yet: the first workout | A,B | none | 1.1: A |
| Day 1 done: day 2 | A,B | 1.1 | 1.2: B |
| One-week cycle: back to day 1 | A,B | 1.2 | 1.1: A |
| End of week 1 in a 2-week cycle: week 2 starts | A,B \| A2,B2 | 1.2 | 2.1: A2 |
| End of the cycle: back to week 1 | A,B \| A2,B2 | 2.2 | 1.1: A |
| Weeks can have different numbers of days | A \| B,C,D | 1.1 | 2.1: B |
| A place the plan no longer has: start of the next week | A,B \| C,D | 1.5 | 2.1: C |
| A week the plan no longer has: back to the start | A,B | 3.1 | 1.1: A |

## Ad hoc: rest days between workouts

With a minimum number of rest days set, the next workout waits until that many full days have passed since the last one.

| Case | Rest days | Last workout | Today | Days still to rest |
| --- | --- | --- | --- | --- |
| No rest days set | none | 2027-01-01 | 2027-01-02 | 0 |
| 2 rest days, the next day: 2 more | 2 | 2027-01-01 | 2027-01-02 | 2 |
| 2 rest days, Friday then Sunday: 1 more | 2 | 2027-01-01 | 2027-01-03 | 1 |
| 2 rest days, Friday then Monday: ready | 2 | 2027-01-01 | 2027-01-04 | 0 |
| Nothing done yet: ready | 2 |  | 2027-01-04 | 0 |

## Set days: which week and day a date is

Weeks run Monday to Sunday. Week 1 is the week the start date falls in, and the cycle repeats from there. Nothing is planned before the start date.

| Case | Weeks in cycle | Start date | Date | Week, day |
| --- | --- | --- | --- | --- |
| The start date itself | 2 | 2027-01-04 | 2027-01-04 | 1, mon |
| Later the same week | 2 | 2027-01-04 | 2027-01-08 | 1, fri |
| The next Monday starts week 2 | 2 | 2027-01-04 | 2027-01-11 | 2, mon |
| After the last week, back to week 1 | 2 | 2027-01-04 | 2027-01-18 | 1, mon |
| Starting on a Friday: that week is week 1, and Monday starts week 2 | 2 | 2027-01-01 | 2027-01-04 | 2, mon |
| A 1-week cycle is always week 1 | 1 | 2027-01-01 | 2027-03-17 | 1, wed |
| Before the start date: nothing | 2 | 2027-01-04 | 2027-01-03 | not started |
