# @jotl/language-server

**English** · [简体中文](./zh/README.md)

Live diagnostics, completion, hover and preview for Jotl files in any editor with an LSP client.

`@jotl/language-server` is the Language Server Protocol server for [Jotl](../../README.md), a compact language that compiles to JSON Schema 2020-12. It is for people who want Jotl support in an editor other than VS Code, or who build tools that need the same checks. It runs the same compiler as the [`jotl` command line](../cli/README.md) and reads the same `jotl.config.json`, so the editor flags exactly what your build will reject. Every feature is also a plain function you can call without an LSP connection.

## See the diagnostics an editor gets

This script feeds a Jotl document with a typo and an unknown widget to `getDiagnostics`, the function behind the server's `textDocument/publishDiagnostics`:

```js
// diagnose.mjs
import { getDiagnostics } from '@jotl/language-server';

const text = "Home: {\n  title: strng\n  logo: string[widget: 'uploader']\n}\n";
for (const d of getDiagnostics(text, 'file:///home.jotl')) {
  console.log(d.range.start.line, d.range.start.character, d.code, d.message);
}
```

```console
$ node diagnose.mjs
1 9 JOTL1004 Unknown component `strng`
2 23 JOTL7001 widget `uploader` is not registered and will fall back when rendering
```

Positions are zero-based, as in LSP. Messages are in English by default; call `setLocale("zh-CN")` from `@jotl/core` first to get Chinese. Pass `{ registeredWidgets: ["uploader"] }` as the third argument and only the typo remains.

## Start a server in three steps

You need Node 22 or later and an editor whose LSP client can launch a command.

1. Install the package:

   ```sh
   pnpm add @jotl/language-server
   ```

2. Create the server entry:

   ```sh
   echo 'import { startServer } from "@jotl/language-server"; startServer();' > jotl-server.mjs
   ```

3. Point your editor's LSP client at this command for `*.jotl` files:

   ```sh
   node jotl-server.mjs --stdio
   ```

   The server answers `initialize` with `serverInfo.name` `jotl-language-server` and pushes diagnostics as soon as a document opens. `--node-ipc` and `--socket` work too.

## What you get

- **Errors appear while you type, with quick fixes.** Compiler diagnostics and unregistered-widget warnings are pushed 200 ms after the last edit, and fixes such as wrapping top-level fields into a root type come as code actions.
- Completion knows Jotl: components, types declared in the file, metadata keys that apply to the current component, `widget` values that fit the field's data shape, `value_format`, condition `op` and the `<root/>` / `<default/>` markers.
- See what a field compiles to: hover shows the compiled JSON fragment, and go to definition, find references and the outline work on top-level types.
- Preview the output: the `jotl/preview` request returns the compiled JSON Schema and TS declarations with their diagnostics.
- Project widgets just work: the server finds each document's `jotl.config.json`, re-checks open documents when it changes, and `createXUiJsonSchema()` gives the JSON language service a schema for `x-ui` in `*.schema.json`.

## Know the limits

In VS Code, install the [Jotl extension](../vscode/README.md) instead; it bundles this server and adds the preview panel. The server works one file at a time: definition and references do not cross files. It does not format documents; use [`jotl format`](../cli/README.md) for that. The preview is a custom request, so a generic LSP client needs a few lines of client code to show it.

## Read more

- [Guides](docs/README.md): connecting an LSP client, initialization options and settings, the preview request, and calling the functions directly
- [Jotl language specification](../../docs/spec/jotl.md) and [`x-ui` specification](../../docs/spec/x-ui.md)

## License

[MIT](../../LICENSE)
