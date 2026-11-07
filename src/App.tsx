import { useLiveQuery } from "dexie-react-hooks";
import { db, testVersion } from "./store/db.ts";
import { getCurrentProfileId } from "./store/profiles.ts";
import { useRoute } from "./shared/route.ts";
import { UpdateBanner } from "./shared/UpdateBanner.tsx";
import { WhoIsTraining } from "./shared/WhoIsTraining.tsx";
import { Today } from "./train/Today.tsx";

export function App() {
  const route = useRoute();
  const profiles = useLiveQuery(() => db.profiles.orderBy("name").toArray());
  const currentId = useLiveQuery(() => getCurrentProfileId(db));

  if (profiles === undefined || currentId === undefined) return <div className="loading" aria-busy="true" />;

  const current = profiles.find((p) => p.id === currentId);
  const pr = testVersion(location.pathname);
  return (
    <>
      {pr !== null && (
        <div className="test-version" role="note">
          Test version of change #{pr}. Anything entered here is kept apart from the real app.
        </div>
      )}
      <UpdateBanner />
      {route === "who" || !current ? (
        <WhoIsTraining profiles={profiles} currentId={current?.id ?? null} />
      ) : (
        <Today profile={current} />
      )}
    </>
  );
}
