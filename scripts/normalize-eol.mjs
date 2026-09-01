// normalize-eol.mjs — 把 vendor 的 SKILL.md / _source.json / 索引统一为 LF 行尾，
// 消除 git core.autocrlf 提交时的行尾规范化导致的 SHA-256 漂移。
// 用法: node scripts/normalize-eol.mjs   （重跑幂等）
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const hubRoot = join(here, "..");
const skillsRoot = join(hubRoot, "skills");

const toLF = (s) => String(s).replace(/\r\n/g, "\n");

let changed = 0;
const files = [];
for (const dir of readdirSync(skillsRoot).sort()) {
  for (const name of ["SKILL.md", "_source.json"]) {
    const p = join(skillsRoot, dir, name);
    if (existsSync(p)) files.push(p);
  }
}
for (const p of ["manifest.json", "skills-index.json", "package.json", "README.md", "PUBLISH.md", "LICENSE", ".gitignore"]) {
  const f = join(hubRoot, p);
  if (existsSync(f)) files.push(f);
}
for (const p of files) {
  const before = readFileSync(p, "utf8");
  const after = toLF(before);
  if (before !== after) {
    writeFileSync(p, after, "utf8");
    console.log("LF-normalized: " + p.replace(hubRoot + "\\", ""));
    changed++;
  }
}
console.log(`done: ${changed} files normalized to LF`);
