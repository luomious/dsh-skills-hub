# dsh-skills-hub 发布检查清单（PUBLISH.md）

> 更新：2026-09-01　目标仓库：`github.com/luomious/dsh-skills-hub`（独立仓库，jsDelivr 分发）
> 版本：v1.2.0（多源架构：official 19 官方技能 + community 社区技能）

## 本地已就绪（无需网络，均已验证）

- [x] `package.json`：`dshHub.owner = luomious`，`version = 1.2.0`
- [x] 多源管线：`official`（根，19 官方）+ `community`（sources/community/，4 种子）各自独立 manifest/index/900KiB 配额
- [x] `npm test` 全绿：verify-parser（全源健康描述）+ test-rewrite（截断重写）+ validate-index（契约 v1 + sha256 + 交叉校验）
- [x] `npm run build:all && npm run validate:all` → 两源均 `VALIDATION OK`
- [x] 负向测试通过：篡改 description 为 `">"` 时 validate 拒绝

## 发布步骤（需网络，SSH 通道已验证可用）

```bash
cd D:\Deepseek-Harness\tools\dsh-skills-hub
npm test && npm run build:all && npm run validate:all   # 发布前必须全绿
git add -A && git commit -m "feat(skills): multi-source hub v1.2.0 (official+community)"
git tag v1.2.0
git push origin main v1.2.0
# 验证 jsDelivr（等 1-2 分钟 CDN 预热）
curl -I https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.2.0/manifest.json
curl -I https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.2.0/sources/community/manifest.json
```

## 在 DSH 中使用（多源，Web GUI）

1. 打开 http://127.0.0.1:43120 → 设置 → **Skills** → **市场**
2. 「添加目录源」各加一个 URL：
   - official：`https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.2.0/manifest.json`
   - community：`https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.2.0/sources/community/manifest.json`
3. 选中某源 → 浏览/搜索/分类/安装（SHA-256 强校验 + 原子安装）

## 扩充社区源（可迭代）

```bash
cd D:\Deepseek-Harness\tools\dsh-skills-hub
npm run upgrade -- community https://github.com/<MIT上游>/<skills仓库>.git
npm test && npm run build:all && npm run validate:all
# bump version → commit → tag v1.3.0 → push --tags
```

## 后续迭代（新增 skill / 上游更新）

```bash
git -c http.sslBackend=openssl clone --depth 1 https://github.com/anthropics/skills.git /tmp/upstream
cd D:\Deepseek-Harness\tools\dsh-skills-hub
npm run import -- /tmp/upstream https://github.com/anthropics/skills official   # 契约校验 + 描述自动截断/清洗
npm test && npm run build:all && npm run validate:all                          # 全绿才可发布
# bump package.json version → commit → git tag vX.Y.Z → push --tags
```

## 风险与回滚

- **jsDelivr 对 tag 永久缓存**：一旦发布，内容不可变；改坏只能发新 tag。因此发布前 `npm test && npm run build:all` 必须全绿（本清单已前置保证）。
- **本地改动全部可回滚**：`tools/dsh-skills-hub/` 是独立 git 仓库（嵌套于工作区 `tools/`，主仓忽略该目录），发布前可随时 `git diff` / `git reset` 检视回退。
- **本地快照（方案 A）独立**：`~/.agents/skills/` 下的技能副本独立于市场源，删除即回滚 A，不影响市场源 B。
