import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { buildBackup, restoreBackup } from "../../src/store/backup.ts";
import { JfdiDatabase } from "../../src/store/db.ts";
import { addGym, chooseGym, deleteGym, getGymChoice, getGyms, gymFor, saveGym, TYPICAL_GYM } from "../../src/store/gyms.ts";
import { equipment } from "../../src/store/household.ts";

let db: JfdiDatabase;
beforeEach(async () => { db = new JfdiDatabase(`gyms-${Math.random()}`); await db.open(); });

describe("gyms", () => {
  it("a brand-new household starts with a typical home gym", async () => {
    expect(await getGyms(db)).toEqual([{ id: "home", kit: TYPICAL_GYM }]);
  });

  it("a household that already had data keeps the kit the app came with, as home", async () => {
    const name = `old-${Math.random()}`;
    const old = new Dexie(name);
    old.version(3).stores({ profiles: "id, name", settings: "key", programmes: "id", sessions: "[profile+id], profile, date", days: "[profile+date], profile", weighIns: "[profile+date], profile" });
    await old.open();
    await old.table("settings").put({ key: "currentProfile", value: null });
    old.close();
    const upgraded = new JfdiDatabase(name);
    expect(await getGyms(upgraded)).toEqual([{ id: "home", kit: equipment }]);
  });

  it("adds gyms from a copy, the typical gym or nothing; saves, checks and removes them", async () => {
    const hotel = await addGym(db, " Hotel ", "empty", new Date("2026-12-20T09:00:00Z"));
    const copy = await addGym(db, "Hotel", "home");
    const typical = await addGym(db, "!!!", "typical");
    expect([hotel, copy, typical]).toEqual(["hotel", "hotel-2", "gym"]);
    const gyms = await getGyms(db);
    expect(gyms[1]!.kit).toMatchObject({ name: "Hotel", items: [], updatedAt: "2026-12-20T09:00:00.000Z" });
    expect(gyms[2]!.kit.items).toEqual(TYPICAL_GYM.items);
    await expect(addGym(db, "  ", "empty")).rejects.toThrow("Give the gym a name");
    await expect(addGym(db, "X", "nope")).rejects.toThrow("isn't here");

    const bar = { id: "bar", name: "Hotel bar", kind: "bar" as const, barType: "standard" as const, kg: 15 };
    await saveGym(db, "hotel", { ...gyms[1]!.kit, items: [bar] }, new Date("2026-12-21T09:00:00Z"));
    expect((await getGyms(db))[1]!.kit).toMatchObject({ items: [bar], updatedAt: "2026-12-21T09:00:00.000Z" });
    await expect(saveGym(db, "hotel", { ...gyms[1]!.kit, items: [bar, bar] })).rejects.toThrow('duplicate equipment id "bar"');
    await expect(saveGym(db, "gone", gyms[1]!.kit)).rejects.toThrow("isn't here");

    await chooseGym(db, "andrew", "hotel");
    expect(gymFor(await getGyms(db), await getGymChoice(db, "andrew"))?.id).toBe("hotel");
    await deleteGym(db, "hotel");
    expect(await getGymChoice(db, "andrew")).toBeUndefined();
    expect(gymFor(await getGyms(db), undefined)?.id).toBe("home");
    await chooseGym(db, "diane", "gym");
    await deleteGym(db, "hotel-2");
    expect(await getGymChoice(db, "diane")).toBe("gym");
    await expect(deleteGym(db, "home")).rejects.toThrow("Home can't be removed");
  });

  it("go with a backup, and an older backup without them keeps this device's", async () => {
    await addGym(db, "Hotel", "empty");
    const backup = await buildBackup(db, { version: "test" });
    expect(backup.gyms!.map((g) => g.id)).toEqual(["home", "hotel"]);
    const other = new JfdiDatabase(`gyms-other-${Math.random()}`);
    await restoreBackup(other, backup);
    expect((await getGyms(other)).map((g) => g.id)).toEqual(["home", "hotel"]);
    const { gyms: _g, ...older } = backup;
    const third = new JfdiDatabase(`gyms-third-${Math.random()}`);
    await restoreBackup(third, older);
    expect((await getGyms(third)).map((g) => g.id)).toEqual(["home"]);
  });
});
