# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## v0.0.3 2026-10-22 Stricter formats

- **Breaking:** form validation now follows RFC 3339 for `time`, `date-time` and `duration`: a time zone offset needs minutes (`+08:00`, not `+08`), and `:60` seconds is accepted only for a leap second at 23:59 UTC. `uuid` no longer accepts a `urn:uuid:` prefix, and `hostname` no longer accepts a trailing dot. Rewrite such values in your data and defaults; the editor reports `time`, `date-time`, `uuid` and `hostname` defaults that no longer pass with `JOTL1008`.
- **Breaking:** a `value_format` with tokens that cannot be read back (`w` `W` `k` `kk` `gggg` `GGGG` `z` `S` `SS`, or `X` / `x` mixed with other tokens) now reports the error `JOTL1053`. Use tokens such as `YYYY` `MM` `DD` `HH` `mm` `ss`, or a timestamp; the preview form no longer fails on these formats.
- A `widget` set in a `variants` scene is checked like one on the field: a built-in widget that does not fit reports `JOTL1045` and the scene keeps the field's widget, and a `jotl.config.json` widget whose underlying type does not accept the field reports `JOTL1052`.
- Very long chains of type aliases no longer stop the language server, and a wrong `default` behind one is still reported.
- The new setting `jotl.preview.allowModuleStyles`, off by default, lets widget modules in the preview load `https:` stylesheets and inject styles at run time, as antd does ([guide](https://github.com/HeavenSky/jotl/blob/HEAD/packages/vscode/docs/widget-modules.md)).
- Module declarations in `x-ui.widgets` accept `level`, so a module widget can register as a layout or decorator; completion and validation in `*.schema.json` know the new key.
- Text inputs in the preview form count `maxLength` by characters, so emoji no longer stop typing early, except when only one character is left or when pasting.

## v0.0.2 2026-10-21 Stricter diagnostics

- New diagnostics: an empty discriminated union, string constraints on a timestamp `value_format` field, and a `node_if` path starting with `$.` (use `root_if` to read from the root).
- A `datetime` or `format: 'time'` default without a time zone now reports `JOTL1008`, matching form validation, which already rejected it.
- `default` values are now also checked against `value_format` strings using `YY` `M` `D` `H` `h` `hh` `m` `s`; `h` and `hh` are read together with `A` / `a`.
- Completion inside `item_meta` works when it comes before `array_item`, `map_item` and the like.
- A field using a widget from `jotl.config.json` whose declared underlying type does not accept the field's type reports the warning `JOTL1052`.
- The preview form reports an empty widget name in `x-ui` widgets, a read-only number field keeps its thousands separators when focused, load failures of widget modules are reported in the preview language, and tuple rest elements can be moved and duplicated.
- The TypeScript declarations in the preview keep nullable unions as `(A | B) | null` and mark every closed object with `@closed` (`money` and `bigint` ranges with `@decimalRange`), on the holding property for array elements and nullable objects, and write tuples whose positions all have identifier titles as named tuples, so converting back yields the same schema.

## v0.0.1 2026-10-16 Initial release

- `.jotl` files get syntax highlighting, diagnostics with quick fixes, completion, hover, Go to Definition, Find All References and an outline; the Jotl language server is bundled.
- `Jotl: Open Preview` shows the compiled JSON Schema, TypeScript declarations and form side by side, following the color theme.
- `*.schema.json` files get completion and validation for `x-ui` definitions.
- Project widgets can be registered in `jotl.config.json`, shared with the `jotl` command line, or by name with the `jotl.registeredWidgets` setting ([guide](https://github.com/HeavenSky/jotl/blob/HEAD/packages/vscode/docs/project-widgets.md)).
- The preview form can load your React widget modules once you turn on `jotl.preview.loadWidgetModules`; it is off by default, and its workspace value is ignored in untrusted workspaces ([guide](https://github.com/HeavenSky/jotl/blob/HEAD/packages/vscode/docs/widget-modules.md)).
- The extension UI, preview form and language server messages are available in English and Simplified Chinese, following the VS Code display language.
