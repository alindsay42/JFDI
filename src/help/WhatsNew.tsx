// What's new: the release notes in src/help/changes.md. Opening it counts as having seen this version's.
import { useEffect, useMemo } from "react";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { PlainScreen, Screen } from "../shared/Screen.tsx";
import { APP } from "../shared/Version.tsx";
import { db } from "../store/db.ts";
import changes from "./changes.md?raw";
import { Blocks } from "./Help.tsx";
import { parse } from "./markdown.ts";
import { setSeenVersion } from "./releases.ts";

export function WhatsNew({ profile }: { profile: JFDIProfile | undefined }) {
  const blocks = useMemo(() => parse(changes).filter((b) => b.kind !== "h1"), []);
  useEffect(() => { window.scrollTo(0, 0); void setSeenVersion(db, APP.version); }, []);
  const body = <article className="help"><Blocks blocks={blocks} /></article>;
  if (!profile) return <PlainScreen title="What's new">{body}</PlainScreen>;
  return (
    <Screen profile={profile} route="help">
      <h1 className="page-title">What's new</h1>
      {body}
    </Screen>
  );
}
