# Handle results and diagnostics

**English** · [简体中文](../zh/docs/diagnostics.md)

This page shows how to read the result of any Jotl function, choose the message language, and define diagnostic codes for your own package. It applies to every Jotl package, since they all build on the `Result` and `Diagnostic` types of `@jotl/core`.

## Read a Result

Public functions of all Jotl packages return `Result<T>`, `{ value, diagnostics }`, and do not throw.

```ts
import { compile, hasErrors } from '@jotl/core';

const result = compile('A: strng', 'a.jotl');
if (result.value === undefined || hasErrors(result.diagnostics)) {
  for (const d of result.diagnostics) console.log(d.code, d.severity, d.message);
}
// JOTL1004 error Unknown component `strng`
```

- `value` may be `undefined` when there are `error` diagnostics. Check `value` first, then `hasErrors(diagnostics)`, which looks only at the `error` level.
- Build your own results with `ok(value, diagnostics?)` and `fail(diagnostics)`.

## Read a Diagnostic

A `Diagnostic` has these fields:

- `code`: `JOTL` plus four digits. Codes are never reused once published.
- `severity`: `"error"`, `"warning"` or `"info"`.
- `message`: text in the language that was current when the diagnostic was created.
- Optional `location`, `related` and `fixes`.

`location` comes in two kinds:

- `{ kind: "source", range }` points into source text. `line` and `column` start at 1 and `offset` at 0; columns and offsets count UTF-16 code units, consistent with LSP. Diagnostics of `parse`, `compile` and `format` use this kind.
- `{ kind: "pointer", pointer, document? }` points to a JSON Pointer in a schema or data document. Diagnostics of `print` and of `@jotl/data` use this kind.

A `SourceMap` is keyed by pointers within the schema document. Its values are `SourceSpan`s: `range` covers the whole field or declaration, and `keyRange` covers the key.

## Choose the message language

Messages and generated text are available in English (`"en"`, the default `DEFAULT_LOCALE`) and Chinese (`"zh-CN"`). The language is global: every package reads it when it creates diagnostics and generated text.

```ts
import { compile, setLocale } from '@jotl/core';

setLocale('zh-CN');
compile('A: strng', 'a.jotl').diagnostics[0].message; // "未知组件 `strng`"
```

- `getLocale()` returns the current language; the type is `Locale`.
- `resolveLocale(tag)` maps a BCP 47 tag or a POSIX locale to a supported language: anything starting with `zh` (such as `zh_CN.UTF-8`) means Chinese, anything else English, and an empty value the default.
- `l10n(zh, en, locale?)` picks one of two texts, using the global language when `locale` is omitted.

`@jotl/data` functions also accept a per-call `locale` option; see the [`@jotl/data` guides](../../data/docs/README.md).

## Define codes for your package

Each package, or module within a package, defines its code table with `defineDiagnostics` in its own `diagnostics.ts`. Messages are written only in the code table: `message` is the Chinese template and the optional `en` the English one.

```ts
import { defineDiagnostics, hasErrors } from '@jotl/core';

const diagnostic = defineDiagnostics({
  JOTL9999: { severity: 'warning', message: '字段 {name} 已弃用', en: 'Field {name} is deprecated' },
});
const d = diagnostic('JOTL9999', { name: 'title' });
// { code: "JOTL9999", severity: "warning", message: "Field title is deprecated" }
hasErrors([d]); // false
```

- The factory has the signature `(code, params?, extras?) => Diagnostic`. `{name}` in templates is replaced from `params`; `extras.severity` overrides the severity in the table.
- When the language is `en`, the factory uses the `en` template and falls back to `message` when there is none.
- The factory throws when the code is not in the table.
- `formatMessage(template, params)` only substitutes the template and leaves missing parameters as is: `formatMessage("{a} {b}", { a: 1 })` gives `"1 {b}"`.

## Find which package a code belongs to

| Code range | Package                             | Code table                                                        |
| ---------- | ----------------------------------- | ----------------------------------------------------------------- |
| `JOTL0xxx` | `@jotl/core` (contract)             | `SCHEMA_DIAGNOSTICS` in `packages/core/src/schema/diagnostics.ts` |
| `JOTL1xxx` | `@jotl/core` (syntax)               | `SYNTAX_DIAGNOSTICS` in `packages/core/src/syntax/diagnostics.ts` |
| `JOTL2xxx` | `@jotl/convert` (TS conversion)     | `packages/convert/src/ts/diagnostics.ts`                          |
| `JOTL3xxx` | `@jotl/convert` (version upgrade)   | `packages/convert/src/migrate/upgrade/diagnostics.ts`             |
| `JOTL4xxx` | `@jotl/data`                        | `packages/data/src/diagnostics.ts`                                |
| `JOTL5xxx` | `@jotl/form/core`                   | `packages/form/src/core/diagnostics.ts`                           |
| `JOTL6xxx` | `@jotl/form` (React renderer)       | `packages/form/src/react/diagnostics.ts`                          |
| `JOTL7xxx` | `@jotl/language-server`             | `packages/language-server/src/diagnostics.ts`                     |
| `JOTL8xxx` | `@jotl/convert` (Fengdie migration) | `packages/convert/src/migrate/fengdie/diagnostics.ts`             |
| `JOTL9xxx` | `jotl` command line                 | `packages/cli/src/diagnostics.ts`                                 |

The meaning of each `JOTL1xxx` code is listed in the [Jotl syntax specification](../../../docs/spec/jotl.md).
