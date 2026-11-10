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
  addDay, amberChoices, copyWeek, MAX_DAYS, MAX_WEEKS, moveDay, removeDay, setAmber, setCheck48h, setCheckStyle, setDay,
  setLevelDescription, setMinRestDays, setMode, setWeekCount, type AmberChoices, type CheckStyle,
  DEFAULT_DELOAD, deloadOf, setDeload, setWeightsMode, type DeloadChoices,
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
      {/* Saving is for the whole programme, so it's on the plan; a workout has Done instead */}
      {!workout && <SaveBar draft={draft} />}
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

function SaveBar({ draft }: { draft: DraftState }) {
  const [asking, setAsking] = useState(false);
  if (draft.justSaved) return <div className="saved-bar" role="status">Saved.</div>;
  if (!draft.dirty && !draft.problems.length) return null;
  return (
    <div className="save-bar" role="region" aria-label="Unsaved changes">
      <span>{draft.isNew ? "Not saved yet." : "Unsaved changes."}</span>
      <button type="button" className="btn btn-quiet" onClick={() => setAsking(true)}>Discard</button>
      <button type="button" className="btn btn-you" onClick={() => void draft.save()}>Save</button>
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

      <Weights draft={draft} />
      <Deloads draft={draft} />
      <DailyCheck draft={draft} />

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

const STYLES: Array<[CheckStyle, string]> = [["off", "Off"], ["freshness", "On"]];

/** The Green / Amber / Red check before each workout, and what Amber and Red do. */
function DailyCheck({ draft }: { draft: DraftState }) {
  const p = draft.programme!;
  const { update } = draft;
  const levels = p.readiness.levels;
  const on = p.readiness.preset !== "off" && !!levels;
  const amber = amberChoices(p);
  const setA = (c: Partial<AmberChoices>) => update((q) => setAmber(q, { ...amberChoices(q), ...c }));
  const hasMain = p.workouts.some((w) => w.items.some((i) => i.tier === "primary"));
  const hasExtra = p.workouts.some((w) => w.items.some((i) => i.tier === "tertiary"));

  return (
    <section className="card daily-check" aria-labelledby="check-heading">
      <h2 id="check-heading">Daily check</h2>
      <p className="hint">Before each workout, pick Green, Amber or Red for how you feel that day. Green is the workout in full. Amber is for a day you're less able, whatever the reason, and makes it easier. Red moves it to next time. Each workout records which it was.</p>
      <fieldset className="segmented" aria-label="Daily check">
        <legend>Daily check</legend>
        {STYLES.map(([style, label]) => (
          <label key={style}>
            <input type="radio" name="check-style" checked={style === "off" ? !on : on} onChange={() => update((q) => setCheckStyle(q, style))} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      {on && (
        <>
          <div className="check-level check-green">
            <h3>Green</h3>
            <Wording level="green" text={levels.green.description} draft={draft} />
            <p className="hint">The workout as written.</p>
          </div>

          <div className="check-level check-amber">
            <h3>Amber</h3>
            <Wording level="amber" text={levels.amber.description} draft={draft} />
            <div className="check-list">
              <label className="check">
                <input type="checkbox" checked={amber.halveAll} onChange={(e) => setA({ halveAll: e.target.checked })} />
                <span>Halve every exercise's sets</span>
              </label>
              <span className="check">
                <input type="checkbox" aria-label="Main exercises down to fewer sets" checked={amber.mainSets !== null}
                  onChange={(e) => setA({ mainSets: e.target.checked ? 3 : null })} />
                <span>Main exercises down to</span>
                <select aria-label="Sets for main exercises on Amber" value={amber.mainSets ?? 3} disabled={amber.mainSets === null}
                  onChange={(e) => setA({ mainSets: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span>sets</span>
              </span>
              <label className="check">
                <input type="checkbox" checked={amber.dropExtras} onChange={(e) => setA({ dropExtras: e.target.checked })} />
                <span>Drop the extras</span>
              </label>
              <span className="check">
                <input type="checkbox" aria-label="Leave more reps in the tank" checked={amber.rir !== null}
                  onChange={(e) => setA({ rir: e.target.checked ? 2 : null })} />
                <span>Leave</span>
                <select aria-label="Reps to leave in the tank on Amber" value={amber.rir ?? 2} disabled={amber.rir === null}
                  onChange={(e) => setA({ rir: Number(e.target.value) })}>
                  {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span>more reps in the tank</span>
              </span>
            </div>
            <fieldset className="segmented" aria-label="After an Amber workout">
              <legend>After an Amber workout</legend>
              <label><input type="radio" name="amber-after" checked={!amber.hold} onChange={() => setA({ hold: false })} /><span>Progress as normal</span></label>
              <label><input type="radio" name="amber-after" checked={amber.hold} onChange={() => setA({ hold: true })} /><span>Repeat the weights</span></label>
            </fieldset>
            {(amber.mainSets !== null && !hasMain) || (amber.dropExtras && !hasExtra) ? (
              <p className="hint">
                Mark exercises {[amber.mainSets !== null && !hasMain && "Main", amber.dropExtras && !hasExtra && "Extra"].filter(Boolean).join(" or ")} in each workout for this to do anything.
              </p>
            ) : null}
          </div>

          <div className="check-level check-red">
            <h3>Red</h3>
            <Wording level="red" text={levels.red.description} draft={draft} />
            <p className="hint">No lifting. The workout moves to next time.</p>
          </div>

          <label className="check">
            <input type="checkbox" checked={!!p.readiness.check48h} onChange={(e) => update((q) => setCheck48h(q, e.target.checked))} />
            <span>48-hour check: the day after each workout, ask how you've felt since. It's kept in the log and doesn't change the workout.</span>
          </label>
        </>
      )}
    </section>
  );
}

function Wording({ level, text, draft }: { level: "green" | "amber" | "red"; text: string; draft: DraftState }) {
  const name = level[0]!.toUpperCase() + level.slice(1);
  return (
    <label className="field">
      <span>What {name} means</span>
      <input value={text} maxLength={200} onChange={(e) => draft.update((q) => setLevelDescription(q, level, e.target.value))} />
    </label>
  );
}

/** Whether the app suggests the next weight, or shows last time's and leaves going up to the person. */
function Weights({ draft }: { draft: DraftState }) {
  const p = draft.programme!;
  const repeat = p.weights === "repeat";
  return (
    <section className="card" aria-labelledby="weights-heading">
      <h2 id="weights-heading">Weights</h2>
      <div className="choice-list">
        <label className="check">
          <input type="radio" name="weights" checked={!repeat} onChange={() => draft.update((q) => setWeightsMode(q, "progress"))} />
          <span><strong>Suggest the next step.</strong> When you hit your reps, the next workout adds weight. Miss them and it stays the same.</span>
        </label>
        <label className="check">
          <input type="radio" name="weights" checked={repeat} onChange={() => draft.update((q) => setWeightsMode(q, "repeat"))} />
          <span><strong>Show what I did last time.</strong> The target is last time's weight, and you decide when to go up.</span>
        </label>
      </div>
      <p className="hint">Either way, you can change the weight on the day, and each set shows what you did last time.</p>
    </section>
  );
}

const PERCENTS = [30, 40, 50, 60, 70, 80, 90];

/** Deload weeks: started from Today when you choose, every few weeks, or both; and how much lighter. */
function Deloads({ draft }: { draft: DraftState }) {
  const p = draft.programme!;
  const d = deloadOf(p);
  const set = (c: Partial<DeloadChoices>) => draft.update((q) => setDeload(q, { onDemand: false, everyWeeks: null, ...DEFAULT_DELOAD, ...(deloadOf(q) ?? {}), ...c }));
  return (
    <section className="card" aria-labelledby="deload-heading">
      <h2 id="deload-heading">Deload weeks</h2>
      <p className="hint">A lighter week to recover, usually when you've stopped making progress. Afterwards, weights pick up from where they were before it.</p>
      <div className="check-list">
        <label className="check">
          <input type="checkbox" checked={!!d?.onDemand} onChange={(e) => set({ onDemand: e.target.checked })} />
          <span>Let me start a deload week from Today</span>
        </label>
        <span className="check">
          <input type="checkbox" aria-label="Deload on a schedule" checked={!!d?.everyWeeks} onChange={(e) => set({ everyWeeks: e.target.checked ? 6 : null })} />
          <span>Every</span>
          <select aria-label="Weeks between deloads" value={d?.everyWeeks ?? 6} disabled={!d?.everyWeeks} onChange={(e) => set({ everyWeeks: Number(e.target.value) })}>
            {[3, 4, 5, 6, 7, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>weeks</span>
        </span>
      </div>
      {d && (
        <div className="check-list">
          <span className="check">
            <span>Weights at</span>
            <select aria-label="Deload weight, percent of normal" value={d.loadPercent} onChange={(e) => set({ loadPercent: Number(e.target.value) })}>
              {PERCENTS.map((n) => <option key={n} value={n}>{n}%</option>)}
            </select>
            <span>of normal, sets at</span>
            <select aria-label="Deload sets, percent of normal" value={d.setsPercent} onChange={(e) => set({ setsPercent: Number(e.target.value) })}>
              {PERCENTS.map((n) => <option key={n} value={n}>{n}%</option>)}
            </select>
          </span>
        </div>
      )}
    </section>
  );
}
