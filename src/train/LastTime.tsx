import { lastTime, setsText, type SessionForProgress } from "../engine/progress.ts";
import { formatDayMonth } from "../shared/format.ts";

/** "Last time, Fri 6 Nov: 52.5kg × 5, 5, 4", or nothing if the exercise hasn't been done before. */
export function LastTime({ sessions, exercise, leaveOut, name }: { sessions: SessionForProgress[]; exercise: string; leaveOut?: string; name?: string }) {
  const last = lastTime(sessions, exercise, leaveOut);
  if (!last) return null;
  return (
    <span className="last-time">
      {name ? `${name}, last time` : "Last time"}, {formatDayMonth(last.date)}: <strong>{setsText(last.sets)}</strong>
    </span>
  );
}
