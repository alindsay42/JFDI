import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { backupDue } from "../store/backup.ts";
import { db } from "../store/db.ts";
import { addProfile, PROFILE_COLOURS, setCurrentProfileId } from "../store/profiles.ts";
import { go } from "./route.ts";
import { cssVar } from "./style.ts";
import { Version } from "./Version.tsx";

interface Props {
  profiles: JFDIProfile[];
  currentId: string | null;
}

async function choose(id: string) {
  await setCurrentProfileId(db, id);
  go("today");
}

export function WhoIsTraining({ profiles, currentId }: Props) {
  const [adding, setAdding] = useState(profiles.length === 0);

  return (
    <main className="who">
      <header className="who-head">
        <h1 className="brand">J.F.D.I</h1>
        <p className="who-question">{profiles.length ? "Who's training?" : "Add the first person to get started."}</p>
      </header>

      {profiles.length > 0 && (
        <ul className="people" aria-label="People">
          {profiles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="person"
                style={cssVar("--you", p.colour)}
                aria-current={p.id === currentId ? "true" : undefined}
                onClick={() => void choose(p.id)}
              >
                <span className="person-initial" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="person-name">{p.name}</span>
              </button>
            </li>
          ))}
          {!adding && (
            <li>
              <button type="button" className="person person-add" onClick={() => setAdding(true)}>
                <span className="person-initial" aria-hidden="true">+</span>
                <span className="person-name">Add person</span>
              </button>
            </li>
          )}
        </ul>
      )}

      {adding && <AddPerson onCancel={profiles.length ? () => setAdding(false) : undefined} />}

      <BackupReminder />

      <p className="who-links">
        <a href="#/data">{profiles.length ? "Backup, restore and import" : "Restore a backup instead"}</a>
      </p>

      <Version />
    </main>
  );
}

function AddPerson({ onCancel }: { onCancel: (() => void) | undefined }) {
  const [name, setName] = useState("");
  const [colour, setColour] = useState<string>(PROFILE_COLOURS[0].hex);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const p = await addProfile(db, name, colour);
      await choose(p.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card add-person" onSubmit={(e) => void submit(e)} style={cssVar("--you", colour)}>
      <h2>Add person</h2>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={40} required />
      </label>
      <fieldset className="field">
        <legend>Colour</legend>
        <p className="hint">Shown on every screen, so nobody logs into the wrong person.</p>
        <div className="swatches">
          {PROFILE_COLOURS.map((c) => (
            <label key={c.hex} className="swatch" style={cssVar("--swatch", c.hex)}>
              <input type="radio" name="colour" value={c.hex} checked={colour === c.hex} onChange={() => setColour(c.hex)} />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="actions">
        {onCancel && <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-you" disabled={!name.trim() || busy}>Add</button>
      </div>
    </form>
  );
}

function BackupReminder() {
  const due = useLiveQuery(async () => {
    const [change, backup] = await db.settings.bulkGet(["lastChangeAt", "lastBackupAt"]);
    return backupDue((backup?.value as string) ?? null, (change?.value as string) ?? null);
  });
  if (!due) return null;
  return (
    <div className="reminder" role="status">
      <span>It's been a while since the last backup.</span>
      <a className="btn" href="#/data">Back up now</a>
    </div>
  );
}
