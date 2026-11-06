// Checks the household equipment list, the exercise library and programme files against their
// schemas, then checks the rules a schema can't express (references between ids, which fields a
// slot needs for its exercise, whether a programme's exercises match the library, and so on).
//
//   npm run validate                 checks data/ and every file in examples/
//   npm run validate -- path.json    checks the given files
//   npm test                         also checks that every file in tests/invalid/ is rejected
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = path => JSON.parse(readFileSync(join(root, path), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
addFormats(ajv);
const checkSchema = ajv.compile(readJson("schema/programme.schema.json"));
const checkEquipmentSchema = ajv.compile(readJson("schema/equipment.schema.json"));
const checkLibrarySchema = ajv.compile(readJson("schema/library.schema.json"));
const schemaErrors = (fn, label) => fn.errors.map(e => `${label} schema: ${e.instancePath || "/"} ${e.message}`);
const uniqueIds = (list, what, errors) => {
  const seen = new Set();
  for (const item of list) { if (seen.has(item.id)) errors.push(`duplicate ${what} id "${item.id}"`); seen.add(item.id); }
};

export function validateEquipment(eq) {
  if (!checkEquipmentSchema(eq)) return schemaErrors(checkEquipmentSchema, "equipment");
  const errors = [];
  uniqueIds(eq.items, "equipment", errors);
  const ids = new Set(eq.items.map(i => i.id));
  for (const i of eq.items) if (i.attachesTo && !ids.has(i.attachesTo)) errors.push(`equipment "${i.id}": attaches to unknown "${i.attachesTo}"`);
  return errors;
}

export function validateLibrary(lib, eq) {
  if (!checkLibrarySchema(lib)) return schemaErrors(checkLibrarySchema, "library");
  const errors = [];
  uniqueIds(lib.families, "family", errors);
  uniqueIds(lib.exercises, "library exercise", errors);
  const families = new Map(lib.families.map(f => [f.id, f]));
  const equipment = new Set(eq.items.map(i => i.id));
  const barTypes = new Set(eq.items.filter(i => i.kind === "bar").map(i => i.barType));
  for (const ex of lib.exercises) {
    const where = `library exercise "${ex.id}"`;
    if (!families.has(ex.family)) errors.push(`${where}: unknown family "${ex.family}"`);
    for (const r of ex.requires) if (!equipment.has(r)) errors.push(`${where}: needs unknown equipment "${r}"`);
    for (const bt of ex.barTypes || []) if (!barTypes.has(bt)) errors.push(`${where}: no ${bt} bar in the equipment list`);
    if (ex.barTypes && ex.implement !== "barbell") errors.push(`${where}: only barbell exercises take bar types`);
  }
  const used = new Set(lib.exercises.map(e => e.family));
  for (const f of lib.families) if (!used.has(f.id)) errors.push(`family "${f.id}" has no exercises`);
  return errors;
}

// A programme carries its own copy of each exercise. When it uses a library exercise, the copy must agree.
export function checkAgainstLibrary(p, lib, eq) {
  const errors = [];
  const library = new Map(lib.exercises.map(e => [e.id, e]));
  const bars = new Map(p.equipment.map(b => [b.id, b]));
  const householdBarTypes = new Set(eq.items.filter(i => i.kind === "bar").map(i => i.barType));
  for (const b of p.equipment) if (!householdBarTypes.has(b.barType)) errors.push(`bar "${b.id}": the household has no ${b.barType} bar`);
  for (const ex of p.exercises) {
    const libEx = library.get(ex.id);
    if (!libEx) { errors.push(`exercise "${ex.id}" isn't in the library`); continue; }
    for (const f of ["measure", "implement"]) if (ex[f] !== libEx[f]) errors.push(`exercise "${ex.id}": ${f} is "${ex[f]}" but the library says "${libEx[f]}"`);
    const barType = ex.bar ? bars.get(ex.bar)?.barType : undefined;
    const allowed = libEx.barTypes || [];
    if (barType ? !allowed.includes(barType) : allowed.length) errors.push(`exercise "${ex.id}": uses ${barType ? `bar type "${barType}"` : "no bar"} but the library allows ${allowed.join(" or ") || "no bar"}`);
  }
  return errors;
}

const MEASURE_FIELD = { load: "reps", reps: "reps", time: "seconds", distance: "metres", calories: "calories" };

export function validateProgramme(p) {
  const errors = [];
  if (!checkSchema(p)) {
    for (const e of checkSchema.errors) errors.push(`schema: ${e.instancePath || "/"} ${e.message}`);
    return errors; // cross-checks assume the basic shape is right
  }
  const index = (list, what) => {
    const map = new Map();
    for (const item of list) {
      if (map.has(item.id)) errors.push(`duplicate ${what} id "${item.id}"`);
      map.set(item.id, item);
    }
    return map;
  };
  const equipment = index(p.equipment, "equipment");
  const exercises = index(p.exercises, "exercise");
  const progressions = index(p.progressions, "progression");
  const sessions = index(p.sessions, "session");
  const weeks = index(p.weeks, "week");
  index(p.phases, "phase");
  index(p.phases.flatMap(ph => ph.blocks), "training block");

  const needExercise = (id, where) => { if (!exercises.has(id)) errors.push(`${where}: unknown exercise "${id}"`); return exercises.get(id); };
  const checkRange = (r, where) => { if (r && r.min > r.max) errors.push(`${where}: min ${r.min} is more than max ${r.max}`); };

  for (const ex of p.exercises) {
    if (ex.bar && !equipment.has(ex.bar)) errors.push(`exercise "${ex.id}": unknown bar "${ex.bar}"`);
    if (ex.bar && ex.implement !== "barbell") errors.push(`exercise "${ex.id}": only barbell exercises take a bar`);
  }

  for (const s of p.sessions) {
    for (const [tier, blocks] of Object.entries(s.tiers)) {
      blocks.forEach((b, bi) => {
        b.slots.forEach((slot, si) => {
          const where = `session "${s.id}" ${tier} block ${bi + 1} slot ${si + 1}`;
          const ex = needExercise(slot.exercise, where);
          if (!progressions.has(slot.progression)) errors.push(`${where}: unknown progression "${slot.progression}"`);
          for (const alt of slot.alternatives || []) needExercise(alt, `${where} alternative`);
          const timed = b.type === "giant" || b.type === "finisher";
          if (timed && slot.sets !== undefined) errors.push(`${where}: slots in a ${b.type} block use the block's rounds, not sets`);
          if (!timed && slot.sets === undefined) errors.push(`${where}: sets is required`);
          for (const f of ["reps", "seconds", "metres", "calories"]) checkRange(slot[f], `${where} ${f}`);
          if (!ex) return;
          const field = MEASURE_FIELD[ex.measure];
          if (b.type !== "finisher" && !slot[field]) errors.push(`${where}: "${ex.id}" is measured by ${ex.measure}, so the slot needs ${field}`);
          for (const f of Object.values(MEASURE_FIELD)) if (f !== field && slot[f]) errors.push(`${where}: ${f} doesn't apply to a ${ex.measure} exercise`);
          if (ex.bar && typeof slot.start?.kg === "number") {
            const bar = equipment.get(ex.bar);
            if (bar && slot.start.kg < bar.kg) errors.push(`${where}: start ${slot.start.kg}kg is lighter than the ${bar.name} (${bar.kg}kg)`);
          }
          if (slot.start?.kg === "bar" && !ex.bar) errors.push(`${where}: start "bar" needs a barbell exercise`);
        });
      });
    }
  }

  for (const w of p.weeks) {
    const lifts = Object.values(w.days).filter(d => d.type === "lift").length;
    if (lifts === 0) errors.push(`week "${w.id}": no lifting days`);
    for (const id of w.rotation) {
      const s = sessions.get(id);
      if (!s) errors.push(`week "${w.id}": rotation has unknown session "${id}"`);
      else if (s.inRotation === false) errors.push(`week "${w.id}": session "${id}" is marked as not in rotation`);
    }
    for (const d of Object.values(w.days)) checkRange(d.minutes, `week "${w.id}" minutes`);
  }

  for (const ph of p.phases) {
    for (const b of ph.blocks) if (!weeks.has(b.week)) errors.push(`block "${b.id}": unknown week "${b.week}"`);
    for (const g of [...(ph.gates?.entry || []), ...(ph.gates?.exit || [])]) if (g.type === "lift") needExercise(g.exercise, `phase "${ph.id}" gate`);
  }

  for (const [name, level] of Object.entries(p.readiness.levels || {})) {
    for (const r of level.rules) {
      if (r.rule === "replaceSession" && !sessions.has(r.session)) errors.push(`readiness ${name}: unknown session "${r.session}"`);
    }
  }

  for (const t of p.targets || []) needExercise(t.exercise, "target");
  if (p.createdAt > p.updatedAt) errors.push("updatedAt is earlier than createdAt");
  return errors;
}

function check(file) {
  let data;
  try { data = JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { return [`not valid JSON: ${e.message}`]; }
  return validateProgramme(data);
}

const jsonIn = dir => readdirSync(join(root, dir)).filter(f => f.endsWith(".json")).map(f => join(root, dir, f));
const args = process.argv.slice(2);
const selfTest = args.includes("--self-test");
const files = args.filter(a => !a.startsWith("--"));
let failed = 0;
const report = (label, errors) => {
  if (errors.length) { failed++; console.log(`✗ ${label}`); errors.forEach(e => console.log(`    ${e}`)); }
  else console.log(`✓ ${label}`);
};

const equipment = readJson("data/equipment.json");
const library = readJson("data/library.json");
const equipmentErrors = validateEquipment(equipment);
report("data/equipment.json", equipmentErrors);
const libraryErrors = equipmentErrors.length ? ["skipped: fix the equipment list first"] : validateLibrary(library, equipment);
report(`data/library.json (${library.exercises?.length ?? 0} exercises)`, libraryErrors);

for (const file of files.length ? files : jsonIn("examples")) {
  const errors = check(file);
  if (!errors.length && !libraryErrors.length) errors.push(...checkAgainstLibrary(JSON.parse(readFileSync(file, "utf8")), library, equipment));
  report(file, errors);
}

if (selfTest) {
  // Each broken file must be rejected, and for the reason listed in expected-errors.json
  const expected = readJson("tests/invalid/expected-errors.json");
  for (const file of jsonIn("tests/invalid").filter(f => !f.endsWith("expected-errors.json"))) {
    const name = file.split("/").pop();
    const errors = check(file);
    if (!errors.length && !libraryErrors.length) errors.push(...checkAgainstLibrary(JSON.parse(readFileSync(file, "utf8")), library, equipment));
    const want = expected[name];
    if (!want) { failed++; console.log(`✗ ${name}: no expected error listed in expected-errors.json`); }
    else if (errors.some(e => e.includes(want))) console.log(`✓ rejected ${name}: ${errors.find(e => e.includes(want))}`);
    else { failed++; console.log(`✗ ${name}: expected an error containing "${want}", got ${errors.length ? errors.join("; ") : "no errors"}`); }
  }
}

process.exit(failed ? 1 : 0);
