import type { JFDIProfile } from "../formats/generated/profile.ts";
import { go } from "../shared/route.ts";
import { cssVar } from "../shared/style.ts";
import { Version } from "../shared/Version.tsx";

const dateFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

export function Today({ profile, now = new Date() }: { profile: JFDIProfile; now?: Date }) {
  return (
    <div className="screen" style={cssVar("--you", profile.colour)}>
      <header className="you-bar">
        <button type="button" className="you-name" onClick={() => go("who")} aria-label={`${profile.name}. Change person`}>
          <span className="person-initial" aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</span>
          {profile.name}
          <span className="you-switch" aria-hidden="true">Change</span>
        </button>
        <span className="brand brand-small">J.F.D.I</span>
      </header>

      <main className="today">
        <h1 className="today-date">{dateFormat.format(now)}</h1>
        <section className="card empty">
          <h2>No programme yet</h2>
          <p>Programmes, the daily check and logging sessions arrive in the next updates.</p>
        </section>
      </main>

      <Version />
    </div>
  );
}
