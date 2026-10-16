# @jotl/language-server

**English** · [简体中文](./README.zh-CN.md)

Read this page when wiring the Jotl language service into an editor (LSP client), or when calling the diagnostics, completion, hover, go-to and preview functions directly from code; it corresponds to `packages/language-server`.

`@jotl/language-server` provides live diagnostics and quick fixes, completion, hover, go to definition and find references, outline, and preview content (the compiled JSON Schema and TS declarations) for `.jotl` source; it also generates a schema for the JSON language service so that `x-ui` in `*.schema.json` gets completion and validation.
Each capability is a connection-independent pure function, and `createServer` wires them to an LSP connection.
The VS Code extension (`packages/vscode`) is its consumer; manual verification steps are in `packages/vscode/VERIFY.md`.

## Installation

```sh
pnpm add @jotl/language-server
```

## Starting the server

The language server process entry needs just one line, which is exactly what `packages/vscode/src/server.ts` does:

```ts
import { startServer } from "@jotl/language-server";

startServer();
```

- `startServer()` chooses the transport by the process arguments `--node-ipc` `--stdio` `--socket`, starts listening, and returns the connection. With an existing connection, register the handlers with `createServer(connection, { diagnosticsDelay? })` and then the caller calls `connection.listen()`.
- Documents are kept in memory with incremental sync; on open they are fully compiled immediately and diagnostics are pushed; after changes, diagnostics are debounced by `diagnosticsDelay` (default `DIAGNOSTICS_DELAY`, i.e. 200 ms) and pushed only once for the latest text; on close, pending diagnostics are cancelled and empty diagnostics are pushed. Completion, hover and other requests always use the latest text.
- The client passes `{ registeredWidgets: string[] }` (widget names registered by the project) through `initializationOptions`; invalid items are ignored and duplicates removed. Later, on `workspace/didChangeConfiguration` whose `settings` contain a `jotl` section (`{ jotl: { registeredWidgets } }`), the option is replaced as a whole and all open documents are re-diagnosed immediately. PascalCase names among them are also passed to the compiler as extension components via `compile`'s `options.widgets`, with the underlying type `{ type: "string" }`.
- Language of diagnostics, hover, completion details and preview text: `initializationOptions.locale` first, then `initialize`'s `params.locale`, otherwise `en`; the value is a language tag, where one starting with `zh` means Chinese and anything else English (`resolveLocale` of `@jotl/core`). A `locale` in the `jotl` settings section (`{ jotl: { locale: "en" } }`) switches at runtime and re-diagnoses all open documents. The setting is process-wide (`@jotl/core`'s global language), so when calling the functions directly, call `setLocale` first.
- Names declared by the root entry's `widgets` metadata in a file (see the `@jotl/core` README) count as registered within that file: they are offered in component-position and `widget` completion and are not reported by `JOTL7001`; their underlying types are handled by the compiler itself.
- For each `file:` document, the nearest `jotl.config.json` is searched upward from its directory (stopping at a directory containing `.git` or the filesystem root; for the format see "扩展组件" (Extension components) in `docs/spec/jotl.md` (Chinese)); its names are merged into `registeredWidgets` and its underlying types are passed to the compiler; on name clashes the configuration file wins, names from settings supplement it, and PascalCase names only in settings are still compiled as `string`. Results are cached per directory; on `workspace/didChangeWatchedFiles` containing a `jotl.config.json` the cache is cleared and all open documents are re-diagnosed. When the configuration file is unreadable, is not valid JSON or has invalid items, `JOTL7002` (warning) is reported at the start of the document; invalid items are ignored and the rest take effect as usual.
- Preview goes through the custom request `PREVIEW_REQUEST_METHOD` (`"jotl/preview"`) with parameters `{ textDocument: { uri } }`, returning `PreviewContent`, whose `configFile` and `modules` are the path and module declarations of the document's `jotl.config.json`; `null` is returned when the document is not open. After a `jotl.config.json` change has been applied (config cache cleared), the server sends the parameterless notification `PREVIEW_CONFIG_CHANGED_METHOD` (`"jotl/configChanged"`); clients should re-request the preview on it rather than watching the file themselves, which would read the stale config.
- The VS Code extension starts the bundled `server.cjs` over IPC and passes the setting `jotl.registeredWidgets` as `initializationOptions`, then syncs changes to the `jotl` section via `synchronize.configurationSection` and watches `**/jotl.config.json` via `synchronize.fileEvents`; the wiring is in `packages/vscode/src/index.ts`.

## Calling directly

```ts
import { getCodeActions, getDiagnostics, getPreview } from "@jotl/language-server";

const uri = "file:///demo.jotl";
const text = "A: {\n  name: strng\n  title: string[widget: 'headline']\n}\n";

getDiagnostics(text, uri);
// [JOTL1004 error, range.start { line: 1, character: 8 }], [JOTL7001 warning: headline is not registered]
getDiagnostics(text, uri, { registeredWidgets: ["headline"] });
// only JOTL1004 remains

const source = "title: string\n";
const [diagnostic] = getDiagnostics(source, uri); // JOTL1036: only types may be declared at top level
getCodeActions(source, uri, diagnostic!.range); // [{ title: "包进 `Root(根): {...}` 并标 `<root/>`", kind: "quickfix", ... }]

getPreview("R: { a: string }", uri);
// { schema: JSON text with two-space indentation, typescript: starts with "// 由 Jotl 生成, 不要手改." ("// Generated by Jotl. Do not edit." under en), diagnostics: [] }
```

- Positions and ranges follow the LSP convention: lines and columns start at 0, columns count UTF-16 code units; compiler diagnostics' lines and columns start at 1 and are converted here.
- The `PreviewDiagnostic`s returned by `getPreview` still have lines and columns starting at 1; TS conversion diagnostics are mapped back to source locations via the compiled output's source map, and have only a `pointer` when they cannot be mapped.

## Public API

| Export | Returns | Notes |
|---|---|---|
| `getDiagnostics(text, uri, options?)` | LSP `Diagnostic[]` | Compiler diagnostics plus the unregistered-widget check, sorted by position; `source` is `"jotl"` |
| `getCodeActions(text, uri, range, options?)` | `CodeAction[]` | All fixes attached to diagnostics intersecting `range`; marked preferred when there is only one fix |
| `getCompletions(text, position, options?)` | `CompletionItem[]` | Completes by the context at the cursor: in component position, built-in components, types of this file and extension components (including names declared by the root `widgets` metadata); inside metadata `[...]`, keys applicable to that component (`META_KEY_TARGETS`); `widget` values (built-in widgets accepted by the compiler's `acceptsWidget` for the component's data shape, the first being the default, followed by registered names), `decorator` values, `value_format` values (common formats per date component, timestamps and the 4 aliases), condition `op`, names in type strings, `<root/>` `<default/>`; trigger characters in `COMPLETION_TRIGGER_CHARACTERS` |
| `getHover(text, uri, position, options?)` | `Hover \| null` | Type names, type references and field keys show the compiled JSON fragment, truncated beyond `MAX_FRAGMENT_LINES` lines; built-in components, extension components (with the base schema, declarations in the root `widgets` take precedence), metadata keys and marker tokens show descriptions |
| `getDefinition(text, uri, position)` | `Location[]` | When the cursor is on a reference to a top-level type (in component position or a type string) or on its declared name, returns its declaration |
| `getReferences(text, uri, position, includeDeclaration)` | `Location[]` | References to that top-level type within this file |
| `getDocumentSymbols(text, uri)` | `DocumentSymbol[]` | Outline: one item per top-level type, with fields, branches and enum members nested level by level |
| `getPreview(text, uri, options?, config?)` | `PreviewContent` | With error-level diagnostics `schema` and `typescript` are `undefined`; TS default-exports the compilation result's `defaultExport`; `config` (`{ file, modules }`) is passed through as `configFile` and `modules`, relative paths in `module` resolve against the directory of `configFile` |
| `readInitializationOptions(raw)` | `LanguageServiceOptions` | Reads options from `initializationOptions` |
| `readLocaleOption(raw)` | `string \| undefined` | Reads `locale` from `initializationOptions` or the `jotl` settings section; `undefined` when absent or not a non-empty string |
| `withConfigWidgets(options, widgets)` | `LanguageServiceOptions` | Merges in registrations from `jotl.config.json` (`config.widgets` of `readJotlConfig`), rules as above |
| `createJotlConfigJsonSchema()` `JOTL_CONFIG_FILE` | `JsonSchemaObject`, `string` | Re-exported from `@jotl/core`; written as `jotl.config.schema.json` when the extension is packaged |
| `createXUiJsonSchema()` | `JsonSchemaObject` | A JSON Schema whose `$id` is `X_UI_JSON_SCHEMA_ID`, recursing through all 2020-12 subschema keywords and validating `x-ui` on every node against `xUiMetaSchema`; written as `x-ui.schema.json` when the extension is packaged |
| `createServer(connection, options?)` `startServer()` | `void`, `Connection` | See "Starting the server" above |

`options` is `LanguageServiceOptions`: `registeredWidgets` defaults to empty, i.e. only `@jotl/form/core`'s `BUILTIN_WIDGETS` are recognized, and there are no extension components; `widgets` holds the underlying schemas of registered names, and extension components not in it are compiled as `string`. Calling these functions directly does not look up `jotl.config.json`; when needed, the caller reads it and merges it in with `withConfigWidgets`.

## Diagnostic codes

- This package's own diagnostics are `JOTL7xxx`, code table in `LSP_DIAGNOSTICS` of `src/diagnostics.ts`; `JOTL7001` means a widget name referenced by metadata `widget` `decorator` (including `widget` `decorator` in per-scene overrides of `variants`) is neither a built-in widget, nor in `registeredWidgets`, nor declared by the file's root `widgets` metadata, and rendering will fall back (warning); `JOTL7002` means the document's `jotl.config.json` is invalid (warning, reported at the start of the document).
- Other diagnostics come unchanged from `@jotl/core`'s compiler (`JOTL1xxx`); TS conversion diagnostics in preview come from `@jotl/convert` (`JOTL2xxx`).

## Known limitations

See "确定不修" (Won't fix) in the root `TODO.md`.
