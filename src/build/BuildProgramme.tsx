import { useState } from "react";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { WEEKDAYS, type Day, type Programme, type Weekday } from "../formats/programme.ts";
import { Confirm } from "../shared/Confirm.tsx";
import { plural } from "../shared/format.ts";
import { go, href } from "../shared/route.ts";
import { deleteProgramme } from "../store/build.ts";
import { assignProgramme, localDate, ProfileError, stopProgramme } from "../store/programmes.ts";
import { db } from "../store/db.ts";
import { Frame } from "./Frame.tsx";
import {
  addDay, copyWeek, MAX_DAYS, MAX_WEEKS, moveDay, removeDay, setDay, setMinRestDays, setMode, setWeekCount,
} from "./model.ts";
import { useDraft, type DraftState } from "./useDraft.ts";
import { WorkoutEditor } from "./WorkoutEditor.tsx";

const DAY_NAMES: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

/** One programme in Build mode: the week planner, or one of its workouts. Both edit the same draft. */
export function BuildProgramme({ profile, profiles, id, workout }: {
  profile: JFDIProfile | undefined; profiles: JFDIProfile[]; id: string; workout: string | undefined;
}) {
  const draft = useDraft(id);
  if (!draft.loaded) return null;
  if (!draft.programme) {
    return (
      <Frame profile={profile} title="Programmes">
        <p className="card">This programme isn't here any more. <a href={href("programme")}>Back to programmes</a></p>
      </Frame>
    );
  }
  const p = draft.programme;
  const w = workout ? p.workouts.find((x) => x.id === workout) : undefined;
  return (
    <Frame profile={profile} title={<BuildTitle p={p} workout={w?.name} />}>
      <SaveBar draft={draft} onSaved={() => { if (workout) go("programme", p.id); }} />
      {workout ? (
        w ? <WorkoutEditor draft={draft} workout={w} /> : <p className="card">This workout isn't in the programme any more.</p>
      ) : (
        <Planner draft={draft} profile={profile} runners={profiles.filter((pr) => pr.programmes.active?.programme === id)} />
      )}
    </Frame>
  );
}

function BuildTitle({ p, workout }: { p: Programme; workout: string | undefined }) {
  return (
    <nav className="crumbs" aria-label="Where you are">
      <a href={href("programme")}>Programmes</a>
      <span aria-hidden="true">/</span>
      {workout ? <a href={href("programme", p.id)}>{p.name}</a> : <span className="crumb-here">{p.name}</span>}
      {workout && <><span aria-hidden="true">/</span><span className="crumb-here">{workout}</span></>}
    </nav>
  );
}

function SaveBar({ draft, onSaved }: { draft: DraftState; onSaved: () => void }) {
  const [asking, setAsking] = useState(false);
  if (draft.justSaved) return <div className="saved-bar" role="status">Saved.</div>;
  if (!draft.dirty && !draft.problems.length) return null;
  return (
    <div className="save-bar" role="region" aria-label="Unsaved changes">
      <span>{draft.isNew ? "Not saved yet." : "Unsaved changes."}</span>
      <button type="button" className="btn btn-quiet" onClick={() => setAsking(true)}>Discard</button>
      <button type="button" className="btn btn-you" onClick={() => void draft.save().then((ok) => { if (ok) onSaved(); })}>Save</button>
      {draft.problems.length > 0 && (
        <div className="problems save-problems" role="alert">
          <p>It can't be saved yet:</p>
          <ul>{draft.problems.slice(0, 20).map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      <Confirm
        open={asking}
        title={draft.isNew ? "Throw away this programme?" : "Discard your changes?"}
        confirmLabel="Discard"
        danger
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          const id = draft.programme!.id;
          void draft.discard().then(() => { if (draft.isNew) go("programme"); else go("programme", id); });
        }}
      >
        <p>{draft.isNew ? "It has never been saved, so it will be gone." : "The programme goes back to how it was when last saved."}</p>
      </Confirm>
    </div>
  );
}

function Planner({ draft, profile, runners }: { draft: DraftState; profile: JFDIProfile | undefined; runners: JFDIProfile[] }) {
  const p = draft.programme!;
  const { update } = draft;
  const plan = p.plan;
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  return (
    <>
      <section className="card" aria-labelledby="plan-heading">
        <h2 id="plan-heading">Plan</h2>
        <label className="field field-narrow">
          <span>Programme name</span>
          <input value={p.name} maxLength={80} onChange={(e) => update((q) => ({ ...q, name: e.target.value }))} />
        </label>

        <div className="plan-controls">
          <fieldset className="segmented" aria-label="How workouts are scheduled">
            <legend>Schedule</legend>
            {(["setDays", "adhoc"] as const).map((m) => (
              <label key={m}>
                <input type="radio" name="mode" checked={plan.mode === m} onChange={() => update((q) => setMode(q, m))} />
                <span>{m === "adhoc" ? "Ad hoc" : "Set days"}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="segmented" aria-label="Weeks in the cycle">
            <legend>Weeks in the cycle</legend>
            {Array.from({ length: MAX_WEEKS }, (_, i) => i + 1).map((n) => (
              <label key={n}>
                <input type="radio" name="weeks" checked={plan.weeks.length === n} onChange={() => update((q) => setWeekCount(q, n))} />
                <span>{n}</span>
              </label>
            ))}
          </fieldset>

          {plan.mode === "adhoc" && (
            <label className="field field-inline">
              <span>Rest days between workouts</span>
              <select
                value={plan.minRestDays ?? ""}
                onChange={(e) => update((q) => setMinRestDays(q, e.target.value === "" ? null : Number(e.target.value)))}
              >
                <option value="">Any</option>
                {[0, 1, 2, 3].map((n) => <option key={n} value={n}>At least {n}</option>)}
              </select>
            </label>
          )}
        </div>
        <p className="hint">
          {plan.mode === "adhoc"
            ? "Workouts are done in order, on whichever days suit. A missed one stays next up."
            : "Workouts are on set weekdays. The calendar decides the week, and a missed workout stays missed."}
          {plan.weeks.length > 1 && ` After week ${plan.weeks.length}, it goes back to week 1.`}
        </p>
      </section>

      {profile && <UseProgramme draft={draft} profile={profile} />}

      {plan.weeks.map((_, wi) => (
        <section key={wi} className="card week" aria-labelledby={`week-${wi}`}>
          <div className="week-head">
            <h2 id={`week-${wi}`}>{plan.weeks.length > 1 ? `Week ${wi + 1}` : "Every week"}</h2>
            {wi > 0 && (
              <button type="button" className="btn btn-quiet btn-small" onClick={() => update((q) => copyWeek(q, 0, wi))}>
                Copy week 1 here
              </button>
            )}
          </div>
          {plan.mode === "adhoc" ? <AdhocWeek draft={draft} week={wi} /> : <SetDaysWeek draft={draft} week={wi} />}
        </section>
      ))}

      {!draft.isNew && (
        <section className="card danger-zone">
          <h2>Delete programme</h2>
          <p className="hint">
            {runners.length
              ? `${runners.map((r) => r.name).join(" and ")} ${runners.length > 1 ? "are" : "is"} running it, so it can't be deleted.`
              : "Nobody is running it. Sessions already logged keep their own copy."}
          </p>
          <div className="actions actions-start">
            <button type="button" className="btn btn-danger-quiet" disabled={runners.length > 0} onClick={() => setDeleting(true)}>Delete</button>
          </div>
          {deleteError && <p className="problems" role="alert">{deleteError}</p>}
          <Confirm
            open={deleting}
            title={`Delete ${p.name}?`}
            confirmLabel="Delete"
            danger
            onCancel={() => setDeleting(false)}
            onConfirm={() => {
              setDeleting(false);
              deleteProgramme(db, p.id).then(() => go("programme")).catch((e: Error) => setDeleteError(e.message));
            }}
          >
            <p>This can't be undone, except by restoring a backup.</p>
          </Confirm>
        </section>
      )}
    </>
  );
}

/** Putting the current person on this programme, with a start date. The programme's weights are their starting weights. */
function UseProgramme({ draft, profile }: { draft: DraftState; profile: JFDIProfile }) {
  const p = draft.programme!;
  const active = profile.programmes.active;
  const onThis = active?.programme === p.id;
  const [startDate, setStartDate] = useState(active && onThis ? active.startDate : localDate(new Date()));
  const [error, setError] = useState("");
  const [stopping, setStopping] = useState(false);
  const unsaved = draft.dirty || draft.isNew;

  const use = () => {
    setError("");
    assignProgramme(db, profile.id, { programme: p.id, startDate, startingLoads: {}, unavailableEquipment: profile.unavailableEquipment ?? [] })
      .catch((e: unknown) => setError(e instanceof ProfileError ? e.problems.join(" ") : String(e)));
  };

  return (
    <section className="card use-programme" aria-labelledby="use-heading">
      <h2 id="use-heading">{onThis ? `${profile.name} is on this programme` : `Use this programme for ${profile.name}`}</h2>
      {active && !onThis && <p className="hint">This replaces the programme {profile.name} is on now.</p>}
      <div className="use-row">
        <label className="field field-inline">
          <span>{onThis ? "Started" : "Start"} on</span>
          <input type="date" value={startDate} required onChange={(e) => setStartDate(e.target.value)} />
        </label>
        {onThis ? (
          <>
            {startDate !== active!.startDate && <button type="button" className="btn" onClick={use}>Change start date</button>}
            <button type="button" className="btn btn-quiet" onClick={() => setStopping(true)}>Stop using it</button>
          </>
        ) : (
          <button type="button" className="btn btn-you" disabled={unsaved || !startDate} onClick={use}>Use this programme</button>
        )}
      </div>
      {unsaved && !onThis && <p className="hint">Save the programme first.</p>}
      {error && <p className="problems" role="alert">{error}</p>}
      <Confirm
        open={stopping}
        title={`Stop ${p.name} for ${profile.name}?`}
        confirmLabel="Stop using it"
        onCancel={() => setStopping(false)}
        onConfirm={() => { setStopping(false); void stopProgramme(db, profile.id); }}
      >
        <p>The programme stays here, and sessions already logged are kept.</p>
      </Confirm>
    </section>
  );
}

function workoutSummary(p: Programme, id: string) {
  const w = p.workouts.find((x) => x.id === id);
  const n = w ? w.items.reduce((sum, i) => sum + i.slots.length, 0) : 0;
  return { name: w?.name ?? id, count: n ? plural(n, "exercise") : "No exercises yet" };
}

function AdhocWeek({ draft, week }: { draft: DraftState; week: number }) {
  const p = draft.programme!;
  const plan = p.plan as Extract<Programme["plan"], { mode: "adhoc" }>;
  const ids = plan.weeks[week]!.workouts;
  const { update } = draft;
  return (
    <>
      <ol className="days">
        {ids.map((id, d) => {
          const s = workoutSummary(p, id);
          return (
            <li key={`${id}-${d}`} className="day-card">
              <a className="day-open" href={href("programme", p.id, id)}>
                <span className="day-label">Day {d + 1}</span>
                <span className="day-name">{s.name}</span>
                <span className="muted">{s.count}</span>
              </a>
              <span className="day-tools">
                <button type="button" className="icon-btn" aria-label={`Move day ${d + 1} earlier`} disabled={d === 0} onClick={() => update((q) => moveDay(q, week, d, d - 1))}>↑</button>
                <button type="button" className="icon-btn" aria-label={`Move day ${d + 1} later`} disabled={d === ids.length - 1} onClick={() => update((q) => moveDay(q, week, d, d + 1))}>↓</button>
                <button type="button" className="icon-btn" aria-label={`Remove day ${d + 1}`} disabled={ids.length === 1} onClick={() => update((q) => removeDay(q, week, d))}>×</button>
              </span>
            </li>
          );
        })}
      </ol>
      {ids.length < MAX_DAYS && (
        <button type="button" className="btn btn-quiet" onClick={() => update((q) => addDay(q, week))}>+ Add day</button>
      )}
    </>
  );
}

type DayChoice = "workout" | "conditioning" | "rest" | "free";

function SetDaysWeek({ draft, week }: { draft: DraftState; week: number }) {
  const p = draft.programme!;
  const plan = p.plan as Extract<Programme["plan"], { mode: "setDays" }>;
  const days = plan.weeks[week]!.days;
  const { update } = draft;
  const choose = (d: Weekday, c: DayChoice) =>
    update((q) => setDay(q, week, d, c === "conditioning" ? { type: "conditioning", activity: "Walk" } : { type: c }));
  return (
    <ol className="weekdays">
      {WEEKDAYS.map((d) => {
        const day: Day = days[d];
        return (
          <li key={d} className={`weekday weekday-${day.type}`}>
            <span className="day-label">{DAY_NAMES[d]}</span>
            {day.type === "workout" ? (
              <a className="day-open" href={href("programme", p.id, day.workout)}>
                <span className="day-name">{workoutSummary(p, day.workout).name}</span>
                <span className="muted">{workoutSummary(p, day.workout).count}</span>
              </a>
            ) : (
              <span className="day-name muted">{day.type === "conditioning" ? day.activity : day.type === "rest" ? "Rest" : "Free"}</span>
            )}
            <select aria-label={`${DAY_NAMES[d]} is`} value={day.type} onChange={(e) => choose(d, e.target.value as DayChoice)}>
              <option value="workout">Workout</option>
              <option value="conditioning">Walk</option>
              <option value="rest">Rest</option>
              <option value="free">Free</option>
            </select>
          </li>
        );
      })}
    </ol>
  );
}
