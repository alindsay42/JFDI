// Checks programme files against the schema, then checks the rules the schema can't express
// (references between ids, which fields a slot needs for its exercise, and so on).
//
//   npm run validate                 checks every file in examples/
//   npm run validate -- path.json    checks the given files
//   npm test                         also checks that every file in tests/invalid/ is rejected
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(readFileSync(join(root, "schema/programme.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
addFormats(ajv);
const checkSchema = ajv.compile(schema);

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
    if (w.days) {
      const lifts = Object.values(w.days).filter(d => d.type === "lift").length;
      if (lifts === 0) errors.push(`week "${w.id}": no lifting days`);
    }
    if (w.otherDays?.type === "lift") errors.push(`week "${w.id}": otherDays can't be lifting days`);
    if (w.perWeek && w.perWeek.liftDays * ((w.perWeek.minRestDays ?? 0) + 1) > 7) errors.push(`week "${w.id}": ${w.perWeek.liftDays} lifting days with ${w.perWeek.minRestDays} days between them don't fit in a week`);
    for (const id of w.rotation) {
      const s = sessions.get(id);
      if (!s) errors.push(`week "${w.id}": rotation has unknown session "${id}"`);
      else if (s.inRotation === false) errors.push(`week "${w.id}": session "${id}" is marked as not in rotation`);
    }
    for (const d of [...Object.values(w.days || {}), w.otherDays].filter(Boolean)) checkRange(d.minutes, `week "${w.id}" minutes`);
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

for (const file of files.length ? files : jsonIn("examples")) {
  const errors = check(file);
  if (errors.length) { failed++; console.log(`✗ ${file}`); errors.forEach(e => console.log(`    ${e}`)); }
  else console.log(`✓ ${file}`);
}

if (selfTest) {
  for (const file of jsonIn("tests/invalid")) {
    const errors = check(file);
    if (errors.length) console.log(`✓ rejected ${file}: ${errors[0]}`);
    else { failed++; console.log(`✗ ${file} should have been rejected but passed`); }
  }
}

process.exit(failed ? 1 : 0);
