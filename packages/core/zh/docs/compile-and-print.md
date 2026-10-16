# 编译与打印 Jotl

[English](../../docs/compile-and-print.md) · **简体中文**

读完本页，你能在自己的代码里把 Jotl 源码转成 JSON Schema 2020-12，再转回来。前提是已按[快速开始](../README.md#编译第一个文件)装好 `@jotl/core`；语法与编译规则见 [Jotl 语法规范](../../../../zh/docs/spec/jotl.md)。

## 编译源码

`compile(text, file, options?)` 对一段源码做解析、检查和编译。参数 `file` 只写进诊断与源码映射的位置，不会去读磁盘。

```ts
import { compile } from "@jotl/core";

const result = compile("User: {\n  name(Name): string[maxLength: 20]\n}", "user.jotl");
result.value?.sourceMap.get("/$defs/User/properties/name");
// {
//   range:    { file: "user.jotl", start: { line: 2, column: 3, offset: 10 }, end: { line: 2, column: 36, offset: 43 } },
//   keyRange: { file: "user.jotl", start: { line: 2, column: 3, offset: 10 }, end: { line: 2, column: 7, offset: 14 } }
// }
```

返回的 `CompileOutput` 有四个字段：

- `schema`：规范化的 2020-12 文档。
- `sourceMap`：schema 指针 → `SourceSpan`。`range` 覆盖整个字段或声明；字段与 `$defs` 条目另有覆盖键名的 `keyRange`。
- `ast`：语法树（`JotlFile`）。
- `defaultExport`：默认导出的类型名，不进 schema；生成 TypeScript 时传给 `@jotl/convert` 的 `schemaToTs(schema, { defaultExport })`。

只要有 `error` 级诊断，`value` 就是 `undefined`；warning 不影响 `value`。诊断按源码位置排序。唯一的选项是 `widgets`，见[登记扩展组件](./extension-components.md)。

经元数据 `schema` 写入的 `x-ui` 不符合 `x-ui` meta-schema，或含有根专属字段 `version`、`rules`、`widgets` 时，报 `JOTL1050` warning，内容原样写入。

## 只解析不编译

`parse(text, file)` 只做词法与语法分析，返回 AST（`JotlFile`）。有语法错误时仍返回尽力恢复出的 AST，编辑器可以在源码残缺时继续工作。

## 把 schema 打印成 Jotl

`print(schema, options?)` 把 JSON Schema 2020-12 文档写成规范形 Jotl 源码。输入能用 Jotl 表达时，打印结果再编译一次，得到的 schema 与输入深度相等。

```ts
import { print } from "@jotl/core";

print({ type: "object", properties: { a: { type: "string", format: "time" } } }, { rootName: "Page" }).value;
// "Page: {\n  a?: string[format: 'time']\n}\n"
```

选项：

- `rootName`：根不是指向 `$defs` 条目的 `$ref` 时，为根生成的类型名。默认 `Root`，必须是大驼峰，否则报 `JOTL1035`。
- `defaultExport`：默认导出的类型名，取值是 `$defs` 的键，来自 `compile` 结果或 `@jotl/convert/from-ts` 中 `tsToSchema` 结果的 `defaultExport`。与根不同时，该条目标 `<default/>`，根条目标 `<root/>`，编译回来的 `defaultExport` 与之一致；与根相同时不写标识；不是 `$defs` 的键时不写标识，并报 `JOTL1051` warning。

输入的映射方式：

- 根是指向 `$defs` 条目的 `$ref` 时，该条目成为根条目（不是第一条时标 `<root/>`）。根上的 `$id` 与 `x-ui.rules` 写成它的元数据 `id` 与 `rules`，根 `x-ui.widgets` 写成它的元数据 `widgets`。
- 不能用作类型名的 `$defs` 键改为大驼峰，并报 `JOTL1034` warning。
- 结构无法用组件表达的节点整体写成 `any[schema: {...}]`；其余无法表达的关键字归入 `schema: {...}`。

输入含非 JSON 值（`JOTL1031`）、既不是对象也不是布尔值（`JOTL1030`），或 `rootName` 不合法（`JOTL1035`）时，`value` 为 `undefined`。其他无法表达的内容报 warning 后照常输出。`print` 的诊断位置是输入 schema 中的 JSON Pointer，不是源码范围。

## 格式化源码

`format(text, file)` 按规范排版重写源码，保留全部注释，不改变编译结果。

```ts
import { format } from "@jotl/core";

format("A:{\n// hi\nb:string}", "a.jotl").value;
// "A: {\n  // hi\n  b: string\n}\n"
```

有语法错误时，`value` 是原样的源码，并附带语法诊断。

## 用自定义格式存储日期与时间

`date`、`time`、`datetime` 的元数据 `value_format` 设定存储格式，编译为 `x-valueFormat`：

| 写法 | 编译结果 |
|---|---|
| `date`（默认 `YYYY-MM-DD`） | `{ type: "string", format: "date" }` |
| `datetime` 取别名 `iso`（默认） | `{ type: "string", format: "date-time" }` |
| `datetime` 取别名 `iso-x`、`utc` 或 `utc-x` | `format: "date-time"` 加 `x-valueFormat` |
| `x` 或 `X`（时间戳） | `{ type: "integer", "x-valueFormat": ... }` 加 `x-ui.widget` |
| 其他格式，含 `time` 的默认值 `HH:mm:ss` | `{ type: "string", "x-valueFormat": ... }` 加 `x-ui.widget` |

`x-ui.widget` 取组件名（`date`、`time` 或 `datetime`）。`time` 用 `x` 或 `X` 报 `JOTL1020`。`print` 反向还原；`format: "time"` 不对应任何组件，打印为 `string[format: 'time']`。

## 做编辑器功能

本包还导出语言服务做补全和悬停所需的内容：AST 类型、内置组件名、元数据键白名单及其适用组件、`value_format` 编译规则 `valueFormatSchema`，以及按数据形态判定 widget 的 `defaultWidget` 与 `acceptsWidget`。具体内容以源码 `src/syntax/ast.ts`、`src/syntax/builtins.ts`、`src/syntax/shapes.ts` 为准。

本包的 `BUILTIN_WIDGETS` 是名字集合（`ReadonlySet<string>`），只用于编译期检查。`@jotl/form/core` 也导出 `BUILTIN_WIDGETS`，但那是名字 → 层级与优先级的表，供渲染器使用；在同一文件里同时导入时，给其中一个改名。
