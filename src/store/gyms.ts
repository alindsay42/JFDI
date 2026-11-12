// The places the household trains, each with its own equipment. The first is home. Each person picks where
// they're training on Today, and targets snap to what that gym can load.
import type { JFDIHouseholdEquipment } from "../formats/generated/equipment.ts";
import { validateEquipment } from "../formats/validate.js";
import { markChanged, type JfdiDatabase } from "./db.ts";
import { emptyGym, TYPICAL_GYM, type Gym } from "./gym-templates.ts";

export { TYPICAL_GYM, type Gym };

export async function getGyms(db: JfdiDatabase): Promise<Gym[]> {
  return ((await db.settings.get("gyms"))?.value as Gym[] | undefined) ?? [];
}

/** The gym someone is training at: the one they picked, else home. */
export const gymFor = (gyms: Gym[], id: string | undefined): Gym | undefined => gyms.find((g) => g.id === id) ?? gyms[0];

export async function getGymChoice(db: JfdiDatabase, profileId: string): Promise<string | undefined> {
  return (await db.settings.get(`gym:${profileId}`))?.value as string | undefined;
}

export async function chooseGym(db: JfdiDatabase, profileId: string, gymId: string): Promise<void> {
  await db.settings.put({ key: `gym:${profileId}`, value: gymId });
}

const slug = (name: string, taken: string[]) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "gym";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
};

async function write(db: JfdiDatabase, gyms: Gym[]) {
  await db.settings.put({ key: "gyms", value: gyms });
  await markChanged(db);
}

/** Saves a gym's kit, after checking it. */
export async function saveGym(db: JfdiDatabase, id: string, next: JFDIHouseholdEquipment, now = new Date()): Promise<void> {
  const stamped = { ...next, updatedAt: now.toISOString() };
  const problems = validateEquipment(stamped);
  if (problems.length) throw new Error(problems[0]);
  await db.transaction("rw", db.settings, async () => {
    const gyms = await getGyms(db);
    if (!gyms.some((g) => g.id === id)) throw new Error("That gym isn't here any more");
    await write(db, gyms.map((g) => (g.id === id ? { id, kit: stamped } : g)));
  });
}

/** Adds a gym, starting from a copy of another, the typical home gym, or nothing. Returns its id. */
export async function addGym(db: JfdiDatabase, name: string, from: string | "typical" | "empty", now = new Date()): Promise<string> {
  const clean = name.trim();
  if (!clean) throw new Error("Give the gym a name");
  return db.transaction("rw", db.settings, async () => {
    const gyms = await getGyms(db);
    const source = from === "typical" ? TYPICAL_GYM : from === "empty" ? emptyGym(clean) : gyms.find((g) => g.id === from)?.kit;
    if (!source) throw new Error("That gym isn't here any more");
    const id = slug(clean, gyms.map((g) => g.id));
    await write(db, [...gyms, { id, kit: { ...structuredClone(source), name: clean, updatedAt: now.toISOString() } }]);
    return id;
  });
}

/** Removes a gym; home can't be removed. Anyone training there goes back to home. */
export async function deleteGym(db: JfdiDatabase, id: string): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    const gyms = await getGyms(db);
    if (gyms[0]?.id === id) throw new Error("Home can't be removed");
    await write(db, gyms.filter((g) => g.id !== id));
    for (const s of await db.settings.where("key").startsWith("gym:").toArray()) if (s.value === id) await db.settings.delete(s.key);
  });
}
