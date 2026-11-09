import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { today as planToday, type LoggedSession, type Readiness, type Today as TodayPlan } from "../engine/prescription.ts";
import type { Next } from "../engine/progression.ts";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { asProgramme, type Item, type Programme } from "../formats/programme.ts";
import { daysUntil, formatKg, formatLongDate, plural } from "../shared/format.ts";
import { go, href } from "../shared/route.ts";
import { Check48h } from "./Check48h.tsx";
import { setDayReadiness } from "../store/progress.ts";
import { Walks } from "./Walks.tsx";
import { setDaysOn } from "../engine/schedule.ts";
import { Screen } from "../shared/Screen.tsx";
import { db, type DayRecord, type SessionRecord } from "../store/db.ts";
import { localDate } from "../store/programmes.ts";
import { placesOf } from "../build/model.ts";
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
  ...(s.deload ? { deload: true } : {}),
  exercises: s.exercises,
});

export function Today({ profile, now = new Date() }: { profile: JFDIProfile; now?: Date }) {
  const active = profile.programmes.active;
  const data = useLiveQuery(async () => ({
    programme: active ? await db.programmes.get(active.programme) : undefined,
    sessions: await db.sessions.where("profile").equals(profile.id).toArray(),
    inProgress: await activeSession(db, profile.id),
    skip: await getSkip(db, profile.id),
    day: await db.days.get([profile.id, localDate(now)]),
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
        <>
          <Check48h p={asProgramme(data.programme)} sessions={data.sessions} now={now} />
          <Plan profile={profile} p={asProgramme(data.programme)} sessions={data.sessions} skipped={data.skip} now={now} checkedIn={data.day?.readiness ?? null} />
        </>
      )}
      {data && !data.inProgress && <TodayWalks profile={profile} p={data.programme ? asProgramme(data.programme) : null} day={data.day} now={now} />}
    </Screen>
  );
}

/** Walks for today: in view straight away on a planned walk day, a quiet button on any other. */
function TodayWalks({ profile, p, day, now }: { profile: JFDIProfile; p: Programme | null; day: DayRecord | undefined; now: Date }) {
  const date = localDate(now);
  const start = profile.programmes.active?.startDate;
  const on = p && start && p.plan.mode === "setDays" ? setDaysOn(p.plan, start, date) : null;
  const planned = on?.type === "conditioning";
  return (
    <section className="card" aria-labelledby="walks-heading">
      <h2 id="walks-heading">{planned ? "Log your walk" : "Walks"}</h2>
      <Walks profile={profile.id} date={date} day={day} planned={planned} minutes={planned ? on.minutes?.min : undefined} />
    </section>
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

function Plan({ profile, p, sessions, skipped, now, checkedIn }: {
  profile: JFDIProfile; p: Programme; sessions: SessionRecord[]; skipped: Awaited<ReturnType<typeof getSkip>>; now: Date;
  /** Today's check-in, if already picked */
  checkedIn: Readiness | null;
}) {
  const check = p.readiness.preset !== "off" && !!p.readiness.levels;
  const [readiness, setReadinessState] = useState<Readiness | null>(checkedIn);
  // Saved straight away, so it's on the calendar (Red too) and still there after leaving Today
  const setReadiness = (l: Readiness) => {
    setReadinessState(l);
    void setDayReadiness(db, profile.id, localDate(now), l);
  };
  const [anyway, setAnyway] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const date = localDate(now);
  const logged = sessions.map(toLogged);
  const lastDone = sessions.filter((s) => s.status === "done" && s.programme?.id === p.id).map((s) => s.date).sort().at(-1) ?? null;
  const assignment = profile.programmes.active!;
  const t = planToday({
    programme: p, assignment, sessions: logged, date, readiness: check ? readiness ?? "green" : null,
    skippedTo: skipInForce(skipped, p.id, lastDone), ignoreRest: anyway, chosen,
  });
  // Set days: any workout in the programme can be done on any day
  const other = p.plan.mode === "setDays" ? <OtherWorkout p={p} chosen={chosen} choose={setChosen} /> : null;

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
        {other}
      </section>
    );
  }
  if (t.kind === "done") {
    const w = p.workouts.find((x) => x.id === t.workout);
    return (
      <section className="card">
        {heading}
        <h2>{w?.name ?? "Today's workout"} is done</h2>
        <p className="hint">{t.date === date ? "Done today." : `Done early, on ${formatLongDate(t.date)}.`}</p>
        <div className="actions actions-start">
          <button type="button" className="btn btn-quiet" onClick={() => setChosen(t.workout)}>Do it again</button>
        </div>
        {other}
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
      {other}
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

/** Set days: run another day's workout today, such as Tuesday's on Monday. */
function OtherWorkout({ p, chosen, choose }: { p: Programme; chosen: string | null; choose: (id: string | null) => void }) {
  return (
    <label className="field other-workout">
      <span>Do a different workout today</span>
      <select value={chosen ?? ""} onChange={(e) => choose(e.target.value || null)}>
        <option value="">{chosen ? "Back to today's plan" : "Choose a workout"}</option>
        {p.workouts.map((w) => {
          const places = placesOf(p, w.id);
          return <option key={w.id} value={w.id}>{w.name}{places.length && places.join(", ") !== w.name ? ` (${places.join(", ")})` : ""}</option>;
        })}
      </select>
    </label>
  );
}
