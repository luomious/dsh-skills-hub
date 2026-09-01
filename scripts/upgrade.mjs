// upgrade.mjs — 一键升级某个源：从上游仓库拉取 SKILL.md → 契约导入 → 重建索引 → 全量回归。
// 用法: node scripts/upgrade.mjs [source] [upstream-url] [origin-url]
//   [source]      : 目标源（默认 official=根目录；community 等= sources/<name>/）
//   [upstream-url]: 默认 https://github.com/anthropics/skills（官方）
//   [origin-url]  : 默认同 upstream（作为 author 链接写入 _source.json）
//
// 流程:
//   1. git clone --depth 1 上游到临时目录（本地网络需 openssl 后端时脚本自动加 -c http.sslBackend=openssl）
//   2. import-upstream.mjs  契约校验 + 描述截断/清洗（复用 lib/skillmd.mjs）
//   3. normalize-desc.mjs   自愈收敛（块标量/转义残留 → 干净单行）
//   4. build-index.mjs + validate-index.mjs + verify-parser + test-rewrite
//   5. 输出「新增/更新/跳过」清单 + 发布提醒（不发版，仅本地就绪）
//
// 发布仍需人工: bump package.json version → commit → git tag vX.Y.Z → push --tags（见 PUBLISH.md）
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const hubRoot = join(here, "..");
const SOURCE = process.argv[2] || "official";
const UPSTREAM = process.argv[3] || "https://github.com/anthropics/skills";
const ORIGIN = process.argv[4] || UPSTREAM;

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

const tmp = mkdtempSync(join(tmpdir(), "dsh-skills-hub-upstream-"));
const upstreamRoot = join(tmp, "skills");

try {
  // 1) shallow clone（带 openssl 后端，兼容本机 TLS 问题）
  run("git", ["-c", "http.sslBackend=openssl", "clone", "--depth", "1", UPSTREAM, upstreamRoot]);

  // 2) 契约导入到目标源
  run("node", [join(here, "import-upstream.mjs"), upstreamRoot, ORIGIN, SOURCE], { cwd: hubRoot });

  // 3) 自愈收敛（块标量/转义残留 → 干净单行，幂等）
  run("node", [join(here, "normalize-desc.mjs"), SOURCE], { cwd: hubRoot });

  // 4) 重建 + 全量回归
  run("node", [join(here, "build-index.mjs"), SOURCE], { cwd: hubRoot });
  run("node", [join(here, "validate-index.mjs"), SOURCE], { cwd: hubRoot });
  run("node", [join(here, "verify-parser.mjs"), SOURCE], { cwd: hubRoot });
  run("node", [join(here, "test-rewrite.mjs"), SOURCE], { cwd: hubRoot });

  console.log("\n=== UPGRADE LOCAL OK [" + SOURCE + "] ===");
  console.log("下一步发布（需网络）:");
  console.log("  1. 手动检查 " + (SOURCE === "official" ? "skills/" : "sources/" + SOURCE + "/skills/") + " 与索引变更");
  console.log("  2. bump package.json version（当前 v" + getVersion(hubRoot) + "）");
  console.log("  3. git add -A && git commit -m \"feat(skills): upgrade\"; git tag v<新版本>; git push origin main --tags");
  console.log("  4. DSH 设置页 Skills 市场换新源 URL（见 PUBLISH.md）");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

function getVersion(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return pkg.version;
  } catch {
    return "?";
  }
}
