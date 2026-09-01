---
name: git-commit-message
description: 按 Conventional Commits 规范编写 git 提交信息：类型/范围/主题/正文/脚注，中英皆可，附示例
whenToUse: 用户要求写 commit message、整理多次改动的提交、或审查提交信息是否符合规范时
---
# Git Commit Message（Conventional Commits）

按 Conventional Commits 规范生成提交信息，保持简短、可检索、可回滚。

## 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**（必填）：`feat` 新功能 / `fix` 修复 / `docs` 文档 / `style` 格式（不影响逻辑）/ `refactor` 重构 / `perf` 性能 / `test` 测试 / `build` 构建 / `ci` 持续集成 / `chore` 杂项 / `revert` 回滚
- **scope**（可选）：影响模块，如 `feat(profile): ...`
- **subject**（必填）：祈使句、小写开头（中文可直接用陈述句）、不超过 72 字符、句末不加句号
- **body**（可选）：说明「为什么改」多于「改了什么」；多行要点用 `- `
- **footer**（可选）：`BREAKING CHANGE:` 破坏性变更；`Refs: #123` 关联 issue；`Co-authored-by:` 协作者

## 规则

1. 先看本次改动的实际 diff 与关联 issue，不要臆造内容。
2. 一条提交只表达一个逻辑变更；混杂改动建议拆开（列出拆分方案供用户确认）。
3. 中英文均可，但**全篇保持一致**；subject 用中文则正文也用中文。
4. 引用具体文件/符号时用反引号，如 `lib/index.js` 中的 `addSource`。

## 示例

```
fix(task-scheduler): 资源 key 跨通道确定性

相对路径不再按调用方 cwd resolve，改为字面量确定性，
同一资源字符串在 CLI 与 HTTP 通道必然映射到同一把锁。

Refs: #42
```
