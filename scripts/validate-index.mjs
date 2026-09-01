// Validate generated manifest.json + skills-index.json for ONE source against the DSH market
// contract v1, including offline sha256 verification against the vendored files.
// Usage: node scripts/validate-index.mjs [source]
//   source : "official"（默认，根目录）或 "community" 等（sources/<name>/）
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { validateSkillFile } from "./lib/skillmd.mjs";
import { resolveSource } from "./lib/sources.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = path.resolve(here, "..");
const src = resolveSource(process.argv[2], hubRoot);

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const CATEGORY_RE = /^[a-z0-9-]{1,32}$/;

function fail(msg) { console.error("VALIDATION FAILED: " + msg); process.exitCode = 1; }

const manifest = JSON.parse(readFileSync(src.manifestFile, "utf8"));
const index = JSON.parse(readFileSync(src.indexFile, "utf8"));

// --- manifest ---
if (manifest.manifestVersion !== "1.0.0") fail("manifestVersion");
if (manifest.selected === true || manifest.default === true || manifest.fallback === true) fail("manifest self-select");
if (!manifest.providerId || manifest.providerId.length > 64) fail("providerId");
if (!manifest.name || manifest.name.length > 100) fail("name");
const t = manifest.transport;
if (!t || t.kind !== "https-json") fail("transport.kind");
if (!/^https:\/\//.test(t.endpoint)) fail("endpoint not https");
let ep;
try {
  ep = new URL(t.endpoint);
  if (ep.username || ep.password) fail("endpoint credentials");
  if (ep.search || ep.hash) fail("endpoint query/fragment");
} catch { fail("endpoint parse"); }

// --- index ---
if (index.schemaVersion !== "1.0.0") fail("schemaVersion");
if (!Array.isArray(index.items)) fail("items not array");
if (index.items.length > 2000) fail("items > 2000");
if (index.items.length === 0) fail("empty items");

const ids = new Set();
const GARBAGE_DESC = new Set([">", "|-", "|", ">-", ">+"]);
for (const it of index.items) {
  const id = String(it.id || "");
  if (!ID_RE.test(id) || id.length > 64) fail("bad id " + id);
  if (ids.has(id)) fail("dup id " + id);
  ids.add(id);
  const desc = String(it.description || "").trim();
  if (!desc || desc.length > 500) fail("bad description " + id);
  if (GARBAGE_DESC.has(desc)) fail("garbage description (block-scalar marker) " + id);
  if (VERSION_RE.test(String(it.version || "")) !== true) fail("bad version " + id);
  const cats = Array.isArray(it.categories) ? it.categories : [];
  if (cats.length > 8) fail("too many categories " + id);
  for (const c of cats) if (!CATEGORY_RE.test(String(c))) fail("bad category " + c);
  const dl = it.download;
  if (!dl || !/^https:\/\//.test(String(dl.url || ""))) fail("download not https " + id);
  if (!SHA256_RE.test(String(dl.sha256 || ""))) fail("bad sha256 " + id);
  let dUrl;
  try { dUrl = new URL(dl.url); } catch { fail("download url parse " + id); continue; }
  if (dUrl.origin !== ep.origin) fail("download origin mismatch " + id);

  // offline sha256 check against vendored file
  const local = path.join(src.skillsDir, id, "SKILL.md");
  if (!existsSync(local)) { fail("missing local file " + local); continue; }
  const actual = createHash("sha256").update(readFileSync(local, "utf8"), "utf8").digest("hex");
  if (actual !== dl.sha256) fail("sha256 mismatch " + id);

  // cross-check: index description must equal the description the parser actually
  // derives from the vendored SKILL.md (guards against index/parser drift, e.g.
  // a block scalar ">" folded to garbage in the index but not in the file).
  const parsed = validateSkillFile(readFileSync(local, "utf8"), id);
  if (!parsed.ok) { fail("vendored file fails frontmatter validation " + id + ": " + parsed.reason); continue; }
  if (parsed.fm.name !== id) fail("frontmatter name mismatch " + id);
  if (parsed.desc !== desc) fail("index description drift " + id);
}

if (!process.exitCode) {
  console.log("VALIDATION OK: " + index.items.length + " items, endpoint " + t.endpoint);
} else {
  process.exit(1);
}
