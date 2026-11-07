import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState, type ReactNode } from "react";
import type { JFDIBackup } from "../formats/generated/backup.ts";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import {
  BackupError, backupFileName, buildBackup, importRebuildLog, parseBackup, recordBackup, restoreBackup, type ImportSummary,
} from "../store/backup.ts";
import { db } from "../store/db.ts";
import { Confirm } from "./Confirm.tsx";
import { formatDateTime, plural } from "./format.ts";
import { PlainScreen, Screen } from "./Screen.tsx";
import { APP } from "./Version.tsx";

type Outcome = { kind: "ok"; text: ReactNode } | { kind: "error"; text: string; problems?: string[] };

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function failure(err: unknown): Outcome {
  if (err instanceof BackupError) return { kind: "error", text: err.message, problems: err.problems };
  return { kind: "error", text: `Something went wrong: ${String(err)}` };
}

/** Backup, restore and import. Reachable with no one selected, so a new tablet can be restored. */
export function Data({ profile, profiles }: { profile: JFDIProfile | undefined; profiles: JFDIProfile[] }) {
  const body = (
    <>
      <BackupSection />
      <RestoreSection />
      <ImportSection profiles={profiles} defaultProfile={profile?.id} />
    </>
  );
  return profile ? (
    <Screen profile={profile} route="data">
      <h1 className="page-title">Backup</h1>
      {body}
    </Screen>
  ) : (
    <PlainScreen title="Backup">{body}</PlainScreen>
  );
}

function Result({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) return null;
  return outcome.kind === "ok" ? (
    <div className="result result-ok" role="status">{outcome.text}</div>
  ) : (
    <div className="problems" role="alert">
      <p>{outcome.text}</p>
      {outcome.problems && outcome.problems.length > 0 && (
        <details>
          <summary>{plural(outcome.problems.length, "problem")}</summary>
          <ul>{outcome.problems.slice(0, 50).map((p) => <li key={p}>{p}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

function FileButton({ label, onFile, disabled }: { label: string; onFile: (text: string) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn" disabled={disabled} onClick={() => input.current?.click()}>{label}</button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        data-testid={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void file.text().then(onFile);
        }}
      />
    </>
  );
}

function BackupSection() {
  const last = useLiveQuery(async () => (await db.settings.get("lastBackupAt"))?.value as string | undefined);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  async function save() {
    try {
      const now = new Date();
      const backup = await buildBackup(db, APP, now);
      download(backupFileName(now), JSON.stringify(backup, null, 1));
      await recordBackup(db, now);
      setOutcome({ kind: "ok", text: <>Saved <strong>{backupFileName(now)}</strong> to Downloads. Keep a copy somewhere other than this tablet.</> });
    } catch (err) {
      setOutcome(failure(err));
    }
  }
  return (
    <section className="card" aria-labelledby="backup-heading">
      <h2 id="backup-heading">Save a backup</h2>
      <p>One file with everyone's setup and history.</p>
      <p className="hint">Last backup: {last ? formatDateTime(last) : "never"}</p>
      <div className="actions actions-start">
        <button type="button" className="btn btn-you" onClick={() => void save()}>Save a backup</button>
      </div>
      <Result outcome={outcome} />
    </section>
  );
}

function RestoreSection() {
  const [pending, setPending] = useState<JFDIBackup | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const sessions = pending?.logs.reduce((n, l) => n + l.sessions.length, 0) ?? 0;
  return (
    <section className="card" aria-labelledby="restore-heading">
      <h2 id="restore-heading">Restore a backup</h2>
      <p>Replaces everything on this device with a J.F.D.I backup file. Use it to move to a new tablet, or to go back to an earlier backup.</p>
      <div className="actions actions-start">
        <FileButton
          label="Choose a backup to restore"
          onFile={(text) => {
            setOutcome(null);
            try { setPending(parseBackup(text)); } catch (err) { setOutcome(failure(err)); }
          }}
        />
      </div>
      <Result outcome={outcome} />
      <Confirm
        open={pending !== null}
        title="Replace everything with this backup?"
        confirmLabel="Replace everything"
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const b = pending!;
          setPending(null);
          restoreBackup(db, b)
            .then(() => setOutcome({ kind: "ok", text: `Restored the backup from ${formatDateTime(b.exportedAt)}.` }))
            .catch((err) => setOutcome(failure(err)));
        }}
      >
        {pending && (
          <p>
            The backup from <strong>{formatDateTime(pending.exportedAt)}</strong> has {plural(pending.profiles.length, "person", "people")}
            {pending.profiles.length > 0 && ` (${pending.profiles.map((p) => p.name).join(", ")})`} and {plural(sessions, "session")}.
            Everything on this device now will be replaced.
          </p>
        )}
      </Confirm>
    </section>
  );
}

function ImportSection({ profiles, defaultProfile }: { profiles: JFDIProfile[]; defaultProfile: string | undefined }) {
  const [who, setWho] = useState(defaultProfile ?? profiles[0]?.id ?? "");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const person = profiles.find((p) => p.id === who);
  return (
    <section className="card" aria-labelledby="import-heading">
      <h2 id="import-heading">Import from Rebuild Log</h2>
      <p>Brings sessions, walks, check-ins and weigh-ins from a Rebuild Log backup into one person's history. Safe to repeat later with a newer backup: nothing is doubled.</p>
      {profiles.length === 0 ? (
        <p className="hint">Add a person first.</p>
      ) : (
        <>
          <label className="field field-narrow">
            <span>Whose history</span>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="actions actions-start">
            <FileButton
              label="Choose a Rebuild Log backup"
              disabled={busy || !person}
              onFile={(text) => {
                setBusy(true);
                setOutcome(null);
                importRebuildLog(db, who, text)
                  .then((s) => setOutcome({ kind: "ok", text: <ImportResult name={person!.name} s={s} /> }))
                  .catch((err) => setOutcome(failure(err)))
                  .finally(() => setBusy(false));
              }}
            />
          </div>
        </>
      )}
      <Result outcome={outcome} />
    </section>
  );
}

function ImportResult({ name, s }: { name: string; s: ImportSummary }) {
  return (
    <>
      <p>
        Imported into {name}'s history: {plural(s.sessionsAdded, "new session")}
        {s.sessionsUpdated > 0 && `, ${s.sessionsUpdated} updated`}, {plural(s.daysAdded, "day")}, {plural(s.weighInsAdded, "weigh-in")}.
        {s.skipped > 0 && ` ${plural(s.skipped, "entry", "entries")} already there, left as they were.`}
      </p>
      {s.problems.length > 0 && (
        <>
          <p>Couldn't bring across:</p>
          <ul>{s.problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </>
      )}
    </>
  );
}
