// Self-healing (kept for audit + reruns): normalize vendored SKILL.md description
// lines to a single quoted line whose embedded ASCII quotes/backslashes are
// replaced with full-width forms. Guarantees BOTH this hub's parser and the
// official dsh-skills-manager validator read identical clean text (the official
// validator strips surrounding quotes but does not unescape `\"`).
//
// Idempotent by convergence: rewrite is applied repeatedly until the bytes stop
// changing (each pass only removes residue, never adds), so a clean file is
// reported untouched and a once-mangled file converges to the stable form.
// Run: node scripts/normalize-desc.mjs [source]
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter, collapseDescription, rewriteDescription } from "./lib/skillmd.mjs";
import { resolveSource } from "./lib/sources.mjs";

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const src = resolveSource(process.argv[2], here);
const skillsRoot = src.skillsDir;
const MAX_PASSES = 6;

let changed = 0, untouched = 0;
for (const dir of readdirSync(skillsRoot).sort()) {
  const file = join(skillsRoot, dir, "SKILL.md");
  if (!existsSync(file)) { untouched++; continue; }
  let current = readFileSync(file, "utf8");
  let fm = parseFrontmatter(current);
  if (!fm) { untouched++; continue; }
  const blockScalar = /^description\s*:\s*([>|][+-]?)\s*$/m.test(current);
  const hasResidue = /\\"/.test(current) || /／“/.test(current);
  if (!blockScalar && !hasResidue) { untouched++; continue; } // already clean single line
  let prev = current;
  let passes = 0;
  while (passes < MAX_PASSES) {
    const next = rewriteDescription(prev, collapseDescription(String(parseFrontmatter(prev)?.description || "").trim()));
    passes++;
    if (next === prev) break;
    prev = next;
  }
  if (prev !== current) {
    writeFileSync(file, prev, "utf8");
    const fin = parseFrontmatter(prev);
    console.log("normalized " + dir + " -> " + (fin ? String(fin.description).length : "?") + " chars (passes=" + passes + ")");
    changed++;
  } else {
    untouched++;
  }
}
console.log(`done: ${changed} normalized, ${untouched} untouched`);
process.exitCode = 0;
