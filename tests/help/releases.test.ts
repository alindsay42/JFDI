import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getSeenVersion, newSince, RELEASES, releasesOf, setSeenVersion } from "../../src/help/releases.ts";
import { JfdiDatabase } from "../../src/store/db.ts";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

describe("release notes", () => {
  it("say what's new in this version, first, and every release has a date and notes", () => {
    expect(RELEASES[0]!.version).toBe(pkg.version);
    for (const r of RELEASES) {
      expect(r.date).toMatch(/^\d{1,2} [A-Z][a-z]+ 20\d\d$/);
      expect(r.items.length).toBeGreaterThan(0);
    }
  });

  it("read each version, its date and its list", () => {
    const md = "# What's new\n\nIntro.\n\n## 2.0.0 · 1 January 2027\n\n- **Big:** thing\n- Small\n\n## 1.0.0 · 1 December 2026\n\n- First\n";
    const r = releasesOf(md);
    expect(r.map((x) => [x.version, x.date, x.items.length])).toEqual([["2.0.0", "1 January 2027", 2], ["1.0.0", "1 December 2026", 1]]);
    expect(r[0]!.items[0]).toEqual([{ text: "Big:", bold: true }, { text: " thing", bold: false }]);
    expect(releasesOf("- before any version\n## 1.0.0\n")).toEqual([{ version: "1.0.0", date: "", items: [] }]);
    // Since a version: the ones after it; unknown, just the newest
    expect(newSince(r, "1.0.0").map((x) => x.version)).toEqual(["2.0.0"]);
    expect(newSince(r, "2.0.0")).toEqual([]);
    expect(newSince(r, "0.1.0").map((x) => x.version)).toEqual(["2.0.0"]);
  });

  it("remember the version last seen on this device", async () => {
    const db = new JfdiDatabase(`releases-${Math.random()}`);
    expect(await getSeenVersion(db)).toBeNull();
    await setSeenVersion(db, "0.18.0");
    expect(await getSeenVersion(db)).toBe("0.18.0");
    await db.delete();
  });
});
