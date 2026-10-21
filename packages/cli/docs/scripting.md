# Use jotl in scripts and CI

**English** · [简体中文](../zh/docs/scripting.md)

After reading this page you can gate a CI job on `jotl`, parse its diagnostics line by line, fix the output language, and call it from Node without spawning a process. You need `jotl` installed as in the [quick start](../README.md).

## Gate a job on the exit code

**The exit code tells you whether a job should fail:** warnings and info never change it.

| Exit code | Meaning                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `0`       | Success; warnings and info may still be printed                                                             |
| `1`       | At least one error-level diagnostic, including file read or write failures and internal errors (`JOTL9099`) |
| `2`       | Usage error: unknown command or option, missing or invalid value, conflicting options                       |

A typical CI step checks every schema and validates sample data:

```sh
jotl check schemas/*.jotl
jotl validate schemas/home.jotl fixtures/home/*.json
```

## Parse the diagnostics

Results go to stdout and diagnostics to stderr, one diagnostic per line:

```text
<file>:<line>:<column> <code> <severity>: <message>
<file>#<JSON Pointer> <code> <severity>: <message>
```

- The first form is used when there is a source position, the second when there is only a JSON Pointer. Lines and columns start at 1; columns count UTF-16 code units.
- Severity is `error`, `warning` or `info` in English output and `错误`, `警告`, `提示` in Chinese output.
- Multi-line messages and related locations continue on the following lines, indented by two spaces. To read one diagnostic per line, keep only lines that do not start with a space.
- Input read from stdin is named `-`. Usage errors are located at `jotl`, and the next line names the `--help` to run.

```console
$ jotl compile
jotl JOTL9006 error: missing argument <file.jotl>
Run `jotl compile --help` for usage
```

Codes tell you which stage reported the problem:

| Codes                              | Source                                                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JOTL9001`-`JOTL9017`              | Command-line usage errors (exit code `2`)                                                                                                                         |
| `JOTL9050`-`JOTL9056`              | Reading files and inputs: unreadable or unwritable files, invalid JSON, schema version fallback, empty defaults, migration input kind, invalid `jotl.config.json` |
| `JOTL9099`                         | Internal error in `jotl`; the next line asks you to report it                                                                                                     |
| `JOTL0xxx`, `JOTL1xxx`             | `@jotl/core`: JSON Pointers and Jotl compilation                                                                                                                  |
| `JOTL2xxx`, `JOTL3xxx`, `JOTL8xxx` | `@jotl/convert`: TS conversion, JSON Schema upgrade, Fengdie migration                                                                                            |
| `JOTL4xxx`                         | `@jotl/data`: validation and default data                                                                                                                         |

The command line's own table is exported as `CLI_DIAGNOSTICS`.

## Choose the output language

Help, diagnostic messages, severity labels, verdict lines and generated text (such as the TS header) come in English or Chinese. Pin the language in CI so log parsing does not depend on the runner's locale.

- `--lang <zh|en>` (or `--lang=en`) works anywhere before `--`. Regional forms such as `zh-CN`, `zh_CN` and `en-US` are accepted, case-insensitively. The last occurrence wins; any other value is usage error `JOTL9005`.
- Without `--lang`, the first non-empty value of `JOTL_LANG`, `LC_ALL`, `LC_MESSAGES` and `LANG` decides: a value starting with `zh` (such as `zh_CN.UTF-8`) means Chinese, anything else (including `C` and `POSIX`) means English. When all are empty, the output is English.

```sh
jotl check home.jotl --lang en
JOTL_LANG=en jotl validate form.schema.json data.json
```

## Call jotl from code

`run(argv, io, options?)` performs one invocation and returns the exit code; it never calls `process.exit`. `createNodeIo()` gives the implementation backed by the Node process and file system.

```ts
import { createNodeIo, run } from "@jotl/cli";

process.exitCode = run(["check", "home.jotl"], createNodeIo(), { env: process.env });
```

- The output language comes from `--lang` in `argv`, then from `options.env` (resolved as in [Choose the output language](#choose-the-output-language); `localeFromEnv(env)` is exported). Without `env`, the current global language of `@jotl/core` is used. `run` sets the global language for the call and restores the previous value afterwards.
- `io` is a `CliIo`: `cwd`, `stdout`, `stderr`, `readFile`, `readStdin`, `writeFile`, `exists` and `isSameFile`. Inject an in-memory implementation in tests; the `jotl.config.json` search and the `.git` stop both go through `exists`.
- Other exports: `EXIT_CODES` (`{ ok: 0, error: 1, usage: 2 }`), `COMMAND_NAMES`, `CLI_DIAGNOSTICS` and `formatDiagnostic`, which formats a diagnostic in the line format above.
