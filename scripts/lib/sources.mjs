// lib/sources.mjs — 多源解析（单一事实源）。
// 布局约定（一个仓库多源 = 大型库）：
//   official（默认/根） -> hubRoot/skills + hubRoot/manifest.json + hubRoot/skills-index.json（向后兼容 v1.1.x）
//   community 等附加源  -> hubRoot/sources/<name>/skills + manifest.json + skills-index.json
// 每个源独立 900KiB 索引配额，共用同一个 repo/tag（jsDelivr 同源满足）。
//
// 用法：各脚本 `const src = resolveSource(process.argv[2])`，随后用 src.skillsDir / src.relPath 等。

export function resolveSource(raw, hubRoot) {
  const name = String(raw || "").trim() || "official";
  if (name === "official" || name === "root") {
    return {
      name: "official",
      rel: "",                                   // URL 相对路径（根为空）
      dir: hubRoot,                              // 源目录
      skillsDir: hubRoot + "/skills",            // 技能 vendor 目录
      manifestFile: hubRoot + "/manifest.json",
      indexFile: hubRoot + "/skills-index.json"
    };
  }
  if (!/^[a-z0-9-]{1,32}$/.test(name)) {
    throw new Error("源名必须为 kebab-case：got " + name);
  }
  const dir = hubRoot + "/sources/" + name;
  return {
    name,
    rel: "sources/" + name,
    dir,
    skillsDir: dir + "/skills",
    manifestFile: dir + "/manifest.json",
    indexFile: dir + "/skills-index.json"
  };
}

/** 列出所有已配置源（根 official + sources/* 下含 manifest 的源）。 */
export function listSources(hubRoot, fs) {
  const out = [];
  const candidates = [resolveSource("official", hubRoot)];
  const srcRoot = hubRoot + "/sources";
  if (fs.existsSync(srcRoot)) {
    for (const d of fs.readdirSync(srcRoot).sort()) {
      if (fs.existsSync(srcRoot + "/" + d + "/skills")) {
        candidates.push(resolveSource(d, hubRoot));
      }
    }
  }
  for (const s of candidates) {
    if (fs.existsSync(s.skillsDir)) out.push(s);
  }
  return out;
}

/** jsDelivr 下载前缀：https://cdn.jsdelivr.net/gh/<owner>/<repo>@v<version>/<rel> */
export function cdnBase(pkg, version, src) {
  const base = "https://cdn.jsdelivr.net/gh/" + pkg.dshHub.owner + "/" + pkg.dshHub.repo + "@v" + version;
  return src.rel ? base + "/" + src.rel : base;
}
