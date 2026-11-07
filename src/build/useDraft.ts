import { useEffect, useRef, useState } from "react";
import { asProgramme, type Programme } from "../formats/programme.ts";
import { discardDraft, getDraft, putDraft, saveProgramme, SaveError } from "../store/build.ts";
import { db } from "../store/db.ts";

export interface DraftState {
  programme: Programme | null;
  /** False until loading is done; null programme after that means it doesn't exist */
  loaded: boolean;
  /** There are unsaved changes */
  dirty: boolean;
  /** Never saved before */
  isNew: boolean;
  problems: string[];
  /** Saved since the last change, to show a confirmation */
  justSaved: boolean;
  update: (change: (p: Programme) => Programme) => void;
  save: () => Promise<boolean>;
  discard: () => Promise<void>;
}

/**
 * The programme being edited. Every change is written to its draft straight away, so nothing is lost if
 * the tablet sleeps or the app closes; Save checks it and makes it the real version.
 */
export function useDraft(id: string): DraftState {
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [basedOn, setBasedOn] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const latest = useRef<Programme | null>(null);
  // The last saved version: edits that end up back where it started aren't unsaved changes.
  const saved = useRef<Programme | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [draft, stored] = await Promise.all([getDraft(db, id), db.programmes.get(id)]);
      if (!live) return;
      saved.current = stored ? asProgramme(stored) : null;
      const p = draft?.programme ?? saved.current;
      latest.current = p;
      setProgramme(p);
      setBasedOn(draft ? draft.basedOn : (stored?.updatedAt ?? null));
      setDirty(!!draft && !sameProgramme(draft.programme, saved.current));
      setLoaded(true);
    })();
    return () => { live = false; };
  }, [id]);

  const update = (change: (p: Programme) => Programme) => {
    const current = latest.current;
    if (!current) return;
    const next = change(current);
    if (next === current) return;
    latest.current = next;
    setProgramme(next);
    setProblems([]);
    setJustSaved(false);
    if (sameProgramme(next, saved.current)) {
      setDirty(false);
      void discardDraft(db, id);
    } else {
      setDirty(true);
      void putDraft(db, { programme: next, basedOn });
    }
  };

  const save = async () => {
    const current = latest.current;
    if (!current) return false;
    try {
      const result = await saveProgramme(db, current);
      latest.current = result;
      saved.current = result;
      setProgramme(result);
      setBasedOn(result.updatedAt);
      setDirty(false);
      setProblems([]);
      setJustSaved(true);
      return true;
    } catch (err) {
      setProblems(err instanceof SaveError ? err.problems : [String(err)]);
      return false;
    }
  };

  const discard = async () => {
    await discardDraft(db, id);
    const stored = await db.programmes.get(id);
    const p = stored ? asProgramme(stored) : null;
    saved.current = p;
    latest.current = p;
    setProgramme(p);
    setDirty(false);
    setProblems([]);
  };

  return { programme, loaded, dirty, isNew: basedOn === null, problems, justSaved, update, save, discard };
}

/** The same programme, whatever order its fields were written in. */
export function sameProgramme(a: Programme | null, b: Programme | null): boolean {
  if (!a || !b) return false;
  return canonical(a) === canonical(b);
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
