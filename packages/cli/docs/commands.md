# Command reference

**English** · [简体中文](../zh/docs/commands.md)

This page lists every `jotl` command with its options, defaults and examples, and explains how input formats are detected. It assumes `jotl` is installed as in the [quick start](../README.md); `jotl <command> --help` prints the same options offline.

| Command                             | What it does                                                           |
| ----------------------------------- | ---------------------------------------------------------------------- |
| [`compile`](#compile)               | Compile Jotl to JSON Schema 2020-12 (default) or TS declarations       |
| [`convert`](#convert)               | Convert between Jotl, JSON Schema and TS declarations in any direction |
| [`check`](#check)                   | Report diagnostics only, without output                                |
| [`validate`](#validate)             | Validate JSON data files against a schema                              |
| [`defaults`](#defaults)             | Output the default data of a schema as JSON                            |
| [`migrate-schema`](#migrate-schema) | Migrate a fengdie DSL schema or a legacy JSON Schema to Jotl or 2020-12    |
| [`format`](#format)                 | Format Jotl source, keeping comments                                   |

Global options work with every command: `-h, --help` shows help (after a command, that command's help; `jotl help <command>` does the same), `-v, --version` prints the version, and `--lang <zh|en>` picks the output language (see [Use jotl in scripts and CI](scripting.md#choose-the-output-language)).

## How inputs are read

The schema argument is classified by extension: `.jotl` is Jotl source, `.json` is JSON Schema, and `.ts` (including `.d.ts`) is TS declarations. This applies to `convert`, `check`, `validate` and `defaults`; `convert` also accepts `--from jotl|schema|ts` to override it. Any other extension is a usage error (`JOTL9009`, or `JOTL9010` for `convert`).

Any file argument written as `-` is read from stdin, and diagnostics name it `-`. Only one argument per command may be `-`; otherwise you get usage error `JOTL9015`. Stdin has no extension, so the format comes from the content:

- `check`, `validate` and `defaults`: after stripping a BOM and whitespace, text starting with `{` or `[` is JSON Schema, anything else is Jotl.
- `convert` without `--from` also recognizes TS. After leading whitespace and comments, a declaration keyword (`export`, `declare`, `interface`, `type`, `import`, `enum`, `namespace`, `const`, `let`, `var`, `function`, `class`, `abstract`) followed by a name means TS; `<`, an UpperCamelCase type name followed by `(`, `:` or `[`, or empty input means Jotl. Anything else is usage error `JOTL9016`; pass `--from`.

JSON Schema input is first upgraded to 2020-12, the same way as `migrate-schema --to schema` but without printing the change list:

- `--schema-version <version>` sets the version when `$schema` is not declared. Values: `draft-04`, `draft-06`, `draft-07`, `2019-09`, `2020-12`, `swagger-2.0`, `openapi-3.0`, `openapi-3.1`.
- Without `$schema` and with no features that reveal the version, the schema is treated as 2020-12 and warning `JOTL9053` is reported.
- OpenAPI 3.0 and Swagger 2.0 Schema Objects need `--schema-version` to be recognized.

Commands that compile Jotl read `jotl.config.json` and accept `--config <file>` and `--no-config`; see [Register project components](project-config.md).

## Where results go

Results go to stdout, or to the file given by `--out <file>`, in which case stdout stays empty. When there are error-level diagnostics, no result is written and no `--out` file is created. An `--out` path that points at any input file (including through a symlink) is usage error `JOTL9008`; inputs are never overwritten.

## compile

```sh
jotl compile <file.jotl> [--to schema|ts] [--out <file>] [--typia-tags] [--config <file> | --no-config]
```

Compiles Jotl to JSON Schema 2020-12 (`--to schema`, the default) or TS declarations (`--to ts`). `--typia-tags` emits typia type tags and works only with `--to ts`; otherwise it is usage error `JOTL9011`. Diagnostics from the TS step are mapped back to positions in the Jotl source.

```sh
jotl compile home.jotl --out home.schema.json
jotl compile home.jotl --to ts --typia-tags --out home.d.ts
```

## convert

```sh
jotl convert <input> --to jotl|schema|ts [--from jotl|schema|ts] [--schema-version <version>]
             [--on-conflict error|preferDeclared|preferLatest] [--out <file>] [--typia-tags]
             [--config <file> | --no-config]
```

Converts between Jotl, JSON Schema 2020-12 and TS declarations. `--to` is required.

| Option                       | Meaning                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--from <jotl\|schema\|ts>`  | Input format; detected as in [How inputs are read](#how-inputs-are-read) when omitted                                                                                                                         |
| `--schema-version <version>` | Version for JSON Schema input that does not declare `$schema`                                                                                                                                                 |
| `--on-conflict <policy>`     | How to resolve conflicts between old and new keyword semantics while upgrading JSON Schema: `preferDeclared` follows the declared version (default), `preferLatest` follows 2020-12, `error` reports an error |
| `--typia-tags`               | Use typia type tags in TS output; only with `--to ts`                                                                                                                                                         |

```sh
jotl convert legacy.json --to jotl --out legacy.jotl
jotl convert types.d.ts --to schema
jotl convert schema.txt --from jotl --to ts
cat types.d.ts | jotl convert - --to jotl
```

## check

```sh
jotl check <file...> [--schema-version <version>] [--config <file> | --no-config]
```

Reports diagnostics and writes no result. What is checked depends on the format:

- `.jotl`: compile diagnostics.
- `.json`: warnings and errors from the upgrade to 2020-12, and whether the upgraded schema can be compiled for validation.
- `.ts` / `.d.ts`: conversion diagnostics.

If the format of any file cannot be determined, no file is checked and the command exits with a usage error.

```sh
jotl check schemas/*.jotl schemas/legacy.json
```

## validate

```sh
jotl validate <schema> <data...> [--schema-version <version>] [--config <file> | --no-config]
```

Validates one or more JSON data files against the schema and prints one verdict line per file to stdout: `<file>: passed` or `<file>: failed` (`通过` / `未通过` in Chinese output). Validation errors go to stderr, located as `<data file>#<JSON Pointer>`. The next, indented line gives `file:line:column` of that value in the data file; object members point at their key, and a pointer that does not exist falls back to its nearest ancestor. The exit code is `1` if any file fails.

```sh
jotl validate home.jotl data/home.json data/home-empty.json
```

A data file that cannot be read or is not valid JSON reports `JOTL9050` or `JOTL9052` and gets no verdict line.

## defaults

```sh
jotl defaults <schema> [--strategy explicit|required|all] [--schema-version <version>] [--out <file>]
              [--config <file> | --no-config]
```

Generates default data from the schema and prints it as JSON.

| `--strategy`         | Produces                                                |
| -------------------- | ------------------------------------------------------- |
| `explicit` (default) | Explicit `default` values only                          |
| `required`           | Explicit defaults, plus zero values for required fields |
| `all`                | Explicit defaults, plus zero values for every field     |

When the schema yields no default data, nothing is written and info `JOTL9054` is reported. The exact rules are in the [`@jotl/data` README](../../data/README.md) under getDefaults.

```sh
jotl defaults home.jotl --strategy required --out home.defaults.json
```

## migrate-schema

```sh
jotl migrate-schema <file> [--to jotl|schema] [--out <file>] [--schema-version <version>]
                    [--accept-newer-keywords=true|false] [--on-conflict error|preferDeclared|preferLatest]
```

Migrates a fengdie DSL schema or a legacy JSON Schema to Jotl (`--to jotl`, the default) or JSON Schema 2020-12 (`--to schema`). The input kind is detected automatically, and the verdict and its reason are written to stderr as info `JOTL9055`:

| Detected as                    | When                                                                                                                                                                                                      | Handling                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| fengdie DSL schema                 | The text does not start with `{` or `[` (not JSON)                                                                                                                                                        | Parsed with the Fengdie editor grammar; rules in the [`@jotl/convert` README](../../convert/README.md)      |
| fengdie JSON schema | JSON in which any field has a `key` equal to its property name, a Fengdie type (such as `image`, `text`, `richtext`, `url`, `color`, `date`, `enum`, `box`), or enum members of the form `{label, value}` | As above, without parsing                                                                                 |
| Plain JSON Schema              | Any other JSON; text starting with `{` that is not valid JSON reports `JOTL9052`                                                                                                                          | draft-04 through 2019-09 and OpenAPI 3.0 / 3.1 / Swagger 2.0 Schema Objects are upgraded to 2020-12 first |

Options for plain JSON Schema input:

| Option                                | Meaning                                                                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `--schema-version <version>`          | Version when `$schema` is not declared; values as in [How inputs are read](#how-inputs-are-read)                                          |
| `--accept-newer-keywords=true\|false` | Whether keywords newer than the declared version are accepted with 2020-12 semantics; default `true`                                      |
| `--on-conflict <policy>`              | `error`, `preferDeclared` or `preferLatest`; default `preferDeclared` with `--to jotl` (same as `convert`) and `error` with `--to schema` |

- These three options apply only to plain JSON Schema; with Fengdie input they are usage error `JOTL9013`.
- With plain JSON Schema and `--to schema`, the change list (one info diagnostic per rewrite) is also written to stderr.
- Information that a Fengdie migration cannot convert is kept in `x-fengdie` and reported as a warning; it does not change the exit code.
- `migrate-schema` does not read `jotl.config.json`.

```sh
jotl migrate-schema home.schema --out home.jotl
jotl migrate-schema home.fengdie.json --to schema
jotl migrate-schema legacy.json --to schema --out legacy.2020-12.json
jotl migrate-schema pet.json --to schema --schema-version openapi-3.0 --on-conflict preferLatest
```

## format

```sh
jotl format <file.jotl> [--write]
```

Formats Jotl source and keeps comments; the result goes to stdout. With `--write` the file is rewritten in place: nothing is written when the content is unchanged, and a leading BOM is kept. `--write` cannot be combined with `-` (usage error `JOTL9014`). When the source has syntax errors, nothing is printed or written. `format` only lays out source and does not read `jotl.config.json`.

```sh
jotl format home.jotl --write
```
