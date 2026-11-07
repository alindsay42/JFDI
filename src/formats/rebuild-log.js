// Converts a Rebuild Log backup into a J.F.D.I training log (requirement DA-1). Training history
// comes across; Rebuild Log's programme does not. Shared by the app's import and by
// scripts/import-rebuild-log.mjs. Types are in rebuild-log.d.ts.

// Rebuild Log exercise id -> J.F.D.I library id. Some depend on whether weight was added.
const EXERCISE_MAP = {
  ssb: "ssb-squat-heels-raised",
  hatfield: "hatfield-squat",
  goblet: "goblet-squat-to-box",
  split: "rack-supported-split-squat",
  legext: "leg-extension",
  legcurl: "leg-curl",
  calfseat: "seated-db-calf-raise",
  calfstand: "standing-calf-raise",
  dbrdl: "db-romanian-deadlift",
  rdl: "romanian-deadlift",
  trapbar: "trap-bar-deadlift-high",
  hyper: added => (added ? "back-extension-plate-chest" : "back-extension-pause"),
  hyperw: "back-extension-plate-chest",
  bench: "bench-press",
  dbpress: "seated-db-shoulder-press",
  incdb: "incline-db-press",
  swiss: "swiss-bar-press",
  dips: added => (added ? "weighted-dip" : "dip"),
  csrow: "chest-supported-db-row",
  cablerow: "seated-cable-row",
  pulldown: "cable-pulldown",
  pullup: added => (added ? "weighted-pull-up" : "pull-up"),
  ngpull: added => (added ? "weighted-pull-up" : "neutral-grip-pull-up"),
  facepull: "face-pull",
  latraise: "db-lateral-raise",
  dbcurl: "db-curl",
  ezcurl: "ez-bar-curl",
  hammer: "hammer-curl",
  pushdown: "cable-pushdown",
  skull: "ez-skull-crusher",
  pallof: "pallof-press",
  splank: "side-plank",
  deadbug: "dead-bug",
  carry: "farmers-carry",
  suitcase: "suitcase-carry"
};

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : undefined; };
const safeId = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
const iso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

export function convertRebuildLog(backup, profileId, library) {
  if (backup.app !== "rebuild-log" || !backup.sessions) throw new Error("Not a Rebuild Log backup file");
  const lib = new Map(library.exercises.map(e => [e.id, e]));
  const problems = [];

  const sessions = Object.values(backup.sessions)
    .filter(s => s.status === "done")
    .sort((a, b) => a.startedAt - b.startedAt)
    .map(s => {
      const exercises = (s.exercises || []).map(e => {
        const anyKg = (e.sets || []).some(st => (num(st.kg) ?? 0) > 0);
        const rule = EXERCISE_MAP[e.id];
        const id = typeof rule === "function" ? rule(anyKg) : rule;
        const ex = id && lib.get(id);
        if (!ex) { problems.push(`${s.date}: no J.F.D.I exercise for Rebuild Log's "${e.id}"`); return null; }
        const sets = (e.sets || []).map(st => {
          const out = { done: !!st.done };
          const kg = num(st.kg), value = num(st.reps);
          const usesKg = ex.measure === "load" || ex.measure === "distance" || (ex.measure === "reps" && kg > 0);
          if (kg !== undefined && usesKg) out.kg = kg;
          if (value !== undefined) {
            if (ex.measure === "time") out.seconds = Math.round(value);
            else if (ex.measure === "distance") out.metres = value;
            else out.reps = Math.round(value);
          }
          return out;
        });
        const entry = { exercise: ex.id, name: ex.name };
        if (ex.loadPer) entry.loadPer = ex.loadPer;
        if (e.added) entry.added = true;
        if (e.removed) entry.removed = { reason: e.removed.reason ?? null };
        entry.sets = sets;
        return entry;
      }).filter(Boolean);
      const out = {
        id: safeId(s.id),
        date: s.date,
        startedAt: iso(s.startedAt),
        finishedAt: iso(s.finishedAt || s.startedAt),
        status: "done",
        programme: null,
        session: { id: safeId(`rebuild-log-${s.key || s.title}`), name: s.title, subtitle: s.sub || "" },
        readiness: ["green", "amber", "red"].includes(s.light) ? s.light : null,
        exercises,
        notes: s.notes || "",
        endedEarly: s.endedEarly || null,
        check48h: s.check ? { status: s.check.status, at: iso(s.check.at) } : null,
        importedFrom: "rebuild-log"
      };
      if (s.week) out.notes = [`Rebuild Log phase ${s.phase}, week ${s.week}.`, out.notes].filter(Boolean).join(" ");
      return out;
    });

  const days = Object.values(backup.days || {})
    .filter(d => d && d.date)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(d => {
      const out = { date: d.date };
      if (["green", "amber", "red"].includes(d.light)) out.readiness = d.light;
      const walk = num(d.walkMin);
      if (walk) out.activities = [{ exercise: "walk", minutes: walk }];
      const routine = (d.routine || []).filter(Boolean).length;
      if (routine) out.notes = `Daily routine: ${routine} of ${(d.routine || []).length} done`;
      return out;
    })
    .filter(d => d.readiness || d.activities || d.notes);

  const bodyweight = Object.values(backup.weights || {})
    .filter(w => w && w.date && num(w.kg) !== undefined)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(w => ({ date: w.date, kg: num(w.kg), fasted: w.fasted !== false }));

  return {
    log: { format: "jfdi-log", formatVersion: 1, profile: profileId, description: `Imported from a Rebuild Log backup exported ${backup.exportedAt || "on an unknown date"}`, sessions, days, bodyweight },
    problems
  };
}
