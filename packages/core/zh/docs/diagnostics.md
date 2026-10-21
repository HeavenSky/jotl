# 处理结果与诊断

[English](../../docs/diagnostics.md) · **简体中文**

读完本页，你能读懂任一 Jotl 函数的返回值、选择消息语言，并为自己的包定义诊断代码。所有 Jotl 包都建立在 `@jotl/core` 的 `Result` 与 `Diagnostic` 类型之上，因此本页对每个包都适用。

## 读取 Result

所有 Jotl 包的公开函数都返回 `Result<T>`，即 `{ value, diagnostics }`，不抛异常。

```ts
import { compile, hasErrors } from "@jotl/core";

const result = compile("A: strng", "a.jotl");
if (result.value === undefined || hasErrors(result.diagnostics)) {
	for (const d of result.diagnostics) console.log(d.code, d.severity, d.message);
}
// JOTL1004 error Unknown component `strng`
```

- 有 `error` 级诊断时 `value` 可能是 `undefined`。先看 `value`，再看 `hasErrors(diagnostics)`；后者只看 `error` 级。
- 自己构造结果时用 `ok(value, diagnostics?)` 与 `fail(diagnostics)`。

## 读取 Diagnostic

`Diagnostic` 有这些字段：

- `code`：`JOTL` 加四位数字。代码一旦发布就不再复用。
- `severity`：`"error"`、`"warning"` 或 `"info"`。
- `message`：文本语言取创建诊断时的当前语言。
- 可选的 `location`、`related` 与 `fixes`。

`location` 分两种：

- `{ kind: "source", range }` 指向源码。`line` 与 `column` 从 1 起，`offset` 从 0 起；列与偏移按 UTF-16 代码单元计，与 LSP 一致。`parse`、`compile`、`format` 的诊断用这一种。
- `{ kind: "pointer", pointer, document? }` 指向 schema 或数据文档中的 JSON Pointer。`print` 与 `@jotl/data` 的诊断用这一种。

`SourceMap` 以 schema 文档内的指针为键，值为 `SourceSpan`：`range` 覆盖整个字段或声明，`keyRange` 覆盖键名。

## 选择消息语言

消息与生成的文字有英文（`"en"`，即默认值 `DEFAULT_LOCALE`）和中文（`"zh-CN"`）两种。语言是全局设置，各包创建诊断与生成文字时都读取它。

```ts
import { compile, setLocale } from "@jotl/core";

setLocale("zh-CN");
compile("A: strng", "a.jotl").diagnostics[0].message; // "未知组件 `strng`"
```

- `getLocale()` 返回当前语言，类型为 `Locale`。
- `resolveLocale(tag)` 把 BCP 47 标签或 POSIX 语言环境归到支持的语言：以 `zh` 开头（如 `zh_CN.UTF-8`）为中文，其余为英文，空值取默认。
- `l10n(zh, en, locale?)` 二选一取文案，不传 `locale` 时取全局语言。

`@jotl/data` 的函数还接受按次调用的 `locale` 选项，见 [`@jotl/data` 使用指南](../../../data/zh/docs/README.md)。

## 为自己的包定义代码

每个包（或包内模块）在自己的 `diagnostics.ts` 里用 `defineDiagnostics` 定义代码表。消息只写在代码表里：`message` 是中文模板，可选的 `en` 是英文模板。

```ts
import { defineDiagnostics, hasErrors } from "@jotl/core";

const diagnostic = defineDiagnostics({
	JOTL9999: {
		severity: "warning",
		message: "字段 {name} 已弃用",
		en: "Field {name} is deprecated",
	},
});
const d = diagnostic("JOTL9999", { name: "title" });
// { code: "JOTL9999", severity: "warning", message: "Field title is deprecated" }
hasErrors([d]); // false
```

- 工厂函数的签名是 `(code, params?, extras?) => Diagnostic`。模板中的 `{name}` 由 `params` 替换；`extras.severity` 覆盖表中的级别。
- 语言为 `en` 时取 `en` 模板，没有时回落到 `message`。
- 代码不在表中时，工厂函数抛错。
- `formatMessage(template, params)` 只做模板替换，缺失的参数保留原样：`formatMessage("{a} {b}", { a: 1 })` 得到 `"1 {b}"`。

## 查代码属于哪个包

| 代码段     | 所属包                       | 代码表                                                            |
| ---------- | ---------------------------- | ----------------------------------------------------------------- |
| `JOTL0xxx` | `@jotl/core`（契约）         | `packages/core/src/schema/diagnostics.ts` 的 `SCHEMA_DIAGNOSTICS` |
| `JOTL1xxx` | `@jotl/core`（语法）         | `packages/core/src/syntax/diagnostics.ts` 的 `SYNTAX_DIAGNOSTICS` |
| `JOTL2xxx` | `@jotl/convert`（TS 互转）   | `packages/convert/src/ts/diagnostics.ts`                          |
| `JOTL3xxx` | `@jotl/convert`（版本升级）  | `packages/convert/src/migrate/upgrade/diagnostics.ts`             |
| `JOTL4xxx` | `@jotl/data`                 | `packages/data/src/diagnostics.ts`                                |
| `JOTL5xxx` | `@jotl/form/core`            | `packages/form/src/core/diagnostics.ts`                           |
| `JOTL6xxx` | `@jotl/form`（React 渲染器） | `packages/form/src/react/diagnostics.ts`                          |
| `JOTL7xxx` | `@jotl/language-server`      | `packages/language-server/src/diagnostics.ts`                     |
| `JOTL8xxx` | `@jotl/convert`（凤蝶迁移）  | `packages/convert/src/migrate/fengdie/diagnostics.ts`             |
| `JOTL9xxx` | `jotl` 命令行                | `packages/cli/src/diagnostics.ts`                                 |

每个 `JOTL1xxx` 代码的含义见 [Jotl 语法规范](../../../../zh/docs/spec/jotl.md#诊断)。
