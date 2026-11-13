import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { asProgramme, type Item, type Programme } from "../formats/programme.ts";
import { Confirm } from "../shared/Confirm.tsx";
import { plural } from "../shared/format.ts";
import { go } from "../shared/route.ts";
import { Screen } from "../shared/Screen.tsx";
import { lastTime, setsText } from "../engine/progress.ts";
import { swapOptions } from "../engine/swaps.ts";
import type { JFDIHouseholdEquipment } from "../formats/generated/equipment.ts";
import { getGymChoice, getGyms, gymFor } from "../store/gyms.ts";
import { formatDayMonth } from "../shared/format.ts";
import { db, type SessionRecord } from "../store/db.ts";
import { library } from "../store/household.ts";
import {
  activeSession, addExercise, addRound, addSet, discardSession, fieldOf, finishSession, insteadOf, removeExercise, removeSet, restAfter, restoreExercise,
  setNotes, swapExercise, swappedOut, updateSet, type LoggedSet, type SetField,
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
  // Earlier workouts, for "last time" under each exercise
  const history = useLiveQuery(() => db.sessions.where("profile").equals(profile.id).filter((x) => x.status === "done").toArray(), [profile.id]);
  // Where they're training, for what a swap can be
  const swapping = useLiveQuery(async () => {
    const gyms = await getGyms(db);
    const gym = gymFor(gyms, await getGymChoice(db, profile.id));
    return {
      gym: gym?.kit ?? null,
      known: new Set(gyms.flatMap((g) => g.kit.items.map((i) => i.id))),
      excluded: new Set(profile.excludedExercises ?? []),
    };
  }, [profile.id, profile.excludedExercises]);
  const [s, setS] = useState<SessionRecord | null>(null);
  const latest = useRef<SessionRecord | null>(null);
  const queue = useRef(Promise.resolve());
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);

  useEffect(() => {
    if (loaded && !latest.current) { latest.current = loaded.s; setS(loaded.s); }
  }, [loaded]);

  // Keep the screen on during a workout, so the rest timer stays in view and the alert isn't missed
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const take = () => {
      (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock
        ?.request("screen").then((l) => { lock = l; }).catch(() => { /* not allowed or not supported */ });
    };
    take();
    const again = () => { if (document.visibilityState === "visible") take(); };
    document.addEventListener("visibilitychange", again);
    return () => { document.removeEventListener("visibilitychange", again); void lock?.release().catch(() => {}); };
  }, []);

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
      <History.Provider value={history ?? []}>
        <Swapping.Provider value={swapping ?? NO_SWAPS}>
          <Workout s={s} p={loaded.p} edit={edit} startRest={(sec) => setRest(sec > 0 ? { until: Date.now() + sec * 1000, total: sec } : null)} />
        </Swapping.Provider>
      </History.Provider>
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
    // An exercise swapped for a stand-in is kept in the log, but the stand-in shows in its place
    if (swappedOut(s.exercises, k)) return;
    const i = e.slot ? Number(e.slot.split(".")[0]) : -1;
    if (out[i]) out[i]!.entries.push(k);
    else extra.push(k);
  });
  return [...out.filter((g) => g.entries.length), ...extra.map((k) => ({ item: null, entries: [k] }))];
}

function Workout({ s, p, edit, startRest }: { s: SessionRecord; p: Programme | null; edit: (fn: Edit) => Promise<void>; startRest: (sec: number) => void }) {
  const groups = useMemo(() => layout(s), [s]);
  const [ending, setEnding] = useState<"finish" | "early" | "empty" | "discard" | null>(null);
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
        <button type="button" className="btn btn-danger-quiet" onClick={() => setEnding("discard")}>Discard</button>
        <button type="button" className="btn btn-quiet" onClick={() => setEnding("early")}>End early</button>
        <button type="button" className="btn btn-you btn-big" onClick={() => setEnding(done ? "finish" : "empty")}>Finish workout</button>
      </div>

      <Confirm open={ending === "finish"} title="Finish this workout?" confirmLabel="Finish" onCancel={() => setEnding(null)}
        onConfirm={() => { setEnding(null); void finish(null); }}>
        <p>{done === planned ? "Every set is done." : `${done} of ${planned} sets are ticked. The rest are kept as planned but not done.`}</p>
      </Confirm>
      <Confirm open={ending === "discard"} title="Discard this workout?" confirmLabel="Discard" danger onCancel={() => setEnding(null)}
        onConfirm={() => { setEnding(null); void edit(async (x) => { await discardSession(db, x); return x; }).then(() => go("today")); }}>
        <p>Everything logged in it so far is thrown away, and it stays next up, so you can start it again.</p>
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

/** Finished workouts, for "last time" on each set */
const History = createContext<SessionRecord[]>([]);

/** The gym being trained at, every piece of kit the gyms know of, and exercises this person doesn't do */
interface SwapContext { gym: JFDIHouseholdEquipment | null; known: Set<string>; excluded: Set<string> }
const NO_SWAPS: SwapContext = { gym: null, known: new Set(), excluded: new Set() };
const Swapping = createContext<SwapContext>(NO_SWAPS);

/** Whether an exercise can be swapped: a planned one (or a stand-in) with nothing done yet. */
const swappable = (s: SessionRecord, k: number) => {
  const e = s.exercises[k]!;
  return !e.removed && !e.added && !e.sets.some((set) => set.done);
};

/** Stand-ins for one exercise: its family, then (on request) the same movement. For this workout only. */
function SwapPanel({ s, k, edit, onClose }: { s: SessionRecord; k: number; edit: (fn: Edit) => Promise<void>; onClose: () => void }) {
  const { gym, known, excluded } = useContext(Swapping);
  const [more, setMore] = useState(false);
  const e = s.exercises[k]!;
  const planned = e.swappedFrom ?? e.exercise;
  const inWorkout = new Set(s.exercises.filter((x) => !x.removed).map((x) => x.exercise));
  const leaveOut = new Set([...inWorkout, ...excluded, planned]);
  const options = gym ? swapOptions(planned, library.exercises, gym, known, leaveOut) : { family: [], movement: [] };
  const history = useContext(History);
  // The stand-in starts from what was lifted on it last time, if it's been done before
  const pick = (id: string) => { onClose(); void edit((x) => swapExercise(db, x, k, id, lastTime(history, id, x.id)?.sets ?? [])); };
  const button = (id: string, name: string) => (
    <li key={id}><button type="button" onClick={() => pick(id)}>{name}</button></li>
  );
  return (
    <div className="swap-panel" role="group" aria-label={`Swap ${e.name}`}>
      <p className="hint">For this workout only. The planned exercise's progression isn't affected.</p>
      <ul className="add-list">
        {e.swappedFrom && button(planned, `Back to ${insteadOf(s.exercises, k)}`)}
        {options.family.filter((x) => x.id !== e.exercise).map((x) => button(x.id, x.name))}
        {more && options.movement.filter((x) => x.id !== e.exercise).map((x) => button(x.id, x.name))}
      </ul>
      {!options.family.length && !more && <p className="muted">No close variations{gym ? " this gym can do" : ""}.</p>}
      <div className="actions actions-start">
        {!more && options.movement.length > 0 && (
          <button type="button" className="btn btn-quiet btn-small" onClick={() => setMore(true)}>Show more</button>
        )}
        <button type="button" className="btn btn-quiet btn-small" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/** The values a set copies from last time: the weight and whatever the exercise counts */
function copyOf(last: LoggedSet, field: SetField): Partial<LoggedSet> {
  return { ...(last.kg !== undefined ? { kg: last.kg } : {}), ...(last[field] !== undefined ? { [field]: last[field] } : {}) };
}
const differs = (set: LoggedSet, last: LoggedSet, field: SetField) => set.kg !== last.kg || set[field] !== last[field];

/** Last time for an exercise; its sets match this workout's sets by number. */
function useLast(s: SessionRecord, exercise: string) {
  const history = useContext(History);
  return lastTime(history, exercise, s.id);
}

/** Said once when "last" passed over a deload week, so it doesn't look like the wrong workout. */
const BeforeDeload = ({ date }: { date: string | undefined }) =>
  date ? <p className="hint before-deload">Last numbers are from before your deload week ({formatDayMonth(date)}).</p> : null;

/** Fills every set not yet ticked with last time's numbers, for the given exercises. */
function fillFromLast(edit: (fn: Edit) => Promise<void>, fills: Array<{ k: number; last: LoggedSet[]; field: SetField }>) {
  return edit(async (x) => {
    let cur = x;
    for (const { k, last, field } of fills) {
      for (let j = 0; j < cur.exercises[k]!.sets.length; j++) {
        const set = cur.exercises[k]!.sets[j]!;
        const l = last[j];
        if (l && !set.done && differs(set, l, field)) cur = await updateSet(db, cur, k, j, copyOf(l, field));
      }
    }
    return cur;
  });
}

function ExerciseHead({ s, k, edit, sub, extra }: { s: SessionRecord; k: number; edit: (fn: Edit) => Promise<void>; sub?: string; extra?: React.ReactNode }) {
  const e = s.exercises[k]!;
  const [removing, setRemoving] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const instead = insteadOf(s.exercises, k);
  return (
    <div className="ex-head">
      <span className="ex-title">{e.name}{e.added && <span className="tag">Added</span>}</span>
      {sub ? <span className="muted">{sub}</span> : instead && <span className="muted">Instead of {instead}</span>}
      {extra}
      {swappable(s, k) && !swapping && <button type="button" className="btn btn-quiet btn-small" onClick={() => setSwapping(true)}>Swap</button>}
      {e.removed ? (
        <button type="button" className="btn btn-quiet btn-small" onClick={() => void edit((x) => restoreExercise(db, x, k))}>Undo remove</button>
      ) : (
        <button type="button" className="btn btn-quiet btn-small" onClick={() => setRemoving(true)}>Remove</button>
      )}
      <ReasonDialog open={removing} title={`Remove ${e.name}?`} reasons={REMOVE_REASONS} confirmLabel="Remove"
        note="Sets already done are kept. Removing an exercise doesn't affect its progression."
        onCancel={() => setRemoving(false)} onPick={(r) => { setRemoving(false); void edit((x) => removeExercise(db, x, k, r)); }} />
      {swapping && <SwapPanel s={s} k={k} edit={edit} onClose={() => setSwapping(false)} />}
    </div>
  );
}

function ExerciseCard({ s, p, k, edit, startRest }: { s: SessionRecord; p: Programme | null; k: number; edit: (fn: Edit) => Promise<void>; startRest: (sec: number) => void }) {
  const e = s.exercises[k]!;
  const field = fieldOf(p, e.exercise);
  const rest = restAfter(p, s.prescribed, e.slot, e.exercise);
  const lastInfo = useLast(s, e.exercise);
  const last = lastInfo?.sets ?? [];
  const canFill = !e.removed && e.sets.some((set, j) => !set.done && last[j] && differs(set, last[j], field));
  return (
    <section className={`card ex-card${e.removed ? " is-removed" : ""}`} aria-label={e.name}>
      <ExerciseHead s={s} k={k} edit={edit} sub={e.removed ? `Removed${e.removed.reason ? `: ${e.removed.reason}` : ""}` : undefined}
        extra={canFill && <button type="button" className="btn btn-quiet btn-small" onClick={() => void fillFromLast(edit, [{ k, last, field }])}>Use last time</button>} />
      {!e.removed && (
        <>
          <BeforeDeload date={lastInfo?.deloadSince} />
          <ol className="sets">
            {e.sets.map((set, j) => (
              <li key={`${e.exercise}-${j}`}>
                <SetRow label={`Set ${j + 1}`} name={e.name} set={set} field={field} each={e.loadPer === "each"} last={last[j]}
                  update={(v) => edit((x) => updateSet(db, x, k, j, v))}
                  onDone={() => startRest(rest)}
                  remove={!set.done ? () => void edit((x) => removeSet(db, x, k, j)) : undefined} />
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
  const [removing, setRemoving] = useState(false);
  const [swapping, setSwapping] = useState<number | "which" | null>(null);
  const canSwap = live.filter((k) => swappable(s, k));
  const history = useContext(History);
  const infos = new Map(entries.map((k) => [k, lastTime(history, s.exercises[k]!.exercise, s.id)]));
  const lasts = new Map(entries.map((k) => [k, infos.get(k)?.sets ?? []]));
  const deloadSince = live.map((k) => infos.get(k)?.deloadSince).filter(Boolean).sort().at(-1);
  const fills = live.map((k) => ({ k, last: lasts.get(k)!, field: fieldOf(p, s.exercises[k]!.exercise) }));
  const canFill = fills.some(({ k, last, field }) => s.exercises[k]!.sets.some((set, j) => !set.done && last[j] && differs(set, last[j], field)));
  return (
    <section className="card group-card" aria-label={kind}>
      <div className="group-card-head">
        <span className="tag tag-you">{kind}</span>
        <span className="muted group-meta">{live.length ? `${plural(rounds, "round")}, ${rest}s rest after each` : `${kind} removed`}</span>
        {canFill && <button type="button" className="btn btn-quiet btn-small" onClick={() => void fillFromLast(edit, fills)}>Use last time</button>}
        {canSwap.length > 0 && swapping === null && (
          <button type="button" className="btn btn-quiet btn-small" onClick={() => setSwapping(canSwap.length === 1 ? canSwap[0]! : "which")}>Swap</button>
        )}
        {live.length > 0 ? (
          <button type="button" className="btn btn-quiet btn-small" onClick={() => setRemoving(true)}>Remove</button>
        ) : (
          <button type="button" className="btn btn-quiet btn-small" onClick={() => void entries.reduce((q, k) => q.then(() => edit((x) => restoreExercise(db, x, k))), Promise.resolve())}>Undo remove</button>
        )}
      </div>
      {swapping === "which" && (
        <div className="swap-panel" role="group" aria-label="Swap which exercise?">
          <p className="hint">Swap which?</p>
          <div className="actions actions-start">
            {canSwap.map((k) => <button key={k} type="button" className="btn btn-quiet btn-small" onClick={() => setSwapping(k)}>{s.exercises[k]!.name}</button>)}
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setSwapping(null)}>Cancel</button>
          </div>
        </div>
      )}
      {typeof swapping === "number" && <SwapPanel s={s} k={swapping} edit={edit} onClose={() => setSwapping(null)} />}
      {live.map((k) => insteadOf(s.exercises, k) && <p key={k} className="hint">{s.exercises[k]!.name} instead of {insteadOf(s.exercises, k)}</p>)}
      {live.length > 0 && <BeforeDeload date={deloadSince} />}
      <ReasonDialog open={removing} title={`Remove this ${kind.toLowerCase()}?`} reasons={REMOVE_REASONS} confirmLabel="Remove"
        note="Every exercise in it goes. Sets already done are kept, and progression isn't affected."
        onCancel={() => setRemoving(false)}
        onPick={(r) => { setRemoving(false); void live.reduce((q, k) => q.then(() => edit((x) => removeExercise(db, x, k, r))), Promise.resolve()); }} />
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
                <SetRow key={`${k}-${e.exercise}`} label={e.name} name={e.name} set={set} field={fieldOf(p, e.exercise)} each={e.loadPer === "each"} last={lasts.get(k)![r]}
                  update={(v) => edit((x) => updateSet(db, x, k, r, v))}
                  onDone={() => { if (last || live.every((o) => o === k || s.exercises[o]!.sets[r]?.done)) startRest(rest); }}
                  remove={!set.done ? () => void edit((x) => removeSet(db, x, k, r)) : undefined} />
              );
            })}
          </li>
        ))}
      </ol>
      {live.length > 0 && entries.filter((k) => s.exercises[k]!.removed).map((k) => (
        <p key={k} className="removed-line">
          <span>{s.exercises[k]!.name} removed</span>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => void edit((x) => restoreExercise(db, x, k))}>Undo</button>
        </p>
      ))}
      {live.length > 0 && (
        <button type="button" className="btn btn-quiet btn-small" onClick={() => void edit((x) => addRound(db, x, live))}>+ Round</button>
      )}
    </section>
  );
}

function SetRow({ label, name, set, field, each, last, update, onDone, remove }: {
  label: string; name: string; set: LoggedSet; field: SetField; each: boolean;
  /** The same set last time; tapping it copies its numbers in */
  last?: LoggedSet | undefined;
  update: (v: Partial<LoggedSet>) => Promise<void>; onDone: () => void; remove?: () => void;
}) {
  const tick = () => {
    void update({ done: !set.done });
    if (!set.done) { primeAlert(); onDone(); }
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
      {last && !set.done && (
        <button type="button" className="last-chip" aria-label={`${label}: use last time, ${setsText([last])}`}
          disabled={!differs(set, last, field)} onClick={() => void update(copyOf(last, field))}>
          last {setsText([last])}
        </button>
      )}
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
    restOver();
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

// The rest alert. Browsers only let a page make sound from an audio context it started during a tap,
// so ticking a set starts it, and the alert at the end of the rest plays through it.
let audio: AudioContext | null = null;

function primeAlert() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch { /* no sound available */ }
}

function restOver() {
  try { navigator.vibrate?.([400, 200, 400, 200, 400]); } catch { /* no vibration */ }
  if (!audio) return;
  try {
    const start = audio.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.4, start + i * 0.35 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.35 + 0.25);
      osc.connect(gain).connect(audio.destination);
      osc.start(start + i * 0.35);
      osc.stop(start + i * 0.35 + 0.26);
    }
  } catch { /* no sound available */ }
}
