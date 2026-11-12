// Checks the household equipment list, the exercise library, programmes, profiles and logs against
// their schemas, then the rules a schema can't express (references between ids, which fields a slot
// needs for its exercise, and so on). Shared by the app (before saving or restoring anything) and by
// scripts/validate.mjs (for the files in this repository). Types are in validate.d.ts.
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import programmeSchema from "../../schema/programme.schema.json" with { type: "json" };
import equipmentSchema from "../../schema/equipment.schema.json" with { type: "json" };
import librarySchema from "../../schema/library.schema.json" with { type: "json" };
import profileSchema from "../../schema/profile.schema.json" with { type: "json" };
import logSchema from "../../schema/log.schema.json" with { type: "json" };
import backupSchema from "../../schema/backup.schema.json" with { type: "json" };

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
addFormats(ajv);
const checkSchema = ajv.compile(programmeSchema);
const checkEquipmentSchema = ajv.compile(equipmentSchema);
const checkLibrarySchema = ajv.compile(librarySchema);
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
  const exIds = new Map(lib.exercises.map(e => [e.id, e]));
  for (const i of eq.items) for (const id of i.preferredFor || []) {
    const ex = exIds.get(id);
    if (!ex) errors.push(`equipment "${i.id}": preferred for unknown exercise "${id}"`);
    else if (!(ex.barTypes || []).includes(i.barType)) errors.push(`equipment "${i.id}": preferred for "${id}", which doesn't use a ${i.barType} bar`);
  }
  for (const i of eq.items) for (const kg of i.unavailableKg || []) if (!(i.pairsKg || []).includes(kg)) errors.push(`equipment "${i.id}": ${kg}kg is unavailable but isn't in pairsKg`);
  const used = new Set(lib.exercises.map(e => e.family));
  for (const f of lib.families) if (!used.has(f.id)) errors.push(`family "${f.id}" has no exercises`);
  return errors;
}

// Exercises a household adds itself. They sit alongside the library, so their ids start "own-" and can't
// clash with one the app brings later, and they can need any kit, since each gym's kit is the household's own.
const checkExerciseSchema = ajv.getSchema(`${librarySchema.$id}#/$defs/exercise`);
export function validateOwnExercises(list, lib) {
  const errors = [];
  uniqueIds(list, "exercise", errors);
  const names = new Set(lib.exercises.map(e => e.name.toLowerCase()));
  for (const ex of list) {
    if (!checkExerciseSchema(ex)) { errors.push(...schemaErrors(checkExerciseSchema, `exercise "${ex?.id}"`)); continue; }
    const where = `exercise "${ex.id}"`;
    if (!ex.id.startsWith("own-")) errors.push(`${where}: an added exercise's id starts own-`);
    if (ex.family !== "own") errors.push(`${where}: an added exercise's family is "own"`);
    if (ex.barTypes && ex.implement !== "barbell") errors.push(`${where}: only barbell exercises take bar types`);
    if (names.has(ex.name.toLowerCase())) errors.push(`${where}: there's already an exercise called "${ex.name}"`);
  }
  return errors;
}

/** The library with a household's own exercises added. */
export function withOwnExercises(lib, own) {
  return own?.length ? { ...lib, exercises: [...lib.exercises, ...own] } : lib;
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
  const workouts = index(p.workouts, "workout");
  index(p.phases, "phase");
  index(p.phases.flatMap(ph => ph.blocks), "training block");

  const needExercise = (id, where) => { if (!exercises.has(id)) errors.push(`${where}: unknown exercise "${id}"`); return exercises.get(id); };
  const checkRange = (r, where) => { if (r && r.min > r.max) errors.push(`${where}: min ${r.min} is more than max ${r.max}`); };

  for (const ex of p.exercises) {
    if (ex.bar && !equipment.has(ex.bar)) errors.push(`exercise "${ex.id}": unknown bar "${ex.bar}"`);
    if (ex.bar && ex.implement !== "barbell") errors.push(`exercise "${ex.id}": only barbell exercises take a bar`);
  }

  for (const w of p.workouts) {
    w.items.forEach((b, bi) => {
      b.slots.forEach((slot, si) => {
        const where = `workout "${w.id}" item ${bi + 1}${b.slots.length > 1 ? ` exercise ${si + 1}` : ""}`;
        const ex = needExercise(slot.exercise, where);
        if (!progressions.has(slot.progression)) errors.push(`${where}: unknown progression "${slot.progression}"`);
        for (const alt of slot.alternatives || []) needExercise(alt, `${where} alternative`);
        if (b.type !== "single" && slot.sets !== undefined) errors.push(`${where}: exercises in a ${b.type} use its rounds, not sets`);
        if (b.type === "single" && slot.sets === undefined) errors.push(`${where}: sets is required`);
        for (const f of ["reps", "seconds", "metres", "calories"]) checkRange(slot[f], `${where} ${f}`);
        if (!ex) return;
        const field = MEASURE_FIELD[ex.measure];
        if (b.type !== "finisher" && !slot[field]) errors.push(`${where}: "${ex.id}" is measured by ${ex.measure}, so it needs ${field}`);
        for (const f of Object.values(MEASURE_FIELD)) if (f !== field && slot[f]) errors.push(`${where}: ${f} doesn't apply to a ${ex.measure} exercise`);
        if (ex.bar && typeof slot.start?.kg === "number") {
          const bar = equipment.get(ex.bar);
          if (bar && slot.start.kg < bar.kg) errors.push(`${where}: start ${slot.start.kg}kg is lighter than the ${bar.name} (${bar.kg}kg)`);
        }
        if (slot.start?.kg === "bar" && !ex.bar) errors.push(`${where}: start "bar" needs a barbell exercise`);
      });
    });
  }

  const planned = new Set();
  const needWorkout = (id, where) => { planned.add(id); if (!workouts.has(id)) errors.push(`${where}: unknown workout "${id}"`); };
  p.plan.weeks.forEach((week, wi) => {
    const where = `plan week ${wi + 1}`;
    if (p.plan.mode === "adhoc") {
      week.workouts.forEach((id, d) => needWorkout(id, `${where} day ${d + 1}`));
      const n = week.workouts.length;
      const rest = p.plan.minRestDays ?? 0;
      if (n + (n - 1) * rest > 7) errors.push(`${where}: ${n} workouts with ${rest} rest days between them don't fit in a week`);
      if (week.otherDays) checkRange(week.otherDays.minutes, `${where} other days minutes`);
    } else {
      const days = Object.entries(week.days);
      for (const [d, day] of days) {
        if (day.type === "workout") needWorkout(day.workout, `${where} ${d}`);
        checkRange(day.minutes, `${where} ${d} minutes`);
      }
      if (!days.some(([, day]) => day.type === "workout")) errors.push(`${where}: no workouts`);
    }
  });

  for (const ph of p.phases) {
    for (const g of [...(ph.gates?.entry || []), ...(ph.gates?.exit || [])]) if (g.type === "lift") needExercise(g.exercise, `phase "${ph.id}" gate`);
  }

  for (const [name, level] of Object.entries(p.readiness.levels || {})) {
    for (const r of level.rules) {
      if (r.rule === "replaceWorkout") { planned.add(r.workout); if (!workouts.has(r.workout)) errors.push(`readiness ${name}: unknown workout "${r.workout}"`); }
    }
  }
  for (const w of p.workouts) if (!planned.has(w.id)) errors.push(`workout "${w.id}" isn't in the plan or used by a readiness rule`);

  for (const t of p.targets || []) needExercise(t.exercise, "target");
  if (p.createdAt > p.updatedAt) errors.push("updatedAt is earlier than createdAt");
  return errors;
}

const checkProfileSchema = ajv.compile(profileSchema);
const checkLogSchema = ajv.compile(logSchema);
const MEASURE_SET_FIELD = { load: "reps", reps: "reps", time: "seconds", distance: "metres", calories: "calories" };

// programmes: Map of programme id -> programme file. equipment and library as loaded from data/.
export function validateProfile(profile, { programmes, equipment, library }) {
  if (!checkProfileSchema(profile)) return schemaErrors(checkProfileSchema, "profile");
  const errors = [];
  const equipmentIds = new Set(equipment.items.map(i => i.id));
  const libraryIds = new Set(library.exercises.map(e => e.id));
  for (const id of profile.unavailableEquipment || []) if (!equipmentIds.has(id)) errors.push(`unavailable equipment "${id}" isn't in the equipment list`);
  for (const id of profile.excludedExercises || []) if (!libraryIds.has(id)) errors.push(`excluded exercise "${id}" isn't in the library`);
  for (const t of profile.targets || []) if (!libraryIds.has(t.exercise)) errors.push(`target exercise "${t.exercise}" isn't in the library`);
  const a = profile.programmes.active;
  if (a) {
    const p = programmes.get(a.programme);
    if (!p) errors.push(`active programme "${a.programme}" not found`);
    else {
      if (p.updatedAt !== a.programmeUpdatedAt) errors.push(`active programme "${a.programme}" is version ${p.updatedAt}, but the profile says ${a.programmeUpdatedAt}`);
      const used = new Set(p.exercises.map(e => e.id));
      for (const id of Object.keys(a.startingLoads || {})) if (!used.has(id)) errors.push(`starting load for "${id}", which isn't in programme "${p.id}"`);
      const blocked = new Set(profile.unavailableEquipment || []);
      const barById = new Map(p.equipment.map(b => [b.id, b.barType]));
      const household = equipment.items.filter(i => i.kind === "bar");
      for (const ex of p.exercises) {
        const bt = ex.bar && barById.get(ex.bar);
        if (bt && household.filter(b => b.barType === bt).every(b => blocked.has(b.id))) errors.push(`programme exercise "${ex.id}" needs a ${bt} bar, which this profile can't use`);
      }
    }
  }
  for (const h of profile.programmes.history) if (h.endDate < h.startDate) errors.push(`programme history "${h.programme}": ends before it starts`);
  return errors;
}

export function validateLog(log, { profiles, programmes, library }) {
  if (!checkLogSchema(log)) return schemaErrors(checkLogSchema, "log");
  const errors = [];
  const lib = new Map(library.exercises.map(e => [e.id, e]));
  if (profiles && !profiles.has(log.profile)) errors.push(`profile "${log.profile}" not found`);
  const seen = new Set();
  for (const s of log.sessions) {
    const where = `session "${s.id}"`;
    if (seen.has(s.id)) errors.push(`duplicate session id "${s.id}"`);
    seen.add(s.id);
    if (s.finishedAt && s.finishedAt < s.startedAt) errors.push(`${where}: finishes before it starts`);
    if (s.check48h && s.finishedAt && s.check48h.at < s.finishedAt) errors.push(`${where}: 48-hour check is before the session finished`);
    if (s.programme) {
      const p = programmes.get(s.programme.id);
      if (!p) errors.push(`${where}: programme "${s.programme.id}" not found`);
      else if (!p.workouts.some(x => x.id === s.session.id)) errors.push(`${where}: programme "${p.id}" has no workout "${s.session.id}"`);
      if (!s.prescribed) errors.push(`${where}: a programme session needs its prescription copied in`);
    }
    for (const e of s.exercises) {
      const ew = `${where} "${e.exercise}"`;
      const ex = lib.get(e.exercise);
      if (!ex) { errors.push(`${ew}: not in the library`); continue; }
      if (e.swappedFrom && !lib.has(e.swappedFrom)) errors.push(`${ew}: swapped from unknown "${e.swappedFrom}"`);
      if (e.added && e.slot) errors.push(`${ew}: an added exercise has no slot in the prescription`);
      if (e.slot === null && !e.added) errors.push(`${ew}: slot null is only for exercises added during the session`);
      if (e.slot && s.prescribed) {
        const [b, i] = e.slot.split(".");
        const slot = s.prescribed.items[+b]?.slots?.[+i];
        if (!slot) errors.push(`${ew}: slot ${e.slot} isn't in the prescription`);
        else if (slot.exercise !== e.exercise && slot.exercise !== e.swappedFrom) errors.push(`${ew}: slot ${e.slot} prescribes "${slot.exercise}"`);
      }
      const field = MEASURE_SET_FIELD[ex.measure];
      e.sets.forEach((st, n) => {
        for (const f of Object.values(MEASURE_SET_FIELD)) if (f !== field && st[f] !== undefined) errors.push(`${ew} set ${n + 1}: ${f} doesn't apply to a ${ex.measure} exercise`);
        if (st.done && st[field] === undefined) errors.push(`${ew} set ${n + 1}: a completed set needs ${field}`);
      });
    }
  }
  const dates = new Set();
  for (const d of log.days) {
    if (dates.has(d.date)) errors.push(`duplicate day ${d.date}`);
    dates.add(d.date);
    for (const a of d.activities || []) if (!lib.has(a.exercise)) errors.push(`day ${d.date}: activity "${a.exercise}" isn't in the library`);
  }
  const weighIns = new Set();
  for (const w of log.bodyweight) { if (weighIns.has(w.date)) errors.push(`duplicate weigh-in on ${w.date}`); weighIns.add(w.date); }
  return errors;
}

const checkBackupSchema = ajv.compile(backupSchema);

// A whole-household backup. Everything is checked before anything is restored.
export function validateBackup(backup, { equipment, library: bundled }) {
  if (!checkBackupSchema(backup)) return schemaErrors(checkBackupSchema, "backup");
  const errors = [];
  errors.push(...validateOwnExercises(backup.exercises || [], bundled));
  const library = withOwnExercises(bundled, backup.exercises);
  uniqueIds(backup.profiles, "profile", errors);
  uniqueIds(backup.programmes, "programme", errors);
  uniqueIds(backup.gyms || [], "gym", errors);
  for (const g of backup.gyms || []) errors.push(...validateEquipment(g.kit).map(e => `gym "${g.id}": ${e}`));
  const programmes = new Map(backup.programmes.map(p => [p.id, p]));
  const profiles = new Map(backup.profiles.map(p => [p.id, p]));
  for (const p of backup.programmes) {
    const pe = validateProgramme(p);
    if (!pe.length) pe.push(...checkAgainstLibrary(p, library, equipment));
    errors.push(...pe.map(e => `programme "${p.id}": ${e}`));
  }
  for (const p of backup.profiles) errors.push(...validateProfile(p, { programmes, equipment, library }).map(e => `profile "${p.id}": ${e}`));
  const logged = new Set();
  for (const log of backup.logs) {
    if (logged.has(log.profile)) errors.push(`more than one log for profile "${log.profile}"`);
    logged.add(log.profile);
    errors.push(...validateLog(log, { profiles, programmes, library }).map(e => `log for "${log.profile}": ${e}`));
  }
  return errors;
}
