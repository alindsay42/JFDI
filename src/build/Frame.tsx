import type { ReactNode } from "react";
import type { JFDIProfile } from "../formats/generated/profile.ts";
import { PlainScreen, Screen } from "../shared/Screen.tsx";

/** Build mode screens, in the current person's frame when someone is chosen. */
export function Frame({ profile, title, children }: { profile: JFDIProfile | undefined; title: ReactNode; children: ReactNode }) {
  if (!profile) return <PlainScreen title={typeof title === "string" ? title : "Build"}>{children}</PlainScreen>;
  return (
    <Screen profile={profile} route="build">
      {typeof title === "string" ? <h1 className="page-title">{title}</h1> : title}
      {children}
    </Screen>
  );
}
