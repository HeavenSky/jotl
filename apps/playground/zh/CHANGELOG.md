# 更新日志

[English](../CHANGELOG.md) · **简体中文**

条目按仓库发布版本记录，不采用此私有应用的 package 版本号。

## [0.0.4] - 2026-11-06

### 破坏性变更

- Jotl 与 JSON Schema 输入采用新的可见性条件格式。加载已有输入前，请更新组合条件与手写的 `x-ui.visibleIf` 叶子（[迁移说明](../../../packages/core/zh/CHANGELOG.md)）。

### 新增

- 粘贴 fengdie DSL schema 或凤蝶 `toJson` 产物即可预览迁移后的表单，并在「迁移后 Jotl」页签复制生成的源码（[指南](README.md)）。

### 变更

- 表单预览统一入口行标题、摘要与折叠面板样式。

### 修复

- 名为 `Object`、`String` 或其他凤蝶关键字的 Jotl 类型正确进入 Jotl 编译流程。
- 替换预览数据时清除上一条记录缓存的联合分支值；分支迁移与子 schema 校验包含 `@jotl/data` 的修复（[详情](../../../packages/data/zh/CHANGELOG.md)）。
