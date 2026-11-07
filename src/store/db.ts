// The on-device database. Records are stored in the shapes defined in schema/, so a backup is
// just these records written out, and an import reads them back (architecture.md, "Storage").
import Dexie, { type EntityTable } from "dexie";
import type { JFDIProfile } from "../formats/generated/profile.ts";

export interface Setting {
  key: string;
  value: unknown;
}

export class JfdiDatabase extends Dexie {
  profiles!: EntityTable<JFDIProfile, "id">;
  settings!: EntityTable<Setting, "key">;

  constructor(name = "jfdi") {
    super(name);
    // Version 1. Later versions add tables (logs, programmes) and upgrade code here, never edit this line.
    this.version(1).stores({
      profiles: "id, name",
      settings: "key",
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
