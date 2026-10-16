# Jotl

**English** · [简体中文](./zh/README.md)

Jotl lets you write JSON Schema 2020-12 as compact, type-like source, and get the standard schema, TypeScript declarations and a working form from the same file. It is for teams that keep data contracts or configuration forms in JSON Schema and are tired of editing deeply nested JSON by hand. One line per field carries the type, title, constraints, default and UI hints; `required`, enum labels and `$defs` are generated for you. Unlike code-first libraries such as Zod or TypeBox, the source is a standalone file that people outside your TypeScript codebase can edit, and it converts both ways: existing JSON Schema prints back to Jotl.

## Five lines in, standard JSON Schema out

Save this as `home.jotl`:

```jotl
Home: {
  title(Title): string[default: 'Welcome', maxLength: 20]
  mode(Mode): enum[default: 'light']{ light(Light) dark(Dark) }
  tags?: array[array_item: 'string', maxItems: 5]
}
```

`jotl compile home.jotl` prints:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$ref": "#/$defs/Home",
  "x-ui": {
    "version": 1
  },
  "$defs": {
    "Home": {
      "type": "object",
      "properties": {
        "title": {
          "title": "Title",
          "type": "string",
          "maxLength": 20,
          "default": "Welcome"
        },
        "mode": {
          "title": "Mode",
          "type": "string",
          "oneOf": [
            {
              "title": "Light",
              "const": "light"
            },
            {
              "title": "Dark",
              "const": "dark"
            }
          ],
          "default": "light"
        },
        "tags": {
          "type": "array",
          "maxItems": 5,
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "title",
        "mode"
      ]
    }
  }
}
```

The output is plain 2020-12. The only extension is the `x-ui` keyword, which carries form layout and widget hints.

## Compile your first schema

You need Node 22 or later.

```sh
pnpm add -D @jotl/cli
pnpm exec jotl compile home.jotl --out home.schema.json
pnpm exec jotl compile home.jotl --to ts --out home.d.ts
```

The first command installs the CLI, the second writes the JSON Schema shown above, and the third writes the matching TypeScript declarations. All commands and options are in the [CLI README](packages/cli/README.md).

## What you get from one source

- **Schema, types and form stay in sync**: compile to JSON Schema 2020-12 or TS declarations, and render the schema as a React form with `@jotl/form`, optionally with Ant Design widgets.
- **Existing schemas come along**: print 2020-12 JSON Schema back to Jotl, convert between JSON Schema and TS declarations, and upgrade legacy JSON Schema, OpenAPI 3.0 / Swagger 2.0 Schema Objects and Fengdie schemas.
- **Data tools work on any 2020-12 schema**: default data, validation, migration of old data and Mock data, from code or from `jotl validate` and `jotl defaults`.
- **Editor support while you type**: the VS Code extension adds diagnostics with quick fixes, completion, hover, go to definition and a live preview of the schema, TS and form.
- **Errors you can act on**: every diagnostic carries a stable `JOTL` code and points to a line and column or a JSON Pointer, with messages in English or Chinese.

## Pick the packages you need

Rendering a form in the browser needs only `@jotl/core`, `@jotl/data` and `@jotl/form`; the rest are for authoring and tooling.

| Package | What it does |
|---|---|
| [`@jotl/core`](packages/core/README.md) | Parse, compile, format and print Jotl; shared schema types, diagnostics and JSON Pointer utilities |
| [`@jotl/convert`](packages/convert/README.md) | JSON Schema to and from TS declarations; upgrade legacy JSON Schema and OpenAPI; migrate Fengdie schemas |
| [`@jotl/data`](packages/data/README.md) | Default data, validation, migration and Mock for JSON Schema 2020-12 |
| [`@jotl/form`](packages/form/README.md) | React form renderer (React 16.8 to 19) with native HTML widgets; framework-independent planning in `@jotl/form/core` |
| [`@jotl/antd`](packages/antd/README.md) | Ant Design widgets for `@jotl/form` (antd 5 or 6, React 18+) |
| [`@jotl/language-server`](packages/language-server/README.md) | Language server (LSP) for `.jotl` files |
| [`vscode-jotl`](packages/vscode/README.md) | VS Code extension with live preview |
| [`@jotl/cli`](packages/cli/README.md) | Command line: compile, convert, check, validate, defaults, migrate and format |
| [`@jotl/playground`](apps/playground/README.md) | Browser app for editing Jotl and previewing the form, run locally from this repository |

User-facing text is available in English (`en`, default) and Chinese (`zh-CN`). Code sets it with `setLocale` from `@jotl/core`, the CLI with `--lang`; each package README covers its own options.

## When Jotl is not the right fit

Jotl emits only JSON Schema 2020-12; if your consumers need draft-07 or older output, Jotl does not produce it. If your types already live in TypeScript code and never leave it, a code-first library such as Zod or TypeBox keeps everything in one language. The form renderer targets React; other UI frameworks need their own renderer built on `@jotl/form/core`.

## Read more

- [Documentation index](docs/README.md): which page to read for each task
- Specifications: [Jotl syntax](docs/spec/jotl.md), [`x-ui`](docs/spec/x-ui.md), [native HTML widgets](docs/spec/html-widgets.md), [keyword mapping](docs/spec/keyword-mapping.md)
- [Development guide](docs/development.md): build, test and repository layout
- Package READMEs: see the table above; the editor extension is [vscode-jotl](packages/vscode/README.md)

## License

[MIT](LICENSE)
