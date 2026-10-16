# Changelog

## v0.0.1 2026-10-16 Initial preview

- `.jotl` files get syntax highlighting, diagnostics with quick fixes, completion, hover, Go to Definition, Find All References and an outline; the Jotl language server is bundled.
- `Jotl: Open Preview` shows the compiled JSON Schema, TypeScript declarations and form side by side, following the color theme.
- `*.schema.json` files get completion and validation for `x-ui` definitions.
- Project widgets can be registered in `jotl.config.json`, shared with the `jotl` command line, or by name with the `jotl.registeredWidgets` setting ([guide](https://github.com/HeavenSky/jotl/blob/HEAD/packages/vscode/docs/project-widgets.md)).
- The preview form can load your React widget modules once you turn on `jotl.preview.loadWidgetModules`; it is off by default, and its workspace value is ignored in untrusted workspaces ([guide](https://github.com/HeavenSky/jotl/blob/HEAD/packages/vscode/docs/widget-modules.md)).
- The extension UI, preview form and language server messages are available in English and Simplified Chinese, following the VS Code display language.
