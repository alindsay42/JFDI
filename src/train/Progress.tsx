import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { Confirm } from "../shared/Confirm.tsx";
import { formatShortDate, plural } from "../shared/format.ts";
import { go } from "../shared/route.ts";
import { Screen } from "../shared/Screen.tsx";
import { asProgramme } from "../formats/programme.ts";
import { Bodyweight, Calendar, DayLog, LiftProgress } from "./ProgressParts.tsx";
import { db, type SessionRecord } from "../store/db.ts";
import { deleteProfile } from "../store/profiles.ts";

/** One person's progress: the calendar and each day's log, lift charts, bodyweight, and every session. */
export function Progress({ profile }: { profile: JFDIProfile }) {
  const [selected, setSelected] = useState<string | null>(null);
  const data = useLiveQuery(async () => {
    const active = profile.programmes.active;
    const programme = active ? await db.programmes.get(active.programme) : undefined;
    return {
      sessions: await db.sessions.where("profile").equals(profile.id).toArray(),
      days: await db.days.where("profile").equals(profile.id).toArray(),
      weighIns: await db.weighIns.where("profile").equals(profile.id).sortBy("date"),
      programme: programme ? asProgramme(programme) : null,
    };
  }, [profile.id, profile.programmes.active?.programme]);
  const choose = (date: string) => {
    setSelected(date);
    requestAnimationFrame(() => document.getElementById("day-log")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return (
    <Screen profile={profile} route="progress">
      <h1 className="page-title">{profile.name}'s progress</h1>
      {data && (
        <>
          <Calendar profile={profile} data={data} selected={selected} choose={choose} />
          {selected && <DayLog profile={profile} date={selected} data={data} close={() => setSelected(null)} />}
          <LiftProgress profile={profile} sessions={data.sessions} />
          <Bodyweight profile={profile} weighIns={data.weighIns} />
        </>
      )}
      <SessionList profileId={profile.id} choose={choose} />
      <DeletePerson profile={profile} />
    </Screen>
  );
}

const READINESS: Record<string, string> = { green: "Green", amber: "Amber", red: "Red" };

function SessionList({ profileId, choose }: { profileId: string; choose: (date: string) => void }) {
  const sessions = useLiveQuery(() => db.sessions.where("profile").equals(profileId).reverse().sortBy("startedAt"), [profileId]);
  const counts = useLiveQuery(
    async () => ({
      days: await db.days.where("profile").equals(profileId).count(),
      weighIns: await db.weighIns.where("profile").equals(profileId).count(),
    }),
    [profileId],
  );
  const [all, setAll] = useState(false);
  if (!sessions || !counts) return null;
  const shown = all ? sessions : sessions.slice(0, 10);
  return (
    <section className="card" aria-labelledby="history-heading">
      <h2 id="history-heading">All sessions</h2>
      {sessions.length === 0 && counts.days === 0 && counts.weighIns === 0 ? (
        <p className="hint">Nothing logged yet. Sessions you log, or import from Rebuild Log on the Backup tab, show here.</p>
      ) : (
        <>
          <p>{plural(sessions.length, "session")}, {plural(counts.days, "day")} with a check-in or walk, {plural(counts.weighIns, "weigh-in")}.</p>
          <ul className="history">
            {shown.map((s) => <HistoryRow key={s.id} s={s} open={() => choose(s.date)} />)}
          </ul>
          {sessions.length > shown.length && (
            <button type="button" className="btn btn-quiet" onClick={() => setAll(true)}>Show all {sessions.length}</button>
          )}
        </>
      )}
    </section>
  );
}

function HistoryRow({ s, open }: { s: SessionRecord; open: () => void }) {
  const done = s.exercises.filter((e) => !e.removed).length;
  return (
    <li className="history-row" onClick={open} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") open(); }}>
      <span className="history-date">{formatShortDate(s.date)}</span>
      <span className="history-name">
        {s.session.name}
        {s.session.subtitle && <span className="muted"> · {s.session.subtitle}</span>}
      </span>
      <span className="history-meta">
        {s.readiness && <span className={`dot dot-${s.readiness}`} title={READINESS[s.readiness]} aria-label={`${READINESS[s.readiness]} day`} />}
        {plural(done, "exercise")}
        {s.endedEarly && <span className="tag">Ended early</span>}
        {s.importedFrom === "rebuild-log" && <span className="tag">Rebuild Log</span>}
      </span>
    </li>
  );
}

function DeletePerson({ profile }: { profile: JFDIProfile }) {
  const [asking, setAsking] = useState(false);
  return (
    <section className="card danger-zone">
      <h2>Remove {profile.name}</h2>
      <p className="hint">Removes {profile.name} and everything they've logged from this device. A backup made before still has it.</p>
      <div className="actions actions-start">
        <button type="button" className="btn btn-danger-quiet" onClick={() => setAsking(true)}>Remove {profile.name}</button>
      </div>
      <Confirm
        open={asking}
        title={`Remove ${profile.name}?`}
        confirmLabel={`Remove ${profile.name}`}
        danger
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          void deleteProfile(db, profile.id).then(() => go("who"));
        }}
      >
        <p>Their setup and every session, check-in and weigh-in will be deleted from this device. This can't be undone, except by restoring a backup.</p>
      </Confirm>
    </section>
  );
}
