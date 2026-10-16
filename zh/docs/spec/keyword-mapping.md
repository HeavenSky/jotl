# Jotl, JSON Schema 与 TSDoc 关键字对照

[English](../../../docs/spec/keyword-mapping.md) · **简体中文**

本页对照每个 JSON Schema 标准关键字在 Jotl 源码、JSON Schema 产物和 TS 声明中的写法，用于查某个字段该怎么写，或评审三者是否一一对应。Jotl 到 JSON Schema 由 `packages/core` 负责，JSON Schema 与 TS 之间的互转由 `packages/convert` 负责。

本页只列标准关键字及其在三种写法中的对应；`x-ui` 的各字段见 [x-ui 规范](x-ui.md)，语法细则见 [Jotl 语法规范](jotl.md)，TS 侧的取值编码见 [`@jotl/convert` 标签协议](../../../packages/convert/zh/docs/tag-protocol.md)。

## 三种写法的关系

- **JSON Schema 2020-12** 是唯一的数据格式：校验、默认数据、widget 选择都只读它。
- **Jotl** 是编写 JSON Schema 的源码语言，`compile` 生成 schema，`print` 把 schema 还原为 Jotl。
- **TS 声明**由 `schemaToTs` 生成、`tsToSchema` 读回：类型能表达的部分写成 TS 类型，表达不了的写成文档注释标签。

TS 标签按来源分三类，下文「TS / TSDoc」列用上标区分：

| 标记 | 来源 | 说明 |
|---|---|---|
| （无） | TSDoc 标准标签 | `@deprecated` `@defaultValue` `@example` `@privateRemarks` `@readonly`，任何 TSDoc 工具都认识 |
| ᴾ | Jotl 协议标签 | 在 [`packages/convert/tsdoc.json`](../../../packages/convert/tsdoc.json) 中声明，约束类标签与 JSON Schema 关键字同名；不加载该预设时 TSDoc 工具会报未知标签 |
| ᵀ | TS 类型本身 | 不用标签，由类型写法表达 |

「—」表示该写法中没有对应：Jotl 列为「—」时只能用元数据 `schema: {...}` 原样写入；TS 列为「—」时 `schemaToTs` 不写出，除固定方言的 `$schema`，以及 `money` `bigint` 值对象上的 `additionalProperties: false` / `x-decimalRange` 静默丢弃外，都报 `JOTL2002` warning。

## 文档结构

| JSON Schema | 含义 | Jotl | TS / TSDoc | 用法 |
|---|---|---|---|---|
| `$schema` | 方言 URI | 固定写入 `https://json-schema.org/draft/2020-12/schema`，不能自己写 | — | 只出现在根 |
| `$id` | 文档的基准 URI | 根条目的元数据 `id: 'https://...'` | ᴾ `@id URI`，写在根类型的注释上 | 跨文档引用时作为本文档的地址；只出现在根 |
| `$defs` | 命名类型表 | 每条顶层条目 `X(标签): ...` | ᵀ `export interface X` / `export type X` | 只出现在根（规范化规则 2） |
| `$ref` | 引用另一个 schema | 在类型位置写类型名 `X`，编译为 `#/$defs/X` | ᵀ 类型名 `X` | 根与默认导出由 `<root/>` `<default/>` 决定，见 [文件结构](jotl.md#文件结构)；默认导出对应 `export default X;`，与根不同时在根类型的注释上写 ᴾ `@root`；`tsToSchema` 以带 `@root` 的声明为根，没有时以默认导出为根 |
| `$comment` | 给维护者看的注释，不参与校验 | `comment: '...'` | `@privateRemarks 文本` | 读取时也接受 `@comment` |
| `$anchor` | 锚点 | — | — | 校验、默认数据与 `#名` 引用都支持；Jotl 语法里不写，经 `schema` 元数据透传 |
| `$dynamicRef` `$dynamicAnchor` `$vocabulary` | 动态引用与词汇表 | — | — | Ajv 支持不完整；`$dynamicRef` 还会使节点降级为 `json` |

## 元数据

| JSON Schema | 含义 | Jotl | TS / TSDoc | 用法 |
|---|---|---|---|---|
| `title` | 短标题，表单中用作字段标签 | 键后的标签：`key(标题)` `X(标题)` | ᴾ `@title 标题` | 枚举成员的标签见下文 `oneOf` |
| `description` | 说明文字 | `description: '...'` | 注释正文 | 读取时也接受 `@description`；TSDoc 的 `@remarks` 被忽略 |
| `default` | 缺省值 | `default: 值` | `@defaultValue JSON` | Jotl 编译期校验默认值满足约束；读取时也接受 `@default` |
| `examples` | 示例值数组 | `examples: [...]` | 每个示例一条 `@example JSON` | 只作说明，不参与校验 |
| `deprecated` | 已弃用 | `deprecated: true` / `deprecated: '原因'` | `@deprecated 原因` | 原因写入扩展关键字 `x-deprecatedReason` |
| `readOnly` | 只读，由服务端维护 | `readOnly: true` | `@readonly` | 读取时也接受 `@readOnly` |
| `writeOnly` | 只写，不回显 | `writeOnly: true` | ᴾ `@writeOnly` | 如密码 |

## 类型与结构

| JSON Schema | 含义 | Jotl | TS / TSDoc | 用法 |
|---|---|---|---|---|
| `type: "string"` | 字符串 | `string`，或省略组件 | ᵀ `string` | `text` `url` `image` 等组件也以它为底层类型，见 [Jotl 语法规范](jotl.md#内置组件) |
| `type: "number"` | 数值 | `number` | ᵀ `number` | |
| `type: "integer"` | 整数 | `integer` | ᵀ `number` + ᴾ `@asType integer` | 不能挂注释的位置（数组元素、`Map` 值、元组位置、联合分支）上的 `integer` 在 TS 中丢弃并报 `JOTL2002`，开启 `typiaTags` 时除外 |
| `type: "boolean"` | 布尔 | `boolean` | ᵀ `boolean` | |
| `type: "null"` | null | `nullable: true` | ᵀ `null` | 基础类型上合并为 `type: [T, "null"]`，其余为 `anyOf: [T, {type: "null"}]` |
| `type: "object"` | 对象 | `{ ... }` 或 `map` | ᵀ `interface` / `{ ... }` | |
| `type: "array"` | 数组 | `array[...]` | ᵀ `T[]` / `[A, B]` | |
| `{}`（无约束） | 任意值 | `any` | ᵀ `unknown` | |
| `properties` | 对象字段 | `{ key: T }` 中的各字段 | ᵀ 接口成员 | 键名规则见 [Jotl 语法规范](jotl.md#名字) |
| `required` | 必填字段名 | 写了 `:` 且没有 `?` 为必填；`key?: T` 与不带内容的 `key(标签)` 为选填 | ᵀ 成员是否带 `?` | 按声明顺序排列，为空时省略 |
| `additionalProperties`（schema） | 额外键的取值 | `map` | ᵀ 索引签名 `[key: string]: T` | |
| `additionalProperties: false` | 禁止额外键 | `closed: true` | — | 只能写在对象类型本身，不能写在引用处 |
| `items` | 数组元素 | `array_item` 或体；元组没有 `*` 时为 `false` | ᵀ `T[]` | 元素自身的元数据写在 `item_meta` |
| `prefixItems` | 按位置的元素 | `array[array_item: 'tuple'] { 0: A  1: B }` | ᵀ 元组 `[A, B]` | |
| `const` | 固定值 | 单成员枚举 `enum{ a }`；可区分联合的区分字段 | ᵀ 字面量类型 | 外层带 `type`（规范化规则 4） |
| `enum` | 取值集合 | 无标签的 `enum{ a b }` | ᵀ 字面量联合 | 多选（`enum[multiple: true]`）自动加 `uniqueItems: true` |
| `oneOf: [{ const, title }]` | 带标签的枚举 | `enum{ a(甲) b(乙) }`，成员可带 `description` | ᵀ 字面量联合 + ᴾ `@enumTitles {"a":"甲"}`，成员说明为 ᴾ `@enumDescriptions` | 至少一个成员有标签或说明时使用这种形式 |
| `oneOf` | 恰好匹配一支 | `union[discriminator: 'kind'] {...}` | ᵀ 联合 `A \| B`，分支标题为 ᴾ `@branchTitles` | 见 [Jotl 语法规范](jotl.md#union) |
| `anyOf` | 至少匹配一支 | `union[union_item: 'A\|B']` | ᵀ 联合 `A \| B` | TS 中与 `oneOf` 写法相同，读回时按可区分条件重新判定 |
| `allOf` `not` `if` `then` `else` | 组合与条件 | 可区分联合的引用分支编译为 `allOf: [{$ref}]`，其余为 — | 引用分支为 ᵀ 交叉类型 `X & {...}`，其余为 — | 照常校验；`allOf` 的成员都是 schema 对象时与本节点合并后渲染（见 [`packages/form/src/core/schema-node.ts`](../../../packages/form/src/core/schema-node.ts) 的 `mergeAllOf`），否则该节点与 `not` `if` 一样降级为 `json` widget（F7，判定表见 [`packages/form/src/core/schema-shape.ts`](../../../packages/form/src/core/schema-shape.ts) 的 `UNSUPPORTED_KEYWORDS`） |
| `propertyNames` | 键名约束 | `map[key_meta: {...}]`，只支持 `pattern` `minLength` `maxLength` | — | |
| `patternProperties` `dependentRequired` `dependentSchemas` `contains` `minContains` `maxContains` `unevaluatedItems` `unevaluatedProperties` | 其余结构关键字 | — | — | 照常校验；其中 `patternProperties` `dependentSchemas` 同样使节点降级为 `json` |

## 约束

Jotl 中的约束都写成组件后的元数据 `组件[关键字: 值]`，适用的组件见 [Jotl 语法规范](jotl.md#元数据键)。
TS 中都是与关键字同名的 ᴾ 协议标签。

| JSON Schema | 含义 | Jotl | TS / TSDoc | 用法 |
|---|---|---|---|---|
| `minLength` `maxLength` | 字符串最短 / 最长长度，按码点计 | `string[maxLength: 20]` | `@maxLength 20` | |
| `pattern` | 正则（ECMA-262，不隐含首尾锚定） | `string[pattern: '^\\d+$']` | `@pattern` + 反引号中的正则 | |
| `minimum` `maximum` | 闭区间上下界 | `number[minimum: 0]` | `@minimum 0` | |
| `exclusiveMinimum` `exclusiveMaximum` | 开区间上下界 | `number[exclusiveMaximum: 100]` | `@exclusiveMaximum 100` | |
| `multipleOf` | 必须是该数的整数倍 | — | `@multipleOf 0.01` | 限制小数位用 `decimals`，金额用 `money` |
| `minItems` `maxItems` | 数组最少 / 最多项数 | `array[maxItems: 5]` | `@maxItems 5` | 数组与多选默认允许空数组，不能为空时写 `minItems: 1`；元组取必填位置数 |
| `uniqueItems` | 元素不重复 | `array[uniqueItems: true]` | `@uniqueItems`（无取值） | 多选自动加 |
| `minProperties` `maxProperties` | 对象最少 / 最多键数 | `map[maxProperties: 10]` | `@maxProperties 10` | |

## 内容

| JSON Schema | 含义 | Jotl | TS / TSDoc | 用法 |
|---|---|---|---|---|
| `format` | 字符串格式（`email` `uri` `date` `color` 等） | `email` `url` `date` 等组件，或 `string[format: 'email']` | ᴾ `@format email` | 校验由 ajv-formats 执行；`color` 是 Jotl 自定义的格式 |
| `contentMediaType` | 字符串内容的媒体类型 | `richtext`（`text/html`）、`jsontext`（`application/json`） | ᴾ `@contentMediaType text/html` | 其他媒体类型经 `schema` 元数据写入 |
| `contentEncoding` | 字符串内容的编码（如 `base64`） | — | ᴾ `@contentEncoding base64` | |
| `contentSchema` | 字符串内容解析后的结构 | `jsontext` 的体或 `json_item` | — | Jotl 把它当作断言：`application/json` 文本先解析，再按它校验，见 `@jotl/data` |

## 非标准关键字

以下关键字会出现在产物中，但不属于 JSON Schema 2020-12 标准，这里只列入口：

| 关键字 | 来源 | Jotl | TS / TSDoc |
|---|---|---|---|
| `x-ui` | Jotl，见 [x-ui 规范](x-ui.md) | 元数据 `widget` `props` `hidden` `order` `groups` `layout` `columns` `root_if` `node_if` `variants` `decorator` `summary` `thousands`，根条目另有 `rules` `widgets` | 只有 `widget` 时为 ᴾ `@widget 名字`，否则为 ᴾ `` @ui `{...}` ``；数组元素的写成数组属性上的 ᴾ `@itemWidget` / `@itemUi`；根的 `rules` 写成根类型上的 ᴾ `` @rules `[...]` ``，根的 `widgets`（扩展组件模块）写成 ᴾ `` @widgets `{...}` `` |
| `x-deprecatedReason` | Jotl | `deprecated: '原因'` 中的原因 | `@deprecated 原因` 的正文 |
| `errorMessage` | ajv-errors | `errorMessage: '...'` / `errorMessage: {...}` | ᴾ `@errorMessage JSON` |
| `x-decimals` | Jotl，小数位数上限 | `decimals: n` | — |
| `x-valueFormat` | Jotl，日期时间的存储格式 | `value_format` | ᴾ `@valueFormat` |
| `x-decimalRange` | Jotl，`money` `bigint` 的 `value` 按精确十进制比较的范围 | `money` `bigint` 上的 `minimum` `maximum` 等（字符串） | — |
