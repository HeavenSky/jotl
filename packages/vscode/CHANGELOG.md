# Changelog

## v0.1.0 2026-10-13 Initial preview

- Syntax highlighting, diagnostics with quick fixes, completion, hover, go to definition, find references and outline for `.jotl` files, powered by the bundled Jotl language server.
- Preview panel with JSON Schema, TypeScript and form tabs; syntax-highlighted code and a form that follows the color theme.
- `x-ui` completion and validation in `*.schema.json` files.
- `jotl.registeredWidgets` setting for project-registered widget names.
- `jotl.config.json` project configuration: widgets with their underlying types, shared with the `jotl` command line, with validation for the file itself.
- English and Simplified Chinese, following the VS Code display language: extension UI, preview form, and the language server's diagnostics, hovers and completions.
- Extension widget modules (declared in `jotl.config.json` or in the root `widgets` metadata) can be loaded in the preview form with the `jotl.preview.loadWidgetModules` setting (off by default); modules share the preview's React. When off, the preview shows a notice. In untrusted workspaces the workspace value of this setting is ignored.
