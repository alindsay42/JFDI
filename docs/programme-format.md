# J.F.D.I programme file format

Status: **version 2** of the format, from 7 November 2026: workouts and a week planner, as described in [programme-editor.md](programme-editor.md). Version 1 files are upgraded automatically (see Upgrading below).

A programme file is the whole training plan as data. Build mode writes it and Train mode reads it. Nothing about a plan is written into the app's code. This document defines what goes in the file, and the rules the app follows when it reads one.

- Machine-checkable definition: [`schema/programme.schema.json`](../schema/programme.schema.json)
- Worked example: [`data/programmes/strength-block-1.json`](../data/programmes/strength-block-1.json), the Strength Programme, Block 1 draft
- Check every example: `npm run validate`

## Principles

1. **The file is the plan, never the log.** Training history lives in the log. Each logged session keeps a copy of what was prescribed, so editing a programme never rewrites the past.
2. **Self-contained.** A file carries the exercises and bars it uses, so it can be exported, kept as a version, imported on another device, or sent to Claude for review.
3. **Not tied to a person or a date.** The same file can be run by two people. Who runs it, when they start, and their starting loads belong to the person's profile, not the file.
4. **Weights are kilograms and totals.** A load always includes the bar: 100kg means 100kg. Pounds are a display choice only.
5. **Nothing is locked by the app.** Restrictions such as "no rotation" or "no conditioning on Amber days" are rules written in the file. The app only follows them.

## The shape of a file

```
programme
├─ exercises        what each movement is and how it's measured
├─ equipment        bars the exercises use, with their weights
├─ progressions     named rules for when weight goes up
├─ workouts         an ordered list of items: single exercises and groups
├─ plan             a cycle of 1 to 4 weeks, ad hoc or on set days
├─ phases           blocks of weeks with gates in and out
├─ readiness        the daily Green / Amber / Red check and what each level does
└─ targets          suggested goals, which a profile can adopt
```

Every object that others point to has an `id`: lowercase letters, digits and hyphens, unique within its list (for example `back-squat`, `session-a`, which is a workout id kept from version 1). References between objects always use these ids.

## Top level

| Field | Required | Meaning |
| --- | --- | --- |
| `format` | yes | Always `"jfdi-programme"` |
| `formatVersion` | yes | This document is version `2`. The app upgrades older files when it opens them |
| `id` | yes | Stable id for the programme. Survives edits, so versions of the same plan can be matched |
| `name` | yes | What people call it, such as "Strength Programme, Block 1" |
| `description` | no | One or two sentences on what it's for |
| `goal` | no | Free text, such as "Build strength and keep muscle mass" |
| `createdAt`, `updatedAt` | yes | ISO 8601 timestamps |
| `exercises`, `equipment`, `progressions`, `workouts`, `phases` | yes | Lists, described below |
| `plan` | yes | Described below |
| `readiness` | yes | Described below. Use preset `off` for no daily check |
| `targets` | no | Described below |

## Equipment

Only bars and other fixed-weight implements need listing, so the app knows the lightest load it can suggest. Dumbbells, cables, bands and bodyweight don't.

| Field | Meaning |
| --- | --- |
| `id` | For example `bar-standard`, `bar-junior`, `bar-ez` |
| `name` | "Standard barbell", "Junior barbell" |
| `barType` | `standard`, `junior`, `ez`, `ssb`, `trap`, `log` or `swiss` |
| `kg` | Weight of the empty bar |

When a file is imported, its bars are matched to the household's bars by `barType`. A bar type the household doesn't have is flagged, not silently swapped. See [equipment-and-library.md](equipment-and-library.md).

## Exercises

| Field | Required | Meaning |
| --- | --- | --- |
| `id`, `name` | yes | The library exercise's id and name. A programme's exercises must match the library ([equipment-and-library.md](equipment-and-library.md)) |
| `family` | no | The library family, copied for convenience |
| `measure` | yes | How a set is recorded: `load` (kg and reps), `reps` (reps only, optional kg), `time` (seconds), `distance` (metres, optional kg), `calories` |
| `implement` | yes | `barbell`, `dumbbell`, `kettlebell`, `cable`, `machine`, `band`, `bodyweight`, `other` |
| `bar` | if barbell | Equipment `id`. Suggested loads never go below this bar's weight |
| `loadPer` | no | `total` (default) or `each` for a pair of dumbbells or carry handles, so "20kg each" is clear |
| `perSide` | no | `true` when reps or time are counted per side, such as side planks |
| `pattern` | yes | `squat`, `hinge`, `push`, `pull`, `lunge`, `carry`, `core`, `isolation`, `conditioning`, `mobility` |
| `muscles` | no | For weekly volume later, such as `["quads", "glutes"]` |
| `flags` | no | Any of `spineLoading`, `rotation`, `overhead`, `impact`. Readiness rules can act on these |
| `restSec` | no | Default rest after a set, used when a slot doesn't set one |
| `notes` | no | Coaching cues shown during a session |

## Progressions

A progression is a named rule. Slots point to one by `id`, so changing the rule changes every slot that uses it.

| `type` | Rule | Fields |
| --- | --- | --- |
| `linear` | All prescribed reps on every set: add `incrementKg` next time | `incrementKg`, `holdIfRpeAtLeast`, `stall` |
| `double` | Build reps until every set reaches the top of the slot's range, then add `incrementKg` and drop back to the bottom | `incrementKg`, `holdIfRpeAtLeast`, `stall` |
| `topSetBackoff` | One top set at `topRpe`; back-off sets at `backoffPercent` of it. Top set weight moves by the `linear` rule | `incrementKg`, `topRpe`, `backoffPercent` |
| `none` | Never suggests a change. For mobility and warm-up style work | |

- `holdIfRpeAtLeast`: if any set was logged at this RPE or above, the weight holds even though the reps were done. Example: `9`.
- `stall`: `{ "misses": 2, "reducePercent": 10 }` means two sessions running that miss the reps at the same weight trigger a 10% drop.
- `incrementKg` can be overridden per slot, for example 1kg on an overhead press with fractional plates.

Readiness can hold or reduce a progression (see Readiness). Removing an exercise during a session has no effect on its progression.

## Workouts

A workout is one ordered list of **items**. Each item is a single exercise or a group, and holds one or more **slots** (an exercise with its targets).

### Items

| `type` | How it runs | Fields |
| --- | --- | --- |
| `single` | One exercise, set after set. Its slot has `sets` | `restSec` between sets |
| `superset` | Two exercises: one set of each, then rest, for `rounds` | `rounds`, `restSec` after each round |
| `giant` | Three or more exercises in order, then rest, for `rounds` | `rounds`, `transitionSec` between exercises (default 0), `restSec` after each round |
| `finisher` | Timed intervals, such as 15 s on and 45 s off for 8 rounds | `rounds`, `workSec`, `restSec` |

**Groups run in rounds.** Every exercise in a superset, giant set or finisher does the same number of sets: the group's `rounds`. Slots in a group never set `sets`. Each exercise keeps its own weight and reps or time. While training, any set can be skipped.

**Tiers.** Every item has a `tier`: `primary` (main lifts), `secondary` (supporting work) or `tertiary` (extras). Tiers don't change the order, which is the order of the list. They're what readiness rules act on, such as "on Amber days, drop the extras".

### Slots

| Field | Required | Meaning |
| --- | --- | --- |
| `exercise` | yes | Exercise `id` |
| `sets` | in `single` items only | Number of working sets |
| `reps` | for `load` and `reps` measures | `{ "min": 6, "max": 8 }`, or `{ "min": 5, "max": 5 }` for a fixed count |
| `seconds` | for `time` | `{ "min": 30, "max": 45 }` |
| `metres` | for `distance` | `{ "min": 30, "max": 30 }` |
| `progression` | yes | Progression `id` |
| `incrementKg` | no | Overrides the progression's jump for this slot |
| `start` | no | Suggested first load when the person has no history: `{ "kg": 30 }`, `{ "kg": "bar" }` for the empty bar, or `{ "note": "Leave 2 reps in reserve" }`. A profile's own starting loads take priority |
| `restSec` | no | Overrides the item's or exercise's rest |
| `alternatives` | no | Exercise ids offered as a like-for-like swap, such as band-assisted pull-ups or chest-supported rows |
| `optional` | no | `{ "unlock": { "fromWeek": 5 } }`. Hidden until unlocked, then offered as an extra |
| `notes` | no | Shown under the exercise during the session |

**Where rest comes from**, most specific first: slot `restSec`, then item `restSec`, then exercise `restSec`, then 90 seconds.

### Workout fields

| Field | Meaning |
| --- | --- |
| `id`, `name` | `session-a`, "Session A" |
| `subtitle` | "Squat, bench and rows" |
| `estimatedMinutes` | For planning |
| `items` | The ordered list above |

A workout that isn't in the plan must be used by a readiness rule (such as a light workout swapped in on Red days), or it's flagged.

## Plan

The plan is a **cycle of 1 to 4 weeks** that repeats: 1 week is the same every week, 2 alternate (heavy then light, say), and 3 or 4 go back to Week 1 after the last. A workout can appear in more than one place.

`mode` is one of two choices for the whole programme.

### Ad hoc

Workouts are done **in order**, on whichever days suit, as Day 1, Day 2 and so on.

```json
{ "mode": "adhoc", "minRestDays": 2, "weeks": [{ "workouts": ["session-a", "session-b"], "otherDays": { "type": "free", "notes": "Classes, or rest" } }] }
```

| Field | Meaning |
| --- | --- |
| `minRestDays` | Full days off between workouts. Optional |
| `weeks[].workouts` | 1 to 7 workout ids, in order |
| `weeks[].otherDays` | What the days without a workout are: `conditioning`, `free` or `rest` |

- A missed workout stays next up. The person can choose **Skip to next workout**.
- A week ends when its workouts are done; then the next week of the cycle starts.

### Set days

Each week names every day, `mon` to `sun`. **The calendar decides the week**, counted from the profile's start date.

```json
{ "mode": "setDays", "weeks": [{ "days": { "mon": { "type": "workout", "workout": "squat-day" }, "tue": { "type": "rest" }, "...": "..." } }] }
```

- A missed workout stays missed. Nothing moves, so no other workout is knocked out.

Day types:

| `type` | Meaning | Fields |
| --- | --- | --- |
| `workout` | Set days only: this workout | `workout`, `notes` |
| `conditioning` | A walk, ruck or interval day with a target | `activity`, `minutes` `{min, max}`, `notes` |
| `free` | Nothing planned. Classes, sport or rest are up to the person | `notes` |
| `rest` | Planned rest | `notes` |

## Phases and blocks of weeks

A **phase** has a focus and one or more **blocks**. A block is a run of weeks of the plan.

Block fields:

| Field | Meaning |
| --- | --- |
| `id`, `name` | |
| `weeks` | Number of weeks, or `null` for "until it stalls" |
| `deload` | `{ "everyWeeks": 6, "setsPercent": 60, "loadPercent": 60 }`, and/or `"afterStalls": 2` |
| `endWhen` | Free text for an open-ended block, such as "Most main lifts have stalled once" |

Phase fields: `id`, `name`, `focus`, `blocks` (ordered), and `gates`.

Gates are checks for moving on, shown to the person but never enforced. A phase's `gates.exit` list can hold:

- `{ "type": "text", "text": "..." }` for anything judged by eye
- `{ "type": "lift", "exercise": "back-squat", "kg": 40, "reps": 5, "sets": 5 }`, which the app ticks off from the log

## Readiness

The daily check. `preset` picks a starting point (`freshness`, `injury`, `off`). The `levels` hold the actual wording and rules, so the file always says exactly what will happen.

| Field | Meaning |
| --- | --- |
| `preset` | `freshness`, `injury` or `off` |
| `check48h` | `true` to ask "how did that session sit?" about 48 hours later. On by default for `injury` only |
| `levels` | `green`, `amber`, `red`, each with `label`, `description` and `rules` |

Rules are applied in order when a session starts on that day:

| `rule` | Effect | Fields |
| --- | --- | --- |
| `setsPercent` | Scales the number of sets, rounding up, minimum 1 | `tier` (optional), `percent` |
| `setsTo` | Sets a fixed number of sets | `tier`, `sets` |
| `dropTier` | Removes every item in a tier | `tier` |
| `dropFlagged` | Removes exercises with a flag, such as `spineLoading` | `flag` |
| `swapFlagged` | Swaps flagged exercises for their `alternatives`, or drops them if there are none | `flag` |
| `addRir` | Asks for that many more reps in reserve on every set | `reps` |
| `replaceWorkout` | Runs a different workout instead | `workout` |
| `noLifting` | No workout today | |

And one rule that affects progression:

| `progressionOnThisDay` | Meaning |
| --- | --- |
| `normal` | Completed sets count as usual |
| `hold` | The next session repeats today's weights |
| `skip` | Today doesn't count at all; the planned workout moves to next time |

## Targets

Suggested goals that come with the programme. A profile can adopt, change or ignore them.

```json
{ "exercise": "back-squat", "kg": 40, "reps": 5, "sets": 5, "label": "Previous best" }
```

Charts convert targets and logged sets to an estimated one-rep max using the dos Remedios table.

## Not in the file

| Lives in | What |
| --- | --- |
| The profile | Who runs the programme, start date, a starting load per exercise (a profile's own numbers win over a slot's `start`), adopted targets, bars they can't use (the SSB for your wife) |
| The log | Every workout as performed (a session), with a copy of its prescription; daily lights; walks; bodyweight |
| The household | The equipment list with real bar weights, the shared exercise library |

## Not covered yet

These come in later versions of the format. Files written now will be upgraded automatically.

- **RPE-based progression** (requirement PR-3): the next load worked out from the RPE logged on each set.
- **Percentage of an estimated max** (PR-4).
- **Uneven jumps**, such as "2.5kg every second successful session" on a light overhead press. For now the example covers this with a note on the slot.
- **Chains** (EQ-4): logged on the set, so they belong to the log format rather than the programme.

## Upgrading

[`src/formats/upgrade.js`](../src/formats/upgrade.js) upgrades version 1 files when a backup is restored or the app's database is opened:

| Version 1 | Version 2 |
| --- | --- |
| `sessions`, each with tiers of blocks | `workouts`, each with one list of items that keep their tier |
| `straight` block | `single` item |
| `superset` with sets on each slot | `superset` with `rounds`: the most sets of its two slots |
| `weeks` with a rotation, `perWeek` | `plan` in `adhoc` mode, the rotation laid out over 1 to 4 weeks |
| `weeks` with a rotation, `days` | `plan` in `setDays` mode, lifting days taking the rotation in turn |
| `replaceSession` rule | `replaceWorkout` |
| Log slots `tier.block.slot` | `item.slot` |

## Decisions

Settled on 6 Nov:

1. **Days:** Block 1 is ad hoc: Session A then Session B, any days, at least 2 days apart.
2. **Starting loads:** a number per exercise, held in the profile. For Block 1, these are the lowest of her recent numbers.
3. **Red days:** no mobility session. In Block 1, Red means no session today, and the planned session moves to next time.

Settled on 7 Nov ([programme-editor.md](programme-editor.md)):

4. **Version 2:** workouts and the week planner replace sessions, tiers-as-structure and rotations.
5. **Groups run in rounds.** Block 1's superset is 5 rounds of bench press and barbell row, so rows go from 3 sets to 5.
