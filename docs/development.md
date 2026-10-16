# Development guide

**English** · [简体中文](../zh/docs/development.md)

This page gets you from a fresh clone to a passing build and test run, and shows where each part of the repository lives. You need Node 22 or later and the pnpm version pinned in `packageManager` of the root [`package.json`](../package.json). To use Jotl rather than work on it, start with the [README](../README.md).

## Build and test from a fresh clone

Run every command at the repository root.

1. Install dependencies from the lockfile:

   ```sh
   pnpm install --frozen-lockfile
   ```

2. Download the pinned version of the official JSON-Schema-Test-Suite into `vendor/json-schema-test-suite/` (not committed). The tests of `@jotl/convert` and `@jotl/data` read it and fail when it is missing; rerunning the script skips the download when the pinned commit is already present.

   ```sh
   bash scripts/fetch-json-schema-test-suite.sh
   ```

3. Build all packages into their own `dist/`:

   ```sh
   pnpm build
   ```

4. Run all tests:

   ```sh
   pnpm test
   ```

## Commands

| Command | Purpose |
|---|---|
| `pnpm build` | `tsc -b`: build all packages into their own `dist/` |
| `pnpm test` | Run all test cases under `packages/*/test/` and `apps/*/test/` |
| `pnpm lint` | Lint with Biome |
| `pnpm check` | Lint, build, type-check each package's test code (`typecheck:test`), run all tests, then production-build the playground |
| `pnpm clean` | Remove build artifacts |
| `pnpm --filter @jotl/playground dev` | Start the playground dev server; run `pnpm build` first. See the [playground README](../apps/playground/README.md) |
| `pnpm --filter ./packages/vscode run package` | Package the VS Code extension as a vsix; run `pnpm build` first. See [`packages/vscode/DEVELOPMENT.md`](../packages/vscode/DEVELOPMENT.md) |

## Where things live

Package directories are named after the package without the `@jotl/` prefix.

| Package | Directory | Source layout |
|---|---|---|
| `@jotl/core` | `packages/core` | `src/schema/`: schema and `x-ui` types, `Result` and diagnostics, JSON Pointer, data capability interfaces; `src/syntax/`: Jotl parsing, compilation to JSON Schema, printing back to Jotl and formatting |
| `@jotl/convert` | `packages/convert` | `src/ts/`: conversion between JSON Schema and TS declarations, TSDoc / ESLint presets; `src/migrate/`: legacy JSON Schema and OpenAPI upgrade, Fengdie migration. `tsToSchema` depends on `typescript` and is exported from the subpath `@jotl/convert/from-ts` |
| `@jotl/data` | `packages/data` | Default data, validation, migration and Mock |
| `@jotl/form` | `packages/form` | `src/react/`: React renderer; `src/html/`: native HTML widgets and styles; `src/core/`: framework-independent `x-ui` parsing, widget registry and render planning, exported as `@jotl/form/core` |
| `@jotl/antd` | `packages/antd` | Ant Design widgets for `@jotl/form` |
| `@jotl/language-server` | `packages/language-server` | Language server (LSP) |
| `vscode-jotl` (Marketplace ID `jotl-lang.vscode-jotl`) | `packages/vscode` | VS Code extension and its preview panel |
| `jotl` | `packages/cli` | Command line |
| `@jotl/playground` | `apps/playground` | Browser playground |

Other directories:

| Directory | Contents |
|---|---|
| `docs/spec/` | External contracts: [Jotl syntax](spec/jotl.md), [`x-ui`](spec/x-ui.md), [native HTML widgets](spec/html-widgets.md), [keyword mapping](spec/keyword-mapping.md); Chinese versions in `zh/docs/spec/` |
| `fixtures/` | Samples and expected values shared by every package's tests; see [fixtures/README.md](../fixtures/README.md) |
| `test-utils/` | Helpers for tests to read samples |
| `scripts/` | Repository scripts |
| `vendor/` | Download location of the JSON-Schema-Test-Suite, not committed |

## Open issues

Open issues, pending decisions and deferred work are tracked in [TODO.md](../TODO.md).
