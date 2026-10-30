# @jotl/convert 指南

[English](../../docs/README.md) · **简体中文**

每页只讲一个任务；还没安装时先看 [README](../README.md)。

| 想做的事                                                                                   | 阅读                                                 |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 从 schema 生成 TS 声明，或把 `.d.ts` 读回 schema                                           | [JSON Schema 与 TypeScript 互转](./ts-conversion.md) |
| 手写或校对生成的 `.d.ts` 里的 JSDoc 标签                                                   | [标签协议](./tag-protocol.md)                        |
| 让 TSDoc 或 eslint-plugin-jsdoc 不再把自定义标签报为未知                                   | [配置 TSDoc 与 ESLint](./lint-presets.md)            |
| 在代码里把 draft-04 到 2019-09 的 schema 或 OpenAPI / Swagger Schema Object 升级为 2020-12 | [升级旧版 JSON Schema](./upgrade.md)                 |
| 把 fengdie DSL schema 转成 Jotl                                                                    | [迁移 fengdie DSL schema](./fengdie-migration.md)            |

命令行里用 `jotl migrate-schema`（自动判定输入类型）与 `jotl convert`，见 [`jotl` CLI](../../../cli/zh/README.md)。

## 按诊断代码找页面

每条诊断都带代码，按代码段就能找到解释它的页面。

| 代码       | 来源                        | 页面                                                                                |
| ---------- | --------------------------- | ----------------------------------------------------------------------------------- |
| `JOTL20xx` | `schemaToTs`（schema → TS） | [JSON Schema 与 TypeScript 互转](./ts-conversion.md)                                |
| `JOTL21xx` | `tsToSchema`（TS → schema） | [JSON Schema 与 TypeScript 互转](./ts-conversion.md)、[标签协议](./tag-protocol.md) |
| `JOTL3xxx` | 旧版升级                    | [升级旧版 JSON Schema](./upgrade.md)                                                |
| `JOTL8xxx` | 凤蝶迁移                    | [迁移 fengdie DSL schema](./fengdie-migration.md)                                           |

## 把消息切换为中文

诊断消息与生成文字跟随 `@jotl/core` 的全局语言，默认英文（`en`）。调用 `@jotl/core` 的 `setLocale("zh-CN")` 切换为中文。生成文字包括生成文件头、默认弃用说明、凤蝶分组标题与输入类型的判定依据。
