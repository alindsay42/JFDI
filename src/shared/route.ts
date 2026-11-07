// Hash routing (#/today, #/who), so the app works from any address, including pull request test versions.
import { useSyncExternalStore } from "react";

export type Route = "today" | "who";

function read(): Route {
  const path = location.hash.replace(/^#\/?/, "");
  return path === "who" ? "who" : "today";
}

function subscribe(cb: () => void) {
  addEventListener("hashchange", cb);
  return () => removeEventListener("hashchange", cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, read);
}

export function go(route: Route) {
  location.hash = `#/${route}`;
}
