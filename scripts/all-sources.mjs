// all-sources.mjs — 对全部源（official + sources/*）逐个执行某个子脚本。
// 用法: node scripts/all-sources.mjs <subcommand> [sub-args...]
//   例: node scripts/all-sources.mjs verify-parser
//       node scripts/all-sources.mjs build-index
//       node scripts/all-sources.mjs validate-index
// 每个源：node scripts/<subcommand>.mjs <source> <sub-args...>
// 任一失败立即退出（非零）。
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSource } from "./lib/sources.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const hubRoot = join(here, "..");
const [sub, ...subArgs] = process.argv.slice(2);
if (!sub) {
  console.error("Usage: node scripts/all-sources.mjs <subcommand> [sub-args...]");
  process.exit(2);
}

const sources = [resolveSource("official", hubRoot)];
const srcRoot = join(hubRoot, "sources");
if (existsSync(srcRoot)) {
  for (const d of readdirSync(srcRoot).sort()) {
    if (existsSync(join(srcRoot, d, "skills"))) {
      sources.push(resolveSource(d, hubRoot));
    }
  }
}

let failed = 0;
for (const src of sources) {
  if (!existsSync(src.skillsDir)) continue;
  const cmd = join(here, sub + ".mjs");
  const args = [cmd, src.name, ...subArgs];
  console.log(`\n===== [${src.name}] node ${sub}.mjs ${src.name} ${subArgs.join(" ")} =====`);
  try {
    execFileSync(process.execPath, args, { stdio: "inherit" });
  } catch (e) {
    console.error(`[${src.name}] ${sub} FAILED`);
    failed++;
  }
}
if (failed > 0) {
  console.error(`\nALL-SOURCES: ${failed} source(s) failed`);
  process.exit(1);
}
console.log(`\nALL-SOURCES OK: ${sources.length} source(s)`);
