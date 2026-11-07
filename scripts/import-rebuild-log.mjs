// Command-line version of the app's Rebuild Log import (src/formats/rebuild-log.js).
//
//   node scripts/import-rebuild-log.mjs backup.json --profile andrew [--out log.json]
import { readFileSync, writeFileSync } from "node:fs";
import { convertRebuildLog } from "../src/formats/rebuild-log.js";

{
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith("--"));
  const opt = name => { const i = args.indexOf(`--${name}`); return i > -1 ? args[i + 1] : undefined; };
  if (!file || !opt("profile")) {
    console.log("Usage: node scripts/import-rebuild-log.mjs backup.json --profile <profile id> [--out log.json]");
    process.exit(2);
  }
  const root = new URL("..", import.meta.url);
  const library = JSON.parse(readFileSync(new URL("data/library.json", root), "utf8"));
  const { log, problems } = convertRebuildLog(JSON.parse(readFileSync(file, "utf8")), opt("profile"), library);
  problems.forEach(p => console.error(`! ${p}`));
  const text = JSON.stringify(log, null, 2) + "\n";
  if (opt("out")) writeFileSync(opt("out"), text); else process.stdout.write(text);
  console.error(`${log.sessions.length} sessions, ${log.days.length} days, ${log.bodyweight.length} weigh-ins${problems.length ? `, ${problems.length} problems` : ""}`);
  process.exit(problems.length ? 1 : 0);
}
