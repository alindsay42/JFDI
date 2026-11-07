import { useRegisterSW } from "virtual:pwa-register/react";

// A new version never reloads by itself, so it can't interrupt a session. Everything is saved as you go,
// so updating is safe whenever the button is pressed.
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="update" role="status">
      <span>A new version of J.F.D.I is ready.</span>
      <button type="button" className="btn btn-quiet" onClick={() => setNeedRefresh(false)}>Later</button>
      <button type="button" className="btn" onClick={() => void updateServiceWorker(true)}>Update</button>
    </div>
  );
}
