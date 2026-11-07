import { useMemo, useState } from "react";
import { library } from "../store/household.ts";

const PATTERNS = ["squat", "hinge", "push", "pull", "lunge", "carry", "core", "isolation", "conditioning", "mobility"] as const;
const PATTERN_NAMES: Record<string, string> = {
  squat: "Squat", hinge: "Hinge", push: "Push", pull: "Pull", lunge: "Lunge", carry: "Carry", core: "Core",
  isolation: "Isolation", conditioning: "Conditioning", mobility: "Mobility",
};
const names = new Map(library.exercises.map((e) => [e.id, e.name]));

/**
 * Choosing exercises: every exercise on the left, this workout's on the right. Tap to highlight, then
 * > moves the highlighted ones in, >> moves in everything the search and filter show, < and << take them out.
 */
export function PickLists({ chosen, onAdd, onRemove }: {
  chosen: string[];
  onAdd: (ids: string[]) => void;
  onRemove: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [pattern, setPattern] = useState("");
  const [left, setLeft] = useState<Set<string>>(new Set());
  const [right, setRight] = useState<Set<string>>(new Set());

  const inWorkout = useMemo(() => new Set(chosen), [chosen]);
  const shown = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return library.exercises
      .filter((e) => !inWorkout.has(e.id))
      .filter((e) => !pattern || e.pattern === pattern)
      .filter((e) => words.every((w) => e.name.toLowerCase().includes(w)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [search, pattern, inWorkout]);

  const toggle = (set: Set<string>, id: string, put: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    put(next);
  };
  const add = (ids: string[]) => { if (ids.length) { onAdd(ids); setLeft(new Set()); } };
  const remove = (ids: string[]) => { if (ids.length) { onRemove(ids); setRight(new Set()); } };
  // Highlighted exercises count even when a later search hides them.
  const highlightedLeft = [...left].filter((id) => !inWorkout.has(id));
  const highlightedRight = chosen.filter((id) => right.has(id));

  return (
    <div className="picker">
      <div className="pick-pane">
        <div className="pick-head">
          <span className="pick-title">All exercises <span className="muted">({shown.length})</span></span>
          <div className="pick-filters">
            <input type="search" placeholder="Search" aria-label="Search exercises" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select aria-label="Movement" value={pattern} onChange={(e) => setPattern(e.target.value)}>
              <option value="">All movements</option>
              {PATTERNS.map((p) => <option key={p} value={p}>{PATTERN_NAMES[p]}</option>)}
            </select>
          </div>
        </div>
        <ul className="pick-list" role="listbox" aria-label="All exercises" aria-multiselectable="true">
          {shown.map((e) => (
            <li
              key={e.id}
              role="option"
              aria-selected={left.has(e.id)}
              tabIndex={0}
              onClick={() => toggle(left, e.id, setLeft)}
              onKeyDown={(k) => { if (k.key === " " || k.key === "Enter") { k.preventDefault(); toggle(left, e.id, setLeft); } }}
            >
              {e.name}
            </li>
          ))}
          {shown.length === 0 && <li className="pick-empty">Nothing matches</li>}
        </ul>
      </div>

      <div className="pick-buttons">
        <button type="button" className="btn btn-quiet" aria-label="Add everything shown" disabled={!shown.length} onClick={() => add(shown.map((e) => e.id))}>&gt;&gt;</button>
        <button type="button" className="btn btn-quiet" aria-label="Add highlighted" disabled={!highlightedLeft.length} onClick={() => add(highlightedLeft)}>&gt;</button>
        <button type="button" className="btn btn-quiet" aria-label="Remove highlighted" disabled={!highlightedRight.length} onClick={() => remove(highlightedRight)}>&lt;</button>
        <button type="button" className="btn btn-quiet" aria-label="Remove all" disabled={!chosen.length} onClick={() => remove(chosen)}>&lt;&lt;</button>
      </div>

      <div className="pick-pane">
        <div className="pick-head">
          <span className="pick-title">In this workout <span className="muted">({chosen.length})</span></span>
        </div>
        <ul className="pick-list" role="listbox" aria-label="In this workout" aria-multiselectable="true">
          {chosen.map((id) => (
            <li
              key={id}
              role="option"
              aria-selected={right.has(id)}
              tabIndex={0}
              onClick={() => toggle(right, id, setRight)}
              onKeyDown={(k) => { if (k.key === " " || k.key === "Enter") { k.preventDefault(); toggle(right, id, setRight); } }}
            >
              {names.get(id) ?? id}
            </li>
          ))}
          {chosen.length === 0 && <li className="pick-empty">Highlight exercises on the left, then press &gt;</li>}
        </ul>
      </div>
    </div>
  );
}
