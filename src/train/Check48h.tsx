// "How have you felt since that workout?", asked from the day after a workout when the programme has the 48-hour check on.
// A wrong tap can be changed straight away, or later from the day's log on Progress.
import { useState } from "react";
import type { Programme } from "../formats/programme.ts";
import type { SessionRecord } from "../store/db.ts";
import { db } from "../store/db.ts";
import { localDate } from "../store/programmes.ts";
import { answerCheck48h, type CheckAnswer } from "../store/progress.ts";

export const CHECK_ANSWERS: Array<[CheckAnswer, string]> = [["same", "Fine"], ["settling", "A bit worn but settling"], ["worse", "Clearly worse"]];
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" });

/** The workout to ask about: the latest one done on this programme, from the day after it. */
export function dueCheck(p: Programme, sessions: SessionRecord[], today: string): SessionRecord | null {
  if (p.readiness.preset === "off" || !p.readiness.check48h) return null;
  const latest = sessions
    .filter((s) => s.status === "done" && s.programme?.id === p.id)
    .sort((a, b) => ((a.finishedAt ?? a.date) < (b.finishedAt ?? b.date) ? 1 : -1))[0];
  return latest && latest.date < today ? latest : null;
}

export function Check48h({ p, sessions, now }: { p: Programme; sessions: SessionRecord[]; now: Date }) {
  const today = localDate(now);
  const s = dueCheck(p, sessions, today);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");
  if (!s) return null;
  const answered = s.check48h ?? null;
  // Once answered, it stays on screen for the rest of that day, so a wrong tap is easy to put right
  if (answered && (localDate(new Date(answered.at)) !== today) && !changing) return null;
  const when = weekday.format(new Date(`${s.date}T12:00:00`));
  const name = `${when}'s ${s.session.name}`;
  const answer = (status: CheckAnswer) => {
    setError("");
    answerCheck48h(db, s.profile, s.id, status, now).then(() => setChanging(false)).catch((e: Error) => setError(e.message));
  };

  if (answered && !changing) {
    return (
      <section className="card check48-done" aria-label="48-hour check">
        <p>
          {name}: <strong>{CHECK_ANSWERS.find(([k]) => k === answered.status)![1]}</strong>.
        </p>
        <button type="button" className="btn btn-quiet btn-small" onClick={() => setChanging(true)}>Change</button>
      </section>
    );
  }
  return (
    <section className="card check48" aria-labelledby="check48-heading">
      <h2 id="check48-heading">How have you felt since {name}?</h2>
      <p className="hint">Compared with before it.</p>
      <div className="check48-options">
        {CHECK_ANSWERS.map(([k, label]) => (
          <button key={k} type="button" className={`btn check48-${k}${answered?.status === k ? " is-current" : ""}`} onClick={() => answer(k)}>{label}</button>
        ))}
      </div>
      {changing && <div className="actions actions-start"><button type="button" className="btn btn-quiet btn-small" onClick={() => setChanging(false)}>Cancel</button></div>}
      {error && <p className="problems" role="alert">{error}</p>}
    </section>
  );
}
