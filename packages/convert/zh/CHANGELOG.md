# 更新日志

[English](../CHANGELOG.md) · **简体中文**

## [0.0.4] - 2026-11-06

### 破坏性变更

- 凤蝶转换的公共 API 统一采用 `fengdie` 命名。请将 `fengdieToUmoJson`、`umoJsonToSchema`、`isKnownUmoType`、`umoJsonFeature` 分别替换为 `parseFengdieJson`、`fengdieJsonToSchema`、`isKnownFengdieJsonType`、`fengdieJsonFeature`；通过 `migrateFengdie(...).fengdieJson` 读取中间产物，替代 `.umo`。`UmoJson` 改为 `FengdieJson`，`UmoToSchemaOptions` 改为 `FengdieJsonToSchemaOptions`，`FengdieUmoResult` 改为 `FengdieJsonResult`，其余 `Umo*` 类型改为 `FengdieJson*`；默认源码文件名改为 `default.schema`（[API](docs/fengdie-migration.md)）。
- 生成的可见性条件改用 `left` / `op` / `right` 叶子与 `op` 组合格式。与转换后的 schema 合并前，请更新手写条件（[迁移说明](../../core/zh/CHANGELOG.md)）。

### 变更

- 凤蝶 `if` 表达式中可以转换为 `visibleIf` 的写法，改为相对字段所在对象读取路径，与凤蝶编辑器的求值上下文一致。请重新运行迁移，生成相对节点的条件（[支持的表达式](docs/fengdie-migration.md)）。
