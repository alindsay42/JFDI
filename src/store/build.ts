// Saving programmes from Build mode. Edits go into a draft as they're made, so nothing is lost if the
// tablet sleeps; Save checks the programme and makes it the version everyone running it uses.
import { asFile, type Programme } from "../formats/programme.ts";
import { checkAgainstLibrary, validateProgramme } from "../formats/validate.js";
import { markChanged, type JfdiDatabase } from "./db.ts";
import { equipment, library } from "./household.ts";

const draftKey = (id: string) => `draft:${id}`;

export interface Draft {
  programme: Programme;
  /** The saved version this draft started from, or null for a programme not saved yet */
  basedOn: string | null;
}

export async function getDraft(db: JfdiDatabase, id: string): Promise<Draft | undefined> {
  return (await db.settings.get(draftKey(id)))?.value as Draft | undefined;
}

export async function putDraft(db: JfdiDatabase, draft: Draft): Promise<void> {
  await db.settings.put({ key: draftKey(draft.programme.id), value: draft });
}

export async function discardDraft(db: JfdiDatabase, id: string): Promise<void> {
  await db.settings.delete(draftKey(id));
}

/** Programmes with unsaved changes, including new ones never saved. */
export async function listDrafts(db: JfdiDatabase): Promise<Draft[]> {
  const rows = await db.settings.where("key").startsWith("draft:").toArray();
  return rows.map((r) => r.value as Draft);
}

/** Everything wrong with a programme, in words. Empty when it can be saved. */
export function programmeProblems(p: Programme): string[] {
  const file = asFile(p);
  const problems = validateProgramme(file);
  return problems.length ? problems : checkAgainstLibrary(file, library, equipment);
}

export class SaveError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join("; "));
    this.name = "SaveError";
    this.problems = problems;
  }
}

/** Saves a programme, moving anyone running it onto the new version. Throws a SaveError, saving nothing, if it has problems. */
export async function saveProgramme(db: JfdiDatabase, p: Programme, now = new Date()): Promise<Programme> {
  const saved: Programme = { ...p, updatedAt: now.toISOString() };
  const problems = programmeProblems(saved);
  if (problems.length) throw new SaveError(problems);
  await db.transaction("rw", [db.programmes, db.profiles, db.settings], async () => {
    await db.programmes.put(asFile(saved));
    const runners = await db.profiles.filter((pr) => pr.programmes.active?.programme === p.id).toArray();
    for (const pr of runners) {
      const active = pr.programmes.active!;
      // Starting loads for exercises the programme no longer has are dropped, so the profile stays valid.
      const kept = new Set(saved.exercises.map((e) => e.id));
      const startingLoads = active.startingLoads && Object.fromEntries(Object.entries(active.startingLoads).filter(([id]) => kept.has(id)));
      await db.profiles.put({
        ...pr,
        programmes: { ...pr.programmes, active: { ...active, programmeUpdatedAt: saved.updatedAt, ...(startingLoads ? { startingLoads } : {}) } },
      });
    }
    await db.settings.delete(draftKey(p.id));
    await markChanged(db, now);
  });
  return saved;
}

/** Deletes a programme nobody is running. Its draft goes too. */
export async function deleteProgramme(db: JfdiDatabase, id: string): Promise<void> {
  await db.transaction("rw", [db.programmes, db.profiles, db.settings], async () => {
    const runners = await db.profiles.filter((pr) => pr.programmes.active?.programme === id).toArray();
    if (runners.length) throw new Error(`${runners.map((r) => r.name).join(" and ")} ${runners.length > 1 ? "are" : "is"} running it`);
    await db.programmes.delete(id);
    await db.settings.delete(draftKey(id));
    await markChanged(db);
  });
}
