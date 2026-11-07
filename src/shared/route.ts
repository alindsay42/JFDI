// Hash routing (#/today, #/who, ...), so the app works from any address, including pull request test versions.
import { useSyncExternalStore } from "react";

export const ROUTES = ["today", "who", "person", "data"] as const;
export type Route = (typeof ROUTES)[number];

function read(): Route {
  const path = location.hash.replace(/^#\/?/, "");
  return (ROUTES as readonly string[]).includes(path) ? (path as Route) : "today";
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
