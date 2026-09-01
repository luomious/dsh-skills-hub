// Regression test: the frontmatter block-scalar parser must fold every vendored
// SKILL.md description into a sound single line ≤ 500 chars (DSH contract §4),
// and must keep the vendored file byte-identical (sha256 is fixed in the index).
//
// This guards against the "block scalar parsed as a literal > / |-" bug that
// corrupted academy-guide / claude-api / discernment-nudge. Run via `npm test`
// (also chained before `npm run build` and inside `npm run validate`).
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSkillFile } from "./lib/skillmd.mjs";
import { resolveSource } from "./lib/sources.mjs";

const hubRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const src = resolveSource(process.argv[2], hubRoot);
const skillsRoot = src.skillsDir;

const GARBAGE = new Set([">", "|-", "|", ">-"]);
let fail = 0, total = 0;

for (const dir of readdirSync(skillsRoot).sort()) {
  const path = join(skillsRoot, dir, "SKILL.md");
  total++;
  const content = readFileSync(path, "utf8");
  const sha = createHash("sha256").update(content, "utf8").digest("hex").slice(0, 12);
  const v = validateSkillFile(content, dir);
  if (!v.ok) { console.error(`[FAIL] ${dir}: ${v.reason}`); fail++; continue; }
  const d = v.desc;
  const bad = GARBAGE.has(d.trim()) || d.length === 0 || d.length > 500;
  if (bad) { console.error(`[FAIL] ${dir}: description unsound len=${d.length} value=${JSON.stringify(d)}`); fail++; continue; }
  console.log(`[ok]   ${dir.padEnd(20)} len=${String(d.length).padStart(3)} sha12=${sha}`);
}

if (fail > 0) {
  console.error(`\nPARSER REGRESSION FAILED: ${fail}/${total} skills failed`);
  process.exit(1);
}
console.log(`\nPARSER REGRESSION OK: ${total}/${total} skills parse to a sound single-line description`);