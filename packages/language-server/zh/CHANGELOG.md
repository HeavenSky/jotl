# 更新日志

[English](../CHANGELOG.md) · **简体中文**

## [0.0.5] - 2026-11-27

- 编写枚举时可补全 `options_from`；悬停提示说明如何引用当前对象或根对象的数组，以及 `{label, value}` 的显示和保存规则。[枚举语法](../../../zh/docs/spec/jotl.md#枚举)

## [0.0.4] - 2026-11-06

### 破坏性变更

- 语言服务按新的 `op` 组合格式编译 Jotl 条件。请替换 `.jotl` 源码中原有的 `and`、`or`、`not` 组合对象，并将手写 `x-ui.visibleIf` 条件迁移为 `left` / `op` / `right` 叶子与 `op` 组合（[迁移说明](../../core/zh/CHANGELOG.md)）。

### 变更

- 对象 widget 的悬停说明统一使用「层级」术语，与表单呈现选项一致。
