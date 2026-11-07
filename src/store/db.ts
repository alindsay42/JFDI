// The on-device database. Records are stored in the shapes defined in schema/, so a backup is
// just these records written out, and a restore reads them back (architecture.md, "Storage").
import Dexie, { type EntityTable, type Table } from "dexie";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import type { JFDIProgrammeFile } from "../formats/generated/programme.ts";
import type { Day, Session, WeighIn } from "../formats/generated/log.ts";

export interface Setting {
  key: string;
  value: unknown;
}

/** A log's sessions, days and weigh-ins are stored one per row, each tagged with whose it is. */
export type SessionRecord = Session & { profile: string };
export type DayRecord = Day & { profile: string };
export type WeighInRecord = WeighIn & { profile: string };

export class JfdiDatabase extends Dexie {
  profiles!: EntityTable<JFDIProfile, "id">;
  settings!: EntityTable<Setting, "key">;
  programmes!: EntityTable<JFDIProgrammeFile, "id">;
  sessions!: Table<SessionRecord, [string, string]>;
  days!: Table<DayRecord, [string, string]>;
  weighIns!: Table<WeighInRecord, [string, string]>;

  constructor(name = "jfdi") {
    super(name);
    // Each version adds to the one before. Never edit a released version; add a new one with any upgrade code.
    this.version(1).stores({
      profiles: "id, name",
      settings: "key",
    });
    this.version(2).stores({
      programmes: "id",
      sessions: "[profile+id], profile, date",
      days: "[profile+date], profile",
      weighIns: "[profile+date], profile",
    });
  }
}

/**
 * The live app and every pull request's test version share one web address (alindsay42.github.io), and so
 * would share one database. Each test version gets its own, so trying a change can never touch real training data.
 */
export function databaseName(pathname: string): string {
  const preview = /\/pr-preview\/pr-(\d+)\//.exec(pathname);
  return preview ? `jfdi-test-pr-${preview[1]}` : "jfdi";
}

/** The pull request number when this is a test version, otherwise null. */
export function testVersion(pathname: string): number | null {
  const preview = /\/pr-preview\/pr-(\d+)\//.exec(pathname);
  return preview ? Number(preview[1]) : null;
}

export const db = new JfdiDatabase(databaseName(typeof location === "undefined" ? "/" : location.pathname));

/** Ask the browser to keep this site's data even when the device is short of space. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

/** Remembers when anything last changed, for the backup reminder. Call inside the write's transaction. */
export async function markChanged(db: JfdiDatabase, now = new Date()): Promise<void> {
  await db.settings.put({ key: "lastChangeAt", value: now.toISOString() });
}
