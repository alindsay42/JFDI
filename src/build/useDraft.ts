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

  useEffect(() => {
    let live = true;
    void (async () => {
      const [draft, saved] = await Promise.all([getDraft(db, id), db.programmes.get(id)]);
      if (!live) return;
      const p = draft?.programme ?? (saved ? asProgramme(saved) : null);
      latest.current = p;
      setProgramme(p);
      setBasedOn(draft ? draft.basedOn : (saved?.updatedAt ?? null));
      setDirty(!!draft);
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
    setDirty(true);
    setProblems([]);
    setJustSaved(false);
    void putDraft(db, { programme: next, basedOn });
  };

  const save = async () => {
    const current = latest.current;
    if (!current) return false;
    try {
      const saved = await saveProgramme(db, current);
      latest.current = saved;
      setProgramme(saved);
      setBasedOn(saved.updatedAt);
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
    const saved = await db.programmes.get(id);
    const p = saved ? asProgramme(saved) : null;
    latest.current = p;
    setProgramme(p);
    setDirty(false);
    setProblems([]);
  };

  return { programme, loaded, dirty, isNew: basedOn === null, problems, justSaved, update, save, discard };
}
