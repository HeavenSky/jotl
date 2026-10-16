# 标签协议

[English](../../docs/tag-protocol.md) · **简体中文**

本页是 JSON Schema 关键字与 TS 写法的完整对应，`schemaToTs` 与 `tsToSchema` 都按它工作。手写或校对 Jotl 生成的 `.d.ts` 中的 JSDoc 标签时查本页；转换 API 见 [JSON Schema 与 TypeScript 互转](./ts-conversion.md)。

## 关键字与 TS 写法的对应

| JSON Schema | TS 写法 |
|---|---|
| `description` | JSDoc 正文 |
| `title` | `@title 文本` |
| `$comment` | `@privateRemarks 文本` |
| `type: "integer"` | 类型写 `number`，加 `@asType integer`（节点为枚举或常量时不写） |
| `minLength` `maxLength` `minimum` `maximum` `exclusiveMinimum` `exclusiveMaximum` `multipleOf` `minItems` `maxItems` `minProperties` `maxProperties` | 同名标签，取值为数字 |
| `format` `contentMediaType` `contentEncoding` | 同名标签，取值为文本 |
| `pattern` | `@pattern`，取值为正则 |
| `uniqueItems: true` `writeOnly: true` | `@uniqueItems` `@writeOnly`（修饰标签，无取值） |
| `readOnly: true` | `@readonly` |
| `deprecated: true`（+ `x-deprecatedReason`） | `@deprecated 原因`；无原因时写默认文本，`zh-CN` 下为 `已弃用.`，`en` 下为 `Deprecated.`；两种文本读回都不产生 `x-deprecatedReason` |
| `default` | `@defaultValue JSON` |
| `examples` | 每个示例一个 `@example JSON` |
| 带标签枚举 `oneOf: [{ const, title }]` | 类型为字面量联合，加 `@enumTitles` JSON 对象（键为成员值：字符串取其本身，其余取 JSON 文本）；数组元素是枚举时写在数组属性上 |
| 枚举成员的 `description` | `@enumDescriptions` JSON 对象，键同 `@enumTitles` |
| 每项只含 `$ref` 的 `allOf` | 交叉类型 `X & Y & 其余部分`，如可区分联合分支 `X & { kind: "x" }`；没有其余部分且只有一个引用时写 `X & unknown` |
| 可区分联合分支的 `title` | `@branchTitles` JSON 数组，按分支顺序，无 `title` 的分支为 `null`；只在联合节点可写注释时输出 |
| 同时有 `properties` 与 `additionalProperties` | 索引签名写 `(额外类型) \| 属性类型...`，可选属性另加 `undefined`；读取时只取括号中的额外类型 |
| `x-valueFormat`（日期组件的存储格式） | `@valueFormat 格式`，取值为文本 |
| 根 `$ref` 指向的类型与默认导出不同 | 根类型注释加 `@root`（修饰标签，无取值） |
| 根 `$id`（只在根类型上） | `@id URI`，取值为文本 |
| 根 `x-ui.rules`（只在根类型上） | `@rules 规则数组`，取值为 JSON |
| 根 `x-ui.widgets`（扩展组件模块，只在根类型上） | `@widgets 模块表`，取值为 JSON 对象 |
| `x-ui` | 只有 `widget` 时写 `@widget 名字`，否则写 `` @ui `{...}` `` |
| 数组元素的 `x-ui` | 写在数组属性上：只有 `widget` 时写 `@itemWidget 名字`，否则写 `` @itemUi `{...}` ``；第 n 个标签作用于第 n 层元素（`items`、`items.items`...），跳过的层级写 `` @itemUi `{}` `` |
| `errorMessage` | `@errorMessage JSON`（字符串或对象） |

标签按 [Jotl 语法规范](../../../../zh/docs/spec/jotl.md#规范化规则) 规范化规则 7 的关键字顺序排列。

## 哪些关键字会被丢弃

表里没有位置的关键字丢弃并报 `JOTL2002` warning，其余输出不受影响。

- 元素级约束与注解（如数组元素上的 `maxLength`）没有可挂注释的位置，数组元素的 `x-ui` 除外。非 typia 模式下丢弃；typia 模式可以表达。
- Jotl 扩展关键字 `x-decimals` `x-decimalRange`，以及 `contentSchema`、`propertyNames` 与含非引用成员的 `allOf`，没有对应写法。
- 编译器为内置组件生成的固定形态不报：`money` / `bigint` 值对象（`properties.type` 为 `money` 或 `bigint` 常量）上的 `additionalProperties: false`、`x-decimalRange` 与 `x-decimals`，以及不能写注释的位置（如数组元素、联合分支）上可区分联合分支的 `title`。

## 写根级标签

文档级信息写在根类型的注释上。根类型是带 `@root` 的声明，没有时为默认导出。

- 根 `$id` 与根 `x-ui.rules` 写成 `@id` 与 `@rules`；根 `x-ui.widgets` 同样写成 `@widgets`。根上只含 `version` 与 `rules` 的 `x-ui` 属于文档级。
- 没有根类型时丢弃并报 `JOTL2002`。
- 在根类型以外写 `@root`、`@id` 或 `@rules` 报 `JOTL2115`。
- 有根类型时，`tsToSchema` 在根上写入 `x-ui: { version: 1 }` 与读到的 `rules`，与编译器一致。

## 标签取值的编码

- 文本取值（正文、`@title` 等）：TSDoc 语法字符（反斜杠、`@`、`{`、`}`、`<`、`>` 与反引号）前加反斜杠转义，`*/` 写成 `*\/`。
- JSON 取值：对象，以及含 TSDoc 语法字符或反斜杠的值，用反引号包裹；其余直接写 JSON（如 `"欢迎"` `1`）。
- 正则：写在反引号中。正则含反引号、换行或 `*/`，以引号开头，首尾有空白或为空串时，改写为反引号中的 JSON 字符串。
- 示例：对象，以及含对象的数组，写成 `json` 代码块。

## tsToSchema 额外接受的手写输入

`tsToSchema` 能读的写法比 `schemaToTs` 写出的多，用不上的都会报出来。

- 别名 `@default` `@readOnly` `@examples` `@comment` `@description`；标签名不区分大小写。
- JSON 取值两侧的反引号可以省略。
- 不是合法 JSON 的取值按字符串处理，报 `JOTL2113` warning。
- TSDoc 标准标签（如 `@remarks` `@see`）静默忽略；未知标签报 `JOTL2114` warning。
- 标签用在不适用的类型上报 `JOTL2115` warning。
- `@asType` 只接受 `integer`，其余值报 `JOTL2118` warning。
