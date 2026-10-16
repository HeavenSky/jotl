# Connect an editor

**English** · [简体中文](../zh/docs/editor-integration.md)

After reading this page you can wire `@jotl/language-server` into any LSP client: start it, pass options, keep settings and `jotl.config.json` in sync, and request previews. It assumes you have a server entry as in the [quick start](../README.md). The VS Code extension does all of this in [`packages/vscode/src/index.ts`](../../vscode/src/index.ts), which is a working reference.

## Start the server

`startServer()` creates a connection, registers every handler and starts listening. It picks the transport from the process arguments `--node-ipc`, `--stdio` or `--socket`, and returns the connection.

```js
import { startServer } from "@jotl/language-server";

startServer();
```

If you already have a connection, call `createServer(connection, options?)` to register the handlers, then call `connection.listen()` yourself. `options.diagnosticsDelay` sets the debounce in milliseconds (default `DIAGNOSTICS_DELAY`, 200), and `options.configHost` (`{ exists, readFile }`) replaces the file system used to read `jotl.config.json`.

## What the server announces

The `initialize` response declares these capabilities, with `serverInfo.name` set to `jotl-language-server`:

| Capability | Value |
|---|---|
| `textDocumentSync` | `openClose: true`, incremental changes |
| `completionProvider` | Trigger characters `:` `[` `,` `'` `"` `<` `\|` (`COMPLETION_TRIGGER_CHARACTERS`) |
| `codeActionProvider` | Kind `quickfix` |
| `hoverProvider`, `definitionProvider`, `referencesProvider`, `documentSymbolProvider` | `true` |

Two custom messages come on top: the request `jotl/preview` and the notification `jotl/configChanged`; see [Show a preview](#show-a-preview).

Documents live in memory. On open the server compiles the document and pushes diagnostics at once. After a change it waits `diagnosticsDelay` and pushes once for the latest text. On close it cancels pending diagnostics and pushes an empty list. Completion, hover and the other requests always use the latest text.

## Pass initialization options

Send these fields in `initializationOptions`; invalid values are ignored.

| Field | Type | Meaning |
|---|---|---|
| `registeredWidgets` | `string[]` | Widget names your project registers. Empty strings and non-strings are dropped, duplicates removed. UpperCamelCase names are also compiled as extension components with the underlying type `{ "type": "string" }`, unless `jotl.config.json` gives another type |
| `locale` | `string` | Language tag for diagnostics, hover, completion details and preview text |

The language is `initializationOptions.locale`, then the `locale` of the `initialize` params, otherwise `en`. A tag starting with `zh` means Chinese; anything else means English. The setting is process-wide: it sets the global language of `@jotl/core`.

Without registration, only the built-in widgets of `@jotl/form/core` (`BUILTIN_WIDGETS`) count as known, and there are no extension components. Names declared by the root entry's `widgets` metadata count as registered within their own file.

## Keep settings in sync

**Send settings under a `jotl` section:** the server reacts to `workspace/didChangeConfiguration` only when `settings` contains `jotl` (`CONFIGURATION_SECTION`).

```json
{ "settings": { "jotl": { "registeredWidgets": ["headline"], "locale": "en" } } }
```

- `registeredWidgets` replaces the previous list as a whole; a `jotl` section without it clears the list.
- `locale` switches the language at runtime.
- After either change, every open document is diagnosed again.

## Use jotl.config.json

For every `file:` document, the server finds the nearest `jotl.config.json`, starting in the document's directory and stopping at a directory that contains `.git` or at the file system root. The format is under extension components in the "Entries" section of the [Jotl language specification](../../../docs/spec/jotl.md#entries); the [`jotl` command line](../../cli/README.md) reads the same file.

- Names from the file are merged into `registeredWidgets`, and their underlying types go to the compiler. On a name clash the configuration file wins; names from settings are added, and UpperCamelCase names that appear only in settings still compile as `string`.
- Results are cached per directory. Watch `**/jotl.config.json` on the client and forward changes with `workspace/didChangeWatchedFiles`: the server then clears the cache and diagnoses every open document again.
- When the file cannot be read, is not valid JSON or has invalid entries, warning `JOTL7002` is reported at the start of each document that uses it. Invalid entries are ignored and the rest still apply.

## Show a preview

Send the request `jotl/preview` (`PREVIEW_REQUEST_METHOD`) with `{ textDocument: { uri } }`. The server returns a `PreviewContent`, or `null` when the document is not open.

| Field | Content |
|---|---|
| `schema` | Compiled JSON Schema as JSON text indented by two spaces; `undefined` when there are error-level diagnostics |
| `typescript` | TS declarations; `undefined` when compilation or conversion fails |
| `diagnostics` | Compile diagnostics and unregistered-widget warnings, with lines and columns starting at 1 |
| `typescriptDiagnostics` | TS conversion diagnostics, mapped back to source positions; only `pointer` is set when they cannot be mapped |
| `configFile`, `modules` | Absolute path of the document's `jotl.config.json` and its module declarations; relative `module` paths resolve against the directory of `configFile` |

After the server has applied a `jotl.config.json` change, it sends the notification `jotl/configChanged` (`PREVIEW_CONFIG_CHANGED_METHOD`) without parameters. Request the preview again when it arrives. Do not watch the file yourself for this: you would read the preview before the server has dropped the old configuration.

## Validate x-ui in JSON Schema files

The server only handles Jotl documents. For `x-ui` in plain JSON Schema files, register two generated schemas with your JSON language service:

- `createXUiJsonSchema()` returns a schema with `$id` `X_UI_JSON_SCHEMA_ID`. It walks every 2020-12 subschema keyword and validates `x-ui` on each node. The VS Code extension associates it with `*.schema.json`.
- `createJotlConfigJsonSchema()` (re-exported from `@jotl/core`) returns the schema of `jotl.config.json` (`JOTL_CONFIG_FILE`).

A JSON language service that picks the schema from a document's root `$schema` ignores schemas associated by file name, so `x-ui` validation stops in files that declare `$schema`.

## Diagnostic codes

The server adds two warnings to the compiler's diagnostics (`JOTL1xxx` from `@jotl/core`):

| Code | Meaning |
|---|---|
| `JOTL7001` | A widget named by `widget` or `decorator` metadata (including per-scene overrides in `variants`) is not a built-in widget, not in `registeredWidgets` and not declared by the file's root `widgets` metadata, so rendering will fall back |
| `JOTL7002` | The document's `jotl.config.json` is invalid; reported at the start of the document |

All diagnostics carry `source: "jotl"`.

## Known limitations

- Definition, references and the outline cover top-level types in the current file only.
- When `item_meta` is written before `*_item`, completion inside it does not know the item type.
