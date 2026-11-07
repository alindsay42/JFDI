# Building a programme

Status: **draft**, agreed with Andrew on 7 November 2026. Nothing is built yet.

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

## Questions still open (from 7 November, before the week planner)

1. ~~Sessions~~: replaced by the week planner.
2. **Undoing a group:** tap the group, then **Split up**?
3. **Rounds:** a giant set in Block 1 runs in rounds rather than sets per exercise (for example, 3 rounds of lateral raise, plank, battle ropes). Does a giant set get a single "rounds" box instead of sets on each row?
4. **Finisher:** Block 1 also has a timed **finisher** group. Is it a type you pick when saving a group of 3 or more, or does it go?
5. **Timed and distance exercises:** a plank takes seconds and a carry takes metres, so those rows show seconds or metres in place of reps.
6. **Who it affects:** changes edit the programme itself. Diane is the only one on Block 1, so that's the same as changing it just for her.

## Decisions

Settled on 7 November:

1. **Week planner** instead of sessions, with a cycle of up to 4 weeks.
2. **Set days or Ad hoc** is one choice for the whole programme.
3. **Missed workouts:** Ad hoc keeps the order, with an optional skip. Set days follows the calendar, and a missed workout stays missed.
4. **Choosing exercises:** two lists with `>> > < <<`. The chosen exercises sit below as standalones, dragged into order, with weight, sets and reps on each row. **Pair exercises** groups 2 into a superset, or 3 or more into a giant set.
