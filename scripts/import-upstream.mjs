// Import validated SKILL.md files from an upstream repo checkout into a target source's skills/.
// Usage: node scripts/import-upstream.mjs <upstream-root> <origin-url> [source]
//   <upstream-root> : local checkout (e.g. git clone) containing skills/<name>/SKILL.md
//   <origin-url>    : upstream repo URL, recorded into _source.json and used as author link
//   [source]        : 目标源（默认 official=根目录；community 等= sources/<name>/）
// Only skills whose frontmatter name matches the directory (kebab-case) and that have
// a non-empty description are imported (DSH market contract v1 rules).
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSkillFile, parseFrontmatter, ID_RE, shortenDescription, rewriteDescription } from "./lib/skillmd.mjs";
import { resolveSource } from "./lib/sources.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = path.resolve(here, "..");
const [upstreamRoot, originUrl, sourceArg] = process.argv.slice(2);
if (!upstreamRoot || !originUrl) {
  console.error("Usage: node scripts/import-upstream.mjs <upstream-root> <origin-url> [source]");
  process.exit(1);
}
const src = resolveSource(sourceArg, hubRoot);
const destRoot = src.skillsDir;

const skillsDir = path.join(upstreamRoot, "skills");
if (!existsSync(skillsDir)) {
  console.error("No skills/ directory at: " + skillsDir);
  process.exit(1);
}

let imported = 0;
const skipped = [];
for (const dir of readdirSync(skillsDir).sort()) {
  const skillFile = path.join(skillsDir, dir, "SKILL.md");
  if (!existsSync(skillFile)) { skipped.push(dir + " (no SKILL.md)"); continue; }
  let content = readFileSync(skillFile, "utf8");
  const fm0 = parseFrontmatter(content);
  if (!fm0) { skipped.push(dir + " (no frontmatter)"); continue; }
  const name0 = String(fm0.name || "").trim();
  if (name0 !== dir || !ID_RE.test(name0)) { skipped.push(dir + " (name mismatch)"); continue; }
  let truncated = false;
  if (String(fm0.description || "").length > 500) {
    content = rewriteDescription(content, shortenDescription(String(fm0.description)));
    truncated = true;
  }
  const v = validateSkillFile(content, dir);
  if (!v.ok) { skipped.push(dir + " (" + v.reason + ")"); continue; }
  const destDir = path.join(destRoot, dir);
  mkdirSync(destDir, { recursive: true });
  writeFileSync(path.join(destDir, "SKILL.md"), content, "utf8");
  writeFileSync(path.join(destDir, "_source.json"), JSON.stringify({
    origin: originUrl,
    license: (v.fm.license && String(v.fm.license).trim()) || null,
    descriptionTruncated: truncated,
    importedAt: new Date().toISOString()
  }, null, 2) + "\n", "utf8");
  imported++;
}
console.log("[" + src.name + "] imported: " + imported);
if (skipped.length > 0) console.log("[" + src.name + "] skipped:\n  " + skipped.join("\n  "));
