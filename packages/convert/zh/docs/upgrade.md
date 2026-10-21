# 升级旧版 JSON Schema

[English](../../docs/upgrade.md) · **简体中文**

本页讲怎样在代码里把 draft-04 到 2019-09 的 schema，以及 OpenAPI / Swagger 的 Schema Object，升级为 JSON Schema 2020-12。前提是已按 [README](../README.md#快速开始) 装好 `@jotl/convert`；命令行里用 [`jotl` CLI](../../../cli/zh/README.md) 的 `jotl migrate-schema --to schema`。

升级先识别输入的版本，再逐级改写到 2020-12。被 `$ref` 指向的未知关键字下的子 schema 一并升级，受改名影响的 `$ref` 同步调整，根上写入 2020-12 的 `$schema`，关键字按规范化顺序排列。**每处改写报一条 info 诊断，诊断列表就是变更清单。**

## 升级单个文档

```ts
import { upgradeSchema } from '@jotl/convert';

const result = upgradeSchema({
  $schema: 'http://json-schema.org/draft-04/schema#',
  id: 'https://x.test/a.json',
  type: 'object',
  properties: { n: { $ref: '#/definitions/n' } },
  definitions: { n: { type: 'number', minimum: 0, exclusiveMinimum: true } },
});
// result.value.schema:
// { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "https://x.test/a.json", type: "object",
//   properties: { n: { $ref: "#/$defs/n" } }, $defs: { n: { type: "number", exclusiveMinimum: 0 } } }
// result.value.version: "draft-04", result.value.versionSource: "declared"
// result.diagnostics: JOTL3101 JOTL3105 JOTL3102 JOTL3120 JOTL3119, 均为 info
```

`upgradeSchema` 不修改输入。有 error 诊断时 `value` 为 `undefined`。

## 升级相互引用的多个文档

跨文件引用用 `upgradeDocuments`，并提供按 URI 取文档的回调：

```ts
import { upgradeDocuments } from '@jotl/convert';

const result = await upgradeDocuments('https://x.test/main.json', {
  load: async uri => ({ value: await fetchJson(uri), diagnostics: [] }),
});
// result.value.documents: 键为文档 URI, 按加载顺序排列, 第一项为入口; 每个文档按自己的 $schema 识别版本
```

`upgradeDocuments` 从入口 URI 开始，升级它以及经 `$ref` 可达的全部文档，并按目标文档的指针映射改写跨文档引用。

`load` 回调（`DocumentLoader`）收到不含片段的绝对 URI，返回（或 resolve 为）`Result<unknown>`：

- `value` 为文档时，该文档参与升级。
- `value` 为 `undefined` 且没有 error 诊断时，该文档不参与升级（例如校验器已内置的元 schema），指向它的引用保持原样。
- `value` 为 `undefined` 且有 error 时报 `JOTL3401`；回调抛出异常时报 `JOTL3402`。

## 版本怎样识别

`detectVersion(schema, options?)` 按以下顺序取第一个成立的项；`upgradeSchema` 与 `upgradeDocuments` 用的是同一套逻辑：

1. `$schema` 可识别（http 与 https，带或不带空片段，以及对应的 hyper-schema）：`versionSource` 为 `"declared"`。与 `version` 选项不同时以 `$schema` 为准，报 `JOTL3006`。JSON Schema 稳定版 v1 的 `https://json-schema.org/v1`（及 `/v1/<年份>`）按 `2020-12` 读取，输出时 `$schema` 改写为 2020-12（`JOTL3119`）。
2. 传了 `version`：`"specified"`。若 `$schema` 存在但无法识别，报 `JOTL3004`。
3. 按特征关键字推断：`"inferred"`，报 `JOTL3007`（info）。有 Swagger 特征（如 `x-nullable`）时取 `swagger-2.0`，有 OpenAPI 3.0 特征（如 `nullable`）时取 `openapi-3.0`。否则有旧版特征时取其中最低的版本，只有新版特征时取它们共同支持的最低版本。

- 既无 `$schema` 也无可区分的关键字时报 `JOTL3001` error，需要传 `version`：`upgradeSchema({ type: "string" })` 失败，`upgradeSchema({ type: "string" }, { version: "draft-07" })` 成功。
- 不支持 draft-03，报 `JOTL3002`。
- 合法的版本取值是 [`src/migrate/upgrade/versions.ts`](../../src/migrate/upgrade/versions.ts) 的 `SCHEMA_VERSIONS`；用 `isSchemaVersion` 判断字符串是否合法。

## API

| 导出                                       | 作用                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `upgradeSchema(schema, options?)`          | 升级单个文档；返回 `Result<UpgradedSchema>`：`{ schema, version, versionSource }`                     |
| `upgradeDocuments(entry, options)`         | 升级入口及经 `$ref` 可达的全部文档；返回 `Promise<Result<UpgradedDocuments>>`：`{ entry, documents }` |
| `detectVersion(schema, options?)`          | 只识别版本；返回 `Result<VersionDetection>`：`{ version, source }`                                    |
| `DEFAULT_UPGRADE_OPTIONS`                  | 选项默认值                                                                                            |
| `RECURSIVE_ANCHOR_NAME`                    | `$recursiveAnchor: true` 改写成的 `$dynamicAnchor` 名字                                               |
| `UPGRADE_DIAGNOSTICS`、`upgradeDiagnostic` | 代码表，以及按代码生成诊断的工具                                                                      |

## 设置升级选项

`UpgradeOptions`：

| 选项                  | 默认      | 含义                                                                                                                                                                        |
| --------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`             | 无        | 没有可识别的 `$schema` 时采用的版本；OpenAPI 3.0 / Swagger 2.0 的 Schema Object 通常需要指定                                                                                |
| `acceptNewerKeywords` | `true`    | 声明版本中不存在的高版本关键字：`true` 按 2020-12 语义保留并报 `JOTL3201`；`false` 移除并报 `JOTL3202`。`$defs` 在两种取值下都保留，因为它只是被 `$ref` 引用的容器          |
| `onConflict`          | `"error"` | 新旧语义冲突（`JOTL33xx`）时：`"error"` 报 error 并失败；`"preferDeclared"` 按声明版本处理；`"preferLatest"` 按 2020-12 处理。后两者报 warning，并在 `related` 写明处理方式 |
| `uri`                 | 无        | 文档 URI：解析相对 `$id` / `$ref` 的基准，也写入诊断位置的 `document`                                                                                                       |

例：draft-07 中写在 `$ref` 旁的 `minLength` 会被忽略，而 2020-12 中会生效。默认报 `JOTL3303` error；`preferDeclared` 删除 `minLength`，`preferLatest` 保留它。

`UpgradeDocumentsOptions` 是 `UpgradeOptions` 去掉 `uri`，再加 `load: DocumentLoader`。

## 解读诊断

升级的代码为 `JOTL3xxx`；代码表是 [`src/migrate/upgrade/diagnostics.ts`](../../src/migrate/upgrade/diagnostics.ts) 的 `UPGRADE_DIAGNOSTICS`。位置为 JSON Pointer（`location.kind === "pointer"`），涉及多个文档时带 `document`。

| 段     | 含义                                                       |
| ------ | ---------------------------------------------------------- |
| `30xx` | 输入与版本识别                                             |
| `31xx` | 逐级改写，每处一条 info                                    |
| `32xx` | 宽松模式：高版本关键字的接受或移除，高版本文档中的旧版写法 |
| `33xx` | 新旧语义冲突；级别随 `onConflict` 变化                     |
| `34xx` | 多文档加载                                                 |

## 已知限制

- **嵌套的 `$defs` 留在原处。** 规范化规则 2（命名类型只在根 `$defs`）对升级结果不成立。把嵌套的 `$defs` 挪到根会改变其中 `$ref` 的解析结果，所以升级保留原位置。需要所有命名类型都在根 `$defs` 时，自己挪过去并改写受影响的 `$ref`。
- **未知关键字下的部分子 schema 不升级。** `$ref` 指向未知关键字下名字与数据关键字相同的属性（如 `default`、`const`）时，升级把该位置当作数据跳过，因为单凭路径无法区分两者。这个子 schema 保持旧语法；手工升级，或在升级前把它移到 `$defs` 下。
