# 更新日志

[English](../CHANGELOG.md) · **简体中文**

## [0.0.4] - 2026-11-06

### 破坏性变更

- 编译与 schema 打印采用新的条件格式。编译或打印已有 schema 前，请更新 `root_if`、`node_if` 和手写 `x-ui.visibleIf` 组合条件（[迁移说明](../../core/zh/CHANGELOG.md)）。

### 变更

- `migrate-schema` 为支持的凤蝶 `if` 表达式生成相对节点的可见性条件。请重新运行迁移生成输出（[转换变更](../../convert/zh/CHANGELOG.md)）。

### 修复

- CLI 校验与数据迁移包含 `@jotl/data` 的联合分支与子 schema 修复（[详情](../../data/zh/CHANGELOG.md)）。
