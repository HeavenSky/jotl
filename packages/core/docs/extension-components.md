# Register extension components

**English** · [简体中文](../zh/docs/extension-components.md)

This page shows how to make custom components such as `ImagePicker` or `Rating` usable in Jotl source. It assumes you already call `compile` as described in [Compile and print Jotl](./compile-and-print.md); the rules for component names and allowed metadata are in the [Jotl syntax specification](../../../docs/spec/jotl.md).

A PascalCase name in component position must be a type declared in the same file or a registered extension component. You can register components in three places: per call, per file, or in the project configuration `jotl.config.json`.

## Register per call

Pass `options.widgets` to `compile`: a map from component name to its underlying schema. This package reads no configuration file, so the caller decides what to pass.

```ts
import { compile } from "@jotl/core";

const result = compile("Form: {\n  score: Rating[maximum: 5]\n}", "form.jotl", {
  widgets: { Rating: { type: "integer" } },
});
result.value?.schema.$defs.Form.properties.score;
// { type: "integer", maximum: 5, "x-ui": { widget: "Rating" } }
```

## Register in the source file

The root entry's `widgets` metadata registers components for that file only. It is merged with `options.widgets`, and the file wins on name clashes.

```ts
import { compile } from "@jotl/core";

const result = compile(
  `Form: [widgets: {ImagePicker: {base: 'url', module: 'https://esm.sh/image-picker'}}] {
  cover(Cover): ImagePicker
}`,
  "form.jotl",
);
result.value?.schema["x-ui"];
// { version: 1, widgets: { ImagePicker: { base: "url", module: "https://esm.sh/image-picker" } } }
result.value?.schema.$defs.Form.properties.cover;
// { title: "Cover", type: "string", format: "uri", "x-ui": { widget: "ImagePicker" } }
```

Each value is written the same way as in `jotl.config.json`:

- A base type, such as `'integer'` or `'url'`.
- A module declaration `{ base?, module, export? }`. `base` defaults to `object` and `export` to `default`.

Module declarations are compiled into the root `x-ui.widgets` (name → `{ base?, module, export? }`, type `XUiWidgetModule`); `base` is kept only when it is something other than `object`. A type name that clashes with such a component reports `JOTL1028`; an invalid value reports `JOTL1020`. `print` writes the root `x-ui.widgets` back as the root entry's `widgets`.

## Load jotl.config.json

`@jotl/core` processes the configuration content, while finding and reading the file is up to you. The file name is the constant `JOTL_CONFIG_FILE` (`"jotl.config.json"`).

1. Read and `JSON.parse` the file, then pass the result to `readJotlConfig`. It validates the content and converts base types to schemas.

   ```ts
   import { configCompileOptions, readJotlConfig } from "@jotl/core";

   const { config, issues } = readJotlConfig({
     widgets: { Rating: "integer", ImagePicker: { base: "url", module: "./widgets/image-picker.js" }, star: "string", Bad: 3 },
   });
   // config.widgets: { Rating: { type: "integer" }, ImagePicker: { type: "string", format: "uri" }, star: { type: "string" } }
   // config.modules: { ImagePicker: { module: "./widgets/image-picker.js" } }
   // issues: [{ pointer: "/widgets/Bad", message: "base type of `Bad` must be a JSON Schema primitive type name, ..." }]
   ```

   Invalid items are skipped and reported in `issues` as `{ pointer, message }`; the rest are returned as usual.

2. Turn the widgets into compile options. `configCompileOptions(widgets)` keeps only PascalCase names, which are the extension components; other names are registered only as widget names.

   ```ts
   const options = configCompileOptions(config.widgets);
   // { widgets: { Rating: { type: "integer" }, ImagePicker: { type: "string", format: "uri" } } }
   ```

3. Load modules yourself. `config.modules` lists the items written as module declarations, with `module` kept verbatim; resolve relative paths against the directory of the configuration file. Module declarations from the configuration are not written into the compiled schema.

For editor validation of the configuration file itself, `createJotlConfigJsonSchema()` returns its JSON Schema, whose `$id` is `JOTL_CONFIG_SCHEMA_ID`.

## Report JSON errors with line and column

Two helpers give JSON input, such as `jotl.config.json`, diagnostics with a position. Neither uses Node APIs, so both run in the browser.

- `locateJsonError(text)` returns `{ offset, found }` for the first syntax error, or `undefined` for valid JSON. `found` is `undefined` when the text ends early: `locateJsonError('{"a": }')` gives `{ offset: 6, found: "}" }`, and `locateJsonError('{"a": 1')` gives `{ offset: 7 }`.
- `jsonPointerOffsets(text)` returns a `Map` from the pointer of every value in valid JSON to its text offset, with object members mapped to the start of the key: `jsonPointerOffsets('{"a": [1, 2]}')` gives `"" → 0`, `"/a" → 1`, `"/a/0" → 7`, `"/a/1" → 10`. It returns `undefined` for invalid JSON.
