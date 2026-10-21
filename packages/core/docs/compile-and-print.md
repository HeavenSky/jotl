# Compile and print Jotl

**English** · [简体中文](../zh/docs/compile-and-print.md)

This page shows how to turn Jotl source into JSON Schema 2020-12 and back from your own code. It assumes `@jotl/core` is installed, as in [Quick start](../README.md#compile-your-first-file); syntax and compilation rules are in the [Jotl syntax specification](../../../docs/spec/jotl.md).

## Compile source

`compile(text, file, options?)` parses, checks and compiles one source text. The `file` argument is only written into diagnostic and source map locations; nothing is read from disk.

```ts
import { compile } from '@jotl/core';

const result = compile('User: {\n  name(Name): string[maxLength: 20]\n}', 'user.jotl');
result.value?.sourceMap.get('/$defs/User/properties/name');
// {
//   range:    { file: "user.jotl", start: { line: 2, column: 3, offset: 10 }, end: { line: 2, column: 36, offset: 43 } },
//   keyRange: { file: "user.jotl", start: { line: 2, column: 3, offset: 10 }, end: { line: 2, column: 7, offset: 14 } }
// }
```

The returned `CompileOutput` has four fields:

- `schema`: the normalized 2020-12 document.
- `sourceMap`: schema pointer → `SourceSpan`. `range` covers the whole field or declaration; fields and `$defs` entries also have a `keyRange` that covers the key.
- `ast`: the syntax tree (`JotlFile`).
- `defaultExport`: the type name of the default export. It is not part of the schema; pass it to `schemaToTs(schema, { defaultExport })` of `@jotl/convert` when you generate TypeScript.

With any `error` diagnostic, `value` is `undefined`; warnings leave `value` intact. Diagnostics are sorted by source position. The only option is `widgets`, described in [Register extension components](./extension-components.md).

When `x-ui` written through the `schema` metadata does not conform to the `x-ui` meta-schema, or contains the root-only fields `version`, `rules` or `widgets`, the compiler reports a `JOTL1050` warning and writes it as is.

## Parse without compiling

`parse(text, file)` runs only lexical and syntax analysis and returns the AST (`JotlFile`). With syntax errors it still returns a best-effort recovered AST, so editors can keep working on broken source.

## Print a schema as Jotl

`print(schema, options?)` writes a JSON Schema 2020-12 document as canonical Jotl source. Compiling the printed source again yields a schema deeply equal to the input when the input is expressible in Jotl.

```ts
import { print } from '@jotl/core';

print({ type: 'object', properties: { a: { type: 'string', format: 'time' } } }, { rootName: 'Page' }).value;
// "Page: {\n  a?: string[format: 'time']\n}\n"
```

Options:

- `rootName`: the type name generated for the root when the root is not a `$ref` to a `$defs` entry. Default `Root`; it must be PascalCase, otherwise `JOTL1035` is reported.
- `defaultExport`: the type name of the default export, a key of `$defs`. Take it from the `defaultExport` of a `compile` result or of `tsToSchema` in `@jotl/convert/from-ts`. When it differs from the root, that entry is marked `<default/>` and the root entry is marked `<root/>`, so compiling back gives the same `defaultExport`. When it equals the root, no marker is written. When it is not a key of `$defs`, no marker is written and a `JOTL1051` warning is reported.

How the input is mapped:

- When the root is a `$ref` to a `$defs` entry, that entry becomes the root entry (marked `<root/>` when it is not the first). The root `$id` and `x-ui.rules` are written as its `id` and `rules` metadata, and the root `x-ui.widgets` as its `widgets` metadata.
- `$defs` keys that cannot be type names are converted to PascalCase with a `JOTL1034` warning.
- A node whose structure cannot be expressed with components is written whole as `any[schema: {...}]`; other inexpressible keywords go into `schema: {...}`.

`value` is `undefined` when the input contains non-JSON values (`JOTL1031`), is neither an object nor a boolean (`JOTL1030`), or `rootName` is invalid (`JOTL1035`). Anything else that cannot be expressed reports a warning and output continues. Diagnostic locations of `print` are JSON Pointers into the input schema, not source ranges.

## Format source

`format(text, file)` rewrites source in canonical layout, keeps every comment, and does not change the compilation result.

```ts
import { format } from '@jotl/core';

format('A:{\n// hi\nb:string}', 'a.jotl').value;
// "A: {\n  // hi\n  b: string\n}\n"
```

With syntax errors, `value` is the unchanged source and the syntax diagnostics are attached.

## Store dates and times in a custom format

The `value_format` metadata of `date`, `time` and `datetime` sets the storage format and compiles to `x-valueFormat`:

| Written as                                                     | Compiles to                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| `date` (default `YYYY-MM-DD`)                                  | `{ type: "string", format: "date" }`                           |
| `datetime` with alias `iso` (default)                          | `{ type: "string", format: "date-time" }`                      |
| `datetime` with alias `iso-x`, `utc` or `utc-x`                | `format: "date-time"` plus `x-valueFormat`                     |
| `x` or `X` (timestamps)                                        | `{ type: "integer", "x-valueFormat": ... }` plus `x-ui.widget` |
| Any other format, including `time` with its default `HH:mm:ss` | `{ type: "string", "x-valueFormat": ... }` plus `x-ui.widget`  |

`x-ui.widget` is the component name (`date`, `time` or `datetime`). `time` with `x` or `X` reports `JOTL1020`. `print` restores these in reverse; `format: "time"` corresponds to no component and prints as `string[format: 'time']`.

## Build editor features

The package also exports what a language service needs for completion and hover: the AST types, built-in component names, metadata key allowlists with the components they apply to, the `value_format` rule `valueFormatSchema`, and `defaultWidget` and `acceptsWidget`, which decide widgets from the data shape. The source files `src/syntax/ast.ts`, `src/syntax/builtins.ts` and `src/syntax/shapes.ts` are authoritative for their contents.

`BUILTIN_WIDGETS` here is a set of names (`ReadonlySet<string>`) used for compile-time checks. `@jotl/form/core` exports a different `BUILTIN_WIDGETS`, a table of name → tier and priority for the renderer; rename one of them when you import both in the same file.
