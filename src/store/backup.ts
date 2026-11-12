// Backup, restore, and importing from Rebuild Log (requirement DA-1).
import type { JFDIBackup } from "../formats/generated/backup.ts";
import type { JFDITrainingLog } from "../formats/generated/log.ts";
import { convertRebuildLog } from "../formats/rebuild-log.js";
import { upgradeBackup } from "../formats/upgrade.js";
import { validateBackup, validateLog } from "../formats/validate.js";
import { markChanged, type DayRecord, type JfdiDatabase, type SessionRecord, type WeighInRecord } from "./db.ts";
import { getGyms } from "./gyms.ts";
import { equipment, library } from "./household.ts";
import { localDate, syncBundledProgrammes } from "./programmes.ts";

const strip = <T extends { profile: string }>({ profile: _p, ...rest }: T) => rest;

/** One person's training log, put back together from the database. */
export async function logFor(db: JfdiDatabase, profile: string): Promise<JFDITrainingLog> {
  const [sessions, days, weighIns] = await Promise.all([
    db.sessions.where("profile").equals(profile).sortBy("startedAt"),
    db.days.where("profile").equals(profile).sortBy("date"),
    db.weighIns.where("profile").equals(profile).sortBy("date"),
  ]);
  return {
    format: "jfdi-log",
    formatVersion: 2,
    profile,
    sessions: sessions.map(strip),
    days: days.map(strip),
    bodyweight: weighIns.map(strip),
  };
}

/** Everything the app holds, as one backup file. */
export async function buildBackup(db: JfdiDatabase, app: { version: string; commit?: string }, now = new Date()): Promise<JFDIBackup> {
  return db.transaction("r", [db.profiles, db.programmes, db.sessions, db.days, db.weighIns, db.settings], async () => {
    const profiles = await db.profiles.orderBy("name").toArray();
    return {
      format: "jfdi-backup",
      formatVersion: 2,
      exportedAt: now.toISOString(),
      app,
      profiles,
      programmes: await db.programmes.toArray(),
      gyms: await getGyms(db),
      logs: await Promise.all(profiles.map((p) => logFor(db, p.id))),
    } as JFDIBackup;
  });
}

export function backupFileName(now = new Date()): string {
  return `jfdi-backup-${localDate(now)}.json`;
}

export class BackupError extends Error {
  readonly problems: string[];
  constructor(message: string, problems: string[] = []) {
    super(message);
    this.name = "BackupError";
    this.problems = problems;
  }
}

/** Reads a backup file's text. Throws a BackupError, in words, if it isn't a J.F.D.I backup or fails a check. */
export function parseBackup(text: string): JFDIBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("This file isn't a backup: it can't be read as JSON.");
  }
  const format = (data as { format?: unknown; app?: unknown } | null)?.format;
  if (format !== "jfdi-backup") {
    if ((data as { app?: unknown } | null)?.app === "rebuild-log")
      throw new BackupError("This is a Rebuild Log backup. Use Import from Rebuild Log instead.");
    throw new BackupError("This file isn't a J.F.D.I backup.");
  }
  const upgraded = upgradeBackup(data);
  const problems = validateBackup(upgraded, { equipment, library });
  if (problems.length) throw new BackupError("This backup has problems, so nothing was restored.", problems);
  return upgraded as JFDIBackup;
}

/** Replaces everything on this device with the backup. All or nothing. */
export async function restoreBackup(db: JfdiDatabase, backup: JFDIBackup): Promise<void> {
  await db.transaction("rw", [db.profiles, db.programmes, db.sessions, db.days, db.weighIns, db.settings], async () => {
    await Promise.all([db.profiles.clear(), db.programmes.clear(), db.sessions.clear(), db.days.clear(), db.weighIns.clear()]);
    await db.programmes.bulkAdd(backup.programmes);
    await db.profiles.bulkAdd(backup.profiles);
    for (const log of backup.logs) {
      const tag = <T,>(r: T) => ({ ...r, profile: log.profile });
      await db.sessions.bulkAdd(log.sessions.map(tag) as SessionRecord[]);
      await db.days.bulkAdd(log.days.map(tag) as DayRecord[]);
      await db.weighIns.bulkAdd(log.bodyweight.map(tag) as WeighInRecord[]);
    }
    // Gyms come with the backup. One made before gyms existed came from a household using the kit the app
    // came with, so that becomes its home gym, as it does when an existing tablet updates
    await db.settings.put({ key: "gyms", value: backup.gyms?.length ? backup.gyms : [{ id: "home", kit: structuredClone(equipment) }] });
    const current = (await db.settings.get("currentProfile"))?.value;
    if (typeof current === "string" && !backup.profiles.some((p) => p.id === current)) {
      await db.settings.put({ key: "currentProfile", value: null });
    }
    // The backup matches the device exactly, so nothing is waiting to be backed up.
    const stamp = new Date().toISOString();
    await db.settings.put({ key: "lastChangeAt", value: stamp });
    await db.settings.put({ key: "lastBackupAt", value: stamp });
  });
  await syncBundledProgrammes(db);
}

export interface ImportSummary {
  sessionsAdded: number;
  sessionsUpdated: number;
  daysAdded: number;
  weighInsAdded: number;
  /** Days and weigh-ins left alone because that date already had one */
  skipped: number;
  /** Anything that couldn't be brought across, such as an exercise with no match */
  problems: string[];
}

/**
 * Brings a Rebuild Log backup into one person's history. Safe to repeat with a newer backup:
 * sessions from Rebuild Log are added or updated, and days and weigh-ins only fill dates that are empty.
 */
export async function importRebuildLog(db: JfdiDatabase, profileId: string, text: string): Promise<ImportSummary> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("This file can't be read. Choose the backup file saved from Rebuild Log.");
  }
  if ((data as { format?: unknown } | null)?.format === "jfdi-backup")
    throw new BackupError("This is a J.F.D.I backup. Use Restore instead.");
  let converted: ReturnType<typeof convertRebuildLog>;
  try {
    converted = convertRebuildLog(data, profileId, library);
  } catch {
    throw new BackupError("This isn't a Rebuild Log backup. In Rebuild Log, use Backup to save one.");
  }
  const { log, problems } = converted;
  const errors = validateLog(log, { profiles: null, programmes: new Map(), library });
  if (errors.length) throw new BackupError("This backup couldn't be brought across, so nothing was imported.", errors);

  return db.transaction("rw", [db.profiles, db.sessions, db.days, db.weighIns, db.settings], async () => {
    if (!(await db.profiles.get(profileId))) throw new BackupError(`No profile "${profileId}"`);
    const summary: ImportSummary = { sessionsAdded: 0, sessionsUpdated: 0, daysAdded: 0, weighInsAdded: 0, skipped: 0, problems };
    for (const s of log.sessions) {
      const existing = await db.sessions.get([profileId, s.id]);
      if (existing && existing.importedFrom !== "rebuild-log") { summary.skipped++; continue; }
      await db.sessions.put({ ...s, profile: profileId });
      if (existing) summary.sessionsUpdated++;
      else summary.sessionsAdded++;
    }
    for (const d of log.days) {
      if (await db.days.get([profileId, d.date])) { summary.skipped++; continue; }
      await db.days.add({ ...d, profile: profileId });
      summary.daysAdded++;
    }
    for (const w of log.bodyweight) {
      if (await db.weighIns.get([profileId, w.date])) { summary.skipped++; continue; }
      await db.weighIns.add({ ...w, profile: profileId });
      summary.weighInsAdded++;
    }
    await markChanged(db);
    return summary;
  });
}

const DAY = 24 * 60 * 60 * 1000;
export const BACKUP_REMINDER_DAYS = 7;

/** A backup is due when something has changed since the last one, and that was a week or more ago (or never). */
export function backupDue(lastBackupAt: string | null, lastChangeAt: string | null, now = new Date()): boolean {
  if (!lastChangeAt) return false;
  if (!lastBackupAt) return true;
  return lastChangeAt > lastBackupAt && now.getTime() - Date.parse(lastBackupAt) >= BACKUP_REMINDER_DAYS * DAY;
}

export async function recordBackup(db: JfdiDatabase, now = new Date()): Promise<void> {
  await db.settings.put({ key: "lastBackupAt", value: now.toISOString() });
}
