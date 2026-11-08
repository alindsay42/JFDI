import { useEffect, useMemo, useRef, useState } from "react";

export interface ChartPoint { date: string; value: number; detail?: string }
export interface ChartBand { date: string; lo: number; hi: number }
export interface ChartMarker { date: string; value: number; label: string }

const H = 240;
const PAD = { top: 16, right: 16, bottom: 32, left: 48 };
const time = (d: string) => Date.parse(`${d}T12:00:00Z`);
const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const long = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/**
 * One series over time, in the person's colour, with an optional goal line, or a shaded band (the target
 * pace) and dated goals drawn as diamonds. Tap or hover for each point's value. The list under each chart
 * is its table view.
 */
export function LineChart({ points, unit, label, goal, band, markers, until, labelLast }: {
  points: ChartPoint[];
  unit: string;
  label: string;
  goal?: { value: number; date?: string; label: string } | undefined;
  band?: ChartBand[];
  markers?: ChartMarker[];
  /** Carry the time axis on to this date, past the last point */
  until?: string | null;
  /** Write the latest value beside its dot */
  labelLast?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  // Drawn at the size it's shown, so text and dots stay the same size on a phone and a tablet
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { if (e && e.contentRect.width > 0) setW(Math.round(e.contentRect.width)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const values = points.map((p) => p.value)
      .concat(goal ? [goal.value] : [], (band ?? []).flatMap((b) => [b.lo, b.hi]), (markers ?? []).map((m) => m.value));
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = Math.max((hi - lo) * 0.1, 1);
    const ticks = niceTicks(lo - pad, hi + pad);
    const yMin = ticks[0]!;
    const yMax = ticks.at(-1)!;
    const dates = points.map((p) => p.date)
      .concat(goal?.date ? [goal.date] : [], until ? [until] : [], (band ?? []).map((b) => b.date), (markers ?? []).map((m) => m.date))
      .sort();
    const first = dates[0]!;
    const last = dates.at(-1)!;
    const tMin = time(first);
    const tMax = time(last);
    const span = tMax - tMin || 86_400_000;
    const x = (d: string) => PAD.left + ((time(d) - tMin + (tMax === tMin ? span / 2 : 0)) / span) * (W - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);
    return { ticks, x, y, first, last };
  }, [points, goal, band, markers, until, W]);

  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !points.length) return;
    const sx = ((clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(geo.x(p.date) - sx) < Math.abs(geo.x(points[best]!.date) - sx)) best = i; });
    setActive(best);
  };

  const path = points.map((p, i) => `${i ? "L" : "M"}${geo.x(p.date).toFixed(1)},${geo.y(p.value).toFixed(1)}`).join(" ");
  const a = active !== null ? points[active] : undefined;
  const ends = geo.first === geo.last ? [geo.first] : [geo.first, geo.last];
  const bandPath = band && band.length > 1
    ? `M${band.map((b) => `${geo.x(b.date).toFixed(1)},${geo.y(b.hi).toFixed(1)}`).join(" L")} L${[...band].reverse().map((b) => `${geo.x(b.date).toFixed(1)},${geo.y(b.lo).toFixed(1)}`).join(" L")} Z`
    : null;
  const lastPoint = points.at(-1);

  return (
    <div className="chart" ref={box} onPointerMove={(e) => pick(e.clientX)} onPointerDown={(e) => pick(e.clientX)} onPointerLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(t)} y2={geo.y(t)} className="chart-grid" />
            <text x={PAD.left - 8} y={geo.y(t) + 4} textAnchor="end" className="chart-tick">{t}</text>
          </g>
        ))}
        {ends.map((d, i) => (
          <text key={d} x={geo.x(d)} y={H - 8} textAnchor={ends.length === 1 ? "middle" : i === 0 ? "start" : "end"} className="chart-tick">
            {short.format(new Date(time(d)))}
          </text>
        ))}
        {bandPath && <path d={bandPath} className="chart-band" />}
        {markers?.map((m) => {
          const mx = geo.x(m.date);
          const my = geo.y(m.value);
          // Label to the left of the diamond, unless it would run off the chart
          const left = mx - 9 - m.label.length * 6.5 > PAD.left;
          return (
            <g key={m.date} className="chart-marker">
              <line x1={mx} x2={mx} y1={PAD.top} y2={H - PAD.bottom} />
              <path d={`M${mx - 6},${my} L${mx},${my - 6} L${mx + 6},${my} L${mx},${my + 6} Z`} />
              <text x={left ? mx - 9 : mx + 9} y={my - 9} textAnchor={left ? "end" : "start"}>{m.label}</text>
            </g>
          );
        })}
        {goal && (
          <g className="chart-goal">
            <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(goal.value)} y2={geo.y(goal.value)} />
            {goal.date && <circle cx={geo.x(goal.date)} cy={geo.y(goal.value)} r={6} />}
            <text x={W - PAD.right} y={geo.y(goal.value) - 6} textAnchor="end">{goal.label}</text>
          </g>
        )}
        <path d={path} className="chart-line" />
        {points.map((p, i) => (
          <circle key={i} cx={geo.x(p.date)} cy={geo.y(p.value)} r={i === active ? 7 : 4.5} className="chart-dot" />
        ))}
        {labelLast && lastPoint && (
          <text x={geo.x(lastPoint.date) + 9} y={geo.y(lastPoint.value) + 4} className="chart-last">{lastPoint.value}</text>
        )}
        {a && <line x1={geo.x(a.date)} x2={geo.x(a.date)} y1={PAD.top} y2={H - PAD.bottom} className="chart-cross" />}
      </svg>
      {a && (
        <div className="chart-tip" style={{ left: `${(geo.x(a.date) / W) * 100}%` }} role="status">
          <strong>{a.value}{unit}</strong>
          <span>{long.format(new Date(time(a.date)))}</span>
          {a.detail && <span>{a.detail}</span>}
        </div>
      )}
    </div>
  );
}
