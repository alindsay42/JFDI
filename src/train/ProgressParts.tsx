import { useMemo, useState, type FormEvent } from "react";
import { addDays, bodyweightView, calendarWeeks, liftSeries, liftsLogged, weeklyChange, type Pace, type PaceStatus } from "../engine/progress.ts";
import { setDaysOn } from "../engine/schedule.ts";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import type { Programme } from "../formats/programme.ts";
import { Confirm } from "../shared/Confirm.tsx";
import { formatKg, formatLongDate, formatShortDate, plural } from "../shared/format.ts";
import { LineChart } from "../shared/LineChart.tsx";
import type { DayRecord, SessionRecord, WeighInRecord } from "../store/db.ts";
import { db } from "../store/db.ts";
import { localDate } from "../store/programmes.ts";
import { CHECK_ANSWERS } from "./Check48h.tsx";
import { Walks } from "./Walks.tsx";
import { type CheckAnswer, addBodyweightGoal, clearGoal, deleteSession, deleteWeighIn, putWeighIn, removeBodyweightGoal, saveSession, setGoal } from "../store/progress.ts";
import { fieldOf, insteadOf, swappedOut, type LoggedSet, type SetField } from "../store/session.ts";

export interface ProgressData {
  sessions: SessionRecord[];
  days: DayRecord[];
  weighIns: WeighInRecord[];
  programme: Programme | null;
}

const monthDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const READINESS: Record<string, string> = { green: "Green", amber: "Amber", red: "Red" };
const UNITS: Record<SetField, string> = { reps: "reps", seconds: "sec", metres: "m", calories: "cal" };
const fmt = (d: string) => monthDay.format(new Date(`${d}T12:00:00`));

// ----- Calendar -----

export function Calendar({ profile, data, selected, choose }: {
  profile: JFDIProfile; data: ProgressData; selected: string | null; choose: (date: string) => void;
}) {
  const today = localDate(new Date());
  const [anchor, setAnchor] = useState(today);
  const weeks = calendarWeeks(anchor);
  const first = weeks[0]![0]!;
  const last = weeks[3]![6]!;
  const byDate = useMemo(() => {
    const m = new Map<string, SessionRecord[]>();
    for (const s of data.sessions) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  }, [data.sessions]);
  const days = new Map(data.days.map((d) => [d.date, d]));
  const active = profile.programmes.active;
  const p = data.programme;
  const planned = (date: string) => {
    if (!p || !active || p.plan.mode !== "setDays" || date <= today) return null;
    const on = setDaysOn(p.plan, active.startDate, date);
    return on?.type === "workout" ? p.workouts.find((w) => w.id === on.workout)?.name ?? null : null;
  };

  return (
    <section className="card" aria-labelledby="cal-heading">
      <div className="week-head">
        <div>
          <span className="muted cal-range">{fmt(first)} to {fmt(last)}</span>
          <h2 id="cal-heading">Calendar</h2>
        </div>
        <span className="cal-nav">
          <button type="button" className="btn btn-quiet btn-small" aria-label="4 weeks earlier" onClick={() => setAnchor(addDays(anchor, -28))}>‹</button>
          {anchor !== today && <button type="button" className="btn btn-quiet btn-small" onClick={() => setAnchor(today)}>This week</button>}
          <button type="button" className="btn btn-quiet btn-small" aria-label="4 weeks later" onClick={() => setAnchor(addDays(anchor, 28))}>›</button>
        </span>
      </div>
      <div className="cal" role="grid" aria-label="Calendar">
        <div className="cal-row cal-dow" role="row">{DOW.map((d) => <span key={d} role="columnheader">{d}</span>)}</div>
        {weeks.map((w) => (
          <div key={w[0]} className="cal-row" role="row">
            {w.map((date) => {
              const sessions = (byDate.get(date) ?? []).filter((s) => s.status === "done");
              const day = days.get(date);
              const plan = planned(date);
              const walk = day?.activities?.length;
              const label = [
                formatLongDate(date),
                sessions.length ? plural(sessions.length, "workout") : "",
                day?.readiness ? `${READINESS[day.readiness]} day` : "",
                walk ? "walk" : "",
                plan ? `planned: ${plan}` : "",
              ].filter(Boolean).join(", ");
              return (
                <button
                  key={date} type="button" role="gridcell" aria-label={label} aria-selected={selected === date}
                  className={`cal-day${date === today ? " is-today" : ""}${date > today ? " is-future" : ""}`}
                  onClick={() => choose(date)}
                >
                  <span className="cal-num">{Number(date.slice(8))}</span>
                  <span className="cal-marks">
                    {sessions.map((s) => <span key={s.id} className={`cal-dot${s.readiness ? ` dot-${s.readiness}` : ""}`} aria-hidden="true" />)}
                    {!sessions.length && day?.readiness && <span className={`cal-ring dot-${day.readiness}`} aria-hidden="true" />}
                    {walk ? <span className="cal-walk" aria-hidden="true">walk</span> : null}
                  </span>
                  {plan && <span className="cal-plan">{plan}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="hint cal-key"><span className="cal-dot" /> workout <span className="cal-walk">walk</span> · tap a day for its log</p>
    </section>
  );
}

// ----- A day's log, with editing -----

export function DayLog({ profile, date, data, close }: { profile: JFDIProfile; date: string; data: ProgressData; close: () => void }) {
  const sessions = data.sessions.filter((s) => s.date === date && s.status === "done");
  const day = data.days.find((d) => d.date === date);
  const weigh = data.weighIns.find((w) => w.date === date);
  return (
    <section className="card day-log" id="day-log" aria-labelledby="day-heading">
      <div className="week-head">
        <h2 id="day-heading">{formatLongDate(date)}</h2>
        <button type="button" className="btn btn-quiet btn-small" onClick={close}>Close</button>
      </div>
      {!sessions.length && !day && !weigh && <p className="hint">Nothing logged on this day.</p>}
      {sessions.map((s) => <SessionLog key={s.id} s={s} p={data.programme} />)}
      {day && (day.readiness || day.notes) && (
        <div className="day-extra">
          {day.readiness && <p><span className={`dot dot-${day.readiness}`} /> {READINESS[day.readiness]} day</p>}
          {day.notes && <p className="hint">{day.notes}</p>}
        </div>
      )}
      {date <= localDate(new Date()) && <Walks profile={profile.id} date={date} day={day} />}
      {weigh && <p>Weighed {formatKg(weigh.kg)}{weigh.fasted ? ", fasted" : ""}.</p>}
    </section>
  );
}

function SessionLog({ s, p }: { s: SessionRecord; p: Programme | null }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <article className="session-log" aria-label={s.session.name}>
      <div className="week-head">
        <h3>
          {s.session.name}
          {s.importedFrom === "rebuild-log" && <span className="tag">Rebuild Log</span>}
          {s.endedEarly && <span className="tag">Ended early: {s.endedEarly}</span>}
        </h3>
        {!editing && (
          <span className="cal-nav">
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="btn btn-danger-quiet btn-small" onClick={() => setDeleting(true)}>Delete</button>
          </span>
        )}
      </div>
      {editing ? <SessionEditor s={s} p={p} done={() => setEditing(false)} /> : <SessionSummary s={s} p={p} />}
      <Confirm open={deleting} title={`Delete ${s.session.name}?`} confirmLabel="Delete" danger onCancel={() => setDeleting(false)}
        onConfirm={() => { setDeleting(false); void deleteSession(db, s.profile, s.id); }}>
        <p>This workout and its sets are removed from {formatShortDate(s.date)}. Next time's weights are worked out without it.</p>
      </Confirm>
    </article>
  );
}

function setText(set: LoggedSet, field: SetField, each: boolean) {
  const kg = set.kg !== undefined ? `${formatKg(set.kg)}${each ? " each" : ""} × ` : "";
  const amount = set[field] !== undefined ? `${set[field]}${field === "reps" ? "" : ` ${UNITS[field]}`}` : "?";
  return `${kg}${amount}${set.rpe ? ` @${set.rpe}` : ""}`;
}

function SessionSummary({ s, p }: { s: SessionRecord; p: Programme | null }) {
  return (
    <>
      <ul className="log-lines">
        {s.exercises.map((e, k) => {
          if (swappedOut(s.exercises, k)) return null;
          const field = fieldOf(p, e.exercise);
          const done = e.sets.filter((x) => x.done);
          const instead = insteadOf(s.exercises, k);
          return (
            <li key={k} className={e.removed ? "is-removed" : undefined}>
              <span className="log-name">{e.name}{instead && <span className="muted"> (instead of {instead})</span>}</span>
              <span className="log-sets">
                {done.length ? done.map((x) => setText(x, field, e.loadPer === "each")).join(", ") : "No sets done"}
                {e.removed && ` · removed${e.removed.reason ? `: ${e.removed.reason}` : ""}`}
              </span>
            </li>
          );
        })}
      </ul>
      {s.check48h && <p className="hint">48-hour check: {CHECK_ANSWERS.find(([k]) => k === s.check48h!.status)?.[1]}</p>}
      {s.notes && <p className="hint">{s.notes}</p>}
    </>
  );
}

/** Amending a finished workout. Save changes is only offered once something has changed. */
function SessionEditor({ s, p, done }: { s: SessionRecord; p: Programme | null; done: () => void }) {
  const [draft, setDraft] = useState<SessionRecord>(() => structuredClone(s));
  const [error, setError] = useState("");
  const changed = JSON.stringify(draft) !== JSON.stringify(s);
  const edit = (fn: (x: SessionRecord) => void) => setDraft((d) => { const n = structuredClone(d); fn(n); return n; });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await saveSession(db, draft);
      done();
    } catch (err) {
      setError(String((err as Error).message ?? err));
    }
  };

  return (
    <form onSubmit={(e) => void save(e)} className="session-editor">
      {(s.check48h || p?.readiness.check48h) && (
        <label className="field field-inline">
          <span>48-hour check</span>
          <select value={draft.check48h?.status ?? ""} onChange={(ev) => edit((x) => {
            const v = ev.target.value as CheckAnswer | "";
            const at = x.finishedAt && x.finishedAt > new Date().toISOString() ? x.finishedAt : new Date().toISOString();
            x.check48h = v ? { status: v, at: s.check48h?.status === v ? s.check48h.at : at } : null;
          })}>
            <option value="">Not answered</option>
            {CHECK_ANSWERS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
      )}
      {draft.exercises.map((e, k) => {
        if (swappedOut(draft.exercises, k)) return null;
        const field = fieldOf(p, e.exercise);
        const instead = insteadOf(draft.exercises, k);
        return (
          <fieldset key={k} className="edit-ex">
            <legend>{e.name}{instead && <span className="muted"> (instead of {instead})</span>}{e.removed && <span className="tag">Removed</span>}</legend>
            {e.sets.map((set, j) => (
              <div key={j} className="set-row edit-set" role="group" aria-label={`${e.name} set ${j + 1}`}>
                <span className="set-label">Set {j + 1}</span>
                <EditNum label={`${e.name} set ${j + 1} weight`} value={set.kg} decimals suffix="kg" onChange={(v) => edit((x) => { setOrDelete(x.exercises[k]!.sets[j]!, "kg", v); })} />
                <EditNum label={`${e.name} set ${j + 1} ${UNITS[field]}`} value={set[field]} decimals={field === "metres"} suffix={UNITS[field]}
                  onChange={(v) => edit((x) => { setOrDelete(x.exercises[k]!.sets[j]!, field, v); })} />
                <label className="check edit-done">
                  <input type="checkbox" checked={set.done} onChange={(ev) => edit((x) => { x.exercises[k]!.sets[j]!.done = ev.target.checked; })} />
                  <span>Done</span>
                </label>
                <button type="button" className="icon-btn set-remove" aria-label={`Remove ${e.name} set ${j + 1}`}
                  onClick={() => edit((x) => { x.exercises[k]!.sets.splice(j, 1); })}>×</button>
              </div>
            ))}
            <button type="button" className="btn btn-quiet btn-small" onClick={() => edit((x) => {
              const sets = x.exercises[k]!.sets;
              const { rpe: _r, ...last } = sets.at(-1) ?? { done: true };
              sets.push({ ...last, done: true });
            })}>+ Set</button>
          </fieldset>
        );
      })}
      <label className="field notes-field">
        <span>Notes</span>
        <textarea rows={2} value={draft.notes ?? ""} onChange={(ev) => edit((x) => { if (ev.target.value) x.notes = ev.target.value; else delete x.notes; })} />
      </label>
      {error && <p className="problems" role="alert">{error}</p>}
      <div className="actions">
        <button type="button" className="btn btn-quiet" onClick={done}>Cancel</button>
        <button type="submit" className="btn btn-you" disabled={!changed}>Save changes</button>
      </div>
    </form>
  );
}

function setOrDelete(set: LoggedSet, field: keyof LoggedSet, v: number | undefined) {
  if (v === undefined) delete set[field];
  else (set as unknown as Record<string, unknown>)[field] = v;
}

function EditNum({ label, value, onChange, decimals, suffix }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; decimals?: boolean; suffix: string;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  return (
    <span className="num-field">
      <input aria-label={label} inputMode={decimals ? "decimal" : "numeric"} value={text} className={decimals ? undefined : "small"}
        onChange={(e) => {
          const t = e.target.value.replace(",", ".");
          setText(t);
          if (t.trim() === "") return onChange(undefined);
          const v = Number(t);
          if (Number.isFinite(v) && v >= 0 && (decimals || Number.isInteger(v))) onChange(v);
        }} />
      <span aria-hidden="true">{suffix}</span>
    </span>
  );
}

// ----- Lift progress -----

export function LiftProgress({ profile, sessions }: { profile: JFDIProfile; sessions: SessionRecord[] }) {
  const lifts = useMemo(() => liftsLogged(sessions), [sessions]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [metric, setMetric] = useState<"e1rm" | "heaviest">("e1rm");
  const exercise = chosen && lifts.some((l) => l.exercise === chosen) ? chosen : lifts[0]?.exercise;
  const series = useMemo(() => (exercise ? liftSeries(sessions, exercise) : []), [sessions, exercise]);
  const goal = profile.targets?.find((t) => t.exercise === exercise);

  if (!lifts.length) {
    return (
      <section className="card" aria-labelledby="lift-heading">
        <h2 id="lift-heading">Lift progress</h2>
        <p className="hint">Finish a workout with weighted sets and each lift's progress shows here.</p>
      </section>
    );
  }
  const points = series
    .map((pt) => ({ date: pt.date, value: metric === "e1rm" ? pt.e1rm : pt.heaviest, detail: `Best set ${formatKg(pt.best.kg)} × ${pt.best.reps}` }))
    .filter((pt): pt is { date: string; value: number; detail: string } => pt.value !== null);
  const change = weeklyChange(points);
  const best = points.length ? Math.max(...points.map((pt) => pt.value)) : null;
  const name = lifts.find((l) => l.exercise === exercise)?.name ?? "";

  return (
    <section className="card" aria-labelledby="lift-heading">
      <h2 id="lift-heading">Lift progress</h2>
      <div className="plan-controls">
        <label className="field field-inline">
          <span>Lift</span>
          <select value={exercise} onChange={(e) => setChosen(e.target.value)}>
            {lifts.map((l) => <option key={l.exercise} value={l.exercise}>{l.name} ({plural(l.sessions, "session")})</option>)}
          </select>
        </label>
        <fieldset className="segmented" aria-label="Show">
          <legend>Show</legend>
          <label><input type="radio" name="metric" checked={metric === "e1rm"} onChange={() => setMetric("e1rm")} /><span>Estimated max</span></label>
          <label><input type="radio" name="metric" checked={metric === "heaviest"} onChange={() => setMetric("heaviest")} /><span>Heaviest weight</span></label>
        </fieldset>
      </div>
      {points.length ? (
        <>
          <p className="lift-summary">
            <span><strong>{formatKg(points.at(-1)!.value)}</strong> latest</span>
            <span><strong>{formatKg(best!)}</strong> best</span>
            {change !== null && <span><strong>{change > 0 ? "+" : ""}{change}kg</strong> a week</span>}
          </p>
          <LineChart
            points={points} unit="kg"
            label={`${name}, ${metric === "e1rm" ? "estimated one-rep max" : "heaviest weight"} by session`}
            goal={goal?.kg ? { value: goal.kg, ...(goal.by ? { date: goal.by } : {}), label: `Goal ${formatKg(goal.kg)}${goal.by ? ` by ${fmt(goal.by)}` : ""}` } : undefined}
          />
          <p className="hint">
            {metric === "e1rm"
              ? "Estimated one-rep max: each session's best set turned into the most it suggests for 1 rep (sets over 15 reps aren't counted)."
              : "The heaviest weight lifted for at least 1 rep in each session."}
          </p>
        </>
      ) : (
        <p className="hint">No sets of 15 reps or fewer to estimate from yet. Try Heaviest weight.</p>
      )}
      <Goal profile={profile} exercise={exercise!} current={goal} />
      <details className="lift-table">
        <summary>Every session ({series.length})</summary>
        <table className="loads">
          <thead><tr><th>Date</th><th>Best set</th><th>Est. max</th><th>Heaviest</th></tr></thead>
          <tbody>
            {[...series].reverse().map((pt) => (
              <tr key={pt.session}>
                <td>{formatShortDate(pt.date)}</td>
                <td>{formatKg(pt.best.kg)} × {pt.best.reps}</td>
                <td>{pt.e1rm !== null ? formatKg(pt.e1rm) : "–"}</td>
                <td>{formatKg(pt.heaviest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function Goal({ profile, exercise, current }: { profile: JFDIProfile; exercise: string; current: { kg?: number; by?: string } | undefined }) {
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState(current?.kg ? String(current.kg) : "");
  const [by, setBy] = useState(current?.by ?? "");
  const valid = Number(kg.replace(",", ".")) > 0;
  if (!open) {
    return (
      <div className="actions actions-start">
        <button type="button" className="btn btn-quiet btn-small" onClick={() => { setKg(current?.kg ? String(current.kg) : ""); setBy(current?.by ?? ""); setOpen(true); }}>
          {current ? "Change goal" : "Set a goal"}
        </button>
        {current && <button type="button" className="btn btn-quiet btn-small" onClick={() => void clearGoal(db, profile.id, exercise)}>Clear goal</button>}
      </div>
    );
  }
  return (
    <form className="goal-form" onSubmit={(e) => {
      e.preventDefault();
      if (!valid) return;
      void setGoal(db, profile.id, { exercise, kg: Number(kg.replace(",", ".")), ...(by ? { by } : {}) }).then(() => setOpen(false));
    }}>
      <label className="field field-inline"><span>Goal</span>
        <span className="num-field"><input aria-label="Goal weight" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} /><span aria-hidden="true">kg</span></span>
      </label>
      <label className="field field-inline"><span>By (optional)</span><input type="date" value={by} onChange={(e) => setBy(e.target.value)} /></label>
      <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>Cancel</button>
      <button type="submit" className="btn btn-you" disabled={!valid}>Save goal</button>
    </form>
  );
}

// ----- Bodyweight -----

const STATUS: Record<PaceStatus, string> = { within: "On the target pace", above: "Above the target pace", below: "Below the target pace" };

function paceText(p: Pace): string {
  if (p.aim === "gain") return `+${p.low} to +${p.high}kg a month`;
  if (p.aim === "lose") return `${-p.high} to ${-p.low}kg down a month (0.5 to 1% a week)`;
  return "within 1kg of the start";
}

export function Bodyweight({ profile, weighIns }: { profile: JFDIProfile; weighIns: WeighInRecord[] }) {
  const today = localDate(new Date());
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState("");
  const [fasted, setFasted] = useState(true);
  const [error, setError] = useState("");
  const [all, setAll] = useState(false);
  const value = Number(kg.replace(",", "."));
  const points = weighIns.map((w) => ({ date: w.date, value: w.kg, ...(w.fasted ? { detail: "Fasted" } : {}) }));
  const change = weeklyChange(points);
  const shown = all ? [...weighIns].reverse() : [...weighIns].reverse().slice(0, 5);
  const plan = profile.bodyweight;
  const view = bodyweightView(weighIns, plan, today);

  const save = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    putWeighIn(db, profile.id, { date, kg: value, fasted }).then(() => setKg("")).catch((err: Error) => setError(err.message));
  };

  return (
    <section className="card" aria-labelledby="bw-heading">
      <h2 id="bw-heading">Bodyweight</h2>
      <form className="goal-form" onSubmit={save}>
        <label className="field field-inline"><span>Date</span><input type="date" value={date} max={today} required onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field field-inline"><span>Weight</span>
          <span className="num-field"><input aria-label="Bodyweight" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} /><span aria-hidden="true">kg</span></span>
        </label>
        <label className="check"><input type="checkbox" checked={fasted} onChange={(e) => setFasted(e.target.checked)} /><span>Fasted</span></label>
        <button type="submit" className="btn btn-you" disabled={!(value > 0)}>Save weigh-in</button>
      </form>
      {error && <p className="problems" role="alert">{error}</p>}
      {points.length > 0 && (points.length > 1 || view.band.length > 0) && (
        <>
          <p className="lift-summary">
            <span><strong>{formatKg(points.at(-1)!.value)}</strong> latest</span>
            {change !== null && <span><strong>{change > 0 ? "+" : ""}{change}kg</strong> a week</span>}
            {view.status && <span className="pace-status">{STATUS[view.status]}</span>}
          </p>
          <LineChart
            points={points} unit="kg" label="Bodyweight by date, with the target pace and goals" labelLast
            band={view.band} until={view.until}
            markers={view.shown.map((g) => ({ date: g.by, value: g.kg, label: `${g.label ? `${g.label} · ` : ""}${formatKg(g.kg)}` }))}
          />
          {view.pace && (
            <p className="chart-legend">
              <span><span className="chart-key-line" aria-hidden="true" /> Your weight</span>
              <span><span className="chart-key-band" aria-hidden="true" /> Target pace, {paceText(view.pace)}</span>
              {view.shown.length > 0 && <span>◇ Goal</span>}
            </p>
          )}
        </>
      )}
      <BodyweightGoals profileId={profile.id} goals={plan?.goals ?? []} next={view.next} today={today} />
      {weighIns.length > 0 && (
        <>
          <h3>Weigh-ins</h3>
          <ul className="history">
            {shown.map((w) => (
              <li key={w.date} className="weigh-row">
                <span className="history-date">{formatShortDate(w.date)}</span>
                <span className="history-name">{formatKg(w.kg)}{w.fasted && <span className="muted"> · fasted</span>}</span>
                <span className="history-meta">
                  <button type="button" className="icon-btn set-remove" aria-label={`Delete weigh-in on ${formatShortDate(w.date)}`} onClick={() => void deleteWeighIn(db, profile.id, w.date)}>×</button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {weighIns.length > shown.length && <button type="button" className="btn btn-quiet btn-small" onClick={() => setAll(true)}>Show all {weighIns.length}</button>}
    </section>
  );
}

function BodyweightGoals({ profileId, goals, next, today }: {
  profileId: string;
  goals: Array<{ kg: number; by: string; label?: string }>;
  next: ReturnType<typeof bodyweightView>["next"];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState("");
  const [by, setBy] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const value = Number(kg.replace(",", "."));
  const name = (g: { kg: number; by: string; label?: string }) => `${g.label ? `${g.label}: ` : ""}${formatKg(g.kg)} by ${formatShortDate(g.by)}`;

  const save = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    addBodyweightGoal(db, profileId, { kg: value, by, label }, today)
      .then(() => { setOpen(false); setKg(""); setBy(""); setLabel(""); })
      .catch((err: Error) => setError(err.message));
  };

  return (
    <div className="bw-goal-section">
      <h3>Goals</h3>
      {goals.length === 0 && !open && <p className="muted">Set a goal weight and a date, and the chart shows a reasonable pace to get there.</p>}
      {next && (
        <p className="pace-note">
          Next: {name(next.goal)}.{" "}
          {next.reached
            ? <strong>Reached.</strong>
            : <><strong>{Math.abs(next.toGo)}kg to {next.toGo > 0 ? "gain" : "lose"}</strong>
              {next.perWeek !== null && <> in {plural(next.weeks, "week")}, about {Math.abs(next.perWeek)}kg a week</>}.</>}
        </p>
      )}
      {goals.length > 0 && (
        <ul className="bw-goals">
          {goals.map((g) => (
            <li key={g.by}>
              <span>{name(g)}</span>
              <button type="button" className="icon-btn set-remove" aria-label={`Remove goal for ${formatShortDate(g.by)}`} onClick={() => void removeBodyweightGoal(db, profileId, g.by)}>×</button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form className="goal-form" onSubmit={save}>
          <label className="field field-inline"><span>Goal</span>
            <span className="num-field"><input aria-label="Goal bodyweight" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} /><span aria-hidden="true">kg</span></span>
          </label>
          <label className="field field-inline"><span>By</span><input aria-label="Reach it by" type="date" value={by} min={today} required onChange={(e) => setBy(e.target.value)} /></label>
          <label className="field field-inline"><span>Name (optional)</span><input aria-label="Goal name" value={label} maxLength={30} placeholder="End Phase 1" onChange={(e) => setLabel(e.target.value)} /></label>
          <button type="button" className="btn btn-quiet" onClick={() => { setOpen(false); setError(""); }}>Cancel</button>
          <button type="submit" className="btn btn-you" disabled={!(value > 0) || !by}>Save goal</button>
        </form>
      ) : (
        goals.length < 6 && (
          <div className="actions actions-start">
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setOpen(true)}>{goals.length ? "Add another goal" : "Set a goal weight"}</button>
          </div>
        )
      )}
      {error && <p className="problems" role="alert">{error}</p>}
    </div>
  );
}
