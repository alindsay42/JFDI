# J.F.D.I programme file format

Status: **draft for review**, version 1 of the format.

A programme file is the whole training plan as data. Build mode writes it and Train mode reads it. Nothing about a plan is written into the app's code. This document defines what goes in the file, and the rules the app follows when it reads one.

- Machine-checkable definition: [`schema/programme.schema.json`](../schema/programme.schema.json)
- Worked example: [`examples/strength-block-1.json`](../examples/strength-block-1.json), the Strength Programme, Block 1 draft
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
├─ sessions         ordered tiers → blocks → slots
├─ weeks            which days lift, walk or rest, and the session rotation
├─ phases           blocks of weeks with gates in and out
├─ readiness        the daily Green / Amber / Red check and what each level does
└─ targets          suggested goals, which a profile can adopt
```

Every object that others point to has an `id`: lowercase letters, digits and hyphens, unique within its list (for example `back-squat`, `session-a`). References between objects always use these ids.

## Top level

| Field | Required | Meaning |
| --- | --- | --- |
| `format` | yes | Always `"jfdi-programme"` |
| `formatVersion` | yes | This document is version `1`. The app upgrades older files when it opens them |
| `id` | yes | Stable id for the programme. Survives edits, so versions of the same plan can be matched |
| `name` | yes | What people call it, such as "Strength Programme, Block 1" |
| `description` | no | One or two sentences on what it's for |
| `goal` | no | Free text, such as "Build strength and keep muscle mass" |
| `daysPerWeek` | no | For display only. The weeks decide the real schedule |
| `createdAt`, `updatedAt` | yes | ISO 8601 timestamps |
| `exercises`, `equipment`, `progressions`, `sessions`, `weeks`, `phases` | yes | Lists, described below |
| `readiness` | yes | Described below. Use preset `off` for no daily check |
| `targets` | no | Described below |

## Equipment

Only bars and other fixed-weight implements need listing, so the app knows the lightest load it can suggest. Dumbbells, cables, bands and bodyweight don't.

| Field | Meaning |
| --- | --- |
| `id` | For example `bar-standard`, `bar-junior`, `bar-ez` |
| `name` | "Standard barbell", "Junior barbell" |
| `kg` | Weight of the empty bar |

When a file is imported, its bars are matched to the household equipment list by `id`. A bar the household doesn't have is flagged, not silently swapped.

## Exercises

| Field | Required | Meaning |
| --- | --- | --- |
| `id`, `name` | yes | |
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

## Sessions

A session is three **tiers** in order: `primary`, `secondary`, `tertiary`. A session can use one, two or all three. Each tier holds one or more **blocks**, and each block holds one or more **slots**.

### Blocks

| `type` | How it runs | Fields |
| --- | --- | --- |
| `straight` | One exercise, set after set | `restSec` between sets |
| `superset` | Two exercises: one set of each, then rest | `restSec` after each pair |
| `giant` | Three or more stations in order, then rest. Repeats for `rounds` | `rounds`, `transitionSec` between stations (default 0), `restSec` after each round |
| `finisher` | Timed intervals, such as 15 s on and 45 s off for 8 rounds | `rounds`, `workSec`, `restSec` |

**Uneven supersets.** When two slots in a superset have different set counts (bench 5 sets, rows 3), they run paired until the shorter one is done. The remaining sets of the longer one run as straight sets with the block's `restSec`.

**Giant set rounds.** In a giant block, `rounds` replaces each slot's `sets`. A slot in a giant block should not set `sets`.

### Slots

| Field | Required | Meaning |
| --- | --- | --- |
| `exercise` | yes | Exercise `id` |
| `sets` | yes, except in giant blocks | Number of working sets |
| `reps` | for `load` and `reps` measures | `{ "min": 6, "max": 8 }`, or `{ "min": 5, "max": 5 }` for a fixed count |
| `seconds` | for `time` | `{ "min": 30, "max": 45 }` |
| `metres` | for `distance` | `{ "min": 30, "max": 30 }` |
| `progression` | yes | Progression `id` |
| `incrementKg` | no | Overrides the progression's jump for this slot |
| `start` | no | Suggested first load when the person has no history: `{ "kg": 30 }`, `{ "kg": "bar" }` for the empty bar, or `{ "note": "Leave 2 reps in reserve" }`. A profile's own starting loads take priority |
| `restSec` | no | Overrides the block's or exercise's rest |
| `alternatives` | no | Exercise ids offered as a like-for-like swap, such as band-assisted pull-ups or chest-supported rows |
| `optional` | no | `{ "unlock": { "fromWeek": 5 } }`. Hidden until unlocked, then offered as an extra |
| `notes` | no | Shown under the exercise during the session |

**Where rest comes from**, most specific first: slot `restSec`, then block `restSec`, then exercise `restSec`, then 90 seconds.

### Session fields

| Field | Meaning |
| --- | --- |
| `id`, `name` | `session-a`, "Session A" |
| `subtitle` | "Squat, bench and rows" |
| `estimatedMinutes` | For planning |
| `inRotation` | `false` for sessions only used by readiness rules, such as a mobility session for Red days. Default `true` |
| `tiers` | `{ "primary": [blocks], "secondary": [blocks], "tertiary": [blocks] }` |

## Weeks

A week says what each day is. Lifting days take the **next session in the rotation**, so a missed or moved day shifts the sessions along and none is skipped. The rotation carries on across weeks: with two lifting days and a rotation of A, B, week 1 is A then B, and week 2 is A then B again. With three lifting days and two sessions, it alternates A, B, A then B, A, B.

| Field | Meaning |
| --- | --- |
| `id`, `name` | |
| `days` | `mon` to `sun`, each one of the day types below |
| `rotation` | Session ids in order |

Day types:

| `type` | Meaning | Fields |
| --- | --- | --- |
| `lift` | Takes the next session in the rotation | |
| `conditioning` | A walk, ruck or interval day with a target | `activity`, `minutes` `{min, max}`, `notes` |
| `free` | Nothing planned. Classes, sport or rest are up to the person | `notes` |
| `rest` | Planned rest | `notes` |

Training early is always allowed. If a session is done on a non-lifting day, the next lifting day becomes a `free` day, so nobody ends up lifting on back-to-back days by accident. A session done to make up a missed day doesn't move anything.

## Phases and blocks of weeks

A **phase** has a focus and one or more **blocks**. A block is a run of weeks using one week template.

Block fields:

| Field | Meaning |
| --- | --- |
| `id`, `name` | |
| `week` | Week template `id` |
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
| `dropTier` | Removes a whole tier | `tier` |
| `dropFlagged` | Removes exercises with a flag, such as `spineLoading` | `flag` |
| `swapFlagged` | Swaps flagged exercises for their `alternatives`, or drops them if there are none | `flag` |
| `addRir` | Asks for that many more reps in reserve on every set | `reps` |
| `replaceSession` | Runs a different session instead | `session` |
| `noLifting` | No session today | |

And one rule that affects progression:

| `progressionOnThisDay` | Meaning |
| --- | --- |
| `normal` | Completed sets count as usual |
| `hold` | The next session repeats today's weights |
| `skip` | Today doesn't count at all; the planned session moves to next time |

## Targets

Suggested goals that come with the programme. A profile can adopt, change or ignore them.

```json
{ "exercise": "back-squat", "kg": 40, "reps": 5, "sets": 5, "label": "Previous best" }
```

Charts convert targets and logged sets to an estimated one-rep max using the dos Remedios table.

## Not in the file

| Lives in | What |
| --- | --- |
| The profile | Who runs the programme, start date, starting loads from their own history, adopted targets, bars they can't use (the SSB for your wife) |
| The log | Every session as performed, with a copy of its prescription; daily lights; walks; bodyweight |
| The household | The equipment list with real bar weights, the shared exercise library |

## Not covered yet

These come in later versions of the format. Files written now will be upgraded automatically.

- **RPE-based progression** (requirement PR-3): the next load worked out from the RPE logged on each set.
- **Percentage of an estimated max** (PR-4).
- **Uneven jumps**, such as "2.5kg every second successful session" on a light overhead press. For now the example covers this with a note on the slot.
- **Chains** (EQ-4): logged on the set, so they belong to the log format rather than the programme.

## Open questions

1. **Day names or "lifting days per week".** This draft uses named days (Monday and Thursday). The alternative is "2 lifting days per week, any days, at least 2 days apart", which suits someone with classes that move about. Named days are simpler and match the calendar, so they're the default here.
2. **Profile starting loads.** Should the profile hold a starting load per exercise, or just a list of recent sets that the app reads like history? The second is closer to how the log already works.
3. **Mobility on Red days.** The example uses a short mobility session marked `inRotation: false`. Is that the right shape, or should Red days point at a separate library of mobility routines?
