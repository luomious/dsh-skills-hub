// Build manifest.json + skills-index.json from the ./skills/ vendor directory.
// Zero-dependency; Node 18+ (fs, crypto, url).
// Usage: node scripts/build-index.mjs [version]
//   version defaults to package.json "version" (semver x.y.z).
// Generated URLs point to jsDelivr CDN:
//   https://cdn.jsdelivr.net/gh/<owner>/<repo>@v<version>/...
// which keeps manifest, index and downloads on the SAME origin
// (DSH market contract v1 requirement).
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSkillFile } from "./lib/skillmd.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = path.resolve(here, "..");
const skillsRoot = path.join(hubRoot, "skills");

const pkg = JSON.parse(readFileSync(path.join(hubRoot, "package.json"), "utf8"));
const version = process.argv[2] || pkg.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("version must be semver x.y.z (got: " + version + ")");
  process.exit(1);
}
const hub = pkg.dshHub;
if (!hub || !hub.owner || !hub.repo) {
  console.error('package.json "dshHub" must contain owner + repo');
  process.exit(1);
}
const base = "https://cdn.jsdelivr.net/gh/" + hub.owner + "/" + hub.repo + "@v" + version;

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
  "xlsx": ["office", "spreadsheet"]
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
for (const dir of readdirSync(skillsRoot).sort()) {
  const skillFile = path.join(skillsRoot, dir, "SKILL.md");
  if (!existsSync(skillFile)) continue;
  const content = readFileSync(skillFile, "utf8");
  const v = validateSkillFile(content, dir);
  if (!v.ok) {
    console.error("skip invalid vendored skill " + dir + ": " + v.reason);
    continue;
  }
  const src = JSON.parse(readFileSync(path.join(skillsRoot, dir, "_source.json"), "utf8"));
  const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
  items.push({
    id: dir,
    description: v.fm.description,
    categories: CATEGORIES[dir] || ["general"],
    version: pkg.version,
    author: authorOf(src.origin || "https://github.com"),
    origin: src.origin || null,
    license: src.license || null,
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
  providerId: "dsh-skills-hub",
  name: "DSH Skills Hub",
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

writeFileSync(path.join(hubRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
writeFileSync(path.join(hubRoot, "skills-index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
console.log("manifest.json      -> " + manifest.transport.endpoint);
console.log("skills-index.json  -> " + items.length + " items (" + index.revision + ")");
