import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { today as planToday, type LoggedSession, type Readiness, type Today as TodayPlan } from "../engine/prescription.ts";
import type { Next } from "../engine/progression.ts";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { asProgramme, type Item, type Programme } from "../formats/programme.ts";
import { daysUntil, formatKg, formatLongDate, plural } from "../shared/format.ts";
import { go, href } from "../shared/route.ts";
import { Screen } from "../shared/Screen.tsx";
import { db, type SessionRecord } from "../store/db.ts";
import { localDate } from "../store/programmes.ts";
import { activeSession, fieldOf, getSkip, skipInForce, skipWorkout, startSession } from "../store/session.ts";

const todayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const LEVELS: Readiness[] = ["green", "amber", "red"];

export const toLogged = (s: SessionRecord): LoggedSession => ({
  date: s.date,
  status: s.status,
  readiness: s.readiness,
  programme: s.programme ? { id: s.programme.id, week: s.programme.week ?? 1 } : null,
  workout: s.session.id,
  exercises: s.exercises,
});

export function Today({ profile, now = new Date() }: { profile: JFDIProfile; now?: Date }) {
  const active = profile.programmes.active;
  const data = useLiveQuery(async () => ({
    programme: active ? await db.programmes.get(active.programme) : undefined,
    sessions: await db.sessions.where("profile").equals(profile.id).toArray(),
    inProgress: await activeSession(db, profile.id),
    skip: await getSkip(db, profile.id),
  }), [profile.id, active?.programme]);

  return (
    <Screen profile={profile} route="today">
      <h1 className="page-title">{todayFormat.format(now)}</h1>
      {data === undefined ? null : data.inProgress ? (
        <InProgress s={data.inProgress} />
      ) : !active || !data.programme ? (
        <section className="card empty">
          <h2>No programme yet</h2>
          <p>Build one, or choose one, on the Programme tab.</p>
          <div className="actions actions-start">
            <a className="btn btn-you" href="#/programme">Go to programmes</a>
          </div>
        </section>
      ) : (
        <Plan profile={profile} p={asProgramme(data.programme)} sessions={data.sessions} skipped={data.skip} now={now} />
      )}
    </Screen>
  );
}

function InProgress({ s }: { s: SessionRecord }) {
  const done = s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
  return (
    <section className="card in-progress">
      <h2>{s.session.name} is under way</h2>
      <p>Started at {timeFormat.format(new Date(s.startedAt))}. {plural(done, "set")} done so far.</p>
      <div className="actions actions-start">
        <a className="btn btn-you btn-big" href={href("session")}>Carry on</a>
      </div>
    </section>
  );
}

function Plan({ profile, p, sessions, skipped, now }: {
  profile: JFDIProfile; p: Programme; sessions: SessionRecord[]; skipped: Awaited<ReturnType<typeof getSkip>>; now: Date;
}) {
  const check = p.readiness.preset !== "off" && !!p.readiness.levels;
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [anyway, setAnyway] = useState(false);
  const [busy, setBusy] = useState(false);
  const date = localDate(now);
  const logged = sessions.map(toLogged);
  const lastDone = sessions.filter((s) => s.status === "done" && s.programme?.id === p.id).map((s) => s.date).sort().at(-1) ?? null;
  const assignment = profile.programmes.active!;
  const t = planToday({
    programme: p, assignment, sessions: logged, date, readiness: check ? readiness ?? "green" : null,
    skippedTo: skipInForce(skipped, p.id, lastDone), ignoreRest: anyway,
  });

  const start = async () => {
    if (t.kind !== "workout" || busy) return;
    setBusy(true);
    try {
      await startSession(db, profile, p, t, check ? readiness : null, now);
      go("session");
    } finally {
      setBusy(false);
    }
  };

  const heading = <p className="programme-line"><a href={href("programme", p.id)}>{p.name}</a></p>;

  if (t.kind === "notStarted") {
    const days = daysUntil(t.startDate, date);
    return (
      <section className="card">
        {heading}
        <h2>Starts {formatLongDate(t.startDate)}</h2>
        <p className="hint">In {plural(days, "day")}.</p>
      </section>
    );
  }
  if (t.kind === "day") {
    const what = t.day.type === "conditioning" ? t.day.activity : t.day.type === "rest" ? "Rest day" : "Nothing planned today";
    return (
      <section className="card">
        {heading}
        <h2>{what}</h2>
        {t.day.type === "conditioning" && t.day.minutes && <p>{t.day.minutes.min === t.day.minutes.max ? t.day.minutes.min : `${t.day.minutes.min} to ${t.day.minutes.max}`} minutes.</p>}
        {t.day.notes && <p className="hint">{t.day.notes}</p>}
      </section>
    );
  }
  if (t.kind === "resting") {
    const next = p.workouts.find((w) => w.id === t.next.workout);
    return (
      <section className="card">
        {heading}
        <h2>Rest day</h2>
        <p>{plural(t.daysLeft, "more rest day")} before {next?.name ?? "the next workout"}.</p>
        <div className="actions actions-start">
          <button type="button" className="btn btn-quiet" onClick={() => setAnyway(true)}>Train today anyway</button>
        </div>
      </section>
    );
  }

  return (
    <section className="card today-workout">
      {heading}
      {check && (
        <fieldset className="readiness">
          <legend>How are you today?</legend>
          <div className="readiness-options">
            {LEVELS.map((l) => {
              const level = p.readiness.levels![l];
              return (
                <label key={l} className={`readiness-option readiness-${l}`}>
                  <input type="radio" name="readiness" checked={readiness === l} onChange={() => setReadiness(l)} />
                  <span className="readiness-label">{level.label}</span>
                  <span className="readiness-desc">{level.description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      {t.kind === "noLifting" ? (
        <>
          <h2>No lifting today</h2>
          <p className="hint">The planned workout moves to next time.</p>
        </>
      ) : (
        <Preview p={p} t={t} />
      )}
      {t.kind === "workout" && (
        <div className="actions actions-start">
          <button type="button" className="btn btn-you btn-big" disabled={busy || (check && !readiness)} onClick={() => void start()}>
            Start workout
          </button>
          {p.plan.mode === "adhoc" && (
            <button type="button" className="btn btn-quiet" onClick={() => void skipWorkout(db, profile.id, p.id, t.position, now)}>
              Skip to next workout
            </button>
          )}
        </div>
      )}
      {check && !readiness && t.kind === "workout" && <p className="hint">Choose how you are today first.</p>}
    </section>
  );
}

const WHY: Partial<Record<Next["why"], string>> = {
  add: "up", "reduce: stalled": "down 10%", "hold: hard": "held: last time was hard", "hold: sets skipped": "held: sets skipped",
  "hold: readiness": "held", "build reps": "build reps",
};

function targetText(p: Programme, item: Item, j: number, next: Next | undefined): string {
  const slot = item.slots[j]!;
  const field = fieldOf(p, slot.exercise);
  const unit = { reps: "", seconds: "s", metres: "m", calories: " cal" }[field];
  const r = next?.reps ?? { min: 0, max: 0 };
  const reps = r.min === r.max ? `${r.max}${unit}` : `${r.min}-${r.max}${unit}`;
  const ex = p.exercises.find((e) => e.id === slot.exercise);
  const kg = next?.kg != null ? `${formatKg(next.kg)}${ex?.loadPer === "each" ? " each" : ""} · ` : "";
  return item.type === "single" ? `${kg}${slot.sets} × ${reps}` : `${kg}${reps}`;
}

function Preview({ p, t }: { p: Programme; t: Extract<TodayPlan, { kind: "workout" }> }) {
  const where = p.plan.mode === "adhoc"
    ? `${p.plan.weeks.length > 1 ? `Week ${t.position.week + 1}, ` : ""}Day ${t.position.day + 1}`
    : p.plan.weeks.length > 1 ? `Week ${t.position.week + 1}` : "";
  return (
    <>
      <h2>{t.workout.name}</h2>
      <p className="hint">
        {where}
        {t.deload && <span className="tag tag-warn">Deload week</span>}
        {t.addRir > 0 && ` Leave ${t.addRir} more reps in reserve today.`}
      </p>
      <ol className="preview">
        {t.workout.items.map((item, i) => (
          <li key={i} className={item.type === "single" ? "preview-single" : "preview-group"}>
            {item.type !== "single" && <span className="preview-group-name">{item.type === "superset" ? "Superset" : item.type === "giant" ? "Giant set" : "Finisher"} × {item.rounds}</span>}
            {item.slots.map((slot, j) => {
              const next = t.targets[`${i}.${j}`];
              const ex = p.exercises.find((e) => e.id === slot.exercise);
              return (
                <span key={j} className="preview-row">
                  <span className="preview-name">{ex?.name ?? slot.exercise}</span>
                  <span className="preview-target">{targetText(p, item, j, next)}</span>
                  {next && WHY[next.why] && <span className={`tag why-${next.why.split(":")[0]}`}>{WHY[next.why]}</span>}
                </span>
              );
            })}
          </li>
        ))}
      </ol>
    </>
  );
}
