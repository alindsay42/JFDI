// Gyms and their equipment. Changes save as you go; anything that doesn't make sense is explained and not saved.
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, type FormEvent } from "react";
import type { JFDIHouseholdEquipment } from "../formats/generated/equipment.ts";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { db } from "../store/db.ts";
import { addGym, deleteGym, getGyms, saveGym, type Gym } from "../store/gyms.ts";
import { Confirm } from "./Confirm.tsx";
import { go, useRouteParams } from "./route.ts";
import { PlainScreen, Screen } from "./Screen.tsx";

type Item = JFDIHouseholdEquipment["items"][number];

export const BAR_TYPES: Array<[string, string]> = [
  ["standard", "Barbell"], ["junior", "Junior bar"], ["ez", "EZ curl bar"], ["ssb", "Safety squat bar"],
  ["trap", "Trap bar"], ["log", "Log"], ["swiss", "Swiss bar"],
];
const OTHER_KINDS: Array<[string, string]> = [
  ["rack", "Rack"], ["bench", "Bench"], ["station", "Station"], ["cable", "Cable"], ["handle", "Handle"],
  ["conditioning", "Conditioning"], ["odd-object", "Odd object"], ["collars", "Collars"], ["chains", "Chains"], ["accessory", "Accessory"],
];
const SHOWN = new Set(["bar", "plates", "dumbbells", "weights"]);

const idFor = (name: string, items: Item[]) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
  let id = base;
  for (let n = 2; items.some((i) => i.id === id); n++) id = `${base}-${n}`;
  return id;
};
const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));

/** A number box that only passes on numbers that make sense. */
function Kg({ label, value, onCommit, blank }: { label: string; value: number | undefined; onCommit: (n: number | undefined) => void; blank?: string }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => setText(value === undefined ? "" : String(value)), [value]);
  const n = num(text);
  const ok = (text.trim() === "" && blank !== undefined) || (n >= 0 && n <= 1000);
  return (
    <input className="kg-input" aria-label={label} inputMode="decimal" value={text} placeholder={blank} aria-invalid={!ok || undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (ok && (text.trim() === "" ? value !== undefined : n !== value)) onCommit(text.trim() === "" ? undefined : n); }} />
  );
}

export function Equipment({ profile }: { profile: JFDIProfile | undefined }) {
  const gyms = useLiveQuery(() => getGyms(db));
  const [chosenId] = useRouteParams();
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const gym = gyms?.find((g) => g.id === chosenId) ?? gyms?.[0];

  const save = (items: Item[], name?: string) => {
    if (!gym) return;
    setError("");
    saveGym(db, gym.id, { ...gym.kit, items, ...(name !== undefined ? { name } : {}) }).catch((e: Error) => setError(e.message));
  };
  // A value set to nothing is taken off the item altogether
  const change = (id: string, patch: Partial<Item>) => save(gym!.kit.items.map((i) => {
    if (i.id !== id) return i;
    const next: Record<string, unknown> = { ...i, ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    return next as Item;
  }));
  // Removing something also removes anything attached to it, such as a rack's safeties
  const remove = (id: string) => save(gym!.kit.items.filter((i) => i.id !== id && i.attachesTo !== id));
  const add = (item: Omit<Item, "id">) => save([...gym!.kit.items, { ...item, id: idFor(`${item.kind}-${item.name}`, gym!.kit.items) } as Item]);

  const body = gyms === undefined ? null : !gym ? <p>No gyms yet.</p> : (
    <>
      <section className="card" aria-labelledby="gyms-heading">
        <h2 id="gyms-heading">Gyms</h2>
        <p className="hint">Where you train, each with its own kit. On Today, pick where you're training and targets round to what that gym can load.</p>
        <div className="gym-tabs">
          {gyms.map((g, i) => (
            <a key={g.id} href={`#/equipment/${g.id}`} className="btn btn-quiet btn-small" aria-current={g.id === gym.id ? "page" : undefined}>
              {g.kit.name}{i === 0 ? " (home)" : ""}
            </a>
          ))}
          {!adding && <button type="button" className="btn btn-quiet btn-small" onClick={() => setAdding(true)}>+ Add a gym</button>}
        </div>
        {adding && <AddGym gyms={gyms} done={(id) => { setAdding(false); if (id) go("equipment", id); }} />}
        <div className="goal-form">
          <label className="field field-inline"><span>Name</span>
            <input aria-label="Gym name" defaultValue={gym.kit.name} key={gym.id}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== gym.kit.name) save(gym.kit.items, v); }} />
          </label>
          {gym.id !== gyms[0]!.id && <button type="button" className="btn btn-danger-quiet btn-small" onClick={() => setRemoving(true)}>Remove this gym</button>}
        </div>
      </section>
      {error && <p className="problems" role="alert">{error}</p>}

      <Bars items={gym.kit.items} change={change} remove={remove} add={add} />
      <Plates items={gym.kit.items} change={change} remove={remove} add={add} />
      <Dumbbells items={gym.kit.items} change={change} remove={remove} add={add} />
      <WeightedKit items={gym.kit.items} change={change} remove={remove} add={add} />
      <Other items={gym.kit.items} remove={remove} add={add} />

      <Confirm danger open={removing} title={`Remove ${gym.kit.name}?`} confirmLabel="Remove" onCancel={() => setRemoving(false)}
        onConfirm={() => { setRemoving(false); void deleteGym(db, gym.id).then(() => go("equipment")); }}>
        Anyone training there goes back to {gyms[0]!.kit.name}. Workouts already done aren't affected.
      </Confirm>
    </>
  );
  if (!profile) return <PlainScreen title="Equipment">{body}</PlainScreen>;
  return <Screen profile={profile} route="equipment"><h1 className="page-title">Equipment</h1>{body}</Screen>;
}

function AddGym({ gyms, done }: { gyms: Gym[]; done: (id?: string) => void }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState(gyms[0]!.id);
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    addGym(db, name, from).then(done).catch((err: Error) => setError(err.message));
  };
  return (
    <form className="goal-form" onSubmit={submit}>
      <label className="field field-inline"><span>New gym</span><input aria-label="New gym name" placeholder="Hotel" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field field-inline"><span>Start from</span>
        <select aria-label="Start the new gym from" value={from} onChange={(e) => setFrom(e.target.value)}>
          {gyms.map((g) => <option key={g.id} value={g.id}>A copy of {g.kit.name}</option>)}
          <option value="typical">A typical home gym</option>
          <option value="empty">Nothing</option>
        </select>
      </label>
      <button type="button" className="btn btn-quiet" onClick={() => done()}>Cancel</button>
      <button type="submit" className="btn btn-you" disabled={!name.trim()}>Add gym</button>
      {error && <p className="problems" role="alert">{error}</p>}
    </form>
  );
}

interface Editing {
  items: Item[];
  change: (id: string, patch: Partial<Item>) => void;
  remove: (id: string) => void;
  add: (item: Omit<Item, "id">) => void;
}

function Name({ item, change, label }: { item: Item; change: Editing["change"]; label: string }) {
  return (
    <input className="name-input" aria-label={label} defaultValue={item.name} key={`${item.id}-${item.name}`}
      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== item.name) change(item.id, { name: v }); }} />
  );
}

function Bars({ items, change, remove, add }: Editing) {
  const bars = items.filter((i) => i.kind === "bar");
  return (
    <section className="card" aria-labelledby="bars-heading">
      <h2 id="bars-heading">Bars</h2>
      {bars.length === 0 && <p className="muted">No bars.</p>}
      <ul className="kit-list">
        {bars.map((b) => (
          <li key={b.id} className="kit-row">
            <Name item={b} change={change} label={`${b.name}: name`} />
            <select aria-label={`${b.name}: type`} value={b.barType} onChange={(e) => change(b.id, { barType: e.target.value as Item["barType"] })}>
              {BAR_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <span className="kg-field"><Kg label={`${b.name}: weight`} value={b.kg} onCommit={(kg) => change(b.id, { kg: kg ?? 0 })} /><span aria-hidden="true">kg</span></span>
            <button type="button" className="icon-btn set-remove" aria-label={`Remove ${b.name}`} onClick={() => remove(b.id)}>×</button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-quiet btn-small" onClick={() => add({ name: "Barbell", kind: "bar", barType: "standard", kg: 20 })}>+ Add a bar</button>
    </section>
  );
}

function Plates({ items, change, remove, add }: Editing) {
  const sets = items.filter((i) => i.kind === "plates");
  const [size, setSize] = useState<Record<string, string>>({});
  return (
    <section className="card" aria-labelledby="plates-heading">
      <h2 id="plates-heading">Plates</h2>
      <p className="hint">Count every plate, so a pair is 2. Plates from every set are used together.</p>
      {sets.map((s) => {
        const plates = [...s.plates!].sort((a, b) => b.kg - a.kg);
        const setPlates = (next: typeof plates) => change(s.id, { plates: next });
        const newKg = num(size[s.id] ?? "");
        return (
          <div key={s.id} className="kit-group">
            <div className="kit-row">
              <Name item={s} change={change} label={`${s.name}: name`} />
              <button type="button" className="icon-btn set-remove" aria-label={`Remove ${s.name}`} onClick={() => remove(s.id)}>×</button>
            </div>
            <ul className="kit-list">
              {plates.map((p) => (
                <li key={p.kg} className="kit-row plate-row">
                  <span className="plate-kg">{p.kg}kg</span>
                  <span className="kg-field">
                    <input className="kg-input" aria-label={`${s.name}: how many ${p.kg}kg`} inputMode="numeric" defaultValue={p.count} key={`${p.kg}-${p.count}`}
                      onBlur={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n !== p.count) setPlates(plates.map((x) => (x.kg === p.kg ? { ...x, count: n } : x))); }} />
                    <span>plates</span>
                  </span>
                  <button type="button" className="icon-btn set-remove" aria-label={`Remove ${p.kg}kg plates from ${s.name}`} disabled={plates.length === 1}
                    onClick={() => setPlates(plates.filter((x) => x.kg !== p.kg))}>×</button>
                </li>
              ))}
            </ul>
            <form className="kit-row" onSubmit={(e) => {
              e.preventDefault();
              if (!(newKg > 0) || plates.some((p) => p.kg === newKg)) return;
              setPlates([...plates, { kg: newKg, count: 2 }]);
              setSize({ ...size, [s.id]: "" });
            }}>
              <span className="kg-field"><input className="kg-input" aria-label={`${s.name}: new plate size`} inputMode="decimal" placeholder="size"
                value={size[s.id] ?? ""} onChange={(e) => setSize({ ...size, [s.id]: e.target.value })} /><span aria-hidden="true">kg</span></span>
              <button type="submit" className="btn btn-quiet btn-small" disabled={!(newKg > 0) || plates.some((p) => p.kg === newKg)}>Add a pair</button>
            </form>
          </div>
        );
      })}
      <button type="button" className="btn btn-quiet btn-small" onClick={() => add({ name: "Plates", kind: "plates", plates: [{ kg: 20, count: 2 }] })}>+ Add a plate set</button>
    </section>
  );
}

function WeightedKit({ items, change, remove, add }: Editing) {
  const sets = items.filter((i) => i.kind === "weights");
  const [size, setSize] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  return (
    <section className="card" aria-labelledby="weights-heading">
      <h2 id="weights-heading">Weighted kit</h2>
      <p className="hint">Anything that comes in fixed weights, such as kettlebells, sandbags or medicine balls. An exercise done with it rounds to the weights here.</p>
      {sets.map((s) => {
        const weights = [...s.weights!].sort((a, b) => a.kg - b.kg);
        const setWeights = (next: typeof weights) => change(s.id, { weights: next });
        const newKg = num(size[s.id] ?? "");
        const canAdd = newKg > 0 && newKg <= 1000 && !weights.some((w) => w.kg === newKg);
        return (
          <div key={s.id} className="kit-group">
            <div className="kit-row">
              <Name item={s} change={change} label={`${s.name}: name`} />
              <button type="button" className="icon-btn set-remove" aria-label={`Remove ${s.name}`} onClick={() => remove(s.id)}>×</button>
            </div>
            {weights.length === 0 && <p className="muted">No weights yet.</p>}
            <ul className="kit-list">
              {weights.map((w) => (
                <li key={w.kg} className="kit-row plate-row">
                  <span className="plate-kg">{w.kg}kg</span>
                  <span className="kg-field">
                    <input className="kg-input" aria-label={`${s.name}: how many ${w.kg}kg`} inputMode="numeric" defaultValue={w.count} key={`${w.kg}-${w.count}`}
                      onBlur={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n !== w.count) setWeights(weights.map((x) => (x.kg === w.kg ? { ...x, count: n } : x))); }} />
                    <span>of them</span>
                  </span>
                  <button type="button" className="icon-btn set-remove" aria-label={`Remove ${w.kg}kg from ${s.name}`}
                    onClick={() => setWeights(weights.filter((x) => x.kg !== w.kg))}>×</button>
                </li>
              ))}
            </ul>
            <form className="kit-row" onSubmit={(e) => {
              e.preventDefault();
              if (!canAdd) return;
              setWeights([...weights, { kg: newKg, count: 1 }]);
              setSize({ ...size, [s.id]: "" });
            }}>
              <span className="kg-field"><input className="kg-input" aria-label={`${s.name}: new weight`} inputMode="decimal" placeholder="weight"
                value={size[s.id] ?? ""} onChange={(e) => setSize({ ...size, [s.id]: e.target.value })} /><span aria-hidden="true">kg</span></span>
              <button type="submit" className="btn btn-quiet btn-small" disabled={!canAdd}>Add a weight</button>
            </form>
          </div>
        );
      })}
      <form className="kit-row" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { add({ name: name.trim(), kind: "weights", weights: [] }); setName(""); } }}>
        <input className="name-input" aria-label="New weighted kit name" placeholder="Kettlebells" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-quiet btn-small" disabled={!name.trim()}>+ Add weighted kit</button>
      </form>
    </section>
  );
}

function Dumbbells({ items, change, remove, add }: Editing) {
  const sets = items.filter((i) => i.kind === "dumbbells");
  const [pair, setPair] = useState<Record<string, string>>({});
  return (
    <section className="card" aria-labelledby="dumbbells-heading">
      <h2 id="dumbbells-heading">Dumbbells</h2>
      <p className="hint">Fixed pairs, or loadable handles that take the plates above. Untick a pair that's lent out or broken.</p>
      {sets.map((s) => {
        const newKg = num(pair[s.id] ?? "");
        if (!s.pairsKg) {
          return (
            <div key={s.id} className="kit-group">
              <div className="kit-row">
                <Name item={s} change={change} label={`${s.name}: name`} />
                <span className="kg-field"><span>Each handle</span>
                  <Kg label={`${s.name}: handle weight`} value={s.kg} blank="to weigh" onCommit={(kg) => change(s.id, { kg })} /><span aria-hidden="true">kg</span></span>
                <button type="button" className="icon-btn set-remove" aria-label={`Remove ${s.name}`} onClick={() => remove(s.id)}>×</button>
              </div>
              {s.kg === undefined && <p className="hint">Weigh a handle and enter it here, and they'll be used for dumbbell targets.</p>}
            </div>
          );
        }
        const gone = new Set(s.unavailableKg ?? []);
        const pairs = [...s.pairsKg].sort((a, b) => a - b);
        return (
          <div key={s.id} className="kit-group">
            <div className="kit-row">
              <Name item={s} change={change} label={`${s.name}: name`} />
              <button type="button" className="icon-btn set-remove" aria-label={`Remove ${s.name}`} onClick={() => remove(s.id)}>×</button>
            </div>
            <ul className="pair-list">
              {pairs.map((kg) => (
                <li key={kg} className="pair">
                  <label className="check">
                    <input type="checkbox" checked={!gone.has(kg)} onChange={(e) => {
                      const next = e.target.checked ? [...gone].filter((x) => x !== kg) : [...gone, kg];
                      change(s.id, { unavailableKg: next.length ? next.sort((a, b) => a - b) : undefined });
                    }} />
                    <span>{kg}kg</span>
                  </label>
                  <button type="button" className="icon-btn set-remove" aria-label={`Remove the ${kg}kg pair`} disabled={pairs.length === 1}
                    onClick={() => change(s.id, { pairsKg: pairs.filter((x) => x !== kg), unavailableKg: [...gone].filter((x) => x !== kg).length ? [...gone].filter((x) => x !== kg) : undefined })}>×</button>
                </li>
              ))}
            </ul>
            <form className="kit-row" onSubmit={(e) => {
              e.preventDefault();
              if (!(newKg > 0) || pairs.includes(newKg)) return;
              change(s.id, { pairsKg: [...pairs, newKg].sort((a, b) => a - b) });
              setPair({ ...pair, [s.id]: "" });
            }}>
              <span className="kg-field"><input className="kg-input" aria-label={`${s.name}: new pair`} inputMode="decimal" placeholder="weight"
                value={pair[s.id] ?? ""} onChange={(e) => setPair({ ...pair, [s.id]: e.target.value })} /><span aria-hidden="true">kg</span></span>
              <button type="submit" className="btn btn-quiet btn-small" disabled={!(newKg > 0) || pairs.includes(newKg)}>Add a pair</button>
            </form>
          </div>
        );
      })}
      <div className="actions actions-start">
        <button type="button" className="btn btn-quiet btn-small" onClick={() => add({ name: "Dumbbells", kind: "dumbbells", pairsKg: [5, 10] })}>+ Add fixed dumbbells</button>
        <button type="button" className="btn btn-quiet btn-small" onClick={() => add({ name: "Loadable handles", kind: "dumbbells", count: 2 })}>+ Add loadable handles</button>
      </div>
    </section>
  );
}

function Other({ items, remove, add }: Omit<Editing, "change">) {
  const others = items.filter((i) => !SHOWN.has(i.kind));
  const [name, setName] = useState("");
  const [kind, setKind] = useState("station");
  const label = (k: string) => OTHER_KINDS.find(([v]) => v === k)?.[1] ?? (k === "attachment" ? "Attachment" : k);
  return (
    <section className="card" aria-labelledby="other-heading">
      <h2 id="other-heading">Other kit</h2>
      <p className="hint">To train with something here, such as an ab wheel, give an exercise the kit it needs under <a href="#/exercises">Your exercises</a>.</p>
      {others.length === 0 && <p className="muted">Nothing else yet.</p>}
      <ul className="kit-list">
        {others.map((o) => (
          <li key={o.id} className="kit-row">
            <span>{o.name} <span className="muted">· {label(o.kind)}</span></span>
            <button type="button" className="icon-btn set-remove" aria-label={`Remove ${o.name}`} onClick={() => remove(o.id)}>×</button>
          </li>
        ))}
      </ul>
      <form className="kit-row" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { add({ name: name.trim(), kind: kind as Item["kind"] }); setName(""); } }}>
        <input className="name-input" aria-label="New kit name" placeholder="Cable machine" value={name} onChange={(e) => setName(e.target.value)} />
        <select aria-label="New kit type" value={kind} onChange={(e) => setKind(e.target.value)}>
          {OTHER_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="submit" className="btn btn-quiet btn-small" disabled={!name.trim()}>Add</button>
      </form>
    </section>
  );
}
