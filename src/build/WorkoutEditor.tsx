import { useEffect, useRef, useState } from "react";
import type { Exercise, Item, Programme, Slot } from "../formats/programme.ts";
import {
  addExercises, formatRange, group, groupOf, moveItem, moveSlot, parseRange, removeExercises, renameWorkout, startKg, targetField,
  TIER_NAMES, updateItem, updateSlot, workoutSlots, type SlotRef,
} from "./model.ts";
import { PickLists } from "./PickLists.tsx";
import { href } from "../shared/route.ts";
import type { DraftState } from "./useDraft.ts";
import { equipment, library } from "../store/household.ts";
import type { Tier, Workout } from "../formats/programme.ts";

/** Main, Supporting or Extra: what Amber acts on. Only shown when the programme has the daily check on. */
function TierSelect({ label, tier, onChange, disabled }: { label: string; tier: Tier; onChange: (t: Tier) => void; disabled?: boolean }) {
  return (
    <select className="tier-select" aria-label={label} value={tier} disabled={disabled} onChange={(e) => onChange(e.target.value as Tier)}>
      {(Object.keys(TIER_NAMES) as Tier[]).map((t) => <option key={t} value={t}>{TIER_NAMES[t]}</option>)}
    </select>
  );
}

const GROUP_NAMES: Record<Item["type"], string> = { single: "", superset: "Superset", giant: "Giant set", finisher: "Finisher" };
const UNITS: Record<string, string> = { reps: "reps", seconds: "sec", metres: "m", calories: "cal" };
const NO_KG = new Set(["bodyweight", "band"]);

/** Building one workout: choose exercises with the two lists, then order, set and group them below. */
export function WorkoutEditor({ draft, workout }: { draft: DraftState; workout: Workout }) {
  const p = draft.programme!;
  const id = workout.id;
  const { update } = draft;
  const [pairing, setPairing] = useState<Set<string> | null>(null);
  const chosen = workoutSlots(workout).map((s) => s.slot_.exercise);
  const exercises = new Map(p.exercises.map((e) => [e.id, e]));

  const savePairing = () => {
    if (pairing) update((q) => group(q, id, chosen.filter((x) => pairing.has(x))));
    setPairing(null);
  };
  const n = pairing?.size ?? 0;

  const done = (
    <a className="btn btn-you" href={href("programme", p.id)}>Done</a>
  );

  return (
    <>
      <div className="done-bar">
        <span className="hint">Changes are kept as you go. Save the programme from the plan.</span>
        {done}
      </div>
      <section className="card" aria-labelledby="choose-heading">
        <label className="field field-narrow">
          <span>Workout name</span>
          <input value={workout.name} maxLength={80} onChange={(e) => update((q) => renameWorkout(q, id, e.target.value))} />
        </label>
        <h2 id="choose-heading">Choose exercises</h2>
        <PickLists
          chosen={chosen}
          onAdd={(ids) => update((q) => addExercises(q, id, ids, library, equipment))}
          onRemove={(ids) => update((q) => removeExercises(q, id, ids))}
        />
      </section>

      <section className="card" aria-labelledby="workout-heading">
        <div className="week-head">
          <h2 id="workout-heading">Workout</h2>
        </div>
        {workout.items.length === 0 ? (
          <p className="hint">Exercises you choose above appear here, each on its own. Drag them into order, set their weights, and pair them into supersets and giant sets.</p>
        ) : (
          <DragList
            count={workout.items.length}
            onMove={(from, to) => update((q) => moveItem(q, id, from, to))}
            disabled={pairing !== null}
            className="workout-items"
            label="Workout"
            render={(i, handle) => {
              const item = workout.items[i]!;
              if (item.type === "single") {
                return (
                  <ExerciseRow
                    p={p} workoutId={id} item={item} at={{ item: i, slot: 0 }} ex={exercises.get(item.slots[0].exercise)}
                    handle={handle} pairing={pairing} setPairing={setPairing} update={update}
                  />
                );
              }
              return (
                <div className={`group group-${item.type}`}>
                  <div className="group-head">
                    {handle}
                    <span className="tag tag-you">{GROUP_NAMES[item.type]}</span>
                    {p.readiness.preset !== "off" && (
                      <TierSelect label={`${GROUP_NAMES[item.type]} priority`} tier={item.tier} disabled={pairing !== null}
                        onChange={(t) => update((q) => updateItem(q, id, i, { tier: t }))} />
                    )}
                    <NumberField label="Rounds" value={item.rounds} min={1} max={item.type === "finisher" ? 50 : 20} whole
                      disabled={pairing !== null} onCommit={(v) => update((q) => updateItem(q, id, i, { rounds: v ?? 1 }))} suffix="rounds" />
                    <NumberField label="Rest after each round" value={item.restSec} min={0} max={3600} whole optional
                      disabled={pairing !== null} onCommit={(v) => update((q) => updateItem(q, id, i, { restSec: v ?? null }))} suffix="s rest" />
                    {pairing === null && (
                      <button type="button" className="btn btn-quiet btn-small" onClick={() => setPairing(new Set(groupOf(workout, item.slots[0]!.exercise)))}>
                        Change group
                      </button>
                    )}
                  </div>
                  <DragList
                    count={item.slots.length}
                    onMove={(from, to) => update((q) => moveSlot(q, id, i, from, to))}
                    disabled={pairing !== null}
                    className="group-slots"
                    label={GROUP_NAMES[item.type]}
                    render={(j, inner) => (
                      <ExerciseRow
                        p={p} workoutId={id} item={item} at={{ item: i, slot: j }} ex={exercises.get(item.slots[j]!.exercise)}
                        handle={inner} pairing={pairing} setPairing={setPairing} update={update}
                      />
                    )}
                  />
                </div>
              );
            }}
          />
        )}

        {workout.items.length > 1 && (pairing === null ? (
          <div className="actions actions-start">
            <button type="button" className="btn" onClick={() => setPairing(new Set())}>Pair exercises</button>
          </div>
        ) : (
          <div className="pair-bar" role="region" aria-label="Pair exercises">
            <span>
              {n === 0 ? "Tap the exercises to pair." : n === 1 ? "1 chosen: it will stand on its own." : n === 2 ? "2 chosen: a superset." : `${n} chosen: a giant set.`}
            </span>
            <button type="button" className="btn btn-quiet" onClick={() => setPairing(null)}>Cancel</button>
            <button type="button" className="btn btn-you" onClick={savePairing}>Save</button>
          </div>
        ))}
      </section>
      <div className="actions">{done}</div>
    </>
  );
}

function ExerciseRow({ p, workoutId, item, at, ex, handle, pairing, setPairing, update }: {
  p: Programme; workoutId: string; item: Item; at: SlotRef; ex: Exercise | undefined; handle: React.ReactNode;
  pairing: Set<string> | null; setPairing: (s: Set<string>) => void; update: DraftState["update"];
}) {
  const slot = item.slots[at.slot]!;
  const name = ex?.name ?? slot.exercise;
  const field = ex ? targetField(ex) : "reps";
  const set = (change: Partial<Slot>) => update((q) => updateSlot(q, workoutId, at, change));

  if (pairing) {
    const on = pairing.has(slot.exercise);
    const flip = () => { const next = new Set(pairing); if (on) next.delete(slot.exercise); else next.add(slot.exercise); setPairing(next); };
    return (
      <button type="button" className="ex-row ex-pick" role="checkbox" aria-checked={on} onClick={flip}>
        <span className="pick-box" aria-hidden="true">{on ? "✓" : ""}</span>
        <span className="ex-name">{name}</span>
      </button>
    );
  }

  const kg = startKg(p, slot);
  return (
    <div className="ex-row" role="group" aria-label={name}>
      {handle}
      <span className="ex-name">{name}</span>
      <span className="ex-fields">
        {item.type === "single" && p.readiness.preset !== "off" && (
          <TierSelect label={`${name} priority`} tier={item.tier} onChange={(t) => update((q) => updateItem(q, workoutId, at.item, { tier: t }))} />
        )}
        {ex && !NO_KG.has(ex.implement) && (
          <NumberField label={`${name} weight`} value={kg} min={0} max={1000} optional suffix={ex.loadPer === "each" ? "kg each" : "kg"}
            onCommit={(v) => set({ start: v === undefined ? undefined : { kg: v } })} />
        )}
        {item.type === "single" && (
          <NumberField label={`${name} sets`} value={slot.sets} min={1} max={20} whole suffix="sets ×"
            onCommit={(v) => set({ sets: v ?? 1 })} />
        )}
        <RangeField label={`${name} ${UNITS[field]}`} value={slot[field]} suffix={UNITS[field]!}
          onCommit={(r) => set({ [field]: r } as Partial<Slot>)} />
      </span>
    </div>
  );
}

function NumberField({ label, value, onCommit, min, max, whole, optional, suffix, disabled }: {
  label: string; value: number | undefined; onCommit: (v: number | undefined) => void; min: number; max: number;
  whole?: boolean; optional?: boolean; suffix?: string; disabled?: boolean;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value === undefined ? "" : String(value)); }, [value]);
  const parse = (t: string): number | undefined | false => {
    const s = t.trim().replace(",", ".");
    if (s === "") return optional ? undefined : false;
    const v = Number(s);
    if (!Number.isFinite(v) || v < min || v > max || (whole && !Number.isInteger(v))) return false;
    return v;
  };
  const bad = parse(text) === false;
  return (
    <span className="num-field">
      <input
        aria-label={label} inputMode={whole ? "numeric" : "decimal"} value={text} disabled={disabled} aria-invalid={bad || undefined}
        className={whole ? "small" : undefined}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setText(value === undefined ? "" : String(value)); }}
        onChange={(e) => { setText(e.target.value); const v = parse(e.target.value); if (v !== false) onCommit(v); }}
      />
      {suffix && <span aria-hidden="true">{suffix}</span>}
    </span>
  );
}

function RangeField({ label, value, onCommit, suffix }: {
  label: string; value: { min: number; max: number } | undefined; onCommit: (r: { min: number; max: number }) => void; suffix: string;
}) {
  const [text, setText] = useState(formatRange(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(formatRange(value)); }, [value]);
  const bad = parseRange(text) === null;
  return (
    <span className="num-field">
      <input
        aria-label={label} inputMode="text" value={text} aria-invalid={bad || undefined} className="small range"
        title="A number, or a range such as 8-12"
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setText(formatRange(value)); }}
        onChange={(e) => { setText(e.target.value); const r = parseRange(e.target.value); if (r) onCommit(r); }}
      />
      <span aria-hidden="true">{suffix}</span>
    </span>
  );
}

/**
 * A list whose rows are reordered by dragging their ≡ handle. Works with touch, mouse and pen.
 * Keyboard: focus a handle and press the up or down arrow.
 */
function DragList({ count, onMove, render, disabled, className, label }: {
  count: number;
  onMove: (from: number, to: number) => void;
  render: (index: number, handle: React.ReactNode) => React.ReactNode;
  disabled?: boolean;
  className?: string;
  label: string;
}) {
  const list = useRef<HTMLOListElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const current = useRef<number | null>(null);

  const rows = () => Array.from(list.current?.children ?? []) as HTMLElement[];
  const indexAt = (y: number) => {
    const rs = rows();
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i]!.getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return rs.length - 1;
  };

  // Moves are followed on the whole window: the row being dragged re-renders as it moves, so its handle can't hold on to the pointer.
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const startDrag = (i: number) => {
    current.current = i;
    setDragging(i);
    const move = (e: PointerEvent) => {
      if (current.current === null) return;
      e.preventDefault();
      const to = indexAt(e.clientY);
      if (to !== current.current) {
        moveRef.current(current.current, to);
        current.current = to;
        setDragging(to);
      }
    };
    const end = () => {
      current.current = null;
      setDragging(null);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", end);
      removeEventListener("pointercancel", end);
    };
    addEventListener("pointermove", move, { passive: false });
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
  };

  const handle = (i: number) => (
    <button
      type="button"
      className="drag-handle"
      aria-label={`Move ${i + 1} of ${count} in ${label}`}
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        startDrag(i);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" && i > 0) { e.preventDefault(); onMove(i, i - 1); }
        if (e.key === "ArrowDown" && i < count - 1) { e.preventDefault(); onMove(i, i + 1); }
      }}
    >
      ≡
    </button>
  );

  return (
    <ol ref={list} className={`drag-list ${className ?? ""}`} aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={dragging === i ? "is-dragging" : undefined}>{render(i, handle(i))}</li>
      ))}
    </ol>
  );
}
