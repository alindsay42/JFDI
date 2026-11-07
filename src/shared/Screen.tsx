import type { ReactNode } from "react";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { go, type Route } from "./route.ts";
import { cssVar } from "./style.ts";
import { Version } from "./Version.tsx";

const TABS: Array<{ route: Route; label: string }> = [
  { route: "today", label: "Today" },
  { route: "person", label: "Setup & history" },
  { route: "data", label: "Backup" },
];

/** A screen for one person: their colour along the top, their name (tap to change person), and the main tabs. */
export function Screen({ profile, route, children }: { profile: JFDIProfile; route: Route; children: ReactNode }) {
  return (
    <div className="screen" style={cssVar("--you", profile.colour)}>
      <header className="you-bar">
        <button type="button" className="you-name" onClick={() => go("who")} aria-label={`${profile.name}. Change person`}>
          <span className="person-initial" aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</span>
          {profile.name}
          <span className="you-switch" aria-hidden="true">Change</span>
        </button>
        <nav className="tabs" aria-label="Main">
          {TABS.map((t) => (
            <a key={t.route} href={`#/${t.route}`} className="tab" aria-current={t.route === route ? "page" : undefined}>
              {t.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="page">{children}</main>
      <Version />
    </div>
  );
}

/** A screen that doesn't belong to anyone, such as Backup before anyone has been added. */
export function PlainScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="screen">
      <header className="plain-bar">
        <a href="#/who" className="btn btn-quiet">Back</a>
        <span className="brand brand-small">J.F.D.I</span>
      </header>
      <main className="page">
        <h1 className="page-title">{title}</h1>
        {children}
      </main>
      <Version />
    </div>
  );
}
