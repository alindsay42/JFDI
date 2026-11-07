import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { afterEach, describe, expect, it } from "vitest";
import { JfdiDatabase } from "../../src/store/db.ts";
import {
  addProfile, getCurrentProfileId, newProfile, PROFILE_COLOURS, profileId, setCurrentProfileId,
} from "../../src/store/profiles.ts";

const schema = (n: string) => JSON.parse(readFileSync(`schema/${n}.schema.json`, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
ajv.addSchema(schema("programme"));
const validProfile = ajv.compile(schema("profile"));

describe("profile ids", () => {
  it.each([
    ["Diane", [], "diane"],
    ["  Zoë Lindsay ", [], "zoe-lindsay"],
    ["Diane", ["diane"], "diane-2"],
    ["Diane", ["diane", "diane-2"], "diane-3"],
    ["!!!", [], "person"],
  ])("%j with %j taken gives %j", (name, taken, id) => {
    expect(profileId(name, taken)).toBe(id);
  });
});

describe("new profiles", () => {
  it("pass the profile schema", () => {
    const p = newProfile("Diane", "#7C3AED", [], new Date("2026-11-07T10:00:00Z"));
    expect(validProfile(p), JSON.stringify(validProfile.errors)).toBe(true);
    expect(p).toMatchObject({ id: "diane", colour: "#7c3aed", createdAt: "2026-11-07T10:00:00.000Z" });
  });

  it("every offered colour is a valid profile colour", () => {
    for (const c of PROFILE_COLOURS) expect(validProfile(newProfile("X", c.hex, []))).toBe(true);
  });

  it("need a name and a real colour", () => {
    expect(() => newProfile("   ", "#7c3aed", [])).toThrow("A name is needed");
    expect(() => newProfile("Diane", "purple", [])).toThrow("Not a colour");
  });
});

describe("profiles on the device", () => {
  let db: JfdiDatabase;
  afterEach(async () => { await db.delete(); });

  it("are added with unique ids and remembered as the current person", async () => {
    db = new JfdiDatabase(`test-${Math.random()}`);
    const a = await addProfile(db, "Diane", "#7c3aed");
    const b = await addProfile(db, "Diane", "#2563eb");
    expect([a.id, b.id]).toEqual(["diane", "diane-2"]);
    expect(await getCurrentProfileId(db)).toBeNull();
    await setCurrentProfileId(db, "diane-2");
    expect(await getCurrentProfileId(db)).toBe("diane-2");
  });
});
