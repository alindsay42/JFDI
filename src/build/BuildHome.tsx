import { useLiveQuery } from "dexie-react-hooks";
import { getGyms } from "../store/gyms.ts";
import { getOwnExercises } from "../store/exercises.ts";
import { useState, type FormEvent } from "react";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { asProgramme, type Programme } from "../formats/programme.ts";
import { formatLongDate, plural } from "../shared/format.ts";
import { localDate } from "../store/programmes.ts";
import { go, href } from "../shared/route.ts";
import { listDrafts, putDraft } from "../store/build.ts";
import { db } from "../store/db.ts";
import { newProgramme, weekWorkouts } from "./model.ts";
import { Frame } from "./Frame.tsx";

/** The Programme tab: what the current person is on, every programme, and a new one. */
export function BuildHome({ profile, profiles }: { profile: JFDIProfile | undefined; profiles: JFDIProfile[] }) {
  const saved = useLiveQuery(() => db.programmes.toArray());
  const drafts = useLiveQuery(() => listDrafts(db));
  const gyms = useLiveQuery(() => getGyms(db));
  const own = useLiveQuery(() => getOwnExercises(db));
  const [name, setName] = useState("");

  if (!saved || !drafts) return null;
  const draftIds = new Set(drafts.map((d) => d.programme.id));
  const all: Programme[] = [
    ...saved.map(asProgramme).map((p) => drafts.find((d) => d.programme.id === p.id)?.programme ?? p),
    ...drafts.filter((d) => d.basedOn === null && !saved.some((s) => s.id === d.programme.id)).map((d) => d.programme),
  ].sort((a, b) => a.name.localeCompare(b.name));

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const p = newProgramme(name, all.map((x) => x.id));
    await putDraft(db, { programme: p, basedOn: null });
    go("programme", p.id);
  }

  return (
    <Frame profile={profile} title="Programmes">
      {profile && <CurrentProgramme profile={profile} programmes={all} />}
      <section className="card" aria-labelledby="programmes-heading">
        <h2 id="programmes-heading">All programmes</h2>
        {all.length === 0 && <p className="hint">No programmes yet. Start one below.</p>}
        <ul className="programme-list">
          {all.map((p) => {
            const runners = profiles.filter((pr) => pr.programmes.active?.programme === p.id).map((pr) => pr.name);
            const days = weekWorkouts(p.plan, 0).length;
            return (
              <li key={p.id}>
                <a className="programme-row" href={href("programme", p.id)}>
                  <span className="programme-name">{p.name}</span>
                  <span className="muted">
                    {p.plan.mode === "adhoc" ? "Ad hoc" : "Set days"} · {plural(days, "workout")} a week
                    {p.plan.weeks.length > 1 && ` · repeats every ${p.plan.weeks.length} weeks`}
                    {runners.length > 0 && ` · ${runners.join(", ")}`}
                  </span>
                  {draftIds.has(p.id) && <span className="tag tag-warn">Unsaved changes</span>}
                </a>
              </li>
            );
          })}
        </ul>
      </section>
      <form className="card" onSubmit={(e) => void create(e)}>
        <h2>New programme</h2>
        <label className="field field-narrow">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </label>
        <div className="actions actions-start">
          <button type="submit" className="btn btn-you" disabled={!name.trim()}>Create</button>
        </div>
      </form>
      <section className="card" aria-labelledby="gyms-card-heading">
        <h2 id="gyms-card-heading">Gyms and equipment</h2>
        <p className="hint">
          {gyms?.length ? gyms.map((g) => g.kit.name).join(", ") : "No gyms yet"}. Bars, plates and dumbbells decide which weights targets round to.
        </p>
        <div className="actions actions-start"><a className="btn btn-quiet" href="#/equipment">Edit equipment</a></div>
      </section>
      <section className="card" aria-labelledby="own-card-heading">
        <h2 id="own-card-heading">Your exercises</h2>
        <p className="hint">
          {own?.length ? own.map((e) => e.name).join(", ") : "None added yet"}. Add exercises the app doesn't have, with the kit each one needs.
        </p>
        <div className="actions actions-start"><a className="btn btn-quiet" href="#/exercises">Edit exercises</a></div>
      </section>
    </Frame>
  );
}

function CurrentProgramme({ profile, programmes }: { profile: JFDIProfile; programmes: Programme[] }) {
  const active = profile.programmes.active;
  const p = active && programmes.find((x) => x.id === active.programme);
  return (
    <section className="card" aria-labelledby="current-heading">
      <h2 id="current-heading">{profile.name}'s programme</h2>
      {active ? (
        <p>
          <a href={href("programme", active.programme)}><strong>{p?.name ?? active.programme}</strong></a>,{" "}
          {active.startDate > localDate(new Date()) ? "starting" : "started"} {formatLongDate(active.startDate)}.
        </p>
      ) : (
        <p className="hint">None yet. Open a programme below and choose <strong>Use this programme</strong>, or start a new one.</p>
      )}
    </section>
  );
}
