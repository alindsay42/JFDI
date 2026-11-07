# Choosing and grouping exercises

Status: **draft**, from Andrew's description on 7 November 2026. Nothing is built yet.

This is how a session's exercises are chosen, ordered, grouped and given their weights. It's the first piece of Build mode, brought forward.

## The flow

The screen has two parts, one above the other.

### 1. Choose exercises: two lists

```
 All exercises                         In this session
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
  - `<<` clears the session
- A newly chosen exercise appears in the programme below as a standalone exercise, at the end.

### 2. The programme: order, weights, groups

```
 Programme
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

## Questions still open

1. **Sessions:** Block 1 has Session A and Session B. Is there a session picker above both parts, so each session is done in turn?
2. **Undoing a group:** tap the group, then **Split up**?
3. **Rounds:** a giant set in Block 1 runs in rounds rather than sets per exercise (for example, 3 rounds of lateral raise, plank, battle ropes). Does a giant set get a single "rounds" box instead of sets on each row?
4. **Finisher:** Block 1 also has a timed **finisher** group. Is it a type you pick when saving a group of 3 or more, or does it go?
5. **Timed and distance exercises:** a plank takes seconds and a carry takes metres, so those rows show seconds or metres in place of reps.
6. **Who it affects:** changes edit the programme itself. Diane is the only one on Block 1, so that's the same as changing it just for her.
