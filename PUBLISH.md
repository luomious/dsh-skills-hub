# dsh-skills-hub 发布检查清单（PUBLISH.md）

> 更新于 2026-09-02　目标仓库：`github.com/luomious/dsh-skills-hub`（独立仓库，jsDelivr 分发）
> 版本：v1.5.1（统一源：official 44 个技能 + community 兼容源 4 个）

## 本地已就绪（无需网络，均已验证）

- [x] `package.json`：`dshHub.owner = luomious`，`version = 1.5.1`
- [x] 统一源管线：`official`（根 `skills/`，44 个技能：官方 19 + superpowers-zh 中文 19 + humanizer-zh-academic + shuorenhua + 社区种子 4）＋ 兼容源 `community`（sources/community/，4 个种子）各自独立 manifest/index/900KiB 配额
- [x] `npm test` 全绿：verify-parser（全源健康描述）+ test-rewrite（截断重写）+ validate-index（契约 v1 + sha256 + 交叉校验）
- [x] `npm run build:all && npm run validate:all` → 全部源输出 `VALIDATION OK`
- [x] 负向测试通过：篡改 description 为 `">"` 时 validate 拒绝
- [x] jsDelivr v1.5.1 线上验证：manifest / skills-index 返回 44 项，humanizer-zh-academic / shuorenhua sha256 与索引一致，中文描述技能 25 项

## 发布步骤（需网络，SSH 通道已验证可用）

```bash
cd D:\Deepseek-Harness\tools\dsh-skills-hub
npm test && npm run build:all && npm run validate:all   # 发布前必须全绿
git add -A && git commit -m "feat(skills): v1.6.0 ..."
git tag v1.6.0
git push origin main v1.6.0
# 验证 jsDelivr（等 1-2 分钟 CDN 预热）
curl -I https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.6.0/manifest.json
curl -I https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.6.0/sources/community/manifest.json
```

> ⚠️ 发布走 SSH 通道（`GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519"`）；git 全局代理已清（2026-09-01 修复坏代理 `127.0.0.1:7897`）。

## 在 DSH 中使用（统一源，推荐）

1. 打开 http://127.0.0.1:43120 → 设置 → **Skills** → **市场**
2. 「添加目录源」添加统一源 URL（推荐，44 项全搜）：
   - 统一源：`https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.5.1/manifest.json`
   - （可选兼容）community：`https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.5.1/sources/community/manifest.json`
3. **选中**该源 → 浏览/搜索/分类/安装（SHA-256 强校验 + 原子安装）。搜索只落在当前选中源内。

## 扩充统一源（可迭代）

```bash
cd D:\Deepseek-Harness\tools\dsh-skills-hub
npm run upgrade -- official https://github.com/<MIT上游>/<skills仓库>.git
npm test && npm run build:all && npm run validate:all
# bump version → commit → tag v1.6.0 → push --tags
```

## 风险与回滚

- **jsDelivr 按 tag 永久缓存**：一旦发布，内容不可变；改坏只能发新 tag。因此发布前 `npm test && npm run build:all` 必须全绿（本清单已前置保证）。
- **本地改动全部可回滚**：`tools/dsh-skills-hub/` 是独立 git 仓库（嵌套于工作区 `tools/`，主仓忽略该目录），发布前可随时 `git diff` / `git reset` 检视回退。
- **本地安装独立**：`~/.agents/skills/` 下的技能副本独立于市场源，删除即回滚本地，不影响市场源 B。
- **force push 被 DSH guard 拦截**：绝不重写历史；内容有误就发新 tag 弃用旧 tag。
