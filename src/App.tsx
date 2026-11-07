import { useLiveQuery } from "dexie-react-hooks";
import { BuildHome } from "./build/BuildHome.tsx";
import { BuildProgramme } from "./build/BuildProgramme.tsx";
import { Data } from "./shared/Data.tsx";
import { useRoute, useRouteParams } from "./shared/route.ts";
import { UpdateBanner } from "./shared/UpdateBanner.tsx";
import { WhoIsTraining } from "./shared/WhoIsTraining.tsx";
import { db, testVersion } from "./store/db.ts";
import { getCurrentProfileId } from "./store/profiles.ts";
import { History } from "./train/History.tsx";
import { Today } from "./train/Today.tsx";

export function App() {
  const route = useRoute();
  const params = useRouteParams();
  const profiles = useLiveQuery(() => db.profiles.orderBy("name").toArray());
  const currentId = useLiveQuery(() => getCurrentProfileId(db));

  if (profiles === undefined || currentId === undefined) return <div className="loading" aria-busy="true" />;

  const current = profiles.find((p) => p.id === currentId);
  const pr = testVersion(location.pathname);

  let screen;
  if (route === "data") screen = <Data profile={current} profiles={profiles} />;
  else if (route === "programme") {
    screen = params[0]
      ? <BuildProgramme key={params[0]} profile={current} profiles={profiles} id={params[0]} workout={params[1]} />
      : <BuildHome profile={current} profiles={profiles} />;
  }
  else if (route === "who" || !current) screen = <WhoIsTraining profiles={profiles} currentId={current?.id ?? null} />;
  else if (route === "history") screen = <History profile={current} />;
  else screen = <Today profile={current} />;

  return (
    <>
      {pr !== null && (
        <div className="test-version" role="note">
          Test version of change #{pr}. Anything entered here is kept apart from the real app.
        </div>
      )}
      <UpdateBanner />
      {screen}
    </>
  );
}
