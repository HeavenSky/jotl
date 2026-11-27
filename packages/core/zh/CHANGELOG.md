# 更新日志

[English](../CHANGELOG.md) · **简体中文**

## [0.0.5] - 2026-11-27

- 编译和反向打印均支持 `enum[options_from: 'choices']` 的单选和多选。编译后的 schema 用 `x-enumFrom` 保存来源路径，多选时该关键字位于 `items`。[枚举语法](../../../zh/docs/spec/jotl.md#枚举)
- 如果已有源码将 `x_enum_from` 用作自定义元数据，请先改名再编译。编译器现已将 `x-enumFrom` 保留给选项来源路径。

## [0.0.4] - 2026-11-06

### 破坏性变更

- `root_if` 与 `node_if` 组合条件改用 `{op: 'and', conditions: [...]}`、`{op: 'or', conditions: [...]}` 和 `{op: 'not', condition: ...}`。请替换原来的 `{and: [...]}`、`{or: [...]}` 与 `{not: ...}` 对象；叶子表达式与路径字符串简写保持原有语法（[语法规范](../../../zh/docs/spec/jotl.md#条件)）。
- `x-ui.visibleIf` 叶子改用 `{left: 'kind', op: 'eq', right: 'b'}`，原写法为 `{field: '/kind', eq: 'b'}`。请把 JSON Pointer 路径转换为 lodash 路径，把比较名与值分别放入 `op` 和 `right`，并把 `all`、`any`、`not` 组合改为上面的 `op` 对象；相对节点取值的叶子保留 `base: 'node'`（[契约](../../../zh/docs/spec/x-ui.md#显示条件)）。
