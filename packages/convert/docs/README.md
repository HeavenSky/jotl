# @jotl/convert guides

**English** · [简体中文](../zh/docs/README.md)

Each page covers one task; start from the [README](../README.md) if you have not installed the package yet.

| You want to                                                                                | Read                                                             |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Generate TS declarations from a schema, or read a `.d.ts` back to a schema                 | [Convert between JSON Schema and TypeScript](./ts-conversion.md) |
| Hand-write or proofread the JSDoc tags in a generated `.d.ts`                              | [Tag protocol](./tag-protocol.md)                                |
| Stop TSDoc or eslint-plugin-jsdoc from flagging the custom tags                            | [Configure TSDoc and ESLint](./lint-presets.md)                  |
| Upgrade draft-04 to 2019-09 schemas or OpenAPI / Swagger Schema Objects to 2020-12 in code | [Upgrade legacy JSON Schema](./upgrade.md)                       |
| Turn a fengdie DSL schema into Jotl                                                            | [Migrate fengdie DSL schemas](./fengdie-migration.md)                |

From the command line, use `jotl migrate-schema` (it detects the input type) and `jotl convert`; see the [`jotl` CLI](../../cli/README.md).

## Find the page for a diagnostic code

Every diagnostic carries a code; its range tells you which page explains it.

| Code       | Produced by                | Page                                                                                                |
| ---------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| `JOTL20xx` | `schemaToTs` (schema → TS) | [Convert between JSON Schema and TypeScript](./ts-conversion.md)                                    |
| `JOTL21xx` | `tsToSchema` (TS → schema) | [Convert between JSON Schema and TypeScript](./ts-conversion.md), [Tag protocol](./tag-protocol.md) |
| `JOTL3xxx` | Legacy upgrade             | [Upgrade legacy JSON Schema](./upgrade.md)                                                          |
| `JOTL8xxx` | Fengdie migration          | [Migrate fengdie DSL schemas](./fengdie-migration.md)                                                   |

## Switch messages to Chinese

Diagnostic messages and generated text follow the global language of `@jotl/core`, which defaults to English (`en`). Call `setLocale("zh-CN")` from `@jotl/core` to get Chinese. Generated text covers the generated file header, the default deprecation text, Fengdie group titles and the reasons given by input detection.
