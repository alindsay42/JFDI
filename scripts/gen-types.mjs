// Generates TypeScript types from schema/*.json into src/formats/generated/.
// The schemas are the source of truth; never edit the generated files by hand.
// With --check, fails if the generated files are out of date (run in CI).
import { compileFromFile } from "json-schema-to-typescript";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src/formats/generated");
const check = process.argv.includes("--check");
const names = ["programme", "equipment", "library", "profile", "log", "backup"];
const banner = "// Generated from schema/*.schema.json by scripts/gen-types.mjs. Do not edit; run `npm run types`.";

mkdirSync(out, { recursive: true });
let stale = 0;
for (const name of names) {
  const ts = await compileFromFile(join(root, `schema/${name}.schema.json`), {
    cwd: join(root, "schema"),
    bannerComment: banner,
    additionalProperties: false,
    unknownAny: true,
    style: { singleQuote: false, printWidth: 100 },
  });
  const file = join(out, `${name}.ts`);
  if (check) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (current !== ts) { console.error(`✗ ${file} is out of date: run npm run types`); stale++; }
    else console.log(`✓ src/formats/generated/${name}.ts is up to date`);
  } else {
    writeFileSync(file, ts);
    console.log(`wrote src/formats/generated/${name}.ts`);
  }
}
process.exit(stale ? 1 : 0);
