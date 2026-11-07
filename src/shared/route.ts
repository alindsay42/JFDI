// Hash routing (#/today, #/who, #/build/<programme>/<workout>...), so the app works from any address,
// including pull request test versions.
import { useSyncExternalStore } from "react";

export const ROUTES = ["today", "who", "person", "data", "build"] as const;
export type Route = (typeof ROUTES)[number];

const path = () => location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);

function read(): Route {
  const [first] = path();
  return (ROUTES as readonly string[]).includes(first ?? "") ? (first as Route) : "today";
}

function subscribe(cb: () => void) {
  addEventListener("hashchange", cb);
  return () => removeEventListener("hashchange", cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, read);
}

/** The parts of the address after the route, such as the programme and workout ids in #/build/p/w. */
export function useRouteParams(): string[] {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return hash.replace(/^#\/?/, "").split("/").filter(Boolean).slice(1).map(decodeURIComponent);
}

export function go(route: Route, ...params: string[]) {
  location.hash = `#/${[route, ...params.map(encodeURIComponent)].join("/")}`;
}

export const href = (route: Route, ...params: string[]) => `#/${[route, ...params.map(encodeURIComponent)].join("/")}`;
