// Checks the household equipment list, the exercise library and programme files against their
// schemas, then checks the rules a schema can't express (references between ids, which fields a
// slot needs for its exercise, whether a programme's exercises match the library, and so on).
//
//   npm run validate      checks data/ and every programme, profile and log in examples/
//   npm test              also runs the Rebuild Log importer on a sample backup, and checks that
//                         every file in tests/invalid/ is rejected for its listed reason
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateEquipment, validateLibrary, checkAgainstLibrary, validateProgramme, validateProfile, validateLog,
} from "../src/formats/validate.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = path => JSON.parse(readFileSync(join(root, path), "utf8"));

const jsonIn = dir => readdirSync(join(root, dir)).filter(f => f.endsWith(".json")).map(f => join(root, dir, f));
const args = process.argv.slice(2);
const selfTest = args.includes("--self-test");
let failed = 0;
const report = (label, errors) => {
  if (errors.length) { failed++; console.log(`✗ ${label}`); errors.forEach(e => console.log(`    ${e}`)); }
  else console.log(`✓ ${label}`);
};
const short = f => f.replace(root + "/", "");
const load = file => { try { return { data: JSON.parse(readFileSync(file, "utf8")) }; } catch (e) { return { error: `not valid JSON: ${e.message}` }; } };

const equipment = readJson("data/equipment.json");
const library = readJson("data/library.json");
const equipmentErrors = validateEquipment(equipment);
report("data/equipment.json", equipmentErrors);
const libraryErrors = equipmentErrors.length ? ["skipped: fix the equipment list first"] : validateLibrary(library, equipment);
report(`data/library.json (${library.exercises?.length ?? 0} exercises)`, libraryErrors);

// Example programmes, profiles and logs. Each check can see the others, so references between them are tested.
const programmes = new Map(), profiles = new Map();
for (const f of [...jsonIn("examples/programmes"), ...jsonIn("examples")]) { const { data } = load(f); if (data?.id) programmes.set(data.id, data); }
for (const f of jsonIn("examples/profiles")) { const { data } = load(f); if (data?.id) profiles.set(data.id, data); }
const context = { programmes, profiles, equipment, library };

function check(file) {
  const { data, error } = load(file);
  if (error) return [error];
  if (data.format === "jfdi-profile") return validateProfile(data, context);
  if (data.format === "jfdi-log") return validateLog(data, context);
  const errors = validateProgramme(data);
  if (!errors.length && !libraryErrors.length) errors.push(...checkAgainstLibrary(data, library, equipment));
  return errors;
}

for (const file of [...jsonIn("examples/programmes"), ...jsonIn("examples"), ...jsonIn("examples/profiles"), ...jsonIn("examples/logs")]) report(short(file), check(file));

if (selfTest) {
  // The Rebuild Log importer must turn the sample backup into a valid log with nothing dropped
  const { convertRebuildLog } = await import("../src/formats/rebuild-log.js");
  const backup = readJson("tests/fixtures/rebuild-log-backup-sample.json");
  const { log, problems } = convertRebuildLog(backup, "andrew", library);
  const importErrors = [...problems, ...validateLog(log, { ...context, profiles: null })];
  const doneInBackup = Object.values(backup.sessions).filter(s => s.status === "done").length;
  if (log.sessions.length !== doneInBackup) importErrors.push(`imported ${log.sessions.length} sessions, but the backup has ${doneInBackup}`);
  if (log.bodyweight.length !== Object.keys(backup.weights || {}).length) importErrors.push("not every weigh-in came across");
  report(`Rebuild Log import of the sample backup (${log.sessions.length} sessions, ${log.days.length} days, ${log.bodyweight.length} weigh-ins)`, importErrors);

  // Each broken file must be rejected, and for the reason listed in expected-errors.json
  const expected = readJson("tests/invalid/expected-errors.json");
  for (const file of jsonIn("tests/invalid").filter(f => !f.endsWith("expected-errors.json"))) {
    const name = file.split("/").pop();
    const errors = check(file);
    const want = expected[name];
    if (!want) { failed++; console.log(`✗ ${name}: no expected error listed in expected-errors.json`); }
    else if (errors.some(e => e.includes(want))) console.log(`✓ rejected ${name}: ${errors.find(e => e.includes(want))}`);
    else { failed++; console.log(`✗ ${name}: expected an error containing "${want}", got ${errors.length ? errors.join("; ") : "no errors"}`); }
  }
}

process.exit(failed ? 1 : 0);
