// Upgrades older files to the current format versions, so backups and data saved by earlier
// versions of the app keep working. Shared by the app (on restore, and when the database is
// opened) and by scripts. Types are in upgrade.d.ts. Each upgrade is tested in tests/formats/.
//
// Programme 1 -> 2 (7 November 2026, docs/programme-editor.md):
//   sessions with tiers   -> workouts with one ordered list of items, each keeping its tier
//   straight blocks       -> single
//   superset              -> runs in rounds, like giant sets: the most sets of its slots
//   weeks + rotation      -> plan: a cycle of 1 to 4 weeks, ad hoc or on set days
//   replaceSession rule   -> replaceWorkout
// Log 1 -> 2: each session's prescription becomes a workout, and slots "tier.block.slot" become "item.slot".

const TIERS = ["primary", "secondary", "tertiary"];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const MAX_CYCLE_WEEKS = 4;

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

function convertBlock(block, tier) {
  const { type, slots, ...rest } = block;
  if (type === "straight") return { type: "single", tier, ...rest, slots };
  if (type === "superset") {
    const rounds = Math.max(...slots.map(s => s.sets ?? 1));
    return { type: "superset", tier, rounds, ...rest, slots: slots.map(({ sets: _sets, ...s }) => s) };
  }
  return { type, tier, ...rest, slots };
}

/** A v1 session as a v2 workout, plus where each old slot path now lives. */
export function sessionToWorkout(session) {
  const { tiers, inRotation: _inRotation, ...rest } = session;
  const items = [];
  const slotPaths = new Map();
  for (const tier of TIERS) {
    (tiers[tier] || []).forEach((block, bi) => {
      block.slots.forEach((_, si) => slotPaths.set(`${tier}.${bi}.${si}`, `${items.length}.${si}`));
      items.push(convertBlock(block, tier));
    });
  }
  return { workout: { ...rest, items }, slotPaths };
}

/** Lays a rotation over weeks. Returns the workouts for each week of the cycle, at most 4 weeks. */
function cycle(rotation, perWeek) {
  const weeks = Math.min(MAX_CYCLE_WEEKS, rotation.length / gcd(rotation.length, perWeek));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: perWeek }, (_, d) => rotation[(w * perWeek + d) % rotation.length]));
}

function weekToPlan(week) {
  if (week.perWeek) {
    const plan = { mode: "adhoc", weeks: cycle(week.rotation, week.perWeek.liftDays).map(workouts => ({ workouts })) };
    if (week.perWeek.minRestDays !== undefined) plan.minRestDays = week.perWeek.minRestDays;
    if (week.otherDays) plan.weeks.forEach(w => { w.otherDays = week.otherDays; });
    return plan;
  }
  const liftDays = DAYS.filter(d => week.days[d].type === "lift");
  const lifts = cycle(week.rotation, liftDays.length);
  return {
    mode: "setDays",
    weeks: lifts.map(workouts => ({
      days: Object.fromEntries(DAYS.map(d => {
        const day = week.days[d];
        if (day.type !== "lift") return [d, day];
        const { type: _type, ...rest } = day;
        return [d, { type: "workout", workout: workouts[liftDays.indexOf(d)], ...rest }];
      })),
    })),
  };
}

export function upgradeProgramme(p) {
  if (!p || p.format !== "jfdi-programme" || p.formatVersion !== 1) return p;
  const { sessions, weeks, daysPerWeek: _daysPerWeek, phases, readiness, ...rest } = p;
  const usedWeek = phases[0]?.blocks[0]?.week ?? weeks[0].id;
  const week = weeks.find(w => w.id === usedWeek) ?? weeks[0];
  const levels = readiness.levels && Object.fromEntries(Object.entries(readiness.levels).map(([k, level]) => [k, {
    ...level,
    rules: level.rules.map(r => (r.rule === "replaceSession" ? { rule: "replaceWorkout", workout: r.session } : r)),
  }]));
  return {
    ...rest,
    formatVersion: 2,
    workouts: sessions.map(s => sessionToWorkout(s).workout),
    plan: weekToPlan(week),
    phases: phases.map(ph => ({ ...ph, blocks: ph.blocks.map(({ week: _w, ...b }) => b) })),
    readiness: levels ? { ...readiness, levels } : readiness,
  };
}

/** Upgrades one logged session: its prescription, and the slot each exercise points at. */
export function upgradeSession(s) {
  if (!s.prescribed?.tiers) return s;
  const { workout, slotPaths } = sessionToWorkout(s.prescribed);
  return {
    ...s,
    prescribed: workout,
    exercises: s.exercises.map(e => (e.slot ? { ...e, slot: slotPaths.get(e.slot) ?? e.slot } : e)),
  };
}

export function upgradeLog(log) {
  if (!log || log.format !== "jfdi-log" || log.formatVersion !== 1) return log;
  return { ...log, formatVersion: 2, sessions: log.sessions.map(upgradeSession) };
}

export function upgradeBackup(b) {
  if (!b || b.format !== "jfdi-backup" || b.formatVersion !== 1) return b;
  return {
    ...b,
    formatVersion: 2,
    programmes: (b.programmes || []).map(upgradeProgramme),
    logs: (b.logs || []).map(upgradeLog),
  };
}
