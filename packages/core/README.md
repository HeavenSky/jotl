# @jotl/core

**English** · [简体中文](./zh/README.md)

Compile Jotl to JSON Schema 2020-12 and print schemas back, with diagnostics that point to the exact line and column.

Jotl is a concise language for writing JSON Schema 2020-12. `@jotl/core` is its compiler and the contract shared by every Jotl package: use it when you build an editor, a build step, or a web app that turns Jotl source into schemas at runtime.

Compared with hand-written JSON, a field with its label, constraints and default fits on one line, and every node of the output maps back to its source range. Compared with code-first schema libraries, the output is plain JSON data you can store, diff and send to any 2020-12 tool, and `print` turns an existing schema back into Jotl. The package has no runtime dependencies and uses no Node API, so the same code runs in the browser.

## Three lines in, a normalized schema out

```ts
import { compile } from '@jotl/core';

const result = compile(
  `User: {
  name(Name): string[maxLength: 20]
  role?: enum[default: 'user']{ admin(Admin) user(User) }
}`,
  'user.jotl'
);
console.log(JSON.stringify(result.value?.schema, null, 2));
```

Output, with whitespace condensed:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$ref": "#/$defs/User",
  "x-ui": { "version": 1 },
  "$defs": {
    "User": {
      "type": "object",
      "properties": {
        "name": { "title": "Name", "type": "string", "maxLength": 20 },
        "role": {
          "type": "string",
          "oneOf": [
            { "title": "Admin", "const": "admin" },
            { "title": "User", "const": "user" }
          ],
          "default": "user"
        }
      },
      "required": ["name"]
    }
  }
}
```

A typo does not throw. `compile("A: strng", "a.jotl")` returns `value: undefined` and a diagnostic you can show in an editor:

```json
{
  "code": "JOTL1004",
  "severity": "error",
  "message": "Unknown component `strng`",
  "location": {
    "kind": "source",
    "range": {
      "file": "a.jotl",
      "start": { "line": 1, "column": 4, "offset": 3 },
      "end": { "line": 1, "column": 9, "offset": 8 }
    }
  }
}
```

## Compile your first file

The package is ESM only, so the script uses the `.mjs` extension.

1. Install the package:

   ```sh
   pnpm add @jotl/core
   ```

2. Save this as `compile.mjs`:

   ```js
   import { compile } from '@jotl/core';

   const result = compile('Todo: {\n  title: string\n  done?: boolean\n}', 'todo.jotl');
   console.log(JSON.stringify(result.value?.schema ?? result.diagnostics, null, 2));
   ```

3. Run it and see the JSON Schema:

   ```sh
   node compile.mjs
   ```

## What you get

- **Schemas with a source map.** `compile` returns the normalized 2020-12 document, a source map from every schema pointer to its source range, the AST, and the default export name.
- Round trips between JSON Schema and Jotl: `print` writes any 2020-12 schema as canonical Jotl, and `format` reformats source and keeps every comment.
- Errors as data, never exceptions: every function returns `{ value, diagnostics }`, and each diagnostic has a stable `JOTL` code, a location with 1-based lines and LSP-compatible UTF-16 columns, and a message in English or Chinese.
- One contract for the whole toolchain: JSON Schema and `x-ui` types, the `x-ui` meta-schema, JSON Pointer utilities, and the data capability interfaces that `@jotl/data` implements.
- Extension components: register custom components per call, per file, or through `jotl.config.json`, and compile module declarations into the schema.

## When to use something else

`@jotl/core` reads no files and checks no data. To compile files from a terminal use the [`jotl` command line](../cli/README.md); to validate data or produce defaults use [`@jotl/data`](../data/README.md); to render a form use [`@jotl/form`](../form/README.md). `print` expects JSON Schema 2020-12: upgrade older drafts and OpenAPI schemas with [`@jotl/convert`](../convert/README.md) first.

## Further reading

- [Guides](./docs/README.md): compiling and printing, extension components, diagnostics and language, JSON Pointer, schema types
- [Jotl syntax specification](../../docs/spec/jotl.md) and [`x-ui` specification](../../docs/spec/x-ui.md)
- [Known limitations](./docs/known-limitations.md): print round trips, depth limit, date formats checked at compile time

## License

MIT, see [LICENSE](../../LICENSE).
