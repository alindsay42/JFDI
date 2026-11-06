// Writes docs/catalogue.md: the household equipment and every exercise in the library, as tables.
//
//   npm run catalogue            rewrites docs/catalogue.md from data/
//   npm run catalogue -- --check fails if docs/catalogue.md is out of date (used by npm test)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = p => JSON.parse(readFileSync(join(root, p), "utf8"));
const eq = readJson("data/equipment.json");
const lib = readJson("data/library.json");
const itemName = Object.fromEntries(eq.items.map(i => [i.id, i.name]));
const MEASURE = { load: "kg × reps", reps: "reps", time: "seconds", distance: "metres", calories: "calories" };

const lines = [
  "# Equipment and exercise catalogue",
  "",
  "Generated from `data/equipment.json` and `data/library.json` by `npm run catalogue`. Don't edit this file by hand.",
  "",
  `${eq.items.length} pieces of equipment, ${lib.families.length} exercise families, ${lib.exercises.length} exercises.`,
  "",
  "## Equipment",
  "",
  "| Item | Kind | Details |",
  "| --- | --- | --- |"
];
for (const i of eq.items) {
  const d = [];
  if (i.kg !== undefined) d.push(`${i.kg}kg`);
  if (i.barType) d.push(`bar type \`${i.barType}\``);
  if (i.kgEach !== undefined) d.push(`${i.kgEach}kg each`);
  if (i.totalKg !== undefined) d.push(`about ${i.totalKg}kg in total`);
  if (i.maxKg !== undefined) d.push(`up to ${i.maxKg}kg`);
  if (i.missingKg?.length) d.push(`missing: ${i.missingKg.map(x => `${x}kg`).join(", ")}`);
  if (i.attachesTo) d.push(`attaches to ${itemName[i.attachesTo]}`);
  if (i.tbc) d.push("**to confirm**");
  lines.push(`| ${i.name} (\`${i.id}\`) | ${i.kind} | ${d.join("; ")} |`);
}
lines.push("", "## Exercises by family", "");
for (const f of lib.families) {
  lines.push(`### ${f.name}`, "", `Varies by: ${f.variations}.`, "", "| Exercise | Measured by | Equipment | Flags |", "| --- | --- | --- | --- |");
  for (const e of lib.exercises.filter(x => x.family === f.id)) {
    let m = MEASURE[e.measure];
    if (e.loadPer === "each") m = e.measure === "load" ? "kg each × reps" : `${m}, kg each`;
    if (e.perSide) m += ", per side";
    const equip = [];
    if (e.barTypes) equip.push(e.barTypes.map(b => `${b} bar`).join(" or "));
    equip.push(...e.requires.map(r => itemName[r]));
    lines.push(`| ${e.name} (\`${e.id}\`) | ${m} | ${equip.join(", ") || "None"} | ${(e.flags || []).join(", ")} |`);
  }
  lines.push("");
}
const text = lines.join("\n");
const out = join(root, "docs/catalogue.md");
if (process.argv.includes("--check")) {
  if (!existsSync(out) || readFileSync(out, "utf8") !== text) { console.log("✗ docs/catalogue.md is out of date: run npm run catalogue"); process.exit(1); }
  console.log("✓ docs/catalogue.md is up to date");
} else {
  writeFileSync(out, text);
  console.log(`Wrote docs/catalogue.md (${lib.exercises.length} exercises)`);
}
