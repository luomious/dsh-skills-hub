# DSH Skills Hub

开源 DeepSeek Harness 技能目录（market source for `dsh-skills-manager`）。

让 DSH 设置 → Skills → 市场 可以直接**联网搜索、一键安装开源 skill**。

## 它是什么

DSH Desktop 自带 `dsh-skills-manager` 插件，其「市场」页已实现：目录源管理、搜索/分类、安装/更新/卸载、SHA-256 强校验、原子安装。
但市场需要一个**符合契约的目录源**（manifest + 索引 + 下载文件必须同源 HTTPS）。

本仓库就是这样一个目录源：

- 通过 **jsDelivr CDN** 托管（`cdn.jsdelivr.net/gh/<owner>/<repo>@v<version>/...`），manifest / 索引 / 下载全部同源，且国内可访问；
- skill 文件 **vendor 快照**进本仓库（sha256 固定、内容不可变，安装校验 100% 可复现）；
- 构建产物由零依赖 Node 脚本生成并**自动校验**，重新发布只需一条命令。

## 快速开始（发布到 GitHub）

1. 在 GitHub 新建仓库 `dsh-skills-hub`（owner 已在 `package.json` 配为 `luomious`），把本目录内容推上去。
2. 本目录即独立 git 仓库形态；先在本地跑完整验证：

   ```bash
   npm test                  # 回归测试 + 契约校验（必须全绿）
   npm run build             # 重新生成 manifest + skills-index
   npm run validate          # 复校验，必须输出 VALIDATION OK
   ```

3. 提交并打 tag（tag 名必须与 `package.json` 的 `version` 一致）：

   ```bash
   git add -A && git commit -m "v1.1.0"
   git tag v1.1.0
   git push origin main --tags
   ```

> ⚠️ jsDelivr 对 tag 内容永久缓存，版本不可变；改坏只能发新 tag，所以**发布前 `npm run build && npm test` 必须全绿**。

## 在 DSH 中使用

1. 打开 DSH Web GUI（http://127.0.0.1:43120）→ 设置 → **Skills** → **市场** 页；
2. 在「添加目录源（manifest URL）」粘贴：

   ```
   https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.1.0/manifest.json
   ```

3. 添加后选中该源 → 即可浏览 / 搜索 / 分类 / 一键安装（SHA-256 强校验 + 原子安装）。

## 目录结构

```
skills/                       # vendor 的 skill 快照（每个目录一份 SKILL.md + _source.json）
  docx/SKILL.md
  docx/_source.json           # 来源 / 许可 / 是否截断描述（审计用）
scripts/
  import-upstream.mjs         # 从上游仓库 clone 目录导入 skill（含契约校验）
  build-index.mjs             # 扫描 skills/ → 生成 manifest.json + skills-index.json
  validate-index.mjs          # 复刻 DSH 市场契约 v1 校验（含离线 sha256 复核）
  verify-parser.mjs           # 回归测试：frontmatter 解析器对每个 vendor 技能产出健康单行描述
  test-rewrite.mjs            # 回归测试：description 截断重写对块标量/内联都正确
  lib/skillmd.mjs             # 共享 frontmatter 解析/校验/折叠/重写（单一事实源）
manifest.json                 # 目录源声明（生成产物，提交入库）
skills-index.json             # 技能索引（生成产物，提交入库）
```

## 可维护性与回归（2026-09-01 加固）

**历史问题**：`parseFrontmatter()` 曾只支持 `key: value` 单行；`description: >` / `description: |-`
这类 YAML **块标量**（多行折叠/字面块）会被误解析成字面 `>` / `|-`，导致 3 个技能
（academy-guide / claude-api / discernment-nudge）的索引描述损坏。

**修复**（治本，非补丁）：
- `lib/skillmd.mjs` 的 `parseFrontmatter()` 现支持 `>`, `|`, `|-`, `>-`, `|+`, `>+` 块标量折叠；
- 新增 `collapseDescription()` / `shortenDescription()` / `rewriteDescription()`，统一处理
  「多行描述 → 契约要求的 ≤500 单行」，单一事实源，`import-upstream` / `build-index` / `validate-index` 共用；
- `validate-index.mjs` 增加两道纵深防御：
  1. 拒绝 `>`, `|-` 等垃圾描述（块标量误解析会立刻 fail）；
  2. **交叉校验**：索引里每条 `description` 必须等于解析器从 vendor 文件实际解析出的值（堵死索引/解析漂移）。

**回归保障**：`npm test` 每次跑 3 道：
1. `verify-parser.mjs` —— 19 个 vendor 技能全部解析出健康单行描述（≤500，非垃圾，sha12 不变）；
2. `test-rewrite.mjs` —— 块标量/内联描述截断重写均正确、无悬空行、重写后可再校验；
3. `validate-index.mjs` —— 契约 v1 全量校验 + 离线 sha256 + 交叉校验。

**长期可迭代工作流**（新增 skill / 上游更新后）：

```bash
git -c http.sslBackend=openssl clone --depth 1 https://github.com/anthropics/skills.git /tmp/upstream
npm run import -- /tmp/upstream https://github.com/anthropics/skills   # 契约校验 + 自动截断
npm test && npm run build && npm run validate                          # 全绿才可发布
git add -A && git commit -m "feat(skills): bump to N skills"
git tag v1.2.0 && git push origin main --tags                          # 需网络；DSH 换新源 URL
```

## 维护指南（可迭代）

### 更新上游 skill / 加新源

```bash
# 1. 拉取上游（本机网络需 openssl 后端）
git -c http.sslBackend=openssl clone --depth 1 https://github.com/anthropics/skills.git /tmp/upstream
# 2. 导入（只导入契约合规的；描述超 500 字符会自动截断并记录）
npm run import -- /tmp/upstream https://github.com/anthropics/skills
# 3. 重建 + 校验
npm run build && npm run validate
# 4. 发布：bump package.json version → 提交 → git tag v1.1.0 → push --tags
```

多个上游源可反复执行 `import`（同名后导入的会覆盖，注意检查输出）。

### 手动添加单个 skill

直接把 `SKILL.md` 放到 `skills/<kebab-case-name>/SKILL.md`（frontmatter 必须含 `name`（= 目录名，kebab-case）和 `description`（≤500 字符）），再执行 `npm run build && npm run validate`。

### 发布新版本

1. 改 `package.json` 的 `version`（如 `1.1.0`）；
2. `npm run build && npm run validate`；
3. 提交 + `git tag v1.1.0` + push --tags；
4. DSH 里把源的 URL 换成新 tag（或添加新源）。

### 一键升级（推荐，2026-09-01 新增）

```bash
npm run upgrade
# 等价于: clone 上游(openssl 后端) → import-upstream → normalize-desc → build → validate → 回归测试
# 完成后按脚本提示 bump version → commit → tag → push（见 PUBLISH.md）
```

## 本地快照（方案 A）与市场源（方案 B）的关系

DSH 桌面当前有两种渠道让技能可用：

- **方案 A（本地快照）**：`~/.dsh/skills/<name>/SKILL.md` 下的 19 个官方技能副本，由本仓库 vendor 快照复制而来，**内容与市场源索引逐文件 sha256 一致**（已在 2026-09-01 验证 MATCH）。作用=离线兜底：市场源暂不可达时技能仍可用。
- **方案 B（市场源）**：本仓库发布到 jsDelivr 的 `dsh-skills-hub` 目录源，在 DSH 设置页添加后走「浏览/搜索/安装/更新」标准链路（SHA-256 强校验 + 原子安装）。

**冲突处置**：B 发布后，用户经市场安装同名技能会覆盖 `~/.dsh/skills` 下的 A 副本——因内容相同，覆盖无感且为期望行为；市场是权威更新通道，A 仅作初始引导/离线兜底，**不建议同时手动编辑两边**。需要完全脱离市场时可删除 A 目录（可随时从本仓库重新复制）。

## 契约与安全

- 严格遵循 [DSH Skill Catalog 契约 v1](https://github.com/your-workspace/plugins/dsh-skills-manager/docs/skill-catalog-contract.md)：无默认选中源、显式选择、HTTPS-only、同源下载、fail-closed；
- 安装时 DSH 会二次校验：SHA-256 比对 + frontmatter 解析 + 路径白名单；
- 本仓库不执行任何代码，只是静态目录源。

## 上游来源与许可

| 来源 | 说明 | 许可 |
| --- | --- | --- |
| [anthropics/skills](https://github.com/anthropics/skills) | 官方 19 个 skill（docx/pdf/pptx/xlsx/mcp-builder/skill-creator 等） | 各 skill 自带 `license` 字段（部分标注 Proprietary，见 `skills/*/_source.json`），仅供学习/个人使用 |

内容版权归原作者；本仓库仅做快照分发。

## License

本仓库脚本与索引生成逻辑为 MIT；vendor 的 skill 内容版权归各自作者（见各 `_source.json`）。
