# jotl

**English** · [简体中文](./README.zh-CN.md)

Read this page when compiling, converting or checking Jotl and JSON Schema from the command line or in scripts (CI, build steps), or when parsing `jotl`'s output and exit codes; it corresponds to `packages/cli`.

## Installation

```sh
pnpm add -D jotl
pnpm exec jotl --help
```

Requires Node `>=22`. To run directly inside this repository without installing:

```sh
pnpm exec tsc -p packages/cli
node packages/cli/dist/bin.js --help
```

## Output conventions

- Results are written to stdout; with `--out <file>` they are written to that file and stdout is empty. An `--out` pointing at any input file is rejected as a usage error; inputs are never overwritten.
- Diagnostics are written to stderr, one per line: `file:line:column code severity: message` when there is a source location, `file#/pointer code severity: message` when there is only a JSON Pointer; severity is `错误` `警告` `提示` in Chinese output and `error` `warning` `info` in English output (see "Output language"). Lines and columns start at 1, columns count UTF-16 code units.
- Multi-line messages and `related` information go on subsequent lines indented by two spaces; when parsing line by line, take only lines that do not start with a space.
- The location of a usage error is written as `jotl`, and the next line points to the `--help` of the corresponding command.
- When there are error-level diagnostics no result is output and no `--out` file is written.
- Exit codes: `0` success (warnings and info do not affect it), `1` error-level diagnostics (including file read/write failures), `2` usage error.
- A file argument written as `-` is read from stdin (the diagnostic location is written as `-`); when `convert` has no `--from` the format is detected from content (see "Schema input"). When the schema argument of `check` `defaults` and `validate` is read from stdin, the format is detected from content (see "Schema input"). Only one argument per command may be `-`, otherwise usage error `JOTL9015` is reported.
- The command line's own diagnostic codes are `JOTL9xxx`, see `CLI_DIAGNOSTICS` in `src/diagnostics.ts`; other codes come from the upstream packages.

## Output language

Help text, diagnostic messages, severity labels, result lines and generated text (such as the TS header) are output in Chinese or English:

- The global option `--lang <zh|en>` (also `--lang=en`; regional forms such as `zh-CN`, `zh_CN`, `en-US` are accepted, case-insensitive) may be written anywhere before `--`; when given several times the last one wins; other values are usage errors.
- Without `--lang`, the first non-empty value of the environment variables `JOTL_LANG`, `LC_ALL`, `LC_MESSAGES`, `LANG` is used: a value starting with `zh` (e.g. `zh_CN.UTF-8`) means Chinese, anything else (including `C` and `POSIX`) English; when all are empty, English.

```sh
jotl check home.jotl --lang en
JOTL_LANG=en jotl validate form.schema.json data.json
# home.jotl:2:9 JOTL1004 error: Unknown component `strng`
```

## Project configuration

Commands that compile Jotl input (`compile` `convert` `check` `validate` `defaults`) register extension components from `jotl.config.json`; for the format see "扩展组件" (Extension components) in `docs/spec/jotl.md` (Chinese). `format` only lays out the source and does not read the configuration.

- The nearest `jotl.config.json` is searched upward from the source file's directory, stopping at a directory containing `.git` or the filesystem root; stdin input starts from the current directory. JSON Schema and TS input do not read the configuration.
- `--config <file>` uses that file directly without searching; `--no-config` reads nothing; using both is usage error `JOTL9017`.
- An unreadable configuration file reports `JOTL9050`, invalid JSON reports `JOTL9052`, invalid content reports `JOTL9056` (located at the offending key in the configuration file); on error, source files that use it are not compiled; the same configuration file is read only once per invocation and reported only once.

## Schema input

The schema argument of `convert` `check` `validate` `defaults` is classified by extension: `.jotl` is Jotl source, `.json` is JSON Schema, `.ts` / `.d.ts` are TS declarations; `convert` can specify `--from jotl|schema|ts`. When the schema argument of `check` `validate` `defaults` is `-`, it is read from stdin and classified by content: after stripping BOM and whitespace, starting with `{` or `[` means JSON Schema, otherwise Jotl source. When `convert`'s input is `-` without `--from`, TS is also recognized: after stripping leading whitespace and comments, starting with a declaration keyword such as `export` `interface` `type` `declare` followed by a name means TS declarations, starting with `<` or a PascalCase type name (or being empty) means Jotl source; if neither, usage error `JOTL9016` is reported and `--from` must be given.

JSON Schema input is first upgraded to 2020-12 (same as `migrate-schema --to schema`, but without printing the change list). When there is no `$schema` and the version cannot be inferred from features, it is treated as 2020-12 with a `JOTL9053` warning; OpenAPI 3.0 / Swagger 2.0 Schema Objects require `--schema-version` to specify the version.

## Commands

The complete options are given by `jotl <command> --help`.

### compile

```sh
jotl compile <file.jotl> [--to schema|ts] [--out <file>] [--typia-tags]
```

Compiles Jotl to JSON Schema 2020-12 (default) or TS declarations; `--typia-tags` can only be used together with `--to ts`.

```sh
jotl compile home.jotl --out home.schema.json
jotl compile home.jotl --to ts --typia-tags --out home.d.ts
```

### convert

```sh
jotl convert <input> --to jotl|schema|ts [--from jotl|schema|ts] [--schema-version <version>] [--out <file>] [--typia-tags]
```

Converts freely among Jotl, JSON Schema and TS declarations.

```sh
jotl convert legacy.json --to jotl --out legacy.jotl
jotl convert types.d.ts --to schema
jotl convert schema.txt --from jotl --to ts
```

### check

```sh
jotl check <file...> [--schema-version <version>]
```

Only reports diagnostics, outputs no result: `.jotl` reports compilation diagnostics; `.json` reports warnings and errors from the upgrade, and whether the upgraded schema can be used for validation; `.ts` / `.d.ts` report conversion diagnostics. If the format of any file cannot be determined, no file is checked and it exits with a usage error.

```sh
jotl check schemas/*.jotl schemas/legacy.json
```

### validate

```sh
jotl validate <schema> <data...> [--schema-version <version>]
```

Validates JSON data files against the schema. One verdict line per file is written to stdout (`file: 通过` (passed) or `file: 未通过` (failed)); validation errors are written to stderr located as `datafile#/data-pointer`, and the next, indented line gives `file:line:column` of where that value sits in the data file (object members use the key position; when the pointer does not exist, the nearest ancestor); if any file fails, the exit code is 1.

```sh
jotl validate home.jotl data/home.json data/home-empty.json
```

### defaults

```sh
jotl defaults <schema> [--strategy explicit|required|all] [--schema-version <version>] [--out <file>]
```

Generates default data from the schema and outputs it as JSON; for what each strategy produces see the section "Default data: getDefaults and fillDefaults" in `packages/data/README.md`. When the schema has no default data to generate, nothing is output and `JOTL9054` info is reported.

```sh
jotl defaults home.jotl --strategy required --out home.defaults.json
```

### migrate-schema

```sh
jotl migrate-schema <file> [--to jotl|schema] [--out <file>] [--schema-version <version>]
                    [--accept-newer-keywords=true|false] [--on-conflict error|preferDeclared|preferLatest]
```

Migrates a Fengdie schema or a legacy JSON Schema to Jotl (default) or JSON Schema 2020-12 (`--to schema`). The input type is detected automatically; the verdict and its basis are written to stderr as `JOTL9055` info:

| Verdict | Basis | Handling |
|---|---|---|
| Fengdie source | Does not start with `{` or `[` (not JSON text) | Parsed per the umo-edit-sdk grammar; rules in the `@jotl/convert` README |
| Fengdie toJson JSON (umo JSON) | Is JSON and any field has a `key` equal to its property name, a type that is a Fengdie type (e.g. `image` `text` `richtext` `url` `color` `date` `enum` `box`), or enum members of the form `{label, value}` | Same as above, skipping parsing |
| Regular JSON Schema | Any other JSON (starting with `{` but syntactically invalid reports `JOTL9052`) | draft-04 to 2019-09, and OpenAPI / Swagger Schema Objects are first upgraded to 2020-12 |

- `--schema-version` `--accept-newer-keywords` `--on-conflict` apply only to regular JSON Schema; used with Fengdie input they report usage error `JOTL9013`.
- `--on-conflict` default: `preferDeclared` when outputting Jotl (consistent with `convert`), `error` with `--to schema`. `--accept-newer-keywords` defaults to `true`.
- For regular JSON Schema with `--to schema`, the change list (one info-level diagnostic per rewrite) is also written to stderr.
- Non-convertible items in Fengdie migration report warnings and do not affect the exit code.

```sh
jotl migrate-schema home.fengdie --out home.jotl
jotl migrate-schema legacy.json --to schema --out legacy.2020-12.json
jotl migrate-schema pet.json --to schema --schema-version openapi-3.0 --on-conflict preferLatest
```

### format

```sh
jotl format <file.jotl> [--write]
```

Formats Jotl source preserving comments; `--write` writes back to the original file (not written when the content is unchanged; a leading BOM in the original is kept; cannot be used when the input is `-`). When the source has syntax errors nothing is output or written back.

```sh
jotl format home.jotl --write
```

## Calling from code

`run(argv, io, options?)` performs one invocation and returns the exit code without calling `process.exit`; the output language comes from `--lang`, then from `options.env` (environment variables, resolved as in "Output language"; `localeFromEnv(env)` is exported), and without `env` the current global language of `@jotl/core` is kept; the global language is set for the duration of the call and restored to its previous value afterwards; `io` is a `CliIo`; `createNodeIo()` gives the Node process implementation, and tests can inject an in-memory implementation; looking up `jotl.config.json` uses `CliIo.exists` to check whether files and `.git` exist.

```ts
import { createNodeIo, run } from "jotl";

process.exitCode = run(["check", "home.jotl"], createNodeIo(), { env: process.env });
```
