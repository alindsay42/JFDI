import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { asProgramme, type Item, type Programme } from "../formats/programme.ts";
import { Confirm } from "../shared/Confirm.tsx";
import { plural } from "../shared/format.ts";
import { go } from "../shared/route.ts";
import { Screen } from "../shared/Screen.tsx";
import { db, type SessionRecord } from "../store/db.ts";
import { library } from "../store/household.ts";
import {
  activeSession, addExercise, addSet, discardSession, fieldOf, finishSession, removeExercise, removeSet, restAfter, restoreExercise,
  setNotes, updateSet, type LoggedSet, type SetField,
} from "../store/session.ts";

const UNITS: Record<SetField, string> = { reps: "reps", seconds: "sec", metres: "m", calories: "cal" };
const RPE = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const REMOVE_REASONS = ["Pain or discomfort", "Equipment busy", "Short on time", "Not feeling it"];
const END_REASONS = ["Out of time", "Feeling unwell", "Pain or discomfort", "Not feeling it"];

type Edit = (s: SessionRecord) => Promise<SessionRecord>;

/** The workout being done. Every change is saved straight away, one after another, so nothing is lost or overwritten. */
export function Session({ profile }: { profile: JFDIProfile }) {
  const loaded = useLiveQuery(async () => {
    const s = await activeSession(db, profile.id);
    const p = s?.programme ? await db.programmes.get(s.programme.id) : undefined;
    return { s: s ?? null, p: p ? asProgramme(p) : null };
  }, [profile.id]);
  const [s, setS] = useState<SessionRecord | null>(null);
  const latest = useRef<SessionRecord | null>(null);
  const queue = useRef(Promise.resolve());
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);

  useEffect(() => {
    if (loaded && !latest.current) { latest.current = loaded.s; setS(loaded.s); }
  }, [loaded]);

  const edit = (fn: Edit) => {
    queue.current = queue.current.then(async () => {
      if (!latest.current) return;
      const next = await fn(latest.current);
      latest.current = next;
      setS(next);
    });
    return queue.current;
  };

  if (loaded === undefined) return null;
  if (!s) {
    return (
      <Screen profile={profile} route="today">
        <section className="card">
          <h2>No workout under way</h2>
          <div className="actions actions-start"><a className="btn" href="#/today">Back to today</a></div>
        </section>
      </Screen>
    );
  }
  return (
    <Screen profile={profile} route="today">
      <Workout s={s} p={loaded.p} edit={edit} startRest={(sec) => setRest(sec > 0 ? { until: Date.now() + sec * 1000, total: sec } : null)} />
      {rest && <RestTimer rest={rest} change={(d) => setRest({ ...rest, until: rest.until + d * 1000 })} stop={() => setRest(null)} />}
    </Screen>
  );
}

/** Entries in workout order: each prescribed item with its exercises, then anything added. */
function layout(s: SessionRecord): Array<{ item: Item | null; entries: number[] }> {
  const items = ((s.prescribed as unknown as { items?: Item[] })?.items ?? []) as Item[];
  const out = items.map((item) => ({ item: item as Item | null, entries: [] as number[] }));
  const extra: number[] = [];
  s.exercises.forEach((e, k) => {
    const i = e.slot ? Number(e.slot.split(".")[0]) : -1;
    if (out[i]) out[i]!.entries.push(k);
    else extra.push(k);
  });
  return [...out.filter((g) => g.entries.length), ...extra.map((k) => ({ item: null, entries: [k] }))];
}

function Workout({ s, p, edit, startRest }: { s: SessionRecord; p: Programme | null; edit: (fn: Edit) => Promise<void>; startRest: (sec: number) => void }) {
  const groups = useMemo(() => layout(s), [s]);
  const [ending, setEnding] = useState<"finish" | "early" | "empty" | null>(null);
  const [adding, setAdding] = useState(false);
  const done = s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
  const planned = s.exercises.filter((e) => !e.removed).reduce((n, e) => n + e.sets.length, 0);

  const finish = (reason: string | null) => edit((x) => finishSession(db, x, reason)).then(() => go("today"));

  return (
    <>
      <div className="session-head">
        <h1 className="page-title">{s.session.name}</h1>
        <span className="muted">{done} of {plural(planned, "set")} done</span>
      </div>

      {groups.map((g, gi) => {
        const item = g.item;
        if (!item || item.type === "single") {
          return g.entries.map((k) => <ExerciseCard key={k} s={s} p={p} k={k} edit={edit} startRest={startRest} />);
        }
        return <GroupCard key={`g${gi}`} s={s} p={p} item={item} entries={g.entries} edit={edit} startRest={startRest} />;
      })}

      <section className="card">
        {adding ? (
          <AddExercise onPick={(id) => { setAdding(false); void edit((x) => addExercise(db, x, id)); }} onCancel={() => setAdding(false)} />
        ) : (
          <button type="button" className="btn btn-quiet" onClick={() => setAdding(true)}>+ Add an exercise</button>
        )}
        <label className="field notes-field">
          <span>Notes</span>
          <textarea defaultValue={s.notes ?? ""} rows={2} onBlur={(e) => void edit((x) => setNotes(db, x, e.target.value))} />
        </label>
      </section>

      <div className="finish-bar">
        <button type="button" className="btn btn-quiet" onClick={() => setEnding("early")}>End early</button>
        <button type="button" className="btn btn-you btn-big" onClick={() => setEnding(done ? "finish" : "empty")}>Finish workout</button>
      </div>

      <Confirm open={ending === "finish"} title="Finish this workout?" confirmLabel="Finish" onCancel={() => setEnding(null)}
        onConfirm={() => { setEnding(null); void finish(null); }}>
        <p>{done === planned ? "Every set is done." : `${done} of ${planned} sets are ticked. The rest are kept as planned but not done.`}</p>
      </Confirm>
      <Confirm open={ending === "empty"} title="Nothing is ticked" confirmLabel="Throw it away" danger onCancel={() => setEnding(null)}
        onConfirm={() => { setEnding(null); void edit(async (x) => { await discardSession(db, x); return x; }).then(() => go("today")); }}>
        <p>No sets are ticked, so there's nothing to save. Throw this workout away? It will still be next up.</p>
      </Confirm>
      <ReasonDialog open={ending === "early"} title="End early?" reasons={END_REASONS} confirmLabel="End workout"
        onCancel={() => setEnding(null)} onPick={(r) => { setEnding(null); void finish(r ?? "Ended early"); }} />
    </>
  );
}

function ExerciseHead({ s, k, edit, sub }: { s: SessionRecord; k: number; edit: (fn: Edit) => Promise<void>; sub?: string }) {
  const e = s.exercises[k]!;
  const [removing, setRemoving] = useState(false);
  return (
    <div className="ex-head">
      <span className="ex-title">{e.name}{e.added && <span className="tag">Added</span>}</span>
      {sub && <span className="muted">{sub}</span>}
      {e.removed ? (
        <button type="button" className="btn btn-quiet btn-small" onClick={() => void edit((x) => restoreExercise(db, x, k))}>Undo remove</button>
      ) : (
        <button type="button" className="btn btn-quiet btn-small" onClick={() => setRemoving(true)}>Remove</button>
      )}
      <ReasonDialog open={removing} title={`Remove ${e.name}?`} reasons={REMOVE_REASONS} confirmLabel="Remove"
        note="Sets already done are kept. Removing an exercise doesn't affect its progression."
        onCancel={() => setRemoving(false)} onPick={(r) => { setRemoving(false); void edit((x) => removeExercise(db, x, k, r)); }} />
    </div>
  );
}

function ExerciseCard({ s, p, k, edit, startRest }: { s: SessionRecord; p: Programme | null; k: number; edit: (fn: Edit) => Promise<void>; startRest: (sec: number) => void }) {
  const e = s.exercises[k]!;
  const field = fieldOf(p, e.exercise);
  const rest = restAfter(p, s.prescribed, e.slot, e.exercise);
  return (
    <section className={`card ex-card${e.removed ? " is-removed" : ""}`} aria-label={e.name}>
      <ExerciseHead s={s} k={k} edit={edit} sub={e.removed ? `Removed${e.removed.reason ? `: ${e.removed.reason}` : ""}` : undefined} />
      {!e.removed && (
        <>
          <ol className="sets">
            {e.sets.map((set, j) => (
              <li key={j}>
                <SetRow label={`Set ${j + 1}`} name={e.name} set={set} field={field} each={e.loadPer === "each"}
                  update={(v) => edit((x) => updateSet(db, x, k, j, v))}
                  onDone={() => startRest(rest)}
                  remove={!set.done && e.sets.length > 1 ? () => void edit((x) => removeSet(db, x, k, j)) : undefined} />
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => void edit((x) => addSet(db, x, k))}>+ Set</button>
        </>
      )}
    </section>
  );
}

function GroupCard({ s, p, item, entries, edit, startRest }: {
  s: SessionRecord; p: Programme | null; item: Item; entries: number[]; edit: (fn: Edit) => Promise<void>; startRest: (sec: number) => void;
}) {
  const live = entries.filter((k) => !s.exercises[k]!.removed);
  const rounds = Math.max(0, ...live.map((k) => s.exercises[k]!.sets.length));
  const kind = item.type === "superset" ? "Superset" : item.type === "giant" ? "Giant set" : "Finisher";
  const rest = item.restSec ?? 90;
  return (
    <section className="card group-card" aria-label={kind}>
      <div className="group-card-head"><span className="tag tag-you">{kind}</span><span className="muted">{plural(rounds, "round")}, {rest}s rest after each</span></div>
      {entries.map((k) => <ExerciseHead key={k} s={s} k={k} edit={edit} sub={s.exercises[k]!.removed ? "Removed" : undefined} />)}
      <ol className="rounds">
        {Array.from({ length: rounds }, (_, r) => (
          <li key={r} className="round">
            <span className="round-label">Round {r + 1}</span>
            {live.map((k, n) => {
              const e = s.exercises[k]!;
              const set = e.sets[r];
              if (!set) return null;
              const last = n === live.length - 1;
              return (
                <SetRow key={k} label={e.name} name={e.name} set={set} field={fieldOf(p, e.exercise)} each={e.loadPer === "each"}
                  update={(v) => edit((x) => updateSet(db, x, k, r, v))}
                  onDone={() => { if (last || live.every((o) => o === k || s.exercises[o]!.sets[r]?.done)) startRest(rest); }} />
              );
            })}
          </li>
        ))}
      </ol>
    </section>
  );
}

function SetRow({ label, name, set, field, each, update, onDone, remove }: {
  label: string; name: string; set: LoggedSet; field: SetField; each: boolean;
  update: (v: Partial<LoggedSet>) => Promise<void>; onDone: () => void; remove?: () => void;
}) {
  const tick = () => {
    void update({ done: !set.done });
    if (!set.done) onDone();
  };
  return (
    <div className={`set-row${set.done ? " is-done" : ""}`} role="group" aria-label={`${name} ${label}`}>
      <span className="set-label">{label}</span>
      {field !== "seconds" || set.kg !== undefined ? (
        <Num label={`${label} weight`} value={set.kg} decimals onCommit={(v) => void update({ kg: v })} suffix={each ? "kg each" : "kg"} />
      ) : null}
      <Num label={`${label} ${UNITS[field]}`} value={set[field]} decimals={field === "metres"} onCommit={(v) => void update({ [field]: v })} suffix={UNITS[field]} />
      <select className="rpe" aria-label={`${label} RPE`} value={set.rpe ?? ""} onChange={(e) => void update({ rpe: e.target.value ? Number(e.target.value) : undefined })}>
        <option value="">RPE</option>
        {RPE.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button type="button" className="tick" aria-pressed={set.done} aria-label={`${label} done`} onClick={tick}>✓</button>
      {remove && <button type="button" className="icon-btn set-remove" aria-label={`Remove ${label}`} onClick={remove}>×</button>}
    </div>
  );
}

function Num({ label, value, onCommit, decimals, suffix }: {
  label: string; value: number | undefined; onCommit: (v: number | undefined) => void; decimals?: boolean; suffix: string;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value === undefined ? "" : String(value)); }, [value]);
  return (
    <span className="num-field">
      <input
        aria-label={label} inputMode={decimals ? "decimal" : "numeric"} value={text} className={decimals ? undefined : "small"}
        onFocus={(e) => { focused.current = true; e.target.select(); }}
        onBlur={() => { focused.current = false; setText(value === undefined ? "" : String(value)); }}
        onChange={(e) => {
          const t = e.target.value.replace(",", ".");
          setText(t);
          if (t.trim() === "") return onCommit(undefined);
          const v = Number(t);
          if (Number.isFinite(v) && v >= 0 && (decimals || Number.isInteger(v))) onCommit(v);
        }}
      />
      <span aria-hidden="true">{suffix}</span>
    </span>
  );
}

function ReasonDialog({ open, title, reasons, confirmLabel, note, onPick, onCancel }: {
  open: boolean; title: string; reasons: string[]; confirmLabel: string; note?: string; onPick: (r: string | null) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  return (
    <Confirm open={open} title={title} confirmLabel={confirmLabel} onCancel={onCancel} onConfirm={() => { onPick(reason); setReason(null); }}>
      {note && <p className="hint">{note}</p>}
      <div className="reasons" role="radiogroup" aria-label="Reason">
        {reasons.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={reason === r} className="reason" onClick={() => setReason(reason === r ? null : r)}>{r}</button>
        ))}
      </div>
    </Confirm>
  );
}

function AddExercise({ onPick, onCancel }: { onPick: (id: string) => void; onCancel: () => void }) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length ? library.exercises.filter((e) => words.every((w) => e.name.toLowerCase().includes(w))).slice(0, 30) : [];
  return (
    <div className="add-exercise">
      <div className="pick-filters">
        <input type="search" autoFocus placeholder="Search exercises" aria-label="Search exercises to add" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
      <ul className="add-list">
        {shown.map((e) => <li key={e.id}><button type="button" onClick={() => onPick(e.id)}>{e.name}</button></li>)}
      </ul>
    </div>
  );
}

function RestTimer({ rest, change, stop }: { rest: { until: number; total: number }; change: (d: number) => void; stop: () => void }) {
  const [now, setNow] = useState(Date.now());
  const alerted = useRef(false);
  useEffect(() => {
    alerted.current = false;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest.until]);
  const left = Math.max(0, Math.ceil((rest.until - now) / 1000));
  useEffect(() => {
    if (left > 0 || alerted.current) return;
    alerted.current = true;
    try { navigator.vibrate?.([300, 150, 300]); } catch { /* not supported */ }
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      o.frequency.value = 880;
      o.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.4);
    } catch { /* no sound available */ }
  }, [left]);
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className={`rest-bar${left === 0 ? " is-over" : ""}`} role="timer" aria-live="polite">
      <span className="rest-time">{left === 0 ? "Rest over" : `Rest ${mm}:${ss}`}</span>
      <button type="button" className="btn btn-quiet btn-small" onClick={() => change(-15)}>−15s</button>
      <button type="button" className="btn btn-quiet btn-small" onClick={() => change(15)}>+15s</button>
      <button type="button" className="btn btn-small" onClick={stop}>{left === 0 ? "Close" : "Skip"}</button>
    </div>
  );
}
