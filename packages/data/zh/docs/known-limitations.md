# 已知限制

[English](../../docs/known-limitations.md) · **简体中文**

本页列出校验、默认数据、Mock 数据与迁移和 JSON Schema 规范或你的预期不一致的地方，有绕过办法的一并给出。

## 部分 format 无法编译或校验较宽松

`format` 为 `idn-email`、`idn-hostname`、`iri` 或 `iri-reference` 的 schema 无法编译，`validate` 返回 `JOTL4017`。改用 `email`、`hostname`、`uri` 或 `pattern`。

对 `email`、`hostname`、`date-time`、`time`、`duration`、`uri`、`uri-reference`、`uri-template` 与 `uuid`，`ajv-formats` 在部分边界用例上的接受与拒绝和官方 JSON Schema 测试集不同。实际使用的 format 见[检查范围](validation.md#检查范围)。

## 部分关键字与官方测试集不一致

校验基于 Ajv 的 2020-12 方言，以下情形的结果与官方测试集不同：

- `$dynamicRef`
- `unevaluatedProperties`、`unevaluatedItems` 与 `contains` 或 `if` 组合
- 嵌套 `$id` 下带相对 URI 的 `$ref`
- 空的 `enum`
- `$vocabulary`
- 名为 `__proto__` 的属性

这些写法大多没有 Jotl 语法，通常出现在手写的 schema 或经 `schema` 元数据透传的关键字中。

## 同一节点同时带 `$id` 与 `$ref` 时无法编译

子 schema 在同一节点同时写相对 `$id` 与 `$ref` 时，Ajv 编译失败，`validate` 返回 `JOTL4017`。默认数据与 Mock 数据能正常解析同样的引用。把引用包进 `allOf`，写成 `{ "$id": "sub.json", "allOf": [{ "$ref": "#/$defs/x" }], "$defs": { ... } }`，校验即可恢复。

## 默认数据、Mock 数据与错误文案的引用解析有简化

- 同一个 JavaScript 对象被多个 `$id` 资源共用时，其中的 `$ref` 按最先遍历到的那个资源的 base 解析。各资源 base 不同时，给每个资源一份独立副本（如用 `structuredClone`）。
- `$dynamicRef` 按普通 `$ref` 解析。

## migrate 不修复约束违规

`migrate` 不修复违反 `maxItems`、`uniqueItems`、`maxLength` 等约束或 `format` 的值，因为截断或改写会丢数据。迁移后调用 `validate`，按报告修正，见[无法保留的值](migration.md#无法保留的值)。
