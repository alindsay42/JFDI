import type { JFDIProfile, StartingLoad } from "../formats/generated/profile.ts";
import type { JFDIProgrammeFile } from "../formats/generated/programme.ts";
import { asProgramme, setsOf } from "../formats/programme.ts";
import { validateProfile } from "../formats/validate.js";
import { markChanged, type JfdiDatabase } from "./db.ts";
import { BUNDLED_PROGRAMMES, equipment, library } from "./household.ts";

/**
 * Adds programmes that come with the app, and updates them when the app brings a newer version.
 * Anyone running an updated programme moves to the new version; their past sessions keep their own copies.
 */
export async function syncBundledProgrammes(db: JfdiDatabase, bundled = BUNDLED_PROGRAMMES): Promise<void> {
  await db.transaction("rw", db.programmes, db.profiles, async () => {
    for (const p of bundled) {
      const current = await db.programmes.get(p.id);
      if (current && current.updatedAt >= p.updatedAt) continue;
      await db.programmes.put(p);
      if (!current) continue;
      const runners = await db.profiles.filter((pr) => pr.programmes.active?.programme === p.id).toArray();
      for (const pr of runners) {
        await db.profiles.put({
          ...pr,
          programmes: { ...pr.programmes, active: { ...pr.programmes.active!, programmeUpdatedAt: p.updatedAt } },
        });
      }
    }
  });
}

/**
 * Starting loads suggested by the programme: the first prescribed weight for each loaded exercise,
 * with its sets and the bottom of its rep range.
 */
export function defaultStartingLoads(file: JFDIProgrammeFile): Record<string, StartingLoad> {
  const p = asProgramme(file);
  const exercises = new Map(p.exercises.map((e) => [e.id, e]));
  const bars = new Map(p.equipment.map((b) => [b.id, b]));
  const loads: Record<string, StartingLoad> = {};
  for (const w of p.workouts) {
    for (const item of w.items) {
      for (const slot of item.slots) {
        const ex = exercises.get(slot.exercise);
        if (!ex || ex.measure !== "load" || loads[ex.id]) continue;
        const start = slot.start?.kg;
        const kg = start === "bar" ? (ex.bar ? bars.get(ex.bar)?.kg : undefined) : start;
        if (typeof kg !== "number") continue;
        const load: StartingLoad = { kg };
        if (slot.reps) load.reps = slot.reps.min;
        const sets = setsOf(item, slot);
        if (sets) load.sets = sets;
        loads[ex.id] = load;
      }
    }
  }
  return loads;
}

export interface Assignment {
  programme: string;
  startDate: string;
  startingLoads: Record<string, StartingLoad>;
  unavailableEquipment: string[];
}

/**
 * Puts a person on a programme. Switching from a programme that has already started files it
 * under history as ended early. Throws, saving nothing, if the result isn't a valid profile.
 */
export async function assignProgramme(
  db: JfdiDatabase,
  profileId: string,
  a: Assignment,
  now = new Date(),
): Promise<JFDIProfile> {
  return db.transaction("rw", db.profiles, db.programmes, db.settings, async () => {
    const profile = await db.profiles.get(profileId);
    if (!profile) throw new Error(`No profile "${profileId}"`);
    const programmes = new Map((await db.programmes.toArray()).map((p) => [p.id, p]));
    const programme = programmes.get(a.programme);
    if (!programme) throw new Error(`No programme "${a.programme}"`);

    const today = localDate(now);
    const history = [...profile.programmes.history];
    const old = profile.programmes.active;
    if (old && old.programme !== a.programme && old.startDate <= today) {
      history.push({
        programme: old.programme,
        programmeUpdatedAt: old.programmeUpdatedAt,
        startDate: old.startDate,
        endDate: today,
        ended: "early",
      });
    }

    const next: JFDIProfile = {
      ...profile,
      updatedAt: now.toISOString(),
      unavailableEquipment: a.unavailableEquipment,
      programmes: {
        active: {
          programme: programme.id,
          programmeUpdatedAt: programme.updatedAt,
          startDate: a.startDate,
          startingLoads: a.startingLoads,
        },
        history,
      },
    };
    if (!next.unavailableEquipment?.length) delete next.unavailableEquipment;
    const errors = validateProfile(next, { programmes, equipment, library });
    if (errors.length) throw new ProfileError(errors);
    await db.profiles.put(next);
    await markChanged(db, now);
    return next;
  });
}

export class ProfileError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join("; "));
    this.problems = problems;
    this.name = "ProfileError";
  }
}

/** The local calendar date (YYYY-MM-DD) of a moment, in the device's time zone. */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
