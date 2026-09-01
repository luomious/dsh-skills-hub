# DSH Skills Hub

开源 DeepSeek Harness 技能目录（market source for `dsh-skills-manager`）。
在 DSH 设置 → Skills → 市场 可以直接**联网搜索、一键安装开源 skill**。

## 它是什么

DSH Desktop 自带 `dsh-skills-manager` 插件，其「市场」页已实现：目录源管理、搜索分类、安装/更新/卸载、SHA-256 强校验、原子安装。市场需要一个**符合契约的目录源**（manifest + 索引 + 下载文件必须同源 HTTPS）。

本仓库就是这样一个目录源，且采用**一个仓库、一个统一源**的大型库架构：

- **统一源（2026-09-01 v1.3.0 起）**：`official` 源位于根目录 `skills/`，当前 **70 个技能**——19 个 anthropics 官方 + 19 个 superpowers-zh 中文技能 + humanizer-zh-academic + shuorenhua + 4 个社区种子（code-review / git-commit-message / log-analysis / paper-summary）。**只需一个源即可搜索全部技能，无需切换源**。
- **兼容源**：`sources/community/` 保留 4 个社区种子技能（独立 manifest + 索引 + 900KiB 配额），向后兼容 v1.1.x 多源用法。
- 通过 **jsDelivr CDN** 托管（`cdn.jsdelivr.net/gh/<owner>/<repo>@v<version>/...`），manifest / 索引 / 下载全部同源，且国内可访问；
- skill 文件 **vendor 快照**进本仓库（sha256 固定、内容不可变，安装校验 100% 可复现）；
- 构建产物由零依赖 Node 脚本生成并**自动校验**（多源参数化：`node scripts/build-index.mjs <source>`），重新发布只需一条命令。

## 快速开始（发布到 GitHub）

1. 在 GitHub 新建仓库 `dsh-skills-hub`（owner 已在 `package.json` 配为 `luomious`），把本目录内容推上去。
2. 本目录即独立 git 仓库形态；先在本地跑完整验证：

   ```bash
   npm test                  # 回归测试 + 全源契约校验（必须全绿）
   npm run build:all         # 重建全部源（official + community）的 manifest + index
   npm run validate:all      # 复校验，必须输出 VALIDATION OK
   ```

3. 提交并打 tag（tag 名必须与 `package.json` 的 `version` 一致）：

   ```bash
   git add -A && git commit -m "feat(skills): bump to N skills"
   git tag v1.6.0
   git push origin main --tags
   ```

> ⚠️ jsDelivr 按 tag 内容**永久缓存**，版本不可变；改坏只能发新 tag，所以**发布前 `npm test && npm run build:all` 必须全绿**。

## 在 DSH 中使用

1. 打开 DSH Web GUI（http://127.0.0.1:43120）→ 设置 → **Skills** → **市场** 页；
2. 「添加目录源（manifest URL）」——默认只添加**统一源**即可搜索全部 70 个技能：

   ```
   # 统一源（70 个技能：官方 + 中文 + 社区种子，推荐）
   https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.6.0/manifest.json
   ```

   （可选）兼容旧多源用法再加 community 源：

   ```
   https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.6.0/sources/community/manifest.json
   ```

3. 添加后**选中**该源 → 即可浏览 / 搜索 / 分类 / 一键安装（SHA-256 强校验 + 原子安装）。搜索只落在当前选中源内（契约设计，非 bug）。

## 目录结构

```
skills/                       # official 源：vendor skill 快照（每个目录一个 SKILL.md + _source.json）
  docx/SKILL.md
  docx/_source.json           # 来源 / 许可 / 是否截断描述（审计用）
  chinese-code-review/        # superpowers-zh 中文技能
  ...
sources/community/            # community 源（多源兼容：每源独立 manifest/index/技能目录）
  manifest.json + skills-index.json + skills/<name>/SKILL.md
scripts/
  import-upstream.mjs         # 从上游仓库 clone 目录导入 skill 到指定源（含契约校验）
  build-index.mjs             # 扫描某源 skills/ → 生成 manifest.json + skills-index.json
  validate-index.mjs          # 复刻 DSH 市场契约 v1 校验（含离线 sha256 复核）
  all-sources.mjs             # 对全部源逐个执行子命令（build/validate/verify-parser）
  verify-parser.mjs           # 回归测试：frontmatter 解析器对每个 vendor 技能产出健康单行描述
  test-rewrite.mjs            # 回归测试：description 截断重写对块标量/内联都正确
  normalize-desc.mjs          # 收敛式描述自愈（幂等，重复执行无副作用）
  normalize-eol.mjs           # 全部源行尾归一为 LF（防 git autocrlf 漂移 sha256）
  upgrade.mjs                 # 一键升级：clone→import→normalize→build→validate
  lib/skillmd.mjs             # 共享 frontmatter 解析/校验/折叠/重写（单一事实源）
  lib/sources.mjs             # 源解析 / 源列表 / CDN 前缀
manifest.json                 # 目录源声明（生成产物，提交入库）
skills-index.json             # 技能索引（生成产物，提交入库）
```

## 可维护性与回归（2026-09-01 加固）

**历史问题**：`parseFrontmatter()` 曾只支持 `key: value` 单行；`description: >` / `description: |-`
这类 YAML **块标量**（多行折叠/字面块）会被误解析成字面 `>` / `|-`，导致 3 个技能（academy-guide / claude-api / discernment-nudge）的索引描述损坏。

**修复**（治本，非补丁）：
- `lib/skillmd.mjs` 的 `parseFrontmatter()` 现支持 `>`, `|`, `|-`, `>-`, `|+`, `>+` 块标量折叠；
- 新增 `collapseDescription()` / `shortenDescription()` / `rewriteDescription()`，统一处理「多行描述 → 契约要求的 ≤500 单行」，单一事实源，`import-upstream` / `build-index` / `validate-index` 共用；
- `validate-index.mjs` 增加两道纵深防御：
  1. 拒绝 `>`, `|-` 等垃圾描述（块标量误解析会立即 fail）；
  2. **交叉校验**：索引里每条 `description` 必须等于解析器从 vendor 文件实际解析出的值（堵死索引/解析漂移）。

**回归保障**：`npm test` 每次跑 3 道：
1. `verify-parser.mjs` — 全部 vendor 技能解析出健康单行描述（≤500，非垃圾，sha12 不变）；
2. `test-rewrite.mjs` — 块标量/内联描述截断重写均正确、无悬空行、重写后可再校验；
3. `validate-index.mjs` — 契约 v1 全量校验 + 离线 sha256 + 交叉校验。

**长期可迭代工作流**（新增 skill / 上游更新后）：

```bash
git -c http.sslBackend=openssl clone --depth 1 https://github.com/anthropics/skills.git /tmp/upstream
npm run import -- /tmp/upstream https://github.com/anthropics/skills   # 契约校验 + 自动截断
npm test && npm run build && npm run validate                          # 全绿才可发布
git add -A && git commit -m "feat(skills): bump to N skills"
git tag v1.6.0 && git push origin main --tags                          # 需网络；DSH 换新源 URL
```

## 维护指南（可迭代）

### 更新上游 skill / 加新的

```bash
# 1. 拉取上游（本机网络需 openssl 后端）
git -c http.sslBackend=openssl clone --depth 1 https://github.com/anthropics/skills.git /tmp/upstream
# 2. 导入（只导入契约合规的；描述超 500 字符会自动截断并记录）
npm run import -- /tmp/upstream https://github.com/anthropics/skills
# 3. 重建 + 校验
npm run build && npm run validate
# 4. 发布：bump package.json version → 提交 → git tag v1.6.0 → push --tags
```

多个上游源可反复执行 `import`（同名后导入的会覆盖，注意检查输出）。

### 导入中文 / 社区技能（MIT 许可，2026-09-01 验证可行）

```bash
# 从上游仓库导入到统一源（official 根目录）
npm run upgrade -- official https://github.com/<MIT上游>/<skills仓库>.git
# 或克隆后手工导入
npm run import -- <本地克隆> <上游URL> official
npm test && npm run build:all && npm run validate:all
```

要求：上游必须 MIT（或明确可再分发）许可；结构为 `skills/<kebab-name>/SKILL.md`（或单层 SKILL.md 可转换）。

### 手动添加单个 skill

直接把 `SKILL.md` 放到 `skills/<kebab-case-name>/SKILL.md`（frontmatter 必须 `name`= 目录名，kebab-case，`description` ≤500 字符），再执行 `npm run build && npm run validate`。

### 发布新版本

1. 改 `package.json` 的 `version`（如 `1.6.0`）；
2. `npm run build && npm run validate`；
3. 提交 + `git tag v1.6.0` + push --tags；
4. DSH 里把源的 URL 换成新 tag（或添加新源）。

### 一键升级（推荐，2026-09-01 新增）

```bash
npm run upgrade
# 等价于 clone 上游(openssl 后端) → import-upstream → normalize-desc → build → validate → 回归测试
# 完成后按脚本提示 bump version → commit → tag → push（见 PUBLISH.md）
```

## 本地快照（方案 A）与市场源（方案 B）的关系

DSH 桌面当前有两种渠道让技能可用：

- **方案 A（本地快照）**：曾把官方技能复制到 `~/.dsh/skills/` 作为离线兜底。**2026-09-01 已删除**，避免与市场源同名冲突（安装/更新会报「同名 skill 已存在」）。
- **方案 B（市场源）**：本仓库发布到 jsDelivr 的 `dsh-skills-hub` 目录源，在 DSH 设置页添加后走「浏览/搜索/安装/更新」标准链路（SHA-256 强校验 + 原子安装）。安装目标在 `~/.agents/skills/`。**这是唯一的权威更新通道**。

需要完全脱离市场时可删除 `~/.agents/skills/` 下的技能副本（可随时从本仓库重新复制）。

## 契约与安全

- 严格遵循 [DSH Skill Catalog 契约 v1](本机 DSH 工作区 plugins/dsh-skills-manager/docs/skill-catalog-contract.md（独立仓库外网无法直达，契约要点已在本 README 概述）)：无默认选中源、显式选择、HTTPS-only、同源下载、fail-closed；
- 安装时 DSH 会二次校验：SHA-256 比对 + frontmatter 解析 + 路径白名单；
- 本仓库不执行任何代码，只是静态目录源。

## 上游来源与许可

| 来源 | 说明 | 许可 |
| --- | --- | --- |
| [anthropics/skills](https://github.com/anthropics/skills) | 官方 19 个 skill（docx/pdf/pptx/xlsx/mcp-builder/skill-creator 等） | 各 skill 自带 `license` 字段（部分标注 Proprietary，见 `skills/*/_source.json`），仅供学习/个人使用 |
| [jnMetaCode/superpowers-zh](https://github.com/jnMetaCode/superpowers-zh) | 19 个中文技能（中文代码审查/中文提交规范/中文文档/中文 Git 工作流/头脑风暴/系统化调试/测试驱动开发等），已转统一源 | MIT |
| [MrGeDiao/shuorenhua](https://github.com/MrGeDiao/shuorenhua) | 「说人话」：把晦涩英文文本转成人话，去 AI 味 | MIT |
| [redbaronyyyyy-eng/humanizer-zh-academic](https://github.com/redbaronyyyyy-eng/humanizer-zh-academic) | 中文学术去 AI 味（论文/开题报告/结课论文等 AIGC 痕迹润色） | MIT |
| [laolaoshiren/claude-code-skills-zh](https://github.com/laolaoshiren/claude-code-skills-zh) | 20 个中文开发技能（API 测试/变更日志/DB 迁移/依赖审计/ESLint/Git 工作流/GitHub Actions/i18n/日志分析/性能剖析/重构/安全审计/中文代码审查/中文文档/中文 README 等） | MIT |
| [zenstory-ai/video-recap-skills](https://github.com/zenstory-ai/video-recap-skills) | 6 个视频技能（视频理解/脚本/剪辑/配音/合成/端到端解说），中文优先 | MIT |

内容版权归原作者；本仓库仅做快照分发。

## License

本仓库脚本与索引生成逻辑为 MIT；vendor 的 skill 内容版权归各自作者（见各 `_source.json`）。
