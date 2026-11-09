// Generates a demo backup: a made-up person, Sam, running a copy of Block 1 for 12 weeks.
// Not part of the suite; run on its own with DEMO_OUT set.
import "fake-indexeddb/auto";
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { today } from "../src/engine/prescription.ts";
import { asProgramme } from "../src/formats/programme.ts";
import { buildBackup, parseBackup, restoreBackup } from "../src/store/backup.ts";
import { JfdiDatabase, type SessionRecord } from "../src/store/db.ts";
import { addProfile, setCurrentProfileId } from "../src/store/profiles.ts";
import { assignProgramme } from "../src/store/programmes.ts";
import { addBodyweightGoal, putWeighIn, setGoal } from "../src/store/progress.ts";
import { finishSession, setNotes, startSession, updateSet } from "../src/store/session.ts";
import { BLOCK1 } from "./helpers/block1.ts";

const out = process.env.DEMO_OUT;
const toLogged = (s: SessionRecord) => ({
  date: s.date, status: s.status, readiness: s.readiness,
  programme: s.programme ? { id: s.programme.id, week: s.programme.week ?? 1 } : null,
  workout: s.session.id, ...(s.deload ? { deload: true } : {}), exercises: s.exercises,
});

// Strength as an estimated one-rep max at the start, and kg gained a week (a list: [from week, gain])
const CAPACITY: Record<string, { e1rm: number; gain: Array<[number, number]> }> = {
  "back-squat": { e1rm: 52, gain: [[0, 0.8]] },
  "bench-press": { e1rm: 40, gain: [[0, 0.5]] },
  "barbell-row": { e1rm: 34, gain: [[0, 0.6]] },
  "romanian-deadlift": { e1rm: 46, gain: [[0, 0.9], [5, 0]] }, // stalls from week 5
  deadlift: { e1rm: 80, gain: [[0, 1.2]] },
  "overhead-press-ez": { e1rm: 25, gain: [[0, 0.3]] },
  "goblet-squat": { e1rm: 26, gain: [[0, 0.5]] },
};
const ACCESSORY_KG: Record<string, number> = { "db-lateral-raise": 5, "db-curl": 8, "cable-pushdown": 15 };

const START = new Date("2026-08-17T00:00:00");
const weeksIn = (date: string) => (Date.parse(`${date}T00:00:00`) - START.getTime()) / (7 * 86_400_000);
function capacity(ex: string, date: string) {
  const c = CAPACITY[ex]!;
  const w = weeksIn(date);
  let e = c.e1rm;
  c.gain.forEach(([from, g], i) => {
    const to = c.gain[i + 1]?.[0] ?? Infinity;
    e += g * Math.max(0, Math.min(w, to) - from);
  });
  return e;
}
// Epley: reps possible at a weight, less one on the later sets
const possible = (e1rm: number, kg: number, set: number) => Math.floor(30 * (e1rm / kg - 1)) - (set >= 3 ? 1 : 0);

const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T12:00:00`);
  t.setDate(t.getDate() + n);
  return t.toISOString().slice(0, 10);
};

it("writes the demo backup", async () => {
  if (!out) return;
  const db = new JfdiDatabase(`demo-${Math.random()}`);
  const programme = { ...structuredClone(BLOCK1), id: "demo-strength", name: "Demo: two-session strength" };
  await db.programmes.put(programme);
  const p = asProgramme(programme);
  await addProfile(db, "Sam (demo)", "#0d9488");
  const id = "sam-demo";
  await setCurrentProfileId(db, id);
  await assignProgramme(db, id, { programme: p.id, startDate: "2026-08-17", startingLoads: {}, unavailableEquipment: [] }, new Date("2026-08-16T10:00:00"));

  // Training days: every 3 days, a week away in October, and a couple of 4-day gaps
  const dates: string[] = [];
  for (let d = "2026-08-17"; d <= "2026-11-06"; ) {
    if (d >= "2026-10-05" && d < "2026-10-12") { d = "2026-10-12"; continue; }
    dates.push(d);
    d = addDays(d, ["2026-09-08", "2026-10-21"].includes(d) ? 4 : 3);
  }
  const amber = new Set(["2026-09-28", "2026-10-25"]);
  const notes: Record<string, string> = {
    "2026-09-28": "Slept badly, went Amber. Felt fine once warmed up.",
    "2026-10-12": "First one back after the week away. Bit rusty.",
    "2026-10-28": "RDL grinding at the top of the range again.",
  };

  // Weigh-ins every Saturday, drifting up with day-to-day noise
  const noise = [0.2, -0.3, 0.1, 0.3, -0.1, -0.2, 0.2, 0, -0.3, 0.1, 0.3, -0.1, 0];
  const weighIns: Array<{ date: string; kg: number }> = [];
  for (let d = "2026-08-15", i = 0; d <= "2026-11-07"; d = addDays(d, 7), i++) {
    weighIns.push({ date: d, kg: Math.round((78.2 + 0.17 * i + noise[i % noise.length]!) * 10) / 10 });
  }

  let goalsSet = false;
  const allDates = [...new Set([...dates, ...weighIns.map((w) => w.date)])].sort();
  for (const date of allDates) {
    const w = weighIns.find((x) => x.date === date);
    if (w) await putWeighIn(db, id, { date, kg: w.kg, fasted: true });
    if (!goalsSet && date >= "2026-09-05") {
      await addBodyweightGoal(db, id, { kg: 81, by: "2026-12-19", label: "End of block" }, date);
      await addBodyweightGoal(db, id, { kg: 82.5, by: "2027-03-27", label: "Spring" }, date);
      await setGoal(db, id, { exercise: "back-squat", kg: 65, by: "2026-12-31" });
      await setGoal(db, id, { exercise: "deadlift", kg: 100 });
      goalsSet = true;
    }
    if (!dates.includes(date)) continue;

    const profile = (await db.profiles.get(id))!;
    const sessions = (await db.sessions.where("profile").equals(id).toArray()).map(toLogged);
    const readiness = amber.has(date) ? "amber" : "green";
    const t = today({ programme: p, assignment: profile.programmes.active!, sessions, date, readiness });
    if (t.kind !== "workout") throw new Error(`${date}: ${t.kind}`);
    let s = await startSession(db, profile, p, t, readiness, new Date(`${date}T18:00:00`));
    for (let e = 0; e < s.exercises.length; e++) {
      const entry = s.exercises[e]!;
      const range = t.targets[entry.slot!]?.reps;
      for (let k = 0; k < entry.sets.length; k++) {
        const set = entry.sets[k]!;
        const values: Record<string, unknown> = { done: true };
        if (CAPACITY[entry.exercise] && set.kg) {
          const reps = Math.min(range?.max ?? 5, possible(capacity(entry.exercise, date), set.kg, k));
          values.reps = Math.max(1, reps);
          if (reps >= (range?.max ?? 5) && k === entry.sets.length - 1) values.rpe = amber.has(date) ? 6 : 8;
        } else if (ACCESSORY_KG[entry.exercise]) {
          values.kg = ACCESSORY_KG[entry.exercise];
        } else if (entry.exercise === "band-pull-up") {
          values.reps = 8;
        }
        s = await updateSet(db, s, e, k, values);
      }
    }
    if (notes[date]) s = await setNotes(db, s, notes[date]);
    await finishSession(db, s, null, new Date(`${date}T19:05:00`));
  }

  // Walks on a few rest days
  for (const date of allDates.filter((d) => !dates.includes(d)).concat(dates.map((d) => addDays(d, 1))).sort()) {
    if (date > "2026-11-07" || (await db.days.get([id, date]))) continue;
    if (Number(date.slice(8)) % 3 === 0) continue;
    await db.days.add({ profile: id, date, activities: [{ exercise: "walk", minutes: 30 + (Number(date.slice(8)) % 4) * 10 }] });
  }

  const backup = await buildBackup(db, { version: "demo" }, new Date("2026-11-08T09:00:00"));
  const text = JSON.stringify(backup, null, 2);
  // Check it restores cleanly
  const check = new JfdiDatabase(`demo-check-${Math.random()}`);
  await restoreBackup(check, parseBackup(text));
  console.log(`sessions ${await check.sessions.count()}, weigh-ins ${await check.weighIns.count()}, days ${await check.days.count()}`);
  writeFileSync(out, text);
});
