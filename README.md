# Jotl

**English** · [简体中文](./README.zh-CN.md)

Read this page when installing, building or testing in this repository, or when looking for where a package or contract document lives. Jotl is a concise authoring language for JSON Schema 2020-12 together with its TS toolchain; the code lives in `packages/*` and `apps/*`.

## Packages and directories

Directory names match package names (without the `@jotl/` prefix). Rendering forms in the browser only needs `core` `data` `form`; the rest are for authoring and tooling.

| Package | Directory | Responsibility | Notes |
|---|---|---|---|
| `@jotl/core` | `packages/core` | Language core: schema and `x-ui` types, `Result` and diagnostics, JSON Pointer, data capability interfaces (`src/schema/`); Jotl parsing, compilation to JSON Schema, reverse printing and formatting (`src/syntax/`) | [README](packages/core/README.md) |
| `@jotl/convert` | `packages/convert` | Conversion to and from other formats: JSON Schema <-> TS declarations (JSDoc tags), TSDoc / ESLint presets (`src/ts/`); upgrading legacy JSON Schema and OpenAPI / Swagger Schema Objects to 2020-12, migrating Fengdie schemas to Jotl (`src/migrate/`). `tsToSchema`, which depends on typescript, is in the subpath `@jotl/convert/from-ts` | [README](packages/convert/README.md) |
| `@jotl/data` | `packages/data` | Default data, validation, migration and Mock | [README](packages/data/README.md) |
| `@jotl/form` | `packages/form` | React form renderer for React 16.8 to 19 (`src/react/`), native HTML default widgets and styles (`src/html/`); the subpath `@jotl/form/core` provides `x-ui` parsing, widget registration, render planning and fallback decisions, independent of any UI framework (`src/core/`) | [README](packages/form/README.md) |
| `@jotl/antd` | `packages/antd` | Ant Design widgets for `@jotl/form` (antd 5 or 6, React 18+): `createAntdRegistry({ dayjs })` passed to `JotlForm`; widgets without an antd implementation fall back to the HTML defaults | [README](packages/antd/README.md) |
| `@jotl/language-server` | `packages/language-server` | Jotl language service (LSP) | [README](packages/language-server/README.md) |
| `vscode-jotl` (Marketplace ID `jotl-lang.vscode-jotl`) | `packages/vscode` | VS Code extension, including the preview panel | [README](packages/vscode/README.md) |
| `jotl` | `packages/cli` | Command line | [README](packages/cli/README.md) |
| `@jotl/playground` | `apps/playground` | Online editing and preview in the browser | [README](apps/playground/README.md) |

### Old package names

In 2026-10, 12 packages were merged into 8; none of the old packages was ever published. Old names to new entry points:

| Old package (old directory) | New entry point | New source location |
|---|---|---|
| `@jotl/schema` (`packages/schema`) | `@jotl/core` | `packages/core/src/schema/` |
| `@jotl/syntax` (`packages/syntax`) | `@jotl/core` | `packages/core/src/syntax/` |
| `@jotl/ts` (`packages/ts`) | `@jotl/convert`; `tsToSchema` moved to `@jotl/convert/from-ts` | `packages/convert/src/ts/` |
| `@jotl/ts/eslint`, `@jotl/ts/tsdoc.json` | `@jotl/convert/eslint`, `@jotl/convert/tsdoc.json` | `packages/convert/src/ts/eslint.ts`, `packages/convert/tsdoc.json` |
| `@jotl/migrate` (`packages/migrate`) | `@jotl/convert` | `packages/convert/src/migrate/` |
| `@jotl/ui-core` (`packages/ui-core`) | `@jotl/form/core` | `packages/form/src/core/` |
| `@jotl/html` (`packages/html`) | `@jotl/form` | `packages/form/src/html/` |
| `@jotl/react` (`packages/react`) | `@jotl/form` | `packages/form/src/react/` |
| `@jotl/html/style.css` + `@jotl/react/style.css` | `@jotl/form/style.css` (merged into one) | `packages/form/style.css` |
| `@jotl/html/tailwind.css` + `@jotl/react/tailwind.css`, `@jotl/html/theme.css` | `@jotl/form/tailwind.css`, `@jotl/form/theme.css` | `packages/form/` |
| `@jotl/lsp` (`packages/lsp`) | `@jotl/language-server` | `packages/language-server/` |
| `@jotl/data`, `jotl`, `vscode-jotl`, `@jotl/playground` | Unchanged | Unchanged |

Diagnostic code ranges (`JOTL0xxx`-`JOTL8xxx`) and all export names are unchanged.

Other directories:

| Directory | Contents |
|---|---|
| `docs/spec/` | External contracts (Chinese): Jotl syntax (`jotl.md`), `x-ui` (`x-ui.md`), native widgets (`html-widgets.md`), keyword mapping across the three notations (`keyword-mapping.md`) |
| `fixtures/` | Samples and expected values shared by all packages; conventions in [fixtures/README.md](fixtures/README.md) |
| `test-utils/` | Utilities for tests to read samples |
| `scripts/` | Repository scripts |
| `vendor/` | Download location of the official JSON-Schema-Test-Suite, not committed |

Open issues, pending confirmations and deferred items are in [TODO.md](TODO.md).

## Language

User-facing text (diagnostic messages, generated text, form widget text, language service hover and completion, command-line output) is available in English (`en`, default) and Chinese (`zh-CN`). In code, set it with `setLocale` of `@jotl/core` (a global setting); `@jotl/data` functions and `JotlForm` also take a per-call / per-form `locale` option; the command line uses `--lang` or the environment variables `JOTL_LANG` `LC_ALL` `LC_MESSAGES` `LANG`; the language service reads `locale` from its initialization options. Details are in each package's README.

## Commands

Run at the repository root:

| Command | Purpose |
|---|---|
| `pnpm install --frozen-lockfile` | Install dependencies per the lockfile |
| `bash scripts/fetch-json-schema-test-suite.sh` | Download a pinned version of the official JSON-Schema-Test-Suite to `vendor/`; the tests of `@jotl/convert` and `@jotl/data` depend on it and fail when it is missing |
| `pnpm build` | `tsc -b` builds all packages into their own `dist/` |
| `pnpm test` | Run all test cases under `packages/*/test/` and `apps/*/test/` |
| `pnpm check` | Build, type-check each package's test code (`typecheck:test`), run all tests, then production-build the playground |
| `pnpm clean` | Remove build artifacts |
| `pnpm --filter ./packages/vscode run package` | Package the VS Code extension as a vsix; requires `pnpm build` first; see `packages/vscode/DEVELOPMENT.md` |
| `pnpm --filter @jotl/playground dev` | Start the playground dev server; requires `pnpm build` first |

Requires Node 22 or later; for the pnpm version see `packageManager` in the root `package.json`.
