// Build manifest.json + skills-index.json for ONE source.
// Zero-dependency; Node 18+ (fs, crypto, url).
// Usage: node scripts/build-index.mjs [source] [version]
//   source  : "official"（默认，根目录，向后兼容）或 "community" 等附加源（sources/<name>/）
//   version : 默认取 package.json "version"（semver x.y.z）
// Generated URLs point to jsDelivr CDN (same-origin per DSH market contract v1):
//   https://cdn.jsdelivr.net/gh/<owner>/<repo>@v<version>/<rel>/...
// 多源设计：一个仓库承载多个独立目录源，每个源各有 manifest+index（独立 900KiB 配额）。
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSkillFile } from "./lib/skillmd.mjs";
import { resolveSource, cdnBase } from "./lib/sources.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = path.resolve(here, "..");

const pkg = JSON.parse(readFileSync(path.join(hubRoot, "package.json"), "utf8"));
const src = resolveSource(process.argv[2], hubRoot);
const version = process.argv[3] || pkg.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("version must be semver x.y.z (got: " + version + ")");
  process.exit(1);
}
const hub = pkg.dshHub;
if (!hub || !hub.owner || !hub.repo) {
  console.error('package.json "dshHub" must contain owner + repo');
  process.exit(1);
}
const base = cdnBase(pkg, version, src);

// Manual category assignment; unknown skills fall back to ["general"].
const CATEGORIES = {
  "academy-guide": ["learning", "document"],
  "algorithmic-art": ["design", "creative"],
  "brand-guidelines": ["design", "marketing"],
  "canvas-design": ["design", "creative"],
  "claude-api": ["developer-tools", "api"],
  "discernment-nudge": ["writing", "analysis"],
  "doc-coauthoring": ["office", "writing"],
  "docx": ["office", "document"],
  "frontend-design": ["design", "web"],
  "internal-comms": ["writing", "communication"],
  "mcp-builder": ["developer-tools", "mcp"],
  "pdf": ["office", "document"],
  "pptx": ["office", "presentation"],
  "skill-creator": ["developer-tools", "meta"],
  "slack-gif-creator": ["creative", "communication"],
  "theme-factory": ["design", "frontend"],
  "web-artifacts-builder": ["web", "design"],
  "webapp-testing": ["testing", "web"],
  "xlsx": ["office", "spreadsheet"],
  // laolaoshiren/claude-code-skills-zh（中文开发技能，2026-09-02 v1.6.0 导入）
  "api-tester": ["developer-tools", "testing"],
  "changelog-gen": ["developer-tools", "git"],
  "db-migrator": ["developer-tools", "database"],
  "dep-auditor": ["developer-tools", "security"],
  "ds-mapper": ["developer-tools", "documentation"],
  "env-manager": ["developer-tools", "config"],
  "error-translator": ["developer-tools", "nls"],
  "eslint-fix": ["developer-tools", "linting"],
  "git-workflow": ["developer-tools", "git"],
  "github-actions-gen": ["developer-tools", "cicd"],
  "i18n-helper": ["developer-tools", "i18n"],
  "log-analyzer": ["developer-tools", "observability"],
  "perf-profiler": ["developer-tools", "performance"],
  "refactor-advisor": ["developer-tools", "refactoring"],
  "security-audit": ["developer-tools", "security"],
  "skill-curator": ["developer-tools", "meta"],
  "test-generator": ["developer-tools", "testing"],
  "zh-code-reviewer": ["developer-tools", "code-review"],
  "zh-docgen": ["developer-tools", "documentation"],
  "zh-readme": ["developer-tools", "documentation"],
  // zenstory-ai/video-recap-skills（视频技能，2026-09-02 v1.6.0 导入）
  "video-assemble": ["creative", "media"],
  "video-cut": ["creative", "media"],
  "video-recap": ["creative", "media"],
  "video-script": ["creative", "media"],
  "video-understanding": ["creative", "media"],
  "video-voiceover": ["creative", "media"]
};

function authorOf(origin) {
  try {
    const u = new URL(origin);
    const segs = u.pathname.split("/").filter(Boolean);
    if (segs.length > 0) return { name: segs[0], url: origin };
  } catch { /* fallthrough */ }
  return { name: origin, url: origin };
}

const now = new Date().toISOString();
const items = [];
const skillsRoot = src.skillsDir;
if (!existsSync(skillsRoot)) {
  console.error("源目录不存在：" + skillsRoot);
  process.exit(1);
}
for (const dir of readdirSync(skillsRoot).sort()) {
  const skillFile = path.join(skillsRoot, dir, "SKILL.md");
  if (!existsSync(skillFile)) continue;
  const content = readFileSync(skillFile, "utf8");
  const v = validateSkillFile(content, dir);
  if (!v.ok) {
    console.error("skip invalid vendored skill " + dir + ": " + v.reason);
    continue;
  }
  const meta = JSON.parse(readFileSync(path.join(skillsRoot, dir, "_source.json"), "utf8"));
  const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
  items.push({
    id: dir,
    description: v.fm.description,
    categories: CATEGORIES[dir] || ["general"],
    version: pkg.version,
    author: authorOf(meta.origin || "https://github.com"),
    origin: meta.origin || null,
    license: meta.license || null,
    updatedAt: now.slice(0, 10),
    download: { url: base + "/skills/" + dir + "/SKILL.md", sha256 }
  });
}
if (items.length === 0) {
  console.error("no skills found under " + skillsRoot);
  process.exit(1);
}

const manifest = {
  manifestVersion: "1.0.0",
  providerId: "dsh-skills-hub-" + src.name,
  name: "DSH Skills Hub" + (src.name === "official" ? "" : " (" + src.name + ")"),
  description: "Open-source skills catalog for DeepSeek Harness (dsh-skills-manager market source)",
  attribution: { name: hub.owner, url: "https://github.com/" + hub.owner + "/" + hub.repo },
  transport: { kind: "https-json", endpoint: base + "/skills-index.json" }
};

const index = {
  schemaVersion: "1.0.0",
  generatedAt: now,
  revision: version + "-" + now.slice(0, 10),
  items
};

mkdirSync(src.dir, { recursive: true });
writeFileSync(src.manifestFile, JSON.stringify(manifest, null, 2) + "\n", "utf8");
writeFileSync(src.indexFile, JSON.stringify(index, null, 2) + "\n", "utf8");
console.log("[" + src.name + "] manifest.json      -> " + manifest.transport.endpoint);
console.log("[" + src.name + "] skills-index.json  -> " + items.length + " items (" + index.revision + ")");
