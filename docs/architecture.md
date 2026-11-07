# How J.F.D.I is built

Status: **proposal for review**. Nothing here is built yet.

This proposes the technology, the shape of the code, how it's tested, and the order Train mode is built in. Train mode needs to be ready for Diane to start on Friday 1 January 2027.

## The short version

| Decision | Proposal | Why |
| --- | --- | --- |
| App type | Installable web app (PWA) on GitHub Pages, as Rebuild Log is now | Works offline on the shared tablet, no app store, no server, free |
| Language | TypeScript | Types generated from the JSON Schemas, so the app and the data formats can't drift apart |
| UI framework | React, built with Vite | The most widely used option, so any problem has a known answer. Vite is fast and simple |
| Storage on the device | IndexedDB, through the Dexie library | Holds years of logs for several people. Rebuild Log's simpler storage would run out of room |
| Training logic | Plain TypeScript functions with no screen code | Progression, readiness rules and scheduling can be tested on their own, thoroughly |
| Tests | Vitest for logic, Playwright for the app in a real browser | See Testing below |
| Releases | Every pull request is checked automatically. Merging to `main` publishes the app | Nothing reaches the tablet without passing the tests |

## Shape of the code

```
src/
  formats/      types generated from schema/*.json, plus upgrade code for older files
  engine/       pure training logic, no screens:
                  progression.ts   what weight next time (linear, double, top set, stalls, RPE hold)
                  readiness.ts     applying Green/Amber/Red rules to a session
                  schedule.ts      rotation, per-week and named-day weeks, training early, deloads
                  estimate.ts      estimated one-rep max (dos Remedios)
                  prescription.ts  turning a programme session into today's prescription
  store/        IndexedDB: profiles, programmes, logs, equipment, library; backup and import
  train/        Train mode screens: Today, session, calendar and day log, progress
  build/        Build mode screens (after Train mode)
  shared/       buttons, timers, theme, profile switcher
tests/
  engine/       logic tests (Vitest)
  e2e/          whole-app tests (Playwright)
```

The rule that keeps this testable: **screens never contain training decisions.** A screen asks the engine "what's today's session for Diane?" and shows the answer. All the judgement lives in `engine/`, where it's quick to test exhaustively.

## Storage

- One IndexedDB database on the device, holding all profiles' data.
- Everything is stored in the same shapes as the JSON formats already specified, so a backup is just those records written out as files, and an import reads them back.
- During a session, every tick saves straight away, so nothing is lost if the tablet sleeps or the app is closed.
- The browser is asked to treat the data as persistent, so it isn't cleared to free up space.
- Backup reminders as in Rebuild Log, but covering the whole household.

## Testing

| Layer | Tool | What it covers | When it runs |
| --- | --- | --- | --- |
| Data formats | The existing `npm test` checks | Schemas, examples, broken files, Rebuild Log import | Every pull request |
| Training logic | Vitest | Every progression rule, readiness rule and scheduling case, written as tables of "given this history, expect this". Cases are taken from Rebuild Log's real behaviour and Diane's Block 1 | Every pull request |
| Data upgrades | Vitest | Each older format version upgrades to the current one without loss | Every pull request |
| Whole app | Playwright | Real flows in a real browser at tablet and phone sizes, light and dark: pick a profile, check in, run a session with supersets and a giant set, finish, see it in the calendar, back up, restore | Every pull request |
| Offline | Playwright | The app opens and saves a session with the network switched off | Every pull request |
| On the tablet | You and Diane | A test version on its own web address before each release | Before merging anything that changes a screen |

Test data comes from the formats already written: Block 1, Diane's profile, the made-up first week, and the 8-week Rebuild Log sample.

A pull request can't be merged unless every check passes. That means turning on branch protection for `main` in the repository settings, which I'll walk you through.

## Releases

- `main` is what's live. Merging a pull request publishes it to GitHub Pages within a couple of minutes.
- A test version of each pull request is published at its own address, so changes can be tried on the tablet before they go live.
- The app shows its version number in Settings. Every release has a short note of what changed.
- Data is never at risk from an update. New versions upgrade old data on first open, and that upgrade is tested.

## Build order for Train mode

Each step is one pull request you can try before the next starts.

| Step | What you get | How you'd check it |
| --- | --- | --- |
| 1. Skeleton | The app installs and opens offline, with a profile switcher and an empty Today screen. Tests and publishing run automatically | Install it on the tablet, open it with Wi-Fi off |
| 2. Data | Load Block 1, Diane's profile, the library and equipment. Backup, restore, and import from Rebuild Log | Import your Rebuild Log backup and see your sessions listed |
| 3. Engine | Progression, readiness, schedule and prescription logic, with full tests. No new screens | Read the test tables: each one is a rule in plain terms |
| 4. Today and session | The daily check, today's session with tiers, supersets and giant sets, set logging, rest timer, add and remove exercises, finishing | Run a full Block 1 session in the garage |
| 5. Calendar and progress | Calendar with day logs and editing, lift charts with goals, bodyweight | Look back over the imported Rebuild Log history |
| 6. Trial | Diane runs a few practice sessions on the test version. Fixes from that | Diane's verdict |

Build mode comes after step 6. Until then, programmes are written as files (with my help) and loaded in.

## Questions for you

1. **Framework:** React is proposed. The main alternative is Svelte, which is lighter and arguably simpler to read, but less widely used. Any preference?
2. **The tablet:** what make and model is it, and which browser does it use? That sets the main screen size the end-to-end tests run at.
3. **Test strictness:** should a minimum test coverage be enforced on the engine (for example, every line of `engine/` covered), or is "every rule has a test table" enough?
4. **Branch protection:** happy for `main` to require passing checks before anything merges? That includes changes I make.
