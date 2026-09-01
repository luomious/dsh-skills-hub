# dsh-skills-hub 发布检查清单（PUBLISH.md）

> 生成：2026-09-01　目标仓库：`github.com/luomious/dsh-skills-hub`（独立仓库，jsDelivr 分发）
> 前置：**本机 git 走代理 `127.0.0.1:7897` 时 GitHub TLS 失败**（curl 000），发布前需确保网络可 push（开 Clash TUN / 换可用节点 / 或临时关闭代理直连）。

## 本地已就绪（无需网络，均已验证）

- [x] `package.json`：`dshHub.owner = luomious`，`version = 1.1.0`
- [x] 19 个官方技能 vendor 完成，描述全部修复为干净单行（≤500、非垃圾、弯引号）
- [x] `npm test` 全绿：verify-parser（19/19 健康描述）+ test-rewrite（块标量/内联截断）+ validate-index（契约 v1 + 离线 sha256 + 交叉校验）
- [x] `npm run build && npm run validate` → `VALIDATION OK: 19 items`
- [x] 官方 dsh-skills-manager 校验器交叉验收：`OFFICIAL FINAL PASS 19/19`（含 sha256 比对）
- [x] 负向测试通过：篡改 description 为 `">"` 时 validate 拒绝（垃圾描述防御 + 交叉校验双保险）

## 发布步骤（需网络，网络通畅后逐条执行）

```bash
# 1) 在 GitHub 新建独立空仓库 luomious/dsh-skills-hub（不要勾选 README/.gitignore）

# 2) 在本地 dsh-skills-hub 目录初始化并推送
cd D:\Deepseek-Harness\tools\dsh-skills-hub
git init
git add -A
git commit -m "feat(skills): vendor 19 official anthropics skills (v1.1.0)"
git branch -M main
git remote add origin https://github.com/luomious/dsh-skills-hub.git
git push -u origin main

# 3) 打 tag（tag 名必须与 package.json version 一致；jsDelivr 按 tag 永久缓存）
git tag v1.1.0
git push origin v1.1.0

# 4) 验证 jsDelivr 已生效（等 1-2 分钟 CDN 预热）
curl -I https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.1.0/manifest.json
curl -s https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.1.0/skills-index.json | head
```

## 在 DSH 中使用（Web GUI）

1. 打开 http://127.0.0.1:43120 → 设置 → **Skills** → **市场**
2. 「添加目录源（manifest URL）」粘贴：
   ```
   https://cdn.jsdelivr.net/gh/luomious/dsh-skills-hub@v1.1.0/manifest.json
   ```
3. 选中该源 → 浏览 / 搜索 / 分类 / 一键安装（DSH 二次校验：SHA-256 + frontmatter + 路径白名单）

## 后续迭代（新增 skill / 上游更新）

```bash
git -c http.sslBackend=openssl clone --depth 1 https://github.com/anthropics/skills.git /tmp/upstream
cd D:\Deepseek-Harness\tools\dsh-skills-hub
npm run import -- /tmp/upstream https://github.com/anthropics/skills   # 契约校验 + 描述自动截断/清洗
npm test && npm run build && npm run validate                          # 全绿才可发布
# bump package.json version → commit → git tag vX.Y.Z → push --tags
```

## 风险与回滚

- **jsDelivr 对 tag 永久缓存**：一旦发布，内容不可变；改坏只能发新 tag。因此发布前 `npm test && npm run build` 必须全绿（本清单已前置保证）。
- **本地改动全部可回滚**：`tools/dsh-skills-hub/` 尚未纳入任何 git 仓库（工作区 `tools/` 被忽略），发布前可随时 `git diff` 检视。
- **方案 A 副本独立**：`~/.dsh/skills/` 下的 19 个技能是独立副本，删除该目录即回滚 A，不影响市场源 B。
