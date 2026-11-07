import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { db, requestPersistentStorage } from "./store/db.ts";
import { syncBundledProgrammes } from "./store/programmes.ts";
import "./shared/theme.css";

void requestPersistentStorage();
void syncBundledProgrammes(db);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
