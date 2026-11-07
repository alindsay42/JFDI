import { useLiveQuery } from "dexie-react-hooks";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { daysUntil, formatLongDate, plural } from "../shared/format.ts";
import { Screen } from "../shared/Screen.tsx";
import { db } from "../store/db.ts";
import { localDate } from "../store/programmes.ts";

const todayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

export function Today({ profile, now = new Date() }: { profile: JFDIProfile; now?: Date }) {
  const active = profile.programmes.active;
  const programme = useLiveQuery(() => (active ? db.programmes.get(active.programme) : undefined), [active?.programme]);
  const today = localDate(now);

  return (
    <Screen profile={profile} route="today">
      <h1 className="page-title">{todayFormat.format(now)}</h1>
      {active ? (
        <section className="card">
          <h2>{programme?.name ?? active.programme}</h2>
          <StartLine startDate={active.startDate} today={today} />
          <p className="hint">The daily check and logging sessions arrive in the next updates.</p>
        </section>
      ) : (
        <section className="card empty">
          <h2>No programme yet</h2>
          <p>Build one, or choose one, on the Programme tab.</p>
          <div className="actions actions-start">
            <a className="btn btn-you" href="#/programme">Go to programmes</a>
          </div>
        </section>
      )}
    </Screen>
  );
}

function StartLine({ startDate, today }: { startDate: string; today: string }) {
  const days = daysUntil(startDate, today);
  if (days > 0) return <p className="lead">Starts {formatLongDate(startDate)}, in {plural(days, "day")}.</p>;
  if (days === 0) return <p className="lead">Starts today.</p>;
  return <p className="lead">Started {formatLongDate(startDate)}.</p>;
}
