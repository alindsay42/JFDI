# Profiles and the training log

Status: **draft for review**, version 1 of both formats.

These are the last two pieces of the data model. With programmes, equipment and the library, they cover everything J.F.D.I stores.

| File | One per | Holds | Schema | Example |
| --- | --- | --- | --- | --- |
| Profile | person | Who they are, what they're running, their own limits and starting loads | [`profile.schema.json`](../schema/profile.schema.json) | [`examples/profiles/diane.json`](../examples/profiles/diane.json) |
| Training log | person | Sessions as performed, daily check-ins and activities, bodyweight | [`log.schema.json`](../schema/log.schema.json) | [`examples/logs/diane-week-1.json`](../examples/logs/diane-week-1.json) |

```
household:  equipment.json, library.json, programme files
person:     profile ──runs──▶ a programme
            log ─────records─▶ what actually happened, with a copy of what was prescribed
```

The example log is **made up** to show the format: an illustrative first week on Block 1, not real training.

## Profile

| Field | Required | Meaning |
| --- | --- | --- |
| `id`, `name` | yes | `name` is what the profile switcher shows, such as "Diane" |
| `colour` | yes | Shown on every Train screen, so nobody logs into the wrong profile on the shared tablet (PF-3) |
| `display` | no | `weightUnits` (`kg` or `kg-and-lb`) and `theme` (`device`, `light`, `dark`). Everything is stored in kg |
| `unavailableEquipment` | no | Household equipment this person can't use. Diane's lists `bar-ssb` |
| `excludedExercises` | no | Library exercises this person doesn't want offered, for any reason |
| `readiness` | no | Overrides the active programme's daily check, in the same shape as a programme's `readiness` |
| `programmes.active` | no | The programme being run now (see below) |
| `programmes.history` | yes | Programmes finished or ended early (AR-11), each with start and end dates |
| `targets` | no | Goals this person has adopted, copied from a programme or set by hand, with an optional `by` date |

Everything about one person lives here, never in the programme, so two people can run the same programme file.

### The active programme

| Field | Meaning |
| --- | --- |
| `programme` | The programme's id |
| `programmeUpdatedAt` | Which version of it. If the programme is edited, the profile moves to the new version when the change is saved, and past sessions keep their own copies |
| `startDate` | Week 1 starts here |
| `startingLoads` | Exercise id to `{ kg, reps, sets }`. Used for the first session of each exercise, then the log takes over. These win over a programme slot's own `start` |

Diane's profile is purple and starts Block 1 on Friday 1 January 2027. Her starting loads are the lowest of her recent numbers: squat 30kg, bench 25kg, overhead press 15.5kg, deadlift 55kg, Romanian deadlift 30kg and row 15kg.

### Profile checks

- Every unavailable item, excluded exercise and target refers to something that exists.
- The active programme exists, and its version matches.
- Starting loads are only for exercises the programme uses.
- The profile can actually run the programme. For example, if both standard bars were marked unavailable, any programme needing a standard bar is flagged.

## Training log

A log has three lists: `sessions`, `days` and `bodyweight`.

### Sessions

| Field | Meaning |
| --- | --- |
| `id`, `date` | `date` is the local calendar date, used for the calendar |
| `startedAt`, `finishedAt` | Timestamps. `finishedAt` is required once `status` is `done` |
| `status` | `active` while training (the app saves as you go), then `done`. A discarded session is deleted, not kept |
| `programme` | `{ id, updatedAt, phase, block, week }`, or `null` for a session outside any programme |
| `session` | `{ id, name, subtitle }` of the session template |
| `readiness` | The day's level (`green`, `amber`, `red`), or `null` when the check is off |
| `deload` | `true` in a deload week |
| `prescribed` | **A copy of the session as prescribed that day**, after readiness and deload rules were applied. Same shape as a programme session. This is what lets a programme be edited without rewriting history (AR-4, AR-5) |
| `exercises` | What was actually done, in order (below) |
| `notes`, `endedEarly` | Free text; `endedEarly` holds the reason, such as "Light-headed or sick" |
| `check48h` | `{ status, at }`, where `status` is `same`, `settling` or `worse`. `null` until answered |
| `importedFrom` | Set on sessions imported from another app, such as `rebuild-log` |

### Exercises in a session

| Field | Meaning |
| --- | --- |
| `exercise`, `name` | Library id, plus the name at the time, so history still reads correctly if the library renames something |
| `slot` | Where it sits in `prescribed`, as `tier.block.slot`, such as `secondary.0.1` for the rows in the bench superset. `null` for an exercise added during the session |
| `loadPer` | `each` when kg is per hand |
| `added` | `true` if added during the session (LG-4) |
| `removed` | `{ reason }` if removed during the session. Sets already done stay; the rest are dropped. Removal never affects progression |
| `swappedFrom` | The prescribed exercise it replaced, such as `band-pull-up` swapped for `chest-supported-db-row` |
| `sets` | One entry per set (below) |

### Sets

| Field | Meaning |
| --- | --- |
| `done` | Ticked as completed. Unticked sets are kept, so the log shows what was planned but not done |
| `kg` | Total load, bar included. Any value is allowed, so collars can be recorded exactly, such as 16.06kg |
| `reps`, `seconds`, `metres`, `calories` | Whichever the exercise is measured by. A completed set must have it |
| `rpe` | 1 to 10 in half steps (LG-2). Feeds progression: a set at the programme's `holdIfRpeAtLeast` holds the weight |
| `chains` | Number of chains hung on the bar, counted separately from `kg` (EQ-4) |
| `side` | `left` or `right`, for per-side exercises logged one side at a time |

### Days and bodyweight

A **day** holds anything that isn't a session: the daily check (`readiness`), `activities` such as a walk or ruck (each a library exercise with `minutes`, and optionally `kg` or `metres`), and `notes`. There's one entry per date, and only for dates with something in them.

A **weigh-in** is `{ date, kg, fasted }`. `fasted` means morning, before food and drink. There's one per date.

### Log checks

- Every exercise, swap and activity is in the library, and each set records what that exercise is measured by, and nothing else.
- Every `slot` points at a real slot in the session's `prescribed`, and that slot prescribes this exercise (or the one it was swapped from).
- Added exercises have no slot. Only added exercises may have `slot: null`.
- Programme sessions name a real programme and session, and carry their prescription.
- Times are in order: finished after started, 48-hour check after finishing.
- No duplicate session ids, days or weigh-ins.

## Importing from Rebuild Log

[`scripts/import-rebuild-log.mjs`](../scripts/import-rebuild-log.mjs) turns a Rebuild Log backup into a J.F.D.I log (DA-1):

```
node scripts/import-rebuild-log.mjs rebuild-log-backup.json --profile andrew --out andrew-log.json
```

| Rebuild Log | J.F.D.I |
| --- | --- |
| Finished sessions | Sessions with `programme: null` and `importedFrom: "rebuild-log"`. Rebuild Log's phase and week go into the notes |
| Back light (Green, Amber, Red) | `readiness` |
| 48-hour check | `check48h`, same three answers |
| Removed and added exercises | `removed` with its reason, `added` |
| Ended early | `endedEarly` |
| Walks | A day activity: `walk` with minutes |
| Daily routine ticks | Day notes, such as "Daily routine: 4 of 5 done" |
| Bodyweight | Weigh-ins |
| The programme itself | **Not imported.** J.F.D.I has no recovery programme |

Exercises are mapped to library exercises. Most map one to one, such as `ssb` to `ssb-squat-heels-raised` and `csrow` to `chest-supported-db-row`. A few depend on what was logged:

- Pull-ups, neutral-grip pull-ups and dips become the weighted versions if any set had weight added.
- Hyperextensions become `back-extension-plate-chest` if a plate was held, otherwise `back-extension-pause`.

The full table is at the top of the script. An exercise with no mapping is reported, never silently dropped.

`npm test` runs the importer on a sample backup (the made-up 8-week test data from Rebuild Log, in [`tests/fixtures/`](../tests/fixtures/)). It checks that every session and weigh-in comes across, and that the result passes every log check.

## Decisions

Settled on 6 Nov:

1. **Diane's profile:** name "Diane", colour purple.
2. **Start date:** Friday 1 January 2027, so J.F.D.I can be built first. If she wants to start sooner, a copy of Rebuild Log can run Block 1 in the meantime.
3. **Your history:** all of Rebuild Log comes across when you move to J.F.D.I, so the lift charts show the whole recovery.

Settled on 7 Nov:

4. **Starting weights** are set with their sets and reps, all three editable on the setup screen.
5. **No equipment restrictions on the setup screen.** `unavailableEquipment` stays in the format, and an existing value is kept, but the app doesn't ask for it. Nothing should get in the way unnecessarily.
