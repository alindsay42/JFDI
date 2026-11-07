import type { JFDIProfile } from "../formats/generated/profile.ts";
import type { JfdiDatabase } from "./db.ts";

/** Colours offered when adding a person. Chosen to be told apart at a glance, in light and dark. */
export const PROFILE_COLOURS = [
  { name: "Purple", hex: "#7c3aed" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Green", hex: "#16a34a" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Red", hex: "#dc2626" },
  { name: "Pink", hex: "#db2777" },
  { name: "Slate", hex: "#475569" },
] as const;

/** A profile id from a name: lower case, letters and digits joined by hyphens, unique among `taken`. */
export function profileId(name: string, taken: Iterable<string>): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "person";
  const used = new Set(taken);
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}

export function newProfile(name: string, colour: string, taken: Iterable<string>, now = new Date()): JFDIProfile {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A name is needed");
  if (!/^#[0-9a-f]{6}$/i.test(colour)) throw new Error(`Not a colour: ${colour}`);
  const stamp = now.toISOString();
  return {
    format: "jfdi-profile",
    formatVersion: 1,
    id: profileId(trimmed, taken),
    name: trimmed,
    colour: colour.toLowerCase(),
    createdAt: stamp,
    updatedAt: stamp,
    programmes: { history: [] },
  };
}

export async function addProfile(db: JfdiDatabase, name: string, colour: string): Promise<JFDIProfile> {
  return db.transaction("rw", db.profiles, async () => {
    const ids = (await db.profiles.toCollection().primaryKeys()) as string[];
    const profile = newProfile(name, colour, ids);
    await db.profiles.add(profile);
    return profile;
  });
}

const CURRENT = "currentProfile";

export async function getCurrentProfileId(db: JfdiDatabase): Promise<string | null> {
  const s = await db.settings.get(CURRENT);
  return typeof s?.value === "string" ? s.value : null;
}

export async function setCurrentProfileId(db: JfdiDatabase, id: string | null): Promise<void> {
  await db.settings.put({ key: CURRENT, value: id });
}
