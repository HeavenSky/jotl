# 更新日志

[English](../CHANGELOG.md) · **简体中文**

## [0.0.4] - 2026-11-06

### 破坏性变更

- `root_if` 与 `node_if` 组合条件改用 `{op: 'and', conditions: [...]}`、`{op: 'or', conditions: [...]}` 和 `{op: 'not', condition: ...}`。请替换原来的 `{and: [...]}`、`{or: [...]}` 与 `{not: ...}` 对象；叶子表达式与路径字符串简写保持原有语法（[语法规范](../../../zh/docs/spec/jotl.md#条件)）。
- `x-ui.visibleIf` 叶子改用 `{left: 'kind', op: 'eq', right: 'b'}`，原写法为 `{field: '/kind', eq: 'b'}`。请把 JSON Pointer 路径转换为 lodash 路径，把比较名与值分别放入 `op` 和 `right`，并把 `all`、`any`、`not` 组合改为上面的 `op` 对象；相对节点取值的叶子保留 `base: 'node'`（[契约](../../../zh/docs/spec/x-ui.md#显示条件)）。
