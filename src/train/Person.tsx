import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import type { JFDIProfile, StartingLoad } from "../formats/generated/profile.ts";
import type { JFDIProgrammeFile } from "../formats/generated/programme.ts";
import { Confirm } from "../shared/Confirm.tsx";
import { daysUntil, formatKg, formatLongDate, formatShortDate, plural } from "../shared/format.ts";
import { go } from "../shared/route.ts";
import { Screen } from "../shared/Screen.tsx";
import { db, type SessionRecord } from "../store/db.ts";
import { deleteProfile } from "../store/profiles.ts";
import { assignProgramme, defaultStartingLoads, localDate, ProfileError } from "../store/programmes.ts";

export function Person({ profile }: { profile: JFDIProfile }) {
  const programmes = useLiveQuery(() => db.programmes.toArray());
  const [editing, setEditing] = useState(false);
  const active = profile.programmes.active;
  const programme = programmes?.find((p) => p.id === active?.programme);

  return (
    <Screen profile={profile} route="person">
      <h1 className="page-title">{profile.name}</h1>

      <section className="card" aria-labelledby="programme-heading">
        <h2 id="programme-heading">Programme</h2>
        {programmes === undefined ? null : editing ? (
          <ProgrammeForm profile={profile} programmes={programmes} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
        ) : !active ? (
          <>
            <p>No programme yet.</p>
            <div className="actions actions-start">
              <button type="button" className="btn btn-you" onClick={() => setEditing(true)}>Set up a programme</button>
            </div>
          </>
        ) : (
          <ProgrammeSummary profile={profile} programme={programme} onChange={() => setEditing(true)} />
        )}
      </section>

      <History profileId={profile.id} />

      <DeletePerson profile={profile} />
    </Screen>
  );
}

function ProgrammeSummary({ profile, programme, onChange }: { profile: JFDIProfile; programme?: JFDIProgrammeFile; onChange: () => void }) {
  const active = profile.programmes.active!;
  const names = new Map(programme?.exercises.map((e) => [e.id, e.name]));
  const loads = Object.entries(active.startingLoads ?? {});
  const days = daysUntil(active.startDate, localDate(new Date()));
  return (
    <>
      <p className="lead">{programme?.name ?? active.programme}</p>
      <p>{days > 0 ? "Starts" : "Started"} {formatLongDate(active.startDate)}</p>
      {loads.length > 0 && (
        <table className="loads">
          <caption>Starting weights</caption>
          <tbody>
            {loads.map(([id, l]) => (
              <tr key={id}>
                <th scope="row">{names.get(id) ?? id}</th>
                <td>{formatKg(l.kg)}</td>
                <td className="muted">{setsReps(l)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="actions actions-start">
        <button type="button" className="btn btn-quiet" onClick={onChange}>Change setup</button>
      </div>
    </>
  );
}

const setsReps = (l: StartingLoad) => (l.sets && l.reps ? `${l.sets} × ${l.reps}` : l.reps ? `${l.reps} reps` : "");

function ProgrammeForm({
  profile, programmes, onDone, onCancel,
}: {
  profile: JFDIProfile;
  programmes: JFDIProgrammeFile[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const active = profile.programmes.active;
  const [programmeId, setProgrammeId] = useState(active?.programme ?? programmes[0]?.id ?? "");
  const programme = programmes.find((p) => p.id === programmeId);
  const [startDate, setStartDate] = useState(active?.startDate ?? localDate(new Date()));
  const initialLoads = (p: JFDIProgrammeFile | undefined) => {
    const loads = p ? defaultStartingLoads(p) : {};
    if (active && p && active.programme === p.id) Object.assign(loads, active.startingLoads);
    return Object.fromEntries(
      Object.entries(loads).map(([id, l]) => [id, { note: l.note, kg: String(l.kg), sets: String(l.sets ?? ""), reps: String(l.reps ?? "") }]),
    );
  };
  const [loads, setLoads] = useState(() => initialLoads(programme));
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const names = new Map(programme?.exercises.map((e) => [e.id, e.name]));
  const wholeNumber = (t: string) => /^\d+$/.test(t) && Number(t) >= 1;
  const bad = (l: LoadText) => ({ kg: !(Number(l.kg) > 0), sets: !wholeNumber(l.sets), reps: !wholeNumber(l.reps) });
  const badLoads = Object.entries(loads).filter(([, l]) => Object.values(bad(l)).some(Boolean)).map(([id]) => id);
  const edit = (id: string, field: keyof LoadText, value: string) =>
    setLoads({ ...loads, [id]: { ...loads[id]!, [field]: field === "kg" ? value.replace(",", ".") : value.trim() } });

  function chooseProgramme(id: string) {
    setProgrammeId(id);
    setLoads(initialLoads(programmes.find((p) => p.id === id)));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (badLoads.length || busy) return;
    setBusy(true);
    setProblems([]);
    try {
      const startingLoads = Object.fromEntries(
        Object.entries(loads).map(([id, l]) => {
          const load: StartingLoad = { kg: Number(l.kg), sets: Number(l.sets), reps: Number(l.reps) };
          if (l.note) load.note = l.note;
          return [id, load];
        }),
      );
      await assignProgramme(db, profile.id, {
        programme: programmeId,
        startDate,
        startingLoads,
        unavailableEquipment: profile.unavailableEquipment ?? [],
      });
      onDone();
    } catch (err) {
      setProblems(err instanceof ProfileError ? err.problems : [String(err)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} className="programme-form">
      <label className="field">
        <span>Programme</span>
        <select value={programmeId} onChange={(e) => chooseProgramme(e.target.value)}>
          {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {programme?.description && <span className="hint">{programme.description}</span>}
      </label>

      <label className="field field-narrow">
        <span>Start date</span>
        <input type="date" value={startDate} required onChange={(e) => setStartDate(e.target.value)} />
      </label>

      <fieldset className="field">
        <legend>Starting weights</legend>
        <p className="hint">Total weight, bar included, with sets and reps. Used for each lift's first session; after that the app works it out.</p>
        <div className="load-rows">
          {Object.entries(loads).map(([id, l]) => {
            const name = names.get(id) ?? id;
            const b = bad(l);
            return (
              <div key={id} className="load-row" role="group" aria-label={name}>
                <span className="load-name">{name}</span>
                <span className="load-input">
                  <input inputMode="decimal" aria-label={`${name} weight`} value={l.kg} aria-invalid={b.kg || undefined} onChange={(e) => edit(id, "kg", e.target.value)} />
                  <span aria-hidden="true">kg</span>
                </span>
                <span className="load-input">
                  <input className="small" inputMode="numeric" aria-label={`${name} sets`} value={l.sets} aria-invalid={b.sets || undefined} onChange={(e) => edit(id, "sets", e.target.value)} />
                  <span aria-hidden="true">sets ×</span>
                  <input className="small" inputMode="numeric" aria-label={`${name} reps`} value={l.reps} aria-invalid={b.reps || undefined} onChange={(e) => edit(id, "reps", e.target.value)} />
                  <span aria-hidden="true">reps</span>
                </span>
              </div>
            );
          })}
        </div>
        {badLoads.length > 0 && <p className="hint">Each lift needs a weight, and whole numbers for sets and reps.</p>}
      </fieldset>

      {problems.length > 0 && (
        <div className="problems" role="alert">
          <p>This setup can't be saved:</p>
          <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-you" disabled={busy || badLoads.length > 0 || !programmeId}>Save</button>
      </div>
    </form>
  );
}

interface LoadText {
  kg: string;
  sets: string;
  reps: string;
  note?: string;
}

const READINESS: Record<string, string> = { green: "Green", amber: "Amber", red: "Red" };

function History({ profileId }: { profileId: string }) {
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
      <h2 id="history-heading">History</h2>
      {sessions.length === 0 && counts.days === 0 && counts.weighIns === 0 ? (
        <p className="hint">Nothing logged yet. Sessions you log, or import from Rebuild Log on the Backup tab, show here.</p>
      ) : (
        <>
          <p>{plural(sessions.length, "session")}, {plural(counts.days, "day")} with a check-in or walk, {plural(counts.weighIns, "weigh-in")}.</p>
          <ul className="history">
            {shown.map((s) => <HistoryRow key={s.id} s={s} />)}
          </ul>
          {sessions.length > shown.length && (
            <button type="button" className="btn btn-quiet" onClick={() => setAll(true)}>Show all {sessions.length}</button>
          )}
        </>
      )}
    </section>
  );
}

function HistoryRow({ s }: { s: SessionRecord }) {
  const done = s.exercises.filter((e) => !e.removed).length;
  return (
    <li className="history-row">
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
