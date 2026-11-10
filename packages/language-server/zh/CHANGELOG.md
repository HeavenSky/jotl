# 更新日志

[English](../CHANGELOG.md) · **简体中文**

## [0.0.4] - 2026-11-06

### 破坏性变更

- 语言服务按新的 `op` 组合格式编译 Jotl 条件。请替换 `.jotl` 源码中原有的 `and`、`or`、`not` 组合对象，并将手写 `x-ui.visibleIf` 条件迁移为 `left` / `op` / `right` 叶子与 `op` 组合（[迁移说明](../../core/zh/CHANGELOG.md)）。

### 变更

- 对象 widget 的悬停说明统一使用「层级」术语，与表单呈现选项一致。
