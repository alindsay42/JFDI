// Changing history: editing or deleting a finished workout, weigh-ins, and goals for lifts.
import type { Target } from "../formats/generated/profile.ts";
import { validateLog } from "../formats/validate.js";
import { logFor } from "./backup.ts";
import { markChanged, type JfdiDatabase, type SessionRecord } from "./db.ts";
import { library } from "./household.ts";

/** Saves changes to a finished workout. Checked first: nothing is saved if the log would be wrong. */
export async function saveSession(db: JfdiDatabase, s: SessionRecord): Promise<void> {
  await db.transaction("rw", [db.sessions, db.days, db.weighIns, db.profiles, db.programmes, db.settings], async () => {
    const before = await db.sessions.get([s.profile, s.id]);
    await db.sessions.put(s);
    const log = await logFor(db, s.profile);
    const programmes = new Map((await db.programmes.toArray()).map((p) => [p.id, p]));
    // Sessions keep their own prescription, so a programme changed or deleted since doesn't matter here
    const problems = validateLog(log, { profiles: null, programmes, library })
      .filter((e) => e.includes(`"${s.id}"`) && !/programme "[^"]+" (not found|has no)/.test(e));
    if (problems.length) {
      if (before) await db.sessions.put(before);
      else await db.sessions.delete([s.profile, s.id]);
      throw new Error(problems.join("; "));
    }
    await markChanged(db);
  });
}

export async function deleteSession(db: JfdiDatabase, profile: string, id: string): Promise<void> {
  await db.transaction("rw", db.sessions, db.settings, async () => {
    await db.sessions.delete([profile, id]);
    await markChanged(db);
  });
}

/** Records a weigh-in. One per day: a second on the same date replaces the first. */
export async function putWeighIn(db: JfdiDatabase, profile: string, w: { date: string; kg: number; fasted?: boolean }): Promise<void> {
  if (!(w.kg >= 20 && w.kg <= 300)) throw new Error("Bodyweight must be between 20 and 300kg");
  await db.transaction("rw", db.weighIns, db.settings, async () => {
    await db.weighIns.put({ profile, date: w.date, kg: Math.round(w.kg * 100) / 100, ...(w.fasted ? { fasted: true } : {}) });
    await markChanged(db);
  });
}

export async function deleteWeighIn(db: JfdiDatabase, profile: string, date: string): Promise<void> {
  await db.transaction("rw", db.weighIns, db.settings, async () => {
    await db.weighIns.delete([profile, date]);
    await markChanged(db);
  });
}

/** Sets this person's goal for a lift, replacing any goal they had for it. */
export async function setGoal(db: JfdiDatabase, profileId: string, goal: Target): Promise<void> {
  await db.transaction("rw", db.profiles, db.settings, async () => {
    const p = await db.profiles.get(profileId);
    if (!p) throw new Error(`No profile "${profileId}"`);
    const targets = (p.targets ?? []).filter((t) => t.exercise !== goal.exercise);
    await db.profiles.put({ ...p, targets: [...targets, goal], updatedAt: new Date().toISOString() });
    await markChanged(db);
  });
}

export async function clearGoal(db: JfdiDatabase, profileId: string, exercise: string): Promise<void> {
  await db.transaction("rw", db.profiles, db.settings, async () => {
    const p = await db.profiles.get(profileId);
    if (!p) return;
    const targets = (p.targets ?? []).filter((t) => t.exercise !== exercise);
    const next = { ...p, updatedAt: new Date().toISOString() };
    if (targets.length) next.targets = targets;
    else delete next.targets;
    await db.profiles.put(next);
    await markChanged(db);
  });
}
