# 已知限制

[English](../../docs/known-limitations.md) · **简体中文**

本页列出编译与打印不符合预期的地方，有绕过办法的一并给出。

## 部分 schema 经 print 往返后会变

只有 Jotl 能表达的 schema，`print` 后再编译才与原来深度相等。以下形态能打印，但编译回来的 schema 不同：

- `allOf` 只在每个成员都是指向对象类型的 `$ref`、被引用的对象只含 `type`、`properties`、`required`、`title`、`description`、`$comment`、`examples`，且属性名不重复时才合并成一个对象。其他 `allOf` 会让整个节点打印成 `any[schema: {...}]`。
- 由若干常量加一个同类型开放分支组成的 `anyOf`（如 `anyOf: [{ const: "a" }, { type: "string" }]`）打印为该类型。常量记入 `examples`（节点已有 `examples` 时不记），各常量分支的 `title` 与 `description` 丢失。
- 扩展组件以 `'integer'` 为底层类型登记时，不带上下界的节点 `{ type: "integer", "x-ui": { widget: "Rating" } }` 打印为 `integer[widget: 'Rating']`，再编译会加上 `integer` 的安全整数上下界（`minimum: -9007199254740991`、`maximum: 9007199254740991`）。在 schema 中显式写出 `minimum` 与 `maximum` 即可保持不变。

其余输入怎样映射见[把 schema 打印成 Jotl](compile-and-print.md#把-schema-打印成-jotl)。

## 过深的 JSON 在打印前被拒

`print` 先检查输入的深度，JSON 嵌套超过 1024 层时报 `JOTL1029`（「嵌套层数超过上限 256」）并失败。一层 Jotl 对应若干层 JSON，1024 是对 Jotl 256 层上限的保守估计：极少数本可在上限内打印的文档会被拒。把深层子 schema 移到 `$defs`，再用 `$ref` 引用，可以降低深度。

## 部分日期格式在编译期不检查

编译器只在 `date`、`time`、`datetime` 的 `value_format` 由 `YYYY MM DD HH mm ss SSS Z ZZ A a` 记号与 `[..]` 转义组成时，才按它检查 `default`。含其他 dayjs 记号（如 `Do`、`Q`）时，取值在编译期不经检查直接通过；[`@jotl/data`](../../../data/zh/README.md) 的 `validate` 在运行时仍会检查。见[检查日期存储格式](schema-contract.md#检查日期存储格式)。

## 小写 widget 名的底层类型不生效

`jotl.config.json` 中不是大驼峰的名字只登记为 widget 名。为它们写的底层类型只做格式检查：编译器不使用，也没有任何环节检查该 widget 是否适合所在字段。希望底层类型生效时改用大驼峰名字，见[加载 jotl.config.json](extension-components.md#加载-jotlconfigjson)。
