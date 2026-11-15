// Release notes: src/help/changes.md, newest first, one "## <version> · <date>" heading and a list each.
import type { JfdiDatabase } from "../store/db.ts";
import changes from "./changes.md?raw";
import { parse, type Inline } from "./markdown.ts";

export interface Release { version: string; date: string; items: Inline[][] }

export function releasesOf(md: string): Release[] {
  const releases: Release[] = [];
  for (const b of parse(md)) {
    if (b.kind === "h2") {
      const [version = "", date = ""] = b.text.split(" · ");
      releases.push({ version, date, items: [] });
    } else if (b.kind === "ul" && releases.length) releases.at(-1)!.items.push(...b.items);
  }
  return releases;
}

export const RELEASES = releasesOf(changes);

/** The releases since the version last seen, newest first; just the newest if that version isn't listed. */
export function newSince(releases: Release[], seen: string): Release[] {
  const at = releases.findIndex((r) => r.version === seen);
  return at < 0 ? releases.slice(0, 1) : releases.slice(0, at);
}

const KEY = "seenVersion";

/** The app version this device last told someone about, or null on a device that's never said. */
export async function getSeenVersion(db: JfdiDatabase): Promise<string | null> {
  return ((await db.settings.get(KEY))?.value as string | undefined) ?? null;
}

export async function setSeenVersion(db: JfdiDatabase, version: string): Promise<void> {
  await db.settings.put({ key: KEY, value: version });
}
