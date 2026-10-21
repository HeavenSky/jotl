# Changelog

## v0.0.2 2026-10-21 Stricter diagnostics

- New diagnostics: an empty discriminated union, string constraints on a timestamp `value_format` field, and a `node_if` path starting with `$.` (use `root_if` to read from the root).
- A `datetime` or `format: 'time'` default without a time zone now reports `JOTL1008`, matching form validation, which already rejected it.
- `default` values are now also checked against `value_format` strings using `YY` `M` `D` `H` `h` `hh` `m` `s`; `h` and `hh` are read together with `A` / `a`.
- Completion inside `item_meta` works when it comes before `array_item`, `map_item` and the like.
- The preview form reports an empty widget name in `x-ui` widgets, a read-only number field keeps its thousands separators when focused, and load failures of widget modules are reported in the preview language.
- The TypeScript declarations in the preview keep nullable unions as `(A | B) | null` and mark every closed object with `@closed` (`money` and `bigint` ranges with `@decimalRange`), on the holding property for array elements and nullable objects, so converting back yields the same schema.

## v0.0.1 2026-10-16 Initial release

- `.jotl` files get syntax highlighting, diagnostics with quick fixes, completion, hover, Go to Definition, Find All References and an outline; the Jotl language server is bundled.
- `Jotl: Open Preview` shows the compiled JSON Schema, TypeScript declarations and form side by side, following the color theme.
- `*.schema.json` files get completion and validation for `x-ui` definitions.
- Project widgets can be registered in `jotl.config.json`, shared with the `jotl` command line, or by name with the `jotl.registeredWidgets` setting ([guide](https://github.com/HeavenSky/jotl/blob/HEAD/packages/vscode/docs/project-widgets.md)).
- The preview form can load your React widget modules once you turn on `jotl.preview.loadWidgetModules`; it is off by default, and its workspace value is ignored in untrusted workspaces ([guide](https://github.com/HeavenSky/jotl/blob/HEAD/packages/vscode/docs/widget-modules.md)).
- The extension UI, preview form and language server messages are available in English and Simplified Chinese, following the VS Code display language.
