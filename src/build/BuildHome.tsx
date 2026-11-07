import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { asProgramme, type Programme } from "../formats/programme.ts";
import { plural } from "../shared/format.ts";
import { go, href } from "../shared/route.ts";
import { listDrafts, putDraft } from "../store/build.ts";
import { db } from "../store/db.ts";
import { newProgramme, weekWorkouts } from "./model.ts";
import { Frame } from "./Frame.tsx";

/** Build mode's start: every programme, and a new one. */
export function BuildHome({ profile, profiles }: { profile: JFDIProfile | undefined; profiles: JFDIProfile[] }) {
  const saved = useLiveQuery(() => db.programmes.toArray());
  const drafts = useLiveQuery(() => listDrafts(db));
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
    go("build", p.id);
  }

  return (
    <Frame profile={profile} title="Build">
      <section className="card" aria-labelledby="programmes-heading">
        <h2 id="programmes-heading">Programmes</h2>
        <ul className="programme-list">
          {all.map((p) => {
            const runners = profiles.filter((pr) => pr.programmes.active?.programme === p.id).map((pr) => pr.name);
            const days = weekWorkouts(p.plan, 0).length;
            return (
              <li key={p.id}>
                <a className="programme-row" href={href("build", p.id)}>
                  <span className="programme-name">{p.name}</span>
                  <span className="muted">
                    {p.plan.mode === "adhoc" ? "Ad hoc" : "Set days"} · {plural(days, "workout")} a week
                    {p.plan.weeks.length > 1 && ` · ${p.plan.weeks.length}-week cycle`}
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
    </Frame>
  );
}
