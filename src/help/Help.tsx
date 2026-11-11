// The Help page: the manual in src/help/manual.md, with a contents list. #/help/<section> jumps to a section.
import { useEffect, useMemo } from "react";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { PlainScreen, Screen } from "../shared/Screen.tsx";
import { href } from "../shared/route.ts";
import manual from "./manual.md?raw";
import { parse, type Heading, type Inline } from "./markdown.ts";

const Text = ({ parts }: { parts: Inline[] }) => <>{parts.map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>))}</>;

export function Help({ profile, section }: { profile: JFDIProfile | undefined; section: string | undefined }) {
  const blocks = useMemo(() => parse(manual), []);
  const sections = blocks.filter((b): b is Heading => b.kind === "h2");

  useEffect(() => {
    if (!section) { window.scrollTo(0, 0); return; }
    document.getElementById(section)?.scrollIntoView({ block: "start" });
  }, [section]);

  const body = (
    <article className="help">
      <nav className="card help-contents" aria-label="Contents">
        <h2>Contents</h2>
        <ul>{sections.map((s) => <li key={s.id}><a href={href("help", s.id)}>{s.text}</a></li>)}</ul>
      </nav>
      {blocks.map((b, i) => {
        if (b.kind === "p") return <p key={i}><Text parts={b.parts} /></p>;
        if (b.kind === "ul") return <ul key={i}>{b.items.map((it, j) => <li key={j}><Text parts={it} /></li>)}</ul>;
        if (b.kind === "h2") return <h2 key={i} id={b.id} className="help-section">{b.text}</h2>;
        if (b.kind === "h3") return <h3 key={i} id={b.id}>{b.text}</h3>;
        return null;
      })}
    </article>
  );
  if (!profile) return <PlainScreen title="Help">{body}</PlainScreen>;
  return (
    <Screen profile={profile} route="help">
      <h1 className="page-title">Help</h1>
      {body}
    </Screen>
  );
}
