// Writes docs/rules.md from the rule tables in tests/engine/*.rules.ts.
// With --check, fails if docs/rules.md is out of date (run in CI).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Cell, RuleTable } from "../tests/engine/rule-table.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "tests/engine");
const target = join(root, "docs/rules.md");

const esc = (s: string) => s.replace(/\|/g, "\\|");
const cell = (v: Cell) => (v === null ? "none" : typeof v === "boolean" ? (v ? "yes" : "no") : String(v));

type AnyTable = RuleTable<Record<string, Cell>, Cell>;
const tables: AnyTable[] = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith(".rules.ts")).sort()) {
  const mod = (await import(pathToFileURL(join(dir, file)).href)) as Record<string, AnyTable>;
  tables.push(...Object.values(mod));
}

let md = "# Training rules\n\n";
md += "Generated from the rule tables in `tests/engine/` by `npm run rules`. Do not edit by hand.\n\n";
md += "Each row is a test: the app must give exactly this answer, or the change can't be merged.\n";
for (const t of tables) {
  const keys = Object.keys(t.columns.given);
  md += `\n## ${t.title}\n\n${t.summary}\n\n`;
  md += `| Case | ${keys.map((k) => esc(t.columns.given[k]!)).join(" | ")} | ${esc(t.columns.expected)} |\n`;
  md += `| --- | ${keys.map(() => "---").join(" | ")} | --- |\n`;
  for (const r of t.rows) {
    const shown = t.show ? t.show(r.expected) : cell(r.expected);
    md += `| ${esc(r.case)} | ${keys.map((k) => esc(cell(r.given[k]!))).join(" | ")} | ${esc(shown)} |\n`;
  }
}

if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(target, "utf8"); } catch { /* missing */ }
  if (current !== md) { console.error("✗ docs/rules.md is out of date: run npm run rules"); process.exit(1); }
  console.log("✓ docs/rules.md is up to date");
} else {
  writeFileSync(target, md);
  console.log(`wrote docs/rules.md (${tables.length} tables)`);
}
