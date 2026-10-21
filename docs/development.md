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

| Command                                       | Purpose                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm build`                                  | `tsc -b`: build all packages into their own `dist/`                                                                                        |
| `pnpm test`                                   | Run all test cases under `packages/*/test/` and `apps/*/test/`                                                                             |
| `pnpm lint`                                   | Lint with oxlint and apply fixes; `pnpm lint:check` only reports                                                                           |
| `pnpm fmt`                                    | Format with oxfmt; `pnpm fmt:check` only reports. Config is `.oxfmtrc.json` at the repository root                                         |
| `pnpm check`                                  | Lint, check formatting, build, type-check each package's test code (`typecheck:test`), run all tests, then production-build the playground |
| `pnpm clean`                                  | Remove build artifacts                                                                                                                     |
| `pnpm --filter @jotl/playground dev`          | Start the playground dev server; run `pnpm build` first. See the [playground README](../apps/playground/README.md)                         |
| `pnpm --filter ./packages/vscode run package` | Package the VS Code extension as a vsix; run `pnpm build` first. See [`packages/vscode/DEVELOPMENT.md`](../packages/vscode/DEVELOPMENT.md) |

## Where things live

Package directories are named after the package without the `@jotl/` prefix.

| Package                                                | Directory                  | Source layout                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@jotl/core`                                           | `packages/core`            | `src/schema/`: schema and `x-ui` types, `Result` and diagnostics, JSON Pointer, data capability interfaces; `src/syntax/`: Jotl parsing, compilation to JSON Schema, printing back to Jotl and formatting                                                       |
| `@jotl/convert`                                        | `packages/convert`         | `src/ts/`: conversion between JSON Schema and TS declarations, TSDoc / ESLint presets; `src/migrate/`: legacy JSON Schema and OpenAPI upgrade, Fengdie migration. `tsToSchema` depends on `typescript` and is exported from the subpath `@jotl/convert/from-ts` |
| `@jotl/data`                                           | `packages/data`            | Default data, validation, migration and Mock                                                                                                                                                                                                                    |
| `@jotl/form`                                           | `packages/form`            | `src/react/`: React renderer; `src/html/`: native HTML widgets and styles; `src/core/`: framework-independent `x-ui` parsing, widget registry and render planning, exported as `@jotl/form/core`                                                                |
| `@jotl/antd`                                           | `packages/antd`            | Ant Design widgets for `@jotl/form`                                                                                                                                                                                                                             |
| `@jotl/language-server`                                | `packages/language-server` | Language server (LSP)                                                                                                                                                                                                                                           |
| `vscode-jotl` (Marketplace ID `heavensky.vscode-jotl`) | `packages/vscode`          | VS Code extension and its preview panel                                                                                                                                                                                                                         |
| `@jotl/cli`                                            | `packages/cli`             | Command line                                                                                                                                                                                                                                                    |
| `@jotl/playground`                                     | `apps/playground`          | Browser playground                                                                                                                                                                                                                                              |

Other directories:

| Directory     | Contents                                                                                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/spec/`  | External contracts: [Jotl syntax](spec/jotl.md), [`x-ui`](spec/x-ui.md), [native HTML widgets](spec/html-widgets.md), [keyword mapping](spec/keyword-mapping.md); Chinese versions in `zh/docs/spec/` |
| `fixtures/`   | Samples and expected values shared by every package's tests; see [fixtures/README.md](../fixtures/README.md)                                                                                          |
| `test-utils/` | Helpers for tests to read samples                                                                                                                                                                     |
| `scripts/`    | Repository scripts                                                                                                                                                                                    |
| `vendor/`     | Download location of the JSON-Schema-Test-Suite, not committed                                                                                                                                        |

## Release

Each package is released on its own by pushing a tag: `<directory>@<version>` releases `packages/<directory>` through `.github/workflows/npm-release.yml`, and `vscode-v<version>` releases the extension through `.github/workflows/vscode-release.yml`. Both wait for CI on the tagged commit and skip versions that are already published (on npm, or on the VS Code Marketplace for the extension), so rerunning a failed run is safe. CI warns when the sources bundled into the extension changed since the last `vscode-v*` tag. The extension bundles the workspace sources of `@jotl/language-server`, `@jotl/form` and their dependencies at build time and never loads them from npm, so publishing an npm package never requires a new extension release; release the extension when you want its users to get changes in those bundled packages.

1. Bump `version` in the package's `package.json`, commit and push to `main`.
2. Push the tag, for example for `packages/core`:

    ```sh
    git tag core@0.0.2 && git push origin core@0.0.2
    ```

Packages depend on each other through `workspace:~`, which is packed as `~<dependency's current version>` (for example `~0.0.2`, matching `>=0.0.2 <0.1.0`), so a patch release of a dependency does not require republishing its dependents. Release the dependency first when a dependent needs its new version, and bump the minor version for a breaking change. Before publishing, the workflow installs the packed tarball with npm in an empty directory, together with its peer dependencies, and imports it (and runs `--version` for packages with a `bin`). This install pulls `@jotl/*` dependencies from npm, so a release fails until the versions it depends on are published.

npm publishing uses Trusted Publishing, so the repository holds no npm token. Each package needs a one-time trust entry, and a new package must be published once by hand before it can get one. Register all packages in one go; confirm 2FA on the first one and tick "skip two-factor authentication for the next 5 minutes" so the rest go through without prompts:

```sh
for f in packages/*/package.json; do
  name=$(node -p "const p=require('./$f'); p.private ? '' : p.name")
  [ -n "$name" ] && npm trust github "$name" --repo HeavenSky/jotl --file npm-release.yml --allow-publish --yes && sleep 2
done
```

The extension workflow needs the `VSCE_PAT` secret for the VS Code Marketplace and `OVSX_PAT` for Open VSX; a missing secret skips that marketplace.

## Open issues

Report bugs and track open work in [GitHub Issues](https://github.com/HeavenSky/jotl/issues).
