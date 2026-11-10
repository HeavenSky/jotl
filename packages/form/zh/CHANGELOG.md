# 更新日志

[English](../CHANGELOG.md) · **简体中文**

## [0.0.4] - 2026-11-06

### 破坏性变更

- `JotlForm` 的 `drill` 属性改名为 `nested`。请将 `drill={false}` 替换为 `nested={false}`，需要在同一页显示折叠面板时保留 `collapsible`（[指南](docs/nested.md)）。
- 可见性条件改用 `left` / `op` / `right` 叶子与 `op` 组合格式。渲染已有 schema 前，请更新手写的 `x-ui.visibleIf` 条件（[迁移说明](../../core/zh/CHANGELOG.md)）。

### 变更

- 入口行与折叠面板统一标题和摘要样式，字典行的简单值由键名提供标签。

### 修复

- 表单换数据时清除上一条记录的联合分支缓存，受控值回显时保留缓存。
