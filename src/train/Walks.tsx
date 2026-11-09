// Logging walks: from Today, and on any day's log in Progress.
import { useState, type FormEvent } from "react";
import type { DayRecord } from "../store/db.ts";
import { db } from "../store/db.ts";
import { addWalk, removeActivity } from "../store/progress.ts";

export function activityText(a: NonNullable<DayRecord["activities"]>[number]): string {
  const name = a.exercise === "walk" ? "Walk" : a.exercise.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
  return `${name}${a.minutes ? `, ${a.minutes} minutes` : ""}${a.kg ? `, ${a.kg}kg` : ""}`;
}

/** The walks logged on a day, each with ×, and a way to add one. `planned` puts the form in view straight away. */
export function Walks({ profile, date, day, planned, minutes }: {
  profile: string; date: string; day: DayRecord | undefined; planned?: boolean; minutes?: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(String(minutes ?? 30));
  const [error, setError] = useState("");
  const value = Number(text);
  const walks = day?.activities ?? [];
  const showForm = open || (planned && !walks.length);

  const save = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    addWalk(db, profile, date, value).then(() => setOpen(false)).catch((err: Error) => setError(err.message));
  };

  return (
    <div className="walks">
      {walks.length > 0 && (
        <ul className="walk-list">
          {walks.map((a, i) => (
            <li key={i}>
              <span>{activityText(a)}</span>
              <button type="button" className="icon-btn set-remove" aria-label={`Remove ${activityText(a)}`} onClick={() => void removeActivity(db, profile, date, i)}>×</button>
            </li>
          ))}
        </ul>
      )}
      {showForm ? (
        <form className="goal-form" onSubmit={save}>
          <label className="field field-inline"><span>Walk</span>
            <span className="num-field"><input aria-label="Walk minutes" inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} /><span aria-hidden="true">min</span></span>
          </label>
          {open && <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>Cancel</button>}
          <button type="submit" className={planned ? "btn btn-you" : "btn"} disabled={!(value > 0)}>Log walk</button>
        </form>
      ) : (
        <div className="actions actions-start">
          <button type="button" className="btn btn-quiet btn-small" onClick={() => setOpen(true)}>{walks.length ? "Add another walk" : "Log a walk"}</button>
        </div>
      )}
      {error && <p className="problems" role="alert">{error}</p>}
    </div>
  );
}
