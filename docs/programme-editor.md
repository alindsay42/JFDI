# Building a programme

Status: **built** as the first part of Build mode (version 0.4.0), as agreed with Andrew on 7 November 2026.

This is the first part of Build mode, brought forward: planning the weeks, then building each workout.

## The week planner

A programme is a **cycle of 1 to 4 weeks** that repeats:

- **1 week:** the same week every week
- **2 weeks:** the weeks alternate, such as heavy then light
- **3 or 4 weeks:** after the last week, it goes back to Week 1

Each week has up to 7 workouts. A workout can be copied to another day or week and then changed. For example, copy Week 1's heavy deadlift day to Week 2, then swap the deadlift for RDLs.

The programme is either **Set days** or **Ad hoc**, chosen with a switch at the top of the planner. Switching between them keeps every workout; going from Ad hoc to Set days asks which day each workout goes on.

### Ad hoc

```
 Week 1   [Day 1: Squat & bench]  [Day 2: Deadlift & press]  [+ Add day]
 Week 2   [Day 1: Squat & bench]  [Day 2: RDL & press]       [+ Add day]
```

- **Days:** listed as Day 1, Day 2 and so on, not tied to dates.
- **Order is kept:** a missed workout is still next up whenever the person trains.
- **Skipping:** a **Skip to next workout** button skips one if the person chooses.
- **Moving through the cycle:** a week ends when its workouts are done, then the next week starts.
- **Rest:** an optional setting, "at least N rest days between workouts".

### Set days

```
          Mon     Tue   Wed              Thu   Fri     Sat    Sun
 Week 1   Squat   —     Heavy deadlift   —     Bench   Walk   —
 Week 2   Squat   —     RDL              —     Bench   Walk   —
```

- **Days:** seven columns. Tap a day to add a workout, a walk or rest.
- **Which week:** the calendar decides, counted from the start date.
- **Missed workouts:** a missed workout stays missed and shows as missed. Nothing moves, so no other workout is knocked out.
- **Later:** an option to run a chosen day's workout on any other day.

## Building a workout

Tapping a workout in the planner opens it.

## The flow

The screen has two parts, one above the other.

### 1. Choose exercises: two lists

```
 All exercises                         In this workout
 ┌──────────────────────┐   [ >> ]    ┌──────────────────────┐
 │ search…   [Squat ▾]  │   [ >  ]    │ Back squat           │
 │ Front squat          │   [ <  ]    │ Bench press          │
 │ Box squat            │   [ << ]    │ Barbell row          │
 └──────────────────────┘             └──────────────────────┘
```

- Tap exercises to highlight them, one or several, then use the buttons:
  - `>` moves the highlighted exercises in
  - `<` moves them back out
  - `>>` moves in everything the search or filter is showing
  - `<<` clears the workout
- A newly chosen exercise appears in the workout below as a standalone exercise, at the end.

### 2. The workout: order, weights, groups

```
 Workout
 ┌─────────────────────────────────────────────────────┐
 │ ≡ Back squat           [30] kg  [5] sets × [5] reps │
 │ ┌ Superset ──────────────────────────────────────┐  │
 │ │ ≡ Bench press        [25] kg  [5] sets × [5]   │  │
 │ │ ≡ Barbell row        [15] kg  [3] sets × [6]   │  │
 │ └────────────────────────────────────────────────┘  │
 │ ≡ Romanian deadlift    [30] kg  [3] sets × [6] reps │
 └─────────────────────────────────────────────────────┘
              [ Pair exercises ]
```

- **Order:** drag and drop, using the ≡ handle.
- **Weights:** weight, sets and reps are set on each row.
- **Grouping:** tap **Pair exercises**, tap the exercises to group, then **Save**:
  - 2 exercises make a **superset**
  - 3 or more make a **giant set**
  - **Changing a group** works the same way: tap **Pair exercises** on the group, tap an exercise to add it or tap it again to take it out, then **Save**. A group left with one exercise goes back to standalone.

## Questions still open (from 7 November, before the week planner)

1. ~~Sessions~~: replaced by the week planner.
2. ~~Undoing a group~~: settled, see Grouping above.
3. ~~Rounds~~: settled, see Decisions.
4. **Finisher:** Block 1 also has a timed **finisher** group. Is it a type you pick when saving a group of 3 or more, or does it go?
5. **Timed and distance exercises:** a plank takes seconds and a carry takes metres, so those rows show seconds or metres in place of reps.
6. **Who it affects:** changes edit the programme itself. Diane is the only one on Block 1, so that's the same as changing it just for her.

## Decisions

Settled on 7 November:

1. **Week planner** instead of sessions, with a cycle of up to 4 weeks.
2. **Set days or Ad hoc** is one choice for the whole programme.
3. **Missed workouts:** Ad hoc keeps the order, with an optional skip. Set days follows the calendar, and a missed workout stays missed.
4. **Choosing exercises:** two lists with `>> > < <<`. The chosen exercises sit below as standalones, dragged into order, with weight, sets and reps on each row. **Pair exercises** groups 2 into a superset, or 3 or more into a giant set.
5. **Groups run in rounds.** A superset or giant set always has the same number of sets for every exercise in it, set once as **rounds**, with rest after each round. Each exercise in a group has only its weight and its reps or time. Sets belong to standalone exercises only.
6. **Skipping during a session:** any set of any exercise can be skipped, inside a group or not, as in Rebuild Log.
7. **Block 1's superset** becomes 5 rounds of bench press (5 reps) and barbell row (6 reps). Rows were 3 sets; with rounds they match bench at 5, and any row set can be skipped on the day.

## How it's built

- **Where:** the **Programme** tab (the tabs are Today, Programme, History, Backup). It shows the current person's programme, lists every programme, and has a form for a new one.
- **Using a programme:** on a programme's plan, **Use this programme** with a start date puts the current person on it. The weights set in the builder are their starting weights. **Stop using it** takes them off.
- **No programmes come with the app.** Diane's Block 1 is kept in `examples/programmes/` for later, and is removed from any device where nobody runs it.
- **Drafts:** every change is saved as a draft straight away, so nothing is lost if the tablet sleeps. **Save** is on the plan only, since it checks the whole programme: it makes it the real version and says "Saved". Inside a workout there's a **Done** button back to the plan instead. Anyone running it moves onto the new version. **Discard** goes back to the last saved version.
- **New exercises** go in as standalones with 3 sets of 8 (or 30 seconds, 20 metres...), starting at the empty bar for barbell lifts. Each item also has a tier in the data, for readiness rules later; it isn't shown while the builder has no readiness settings.
- **Copying weeks:** a new week in the cycle starts as a copy of the last, and **Copy week 1 here** copies Week 1 over any later week. Copies are separate workouts, so heavy and light weeks can differ.
- **Reordering:** drag the ≡ handle, or focus it and use the up and down arrows.
