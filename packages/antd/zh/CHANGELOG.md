# 更新日志

[English](../CHANGELOG.md) · **简体中文**

## [0.0.4] - 2026-11-06

### 破坏性变更

- 使用 Ant Design 注册表渲染的表单需同步完成 `@jotl/form` 升级：把 `drill` 替换为 `nested`，并将手写可见性条件迁移为新格式（[迁移说明](../../form/zh/CHANGELOG.md)）。

### 修复

- Ant Design 表单的标题与间距采用共用的表单呈现方式，包括层级入口行与折叠面板。
