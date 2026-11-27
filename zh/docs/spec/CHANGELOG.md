# 规范更新日志

[English](../../../docs/spec/CHANGELOG.md) · **简体中文**

条目按仓库发布版本记录，规范自身的版本仍为 v1。

## [0.0.6] - 2026-11-27

- `enum[options_from: 'choices']` 从字段所在对象读取标量或 `{label, value}` 选项。路径以 `$.` 开头时从数据根读取。两种路径都支持 `multiple: true`。[枚举规范](jotl.md#枚举)

## [0.0.4] - 2026-11-06

### 破坏性变更

- Jotl 的 `root_if` 与 `node_if` 组合条件改用 `{op: 'and', conditions: [...]}`、`{op: 'or', conditions: [...]}` 和 `{op: 'not', condition: ...}`。请替换原来的 `{and: [...]}`、`{or: [...]}` 与 `{not: ...}` 对象；叶子表达式与路径字符串简写仍然有效（[语法规范](jotl.md#条件)）。
- `x-ui.visibleIf` 叶子改用 `left`、`op`、`right`，路径采用 lodash 语法。请转换原有的 JSON Pointer `field` 路径，把比较名与值移入 `op` 和 `right`，并将 `all`、`any`、`not` 组合替换为 `op` 对象。相对节点的叶子保留 `base: 'node'`（[契约](x-ui.md#显示条件)）。
- 层级呈现采用 `JotlForm` 的 `nested` 属性，替代 `drill`。请把 `drill={false}` 替换为 `nested={false}`；需要在同一页显示折叠面板时使用 `collapsible`（[呈现契约](x-ui.md#钻取渲染)）。
