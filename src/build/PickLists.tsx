import { useMemo, useState } from "react";
import { IMPLEMENT_NAMES, kitChoices, PATTERN_NAMES } from "../shared/OwnExercises.tsx";
import type { Gym } from "../store/gyms.ts";
import { library } from "../store/household.ts";

/**
 * Choosing exercises: every exercise on the left, this workout's on the right. Tap to highlight, then
 * > moves the highlighted ones in, >> moves in everything the search and filter show, < and << take them out.
 */
export function PickLists({ chosen, gyms, onAdd, onRemove }: {
  chosen: string[];
  gyms: Gym[];
  onAdd: (ids: string[]) => void;
  onRemove: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [pattern, setPattern] = useState("");
  const [kit, setKit] = useState("");
  const [left, setLeft] = useState<Set<string>>(new Set());
  const [right, setRight] = useState<Set<string>>(new Set());

  // The library gains the household's own exercises as they're added, so it's read afresh each time
  const exercises = library.exercises;
  const names = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises]);
  const inWorkout = useMemo(() => new Set(chosen), [chosen]);
  // Kit to filter by: what exercises are done with, and anything in the gyms that an exercise needs
  const doneWith = useMemo(() => Object.keys(IMPLEMENT_NAMES).filter((i) => exercises.some((e) => e.implement === i)), [exercises]);
  const needs = useMemo(() => kitChoices(gyms).filter((k) => exercises.some((e) => e.requires.includes(k.id))), [gyms, exercises]);
  const shown = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    const [by, what] = kit.split(":");
    return exercises
      .filter((e) => !inWorkout.has(e.id))
      .filter((e) => !pattern || e.pattern === pattern)
      .filter((e) => !kit || (by === "with" ? e.implement === what : e.requires.includes(what!)))
      .filter((e) => words.every((w) => e.name.toLowerCase().includes(w)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [search, pattern, kit, inWorkout, exercises]);

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
              {Object.entries(PATTERN_NAMES).map(([p, name]) => <option key={p} value={p}>{name}</option>)}
            </select>
            <select aria-label="Kit" value={kit} onChange={(e) => setKit(e.target.value)}>
              <option value="">Any kit</option>
              <optgroup label="Done with">
                {doneWith.map((i) => <option key={i} value={`with:${i}`}>{IMPLEMENT_NAMES[i]}</option>)}
              </optgroup>
              {needs.length > 0 && (
                <optgroup label="Needs">
                  {needs.map((k) => <option key={k.id} value={`needs:${k.id}`}>{k.name}</option>)}
                </optgroup>
              )}
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
