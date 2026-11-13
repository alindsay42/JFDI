// Your own exercises: ones the app doesn't come with, such as an ab wheel rollout, each with the kit it needs.
import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { db } from "../store/db.ts";
import {
  addOwnExercise, getOwnExercises, inputOf, isUsed, removeOwnExercise, updateOwnExercise, usesOf,
  type ExerciseInput, type OwnExercise,
} from "../store/exercises.ts";
import { getGyms, type Gym } from "../store/gyms.ts";
import { Confirm } from "./Confirm.tsx";
import { BAR_TYPES } from "./Equipment.tsx";
import { PlainScreen, Screen } from "./Screen.tsx";

export const PATTERN_NAMES: Record<string, string> = {
  squat: "Squat", hinge: "Hinge", push: "Push", pull: "Pull", lunge: "Lunge", carry: "Carry", core: "Core",
  isolation: "Isolation", conditioning: "Conditioning", mobility: "Mobility",
};
const MEASURES: Array<[ExerciseInput["measure"], string]> = [
  ["load", "Weight and reps"], ["reps", "Reps"], ["time", "Time"], ["distance", "Distance"], ["calories", "Calories"],
];
export const IMPLEMENT_NAMES: Record<string, string> = {
  barbell: "Barbell", dumbbell: "Dumbbells", kettlebell: "Kettlebell", plate: "Plates", cable: "Cable", machine: "Machine",
  band: "Band", bodyweight: "Bodyweight", other: "Other",
};
/** Kit an exercise can need: anything but bars, plates and dumbbells, which go with what it's done with */
const NOT_NEEDED = new Set(["bar", "plates", "dumbbells", "weights"]);

/** Every piece of kit in any gym, once each, by name. */
/** Every set of weighted kit (kettlebells, sandbags...) in any gym, once each, by name. */
export function weightedKit(gyms: Gym[]): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  for (const g of gyms) for (const i of g.kit.items) if (i.kind === "weights" && !seen.has(i.id)) seen.set(i.id, i.name);
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** What an exercise is done with, in words: its weighted kit's name, or the kind of thing. */
export function doneWithName(e: Pick<OwnExercise, "implement" | "weights">, gyms: Gym[]): string {
  return (e.weights && weightedKit(gyms).find((w) => w.id === e.weights)?.name) || IMPLEMENT_NAMES[e.implement]!;
}

export function kitChoices(gyms: Gym[]): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  for (const g of gyms) for (const i of g.kit.items) if (!NOT_NEEDED.has(i.kind) && !seen.has(i.id)) seen.set(i.id, i.name);
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function OwnExercises({ profile }: { profile: JFDIProfile | undefined }) {
  const own = useLiveQuery(() => getOwnExercises(db));
  const gyms = useLiveQuery(() => getGyms(db));
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const kit = new Map(kitChoices(gyms ?? []).map((k) => [k.id, k.name]));

  const body = own === undefined || gyms === undefined ? null : (
    <section className="card" aria-labelledby="own-heading">
      <h2 id="own-heading">Exercises you've added</h2>
      <p className="hint">Exercises the app doesn't come with. Say what kit each one needs, then choose it when building a workout like any other.</p>
      {own.length === 0 && editing !== "new" && <p className="muted">None yet.</p>}
      <ul className="kit-list">
        {own.map((e) => editing === e.id ? (
          <li key={e.id} className="own-edit"><ExerciseForm gyms={gyms} exercise={e} done={() => setEditing(null)} /></li>
        ) : (
          <li key={e.id} className="kit-row">
            <span>
              <strong>{e.name}</strong>{" "}
              <span className="muted">
                · {PATTERN_NAMES[e.pattern]} · {doneWithName(e, gyms)}
                {e.requires.length ? ` · needs ${e.requires.map((r) => kit.get(r) ?? r).join(", ")}` : ""}
              </span>
            </span>
            <span className="own-actions">
              <button type="button" className="btn btn-quiet btn-small" aria-label={`Edit ${e.name}`} onClick={() => setEditing(e.id)}>Edit</button>
              <RemoveExercise exercise={e} />
            </span>
          </li>
        ))}
      </ul>
      {editing === "new"
        ? <ExerciseForm gyms={gyms} done={() => setEditing(null)} />
        : <button type="button" className="btn btn-quiet btn-small" onClick={() => setEditing("new")}>+ New exercise</button>}
    </section>
  );
  if (!profile) return <PlainScreen title="Your exercises">{body}</PlainScreen>;
  return <Screen profile={profile} route="programme"><h1 className="page-title">Your exercises</h1>{body}</Screen>;
}

function RemoveExercise({ exercise }: { exercise: OwnExercise }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button type="button" className="icon-btn set-remove" aria-label={`Remove ${exercise.name}`} onClick={() => { setError(""); setOpen(true); }}>×</button>
      <Confirm danger open={open} title={`Remove ${exercise.name}?`} confirmLabel="Remove" onCancel={() => setOpen(false)}
        onConfirm={() => { void removeOwnExercise(db, exercise.id).then(() => setOpen(false), (e: Error) => setError(e.message)); }}>
        {error ? <p className="problems" role="alert">Can't remove it. {error}</p> : <p>It won't be offered when building workouts any more.</p>}
      </Confirm>
    </>
  );
}

const BLANK: ExerciseInput = { name: "", pattern: "" as ExerciseInput["pattern"], measure: "reps", implement: "bodyweight", requires: [] };

/**
 * Adding or changing one of your exercises. `added` is told the new exercise, so a workout being built can
 * take it straight in.
 */
export function ExerciseForm({ gyms, exercise, done, added }: {
  gyms: Gym[];
  exercise?: OwnExercise;
  done: () => void;
  added?: (e: OwnExercise) => void;
}) {
  const [v, setV] = useState<ExerciseInput>(exercise ? inputOf(exercise) : BLANK);
  const [error, setError] = useState("");
  const uses = useLiveQuery(async () => (exercise ? usesOf(db, exercise.id) : null), [exercise?.id]);
  const fixed = !!uses && isUsed(uses);
  const kit = kitChoices(gyms);
  const sets = weightedKit(gyms);
  const set = (patch: Partial<ExerciseInput>) => setV((x) => ({ ...x, ...patch }));
  const twoAtOnce = (!!v.weights || ["dumbbell", "kettlebell", "plate"].includes(v.implement)) && v.measure !== "reps";
  const ready = v.name.trim() !== "" && (v.pattern as string) !== "";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const saving = exercise ? updateOwnExercise(db, exercise.id, v) : addOwnExercise(db, v);
    saving.then((ex) => { if (!exercise) added?.(ex); done(); }, (err: Error) => setError(err.message));
  };

  return (
    <form className="own-form" onSubmit={submit} aria-label={exercise ? `Change ${exercise.name}` : "New exercise"}>
      <label className="field field-narrow"><span>Name</span>
        <input aria-label="Exercise name" placeholder="Ab wheel rollout" value={v.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <div className="own-grid">
        <label className="field"><span>Movement</span>
          <select value={v.pattern} onChange={(e) => set({ pattern: e.target.value as ExerciseInput["pattern"] })}>
            {!v.pattern && <option value="">Choose…</option>}
            {Object.entries(PATTERN_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="field"><span>What it counts</span>
          <select value={v.measure} disabled={fixed} onChange={(e) => set({ measure: e.target.value as ExerciseInput["measure"] })}>
            {MEASURES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="field"><span>Done with</span>
          <select value={v.weights ? `kit:${v.weights}` : v.implement} disabled={fixed} onChange={(e) => {
            const value = e.target.value;
            if (value.startsWith("kit:")) set({ weights: value.slice(4), implement: "other" });
            else set({ implement: value as ExerciseInput["implement"], weights: undefined });
          }}>
            {Object.entries(IMPLEMENT_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            {sets.length > 0 && (
              <optgroup label="Your weighted kit">
                {sets.map((s) => <option key={s.id} value={`kit:${s.id}`}>{s.name}</option>)}
              </optgroup>
            )}
            {v.weights && !sets.some((s) => s.id === v.weights) && <option value={`kit:${v.weights}`}>Removed kit</option>}
          </select>
        </label>
        {v.implement === "barbell" && !v.weights && (
          <label className="field"><span>Bar</span>
            <select value={v.barType ?? "standard"} disabled={fixed} onChange={(e) => set({ barType: e.target.value as ExerciseInput["barType"] })}>
              {BAR_TYPES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        )}
      </div>
      {twoAtOnce && (
        <label className="check own-check">
          <input type="checkbox" checked={!!v.each} disabled={fixed} onChange={(e) => set({ each: e.target.checked })} />
          <span>Two at once, so the weight is for each</span>
        </label>
      )}
      {fixed && <p className="hint">It's been used, so what it counts and what it's done with stay as they are.</p>}
      <fieldset className="field">
        <legend>Needs</legend>
        {kit.length === 0 ? <p className="hint">No kit yet. Add it under Equipment.</p> : (
          <div className="own-kit">
            {kit.map((k) => (
              <label key={k.id} className="check">
                <input type="checkbox" checked={v.requires.includes(k.id)}
                  onChange={(e) => set({ requires: e.target.checked ? [...v.requires, k.id] : v.requires.filter((r) => r !== k.id) })} />
                <span>{k.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <label className="field notes-field"><span>Notes</span>
        <textarea rows={2} placeholder="How to do it" value={v.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
      </label>
      {error && <p className="problems" role="alert">{error}</p>}
      <div className="actions actions-start">
        <button type="button" className="btn btn-quiet" onClick={done}>Cancel</button>
        <button type="submit" className="btn btn-you" disabled={!ready}>{exercise ? "Save" : "Add exercise"}</button>
      </div>
    </form>
  );
}
