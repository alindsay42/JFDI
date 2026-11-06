# Equipment and exercise library

Status: **draft for review**, version 1 of both formats.

Two household-level files sit alongside programmes:

| File | What it holds | Schema |
| --- | --- | --- |
| [`data/equipment.json`](../data/equipment.json) | Everything in the gym, with the details that matter for planning | [`schema/equipment.schema.json`](../schema/equipment.schema.json) |
| [`data/library.json`](../data/library.json) | Every exercise the equipment allows, grouped into families | [`schema/library.schema.json`](../schema/library.schema.json) |

The full list of both, as readable tables, is in [`catalogue.md`](catalogue.md). It's generated from the data files, so it can't drift out of date (`npm test` fails if it does).

## How the pieces fit

```
equipment.json   what's in the garage
      │  exercises say which equipment they need
library.json     families → exercises (every variation is its own exercise)
      │  programmes copy the exercises they use
programme file   sessions, weeks, phases (see programme-format.md)
```

- Build mode offers only exercises whose equipment the household has.
- A programme carries its own copy of each exercise it uses (so the file stands alone). When it's checked, each copy must match the library: same measure, same implement, and a bar the library allows.
- Profiles add their own limits on top, such as "never offer the SSB" for your wife.

## Equipment

Each item has an `id`, a `name` and a `kind`. Other fields depend on the kind.

| `kind` | Extra fields | Examples |
| --- | --- | --- |
| `bar` | `barType`, `kg` (required) | Standard, junior, EZ, SSB, trap bar, log, Swiss bar |
| `bar` (optional) | `preferredFor`: exercises this bar is the first choice for | Beater bar for bench, Bastard bar for deadlifts and Olympic lifts |
| `plates` | `plates` (required): each size and how many single plates | Bumpers, iron plates, rubber-coated plates |
| `collars` | `kg` once weighed | The heavy collars used for micro-loading |
| `chains` | `kgEach`, `count` | Mirafit chains |
| `dumbbells` | `pairsKg` for fixed pairs, `unavailableKg` for pairs lent out, `count` for loadable handles | The dumbbell set, the loadable handles |
| `odd-object` | `kg` | Sandbag |
| `rack` | | The Riot cage |
| `attachment` | `attachesTo` (required) | Safety arms, monolift arms, landmine, ABX leg extension |
| `bench`, `station`, `cable`, `handle` | | ABX bench, hyperextension bench, GHD, dip bars, pull-up bar, pulleys, landmine handles |
| `conditioning`, `accessory` | | Battle ropes, boxing bag, bands, belts, mats |

Any item can carry `tbc: true` when details are still to be confirmed, plus free-text `notes`.

**Bar types.** Exercises name the *type* of bar they use (`standard`, `junior`, `ez`, `ssb`, `trap`, `log`, `swiss`), not a particular bar. You have two standard 20kg bars, and either works for any standard-bar exercise. When there's a choice, `preferredFor` says which comes first: the non-rotating Beater bar for bench, and the Bastard bar (sharper knurling) for deadlifts and Olympic lifts.

**What the plates and dumbbells mean for planning.**

- **Plates:** 335kg in total across three sets. The smallest plates are 1.25kg, so the smallest barbell jump is **2.5kg**. The heavy collars can make smaller jumps once they're weighed.
- **Dumbbells:** fixed pairs from 5kg to 50kg. Below 15kg they go up in 2.5kg steps. Above 15kg they go up in 5kg steps, since there's no 17.5kg or 22.5kg pair. The 7.5kg and 10kg pairs are lent out, so the app won't suggest them until they're marked as back.
- **Loadable dumbbell handles** take over above 50kg, for heavy carries.

## Exercise library

### Families and variations

Every variation is its own exercise, with its own id, history and progress chart. Exercises are grouped into **families**, which describe how their members differ.

For example, the back extension family (45-degree bench) varies by:

- **legs:** both, or one
- **load:** none, plate held at the chest, plate behind the head, dumbbell, barbell, band
- **emphasis:** hip-led with a flat back, or spinal (rounding through)
- **tempo:** normal, or a 2-second hold at the top

The library holds the useful combinations as separate exercises, such as `back-extension-plate-chest`, `back-extension-plate-head` and `back-extension-single-leg`. It doesn't hold every possible combination. A new one is added when someone actually wants to train it.

Families are what make swaps easy. When an exercise is removed in a session, or Amber rules need a gentler option, the app offers others from the same family first.

### Exercise fields

| Field | Required | Meaning |
| --- | --- | --- |
| `id`, `name` | yes | |
| `family` | yes | Family `id` |
| `measure` | yes | `load`, `reps`, `time`, `distance`, `calories` (as in the programme format) |
| `implement` | yes | `barbell`, `dumbbell`, `kettlebell`, `cable`, `machine`, `band`, `bodyweight`, `other` |
| `barTypes` | for barbell exercises | Bars it can be done with, default first. Straight-bar lifts allow `standard` and `junior`, so the kids can use the same exercises |
| `requires` | yes | Equipment ids needed apart from the bar, such as `["rack", "rack-safeties"]`. Empty for things that need nothing |
| `pattern` | yes | `squat`, `hinge`, `push`, `pull`, `lunge`, `carry`, `core`, `isolation`, `conditioning`, `mobility` |
| `loadPer` | no | `each` when the weight is per hand, such as dumbbells in a farmer's carry |
| `perSide` | no | `true` when reps or time are counted per side |
| `muscles` | no | Used later for weekly volume |
| `flags` | no | `spineLoading`, `rotation`, `overhead`, `impact`. Readiness rules can act on these |
| `restSec` | no | Default rest |
| `notes` | no | Cues, and anything that makes the variation different |

**What "load" means for odd exercises.** For a plate-held back extension, the load is the plate. For weighted dips and pull-ups, it's the weight on the belt, not including bodyweight. For a landmine press or row, it's the plates on the bar. Each of these says so in its notes.

### What's in version 1

26 families and 146 exercises, built from:

- everything in Rebuild Log and your wife's Block 1
- the variations your equipment supports, such as the back extension variations above, SSB variations, trap bar handle heights, the ABX attachments, rings, the parallel landmine handle, the sandbag and the skipping rope
- power cleans and snatches from the floor and the hang, on the Bastard bar with bumpers
- conditioning and mobility work, including things you avoid at the moment (boxing bag rounds, GHD sit-ups, spinal back extensions), flagged so a programme can keep them out

The full list is in [`catalogue.md`](catalogue.md).

### Adding an exercise

1. Pick its family, or add a family if none fits.
2. Give it an id that describes the variation, such as `back-extension-single-leg-plate`.
3. List what it `requires`, and its `barTypes` if it uses a bar.
4. Run `npm run catalogue` and `npm test`.

In the app, Build mode will do the same through a form.

## Checks

`npm test` now checks, on top of the programme checks:

- equipment ids are unique, and attachments attach to something that exists
- every library exercise is in a family that exists, needs only equipment that exists, and uses only bar types the household has
- every family has at least one exercise
- every exercise in the example programmes is in the library and matches it
- `docs/catalogue.md` is up to date

The broken test files in `tests/invalid/` are now each paired with the error they must produce (`expected-errors.json`), so a file rejected for the wrong reason fails the test.

## Open questions

Still to weigh or check, all marked "to confirm" in the data:

1. **The heavy collars:** weight of a pair.
2. **The Swiss bar:** 20kg is assumed.
3. **The loadable dumbbell handles:** weight of one empty handle.
