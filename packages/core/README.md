# @jotl/core

**English** · [简体中文](./README.zh-CN.md)

Read this page when calling any Jotl package and you need to understand its `Result` and diagnostic structure, when handling JSON Pointers or source maps, when defining a diagnostic code table for a new package, or when parsing, compiling or formatting Jotl source in code or printing JSON Schema as Jotl; it corresponds to `packages/core`.

`@jotl/core` consists of two parts, exported together through the single entry `@jotl/core`:

- `src/schema/`: the contract layer shared by all packages: JSON Schema 2020-12 and `x-ui` types, diagnostics and `Result`, source locations, JSON Pointer utilities, and the data capability interface types implemented by `@jotl/data`. This part has no runtime dependencies.
- `src/syntax/`: compiles Jotl source to normalized JSON Schema 2020-12 with a source map, and can also print a 2020-12 schema back to Jotl. Syntax and compilation rules follow `docs/spec/jotl.md` (Chinese); for `x-ui` value semantics see `docs/spec/x-ui.md`.

## Installation

```sh
pnpm add @jotl/core
```

## Minimal example

Contract layer: JSON Pointer and diagnostics.

```ts
import { appendPointer, defineDiagnostics, evaluatePointer, fillWildcards, hasErrors, matchPointer } from "@jotl/core";

const doc = { list: [{ "a/b": 1 }] };
evaluatePointer(doc, "/list/0/a~1b"); // { value: 1, diagnostics: [] }
evaluatePointer(doc, "/list/1"); // value is undefined, diagnostics contains a JOTL0002 error

appendPointer("/list", 0, "a/b"); // "/list/0/a~1b"
matchPointer("/list/*/x", "/list/3/x"); // true
fillWildcards("/list/*/x", [2]); // "/list/2/x"

const diagnostic = defineDiagnostics({ JOTL9999: { severity: "warning", message: "Field {name} is deprecated" } });
const d = diagnostic("JOTL9999", { name: "title" }); // { code, severity: "warning", message: "Field title is deprecated" }
hasErrors([d]); // false
```

Syntax: compile and print.

```ts
import { compile, print } from "@jotl/core";

const result = compile(
  `Home(首页): {
  title(标题): string[maxLength: 20, default: '欢迎']
  mode(模式)?: enum[default: 'light']{ light(浅色) dark(深色) }
}`,
  "home.jotl",
);
// result.value.schema:
// { $schema: "https://json-schema.org/draft/2020-12/schema", $ref: "#/$defs/Home", "x-ui": { version: 1 },
//   $defs: { Home: { title: "首页", type: "object", properties: { title: { ..., maxLength: 20 }, mode: { oneOf: [...] } }, required: ["title"] } } }
// result.value.sourceMap.get("/$defs/Home/properties/title"): range of the entry on line 2, keyRange points to the key `title`

const back = print(result.value!.schema);
// back.value is canonical Jotl source; compiling it again yields a schema deeply equal to the input
```

`compile("A: strng", "a.jotl")` returns `value: undefined` and one `JOTL1004` error located at line 1, column 4.

Language and extension component modules: the root entry's `widgets` metadata registers extension components for this file; module declarations among them are compiled into the root `x-ui.widgets`.

```ts
import { compile, setLocale } from "@jotl/core";

setLocale("en"); // diagnostics created from now on are in English (also the default); setLocale("zh-CN") for Chinese

const result = compile(
  `Form: [widgets: {ImagePicker: {base: 'url', module: 'https://esm.sh/image-picker'}}] {
  cover(Cover): ImagePicker
}`,
  "form.jotl",
);
// result.value.schema["x-ui"]: { version: 1, widgets: { ImagePicker: { module: "https://esm.sh/image-picker" } } }
// result.value.schema.$defs.Form.properties.cover: { title: "Cover", type: "string", format: "uri", "x-ui": { widget: "ImagePicker" } }
```

## Result and diagnostics

Public functions of all packages uniformly return `Result<T>`: `{ value, diagnostics }`, without throwing:

- `value` is the result; it may be `undefined` when there are `error`-level diagnostics; callers check `value` first and then `hasErrors(diagnostics)`.
- A `Diagnostic` contains `code` (`JOTL` plus four digits), `severity` (`"error"` `"warning"` `"info"`), a `message` in the language current when the diagnostic was created (`getLocale()`, default `en`), and optional `location` `related` `fixes`.
- `location` has two kinds: `{ kind: "source", range }` points into source, `{ kind: "pointer", pointer, document? }` points to a JSON Pointer in a schema or data.
- In source locations `line` and `column` start at 1 and `offset` starts at 0; columns and offsets count UTF-16 code units (consistent with LSP).
- `SourceMap` is keyed by pointers within the schema document, with `SourceSpan` values (`range` is the whole field or declaration, `keyRange` the key name).

## Public API

For the complete exports see `packages/core/src/index.ts` (merging `src/schema/index.ts` and `src/syntax/index.ts`); the tables below list only exports whose behavior needs explanation.

### Contract (`src/schema/`)

| Export | Purpose |
|---|---|
| `ok(value, diagnostics?)` `fail(diagnostics)` `hasErrors(diagnostics)` | Construct a `Result`; `hasErrors` only looks at the `error` level |
| `defineDiagnostics(table)` | Builds a diagnostic factory `(code, params?, extras?) => Diagnostic` from a code table; `{name}` in message templates is replaced from `params`, `extras.severity` overrides the table's severity; throws when the code is not in the table. Each entry's `message` is the Chinese template and the optional `en` the English one; under `en` the `en` template is used (falling back to `message` when absent) |
| `formatMessage(template, params)` | Template substitution only; missing parameters are left as is |
| `Locale` `DEFAULT_LOCALE` `getLocale()` `setLocale(locale)` `resolveLocale(tag)` `l10n(zh, en, locale?)` | Global language for user-facing text, `"zh-CN" \| "en"`, default `en`; every package reads it when creating diagnostics and generated text. `resolveLocale` maps a BCP 47 tag or POSIX locale (e.g. `zh_CN.UTF-8`) to a supported language: starting with `zh` means Chinese, anything else English, empty means the default; `l10n` picks one of two texts, using the global language when `locale` is omitted |
| `parsePointer` `evaluatePointer` | Parse and evaluate, returning a `Result`; an invalid pointer reports `JOTL0001`, a non-existent location `JOTL0002` |
| `tryParsePointer` `isPointer` `lookupPointer` | Versions that produce no diagnostics; `lookupPointer` returns `{ found, value }`, array tokens accept only canonical decimal indexes, objects are looked up by own properties only |
| `formatPointer(tokens)` `appendPointer(base, ...tokens)` | Build a pointer from unescaped tokens |
| `joinPointer(base, relative)` | Joins an already escaped relative path (e.g. `"0/img"`); an empty string returns `base` |
| `parentPointer` `lastPointerToken` `escapePointerToken` `unescapePointerToken` | Parent pointer, last token, and escaping |
| `matchPointer(pattern, pointer)` `fillWildcards(template, indexes)` `POINTER_WILDCARD` | A `"*"` token matches any single token, and token counts must be equal; `fillWildcards` replaces `"*"` with indexes in order, leaving remaining `"*"` when indexes run out |
| `JsonSchema` `JsonSchemaObject` `JsonValue` `isSchemaObject` | 2020-12 document types; `JsonSchema` includes boolean schemas |
| `JSON_SCHEMA_DIALECT` | `https://json-schema.org/draft/2020-12/schema` |
| `orderKeywords(schema)` | Reorders keywords per normalization rule 7 of `docs/spec/jotl.md`, recursing into subschemas, and returns a new object |
| `SUBSCHEMA_KEYWORDS` | Keywords that hold subschemas, in three groups `single` `array` `map`, for traversal |
| Exports of `packages/core/src/schema/x-ui.ts` (`XUi` and its subtypes, `XUiWidgetModule`, `DEFAULT_SCENE` `DEFAULT_GRID_COLUMNS`) | Types and defaults of the `x-ui` keyword; semantics in `docs/spec/x-ui.md` |
| `xUiMetaSchema` | Meta-schema (2020-12) of `x-ui`, forbidding unknown fields; for validation and editor completion |
| `DEFAULT_VALUE_FORMATS` `VALUE_FORMAT_ALIASES` `TIMESTAMP_VALUE_FORMATS` `isValueFormatAlias` `isTimestampValueFormat` `valueFormatComponent` `TemporalComponent` | Shared rules for the date component storage format `x-valueFormat`: default format per component (`date` `YYYY-MM-DD`, `time` `HH:mm:ss`, `datetime` `iso`), aliases `iso` `iso-x` `utc` `utc-x`, timestamps `x` `X`; without `x-ui.widget` the component is inferred from the format (timestamps and aliases, or containing both date and time tokens, mean `datetime`; only time tokens mean `time`; otherwise `date`) |
| `matchesValueFormat(format, value)` `matchesValueFormatText(format, text)` `isRfc3339DateTime(text)` | Value checking without dayjs, with conclusions consistent with `@jotl/data`: timestamps only check for integers, aliases follow RFC 3339, format strings match strictly position by position and validate calendar dates; only `YYYY MM DD HH mm ss SSS Z ZZ A a` and `[..]` escapes are supported; with other tokens `matchesValueFormatText` returns `undefined` and `matchesValueFormat` returns `true` (undetermined) |
| `DataApi` `GetDefaults` `FillDefaults` `Validate` `Migrate` `Mock` `DefaultsOptions` `MockOptions` `DEFAULT_DEFAULTS_OPTIONS` | Types of the data capability interfaces; for implementation and behavior see the `@jotl/data` README |

### Syntax (`src/syntax/`)

Diagnostics of `parse`, `compile` and `format` are sorted by source location. The `file` parameter is only written into diagnostic and source map locations; no file is read.

| Function | Purpose | On error |
|---|---|---|
| `compile(text, file, options?)` | Parses, checks semantics and compiles, returning `CompileOutput`: `schema` (normalized 2020-12 document), `sourceMap` (schema pointer → source location; fields and `$defs` entries also have a `keyRange` pointing at the key), `ast`, `defaultExport` (the default export's type name, not in the schema; passed to `@jotl/convert`'s `schemaToTs(schema, { defaultExport })` when generating TS) | With error-level diagnostics `value` is `undefined`; warnings do not affect it |
| `parse(text, file)` | Lexical and syntactic analysis only, returning the AST (`JotlFile`) | With syntax errors it still returns a best-effort recovered AST |
| `print(schema, options?)` | Prints JSON Schema 2020-12 as canonical Jotl source | When the input contains non-JSON values (`JOTL1031`), is neither an object nor a boolean (`JOTL1030`), or `rootName` is invalid (`JOTL1035`), `value` is `undefined`; inexpressible content reports a warning and output proceeds |
| `format(text, file)` | Rewrites the source with canonical layout, keeping all comments, without changing the compilation result | With syntax errors `value` is the source unchanged, with the syntax diagnostics attached |

- `compile`'s only option is `widgets`: registered extension components (component name → underlying schema), passed in by the caller; this package reads no configuration file; when not passed, a PascalCase name in component position can only be a type declared in this file or an extension component declared by the root entry's `widgets` metadata.
- Root entry metadata `widgets` (e.g. `Form: [widgets: {ImagePicker: {base: 'url', module: 'https://esm.sh/image-picker'}}] {...}`) registers extension components for this file, merged with `options.widgets`, with the file winning on name clashes; values are written the same way as in `jotl.config.json`: a base type, or a module declaration `{ base?, module, export? }` (`base` defaults to `object`, `export` to `default`); module declarations are compiled into the root `x-ui.widgets` (name → `{ base?, module, export? }`, type `XUiWidgetModule`; `base` is kept only when declared as something other than `object`). A type name clashing with such a component reports `JOTL1028`, an invalid value `JOTL1020`. `print` writes the root `x-ui.widgets` back as the root entry's `widgets`.
- `x-ui` written via the `schema` metadata that does not conform to the `x-ui` meta-schema, or contains the root-only fields `version` `rules` `widgets`, reports a `JOTL1050` warning and is written as is.
- Processing of the project configuration `jotl.config.json` (format in "扩展组件" (Extension components) of `docs/spec/jotl.md`) also lives in this package, while file lookup is done by the caller: `readJotlConfig(value)` validates the parsed JSON and converts underlying types to schemas, returning `{ config: { widgets, modules }, issues }` (`widgets` is name → underlying schema; `modules` is name → `{ module, export? }` for items written as module declarations such as `{ "ImagePicker": { "base": "url", "module": "./widgets/image-picker.js" } }`, with `module` kept verbatim so the caller resolves relative paths against the configuration file's directory; module declarations in the configuration are not written into compile output, the consumer loads them from `config.modules`) (`issues` are `{ pointer, message }`; failing items are skipped, the rest returned as usual); `configCompileOptions(widgets)` takes only PascalCase names as `compile`'s `options.widgets`; `createJotlConfigJsonSchema()` returns the JSON Schema of the configuration file itself (`$id` is `JOTL_CONFIG_SCHEMA_ID`) for editor validation; the file name constant is `JOTL_CONFIG_FILE`.
- `locateJsonError(text)` returns `{ offset, found }` for the first JSON syntax error (`found` is `undefined` when the text ends early), or `undefined` for valid JSON; `jsonPointerOffsets(text)` maps each value's pointer in valid JSON to its text offset (object members map to the start of the key), returning `undefined` for invalid JSON. Used to give `jotl.config.json` and other JSON input diagnostics a line and column; no Node API, runs in the browser.
- `print`'s option `rootName`: when the root is not a `$ref` to a `$defs` entry, the type name generated for the root, default `Root`, must be PascalCase.
- `print`'s option `defaultExport`: the default export's type name (a key of `$defs`, taken from the `defaultExport` of a `compile` result or of a `tsToSchema` result from `@jotl/convert/from-ts`); when it differs from the root, that entry is marked `<default/>` and the root entry is also marked `<root/>`, so the `defaultExport` compiled back matches it; when it equals the root, no marker is written; when it is not a key of `$defs`, no marker is written and a `JOTL1051` warning is reported.
- The `value_format` metadata (storage format) of `date` `time` `datetime` compiles to `x-valueFormat`: `date` with default `YYYY-MM-DD` becomes `format: date`; `datetime` with alias `iso` (default) `iso-x` `utc` `utc-x` becomes `format: date-time`, with non-`iso` also writing `x-valueFormat`; `x` `X` become `{type: integer, x-valueFormat}`; everything else (including `time` default `HH:mm:ss`) becomes `{type: string, x-valueFormat}`; the latter two always write `x-ui.widget` as the component name. `time` with `x` `X` reports `JOTL1020`. `print` restores in reverse; `format: time` corresponds to no component and prints as `string[format: 'time']`.
- In `print`, when the root is a `$ref` to a `$defs` entry, that entry is the root (marked `<root/>` when not the first), and the root `$id` and `x-ui.rules` are written as its `id` `rules`; `$defs` keys that cannot be type names are converted to PascalCase with `JOTL1034`; nodes whose structure cannot be restored with components are written whole as `any[schema: {...}]`, and other inexpressible keywords go into `schema: {...}`.
- Also exported are AST types (`src/syntax/ast.ts`), built-in component names, metadata key allowlists and applicable components, the `value_format` compilation rule `valueFormatSchema` (`src/syntax/builtins.ts`), and `defaultWidget` `acceptsWidget`, which decide widgets from data shape, plus the built-in widget name set `BUILTIN_WIDGETS` (`src/syntax/shapes.ts`), for tools such as the language service to provide completion and hover; the source is authoritative for table contents.
- `BUILTIN_WIDGETS` differs from the export of the same name in `@jotl/form/core`: this package's is a name set (`ReadonlySet<string>`) used only for compile-time checks; `@jotl/form/core`'s is a table of name → tier and priority for the renderer. Rename one when importing both in the same file.

## Diagnostic code ranges

Each package (or module within a package) defines its code table with `defineDiagnostics` in its own `diagnostics.ts`; messages (Chinese `message`, English `en`) are written only in the code table; codes are never reused once published.

| Code range | Package | Code table |
|---|---|---|
| `JOTL0xxx` | `@jotl/core` (contract) | `SCHEMA_DIAGNOSTICS` in `packages/core/src/schema/diagnostics.ts` |
| `JOTL1xxx` | `@jotl/core` (syntax) | `SYNTAX_DIAGNOSTICS` in `packages/core/src/syntax/diagnostics.ts` |
| `JOTL2xxx` | `@jotl/convert` (TS conversion) | `packages/convert/src/ts/diagnostics.ts` |
| `JOTL3xxx` | `@jotl/convert` (version upgrade) | `packages/convert/src/migrate/upgrade/diagnostics.ts` |
| `JOTL4xxx` | `@jotl/data` | `packages/data/src/diagnostics.ts` |
| `JOTL5xxx` | `@jotl/form/core` | `packages/form/src/core/diagnostics.ts` |
| `JOTL6xxx` | `@jotl/form` (React renderer) | `packages/form/src/react/diagnostics.ts` |
| `JOTL7xxx` | `@jotl/language-server` | `packages/language-server/src/diagnostics.ts` |
| `JOTL8xxx` | `@jotl/convert` (Fengdie migration) | `packages/convert/src/migrate/fengdie/diagnostics.ts` |
| `JOTL9xxx` | `jotl` command line | `packages/cli/src/diagnostics.ts` |

Diagnostic locations in the syntax part are source locations (`location.kind === "source"`), with lines and columns starting at 1 and columns counting UTF-16 code units; `print`'s diagnostic locations are JSON Pointers into the input schema.

## Known limitations

See "确定不修" (Won't fix) in the root `TODO.md`.
