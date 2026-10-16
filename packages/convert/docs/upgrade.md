# Upgrade legacy JSON Schema

**English** · [简体中文](../zh/docs/upgrade.md)

This page shows how to upgrade draft-04 to 2019-09 schemas, and OpenAPI / Swagger Schema Objects, to JSON Schema 2020-12 from code. It assumes you have installed `@jotl/convert` as in the [README](../README.md#get-started); from the command line use `jotl migrate-schema --to schema` in the [`jotl` CLI](../../cli/README.md).

The upgrade detects the input's version and rewrites it step by step to 2020-12. It also upgrades subschemas under unknown keywords that a `$ref` points to, adjusts `$ref`s affected by renames, writes the 2020-12 `$schema` on the root and orders keywords in normalized order. **Each rewrite reports one info diagnostic, so the diagnostics are your change list.**

## Upgrade one document

```ts
import { upgradeSchema } from "@jotl/convert";

const result = upgradeSchema({
  $schema: "http://json-schema.org/draft-04/schema#",
  id: "https://x.test/a.json",
  type: "object",
  properties: { n: { $ref: "#/definitions/n" } },
  definitions: { n: { type: "number", minimum: 0, exclusiveMinimum: true } },
});
// result.value.schema:
// { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "https://x.test/a.json", type: "object",
//   properties: { n: { $ref: "#/$defs/n" } }, $defs: { n: { type: "number", exclusiveMinimum: 0 } } }
// result.value.version: "draft-04", result.value.versionSource: "declared"
// result.diagnostics: JOTL3101 JOTL3105 JOTL3102 JOTL3120 JOTL3119, all info
```

`upgradeSchema` does not modify its input. With error diagnostics `value` is `undefined`.

## Upgrade documents that reference each other

For cross-file references use `upgradeDocuments`, and provide a callback that fetches a document by URI:

```ts
import { upgradeDocuments } from "@jotl/convert";

const result = await upgradeDocuments("https://x.test/main.json", {
  load: async (uri) => ({ value: await fetchJson(uri), diagnostics: [] }),
});
// result.value.documents: keyed by document URI, in load order, the first being the entry; each document's version is detected from its own $schema
```

`upgradeDocuments` starts from the entry URI, upgrades it and every document reachable through its `$ref`s, and rewrites cross-document references by the target documents' pointer mappings.

The `load` callback (`DocumentLoader`) receives an absolute URI without fragment and returns, or resolves to, a `Result<unknown>`:

- When `value` is a document, it takes part in the upgrade.
- When `value` is `undefined` with no error diagnostics, the document is left out of the upgrade (e.g. a meta-schema built into the validator), and references to it are kept as is.
- When `value` is `undefined` with errors, `JOTL3401` is reported; when the callback throws, `JOTL3402` is reported.

## Know how the version is detected

`detectVersion(schema, options?)` takes the first item that holds, in this order; `upgradeSchema` and `upgradeDocuments` use the same logic:

1. `$schema` is recognizable (http and https, with or without an empty fragment, and the matching hyper-schema): `versionSource` is `"declared"`. When it differs from the `version` option, `$schema` wins and `JOTL3006` is reported. JSON Schema stable v1's `https://json-schema.org/v1` (and `/v1/<year>`) is read as `2020-12`, and `$schema` is rewritten to 2020-12 on output (`JOTL3119`).
2. You passed `version`: `"specified"`. If `$schema` is present but unrecognizable, `JOTL3004` is reported.
3. Inferred from characteristic keywords: `"inferred"`, reporting `JOTL3007` (info). Swagger features (such as `x-nullable`) give `swagger-2.0`, OpenAPI 3.0 features (such as `nullable`) give `openapi-3.0`. Otherwise legacy features give the lowest version among them, and newer features alone give the lowest version that supports all of them.

- With neither `$schema` nor distinguishing keywords, a `JOTL3001` error asks you to pass `version`: `upgradeSchema({ type: "string" })` fails, `upgradeSchema({ type: "string" }, { version: "draft-07" })` succeeds.
- draft-03 is not supported and reports `JOTL3002`.
- Valid version values are `SCHEMA_VERSIONS` in [`src/migrate/upgrade/versions.ts`](../src/migrate/upgrade/versions.ts); `isSchemaVersion` checks a string.

## API

| Export | Purpose |
|---|---|
| `upgradeSchema(schema, options?)` | Upgrades a single document; returns `Result<UpgradedSchema>`: `{ schema, version, versionSource }` |
| `upgradeDocuments(entry, options)` | Upgrades the entry and every document reachable through `$ref`; returns `Promise<Result<UpgradedDocuments>>`: `{ entry, documents }` |
| `detectVersion(schema, options?)` | Only detects the version; returns `Result<VersionDetection>`: `{ version, source }` |
| `DEFAULT_UPGRADE_OPTIONS` | Default option values |
| `RECURSIVE_ANCHOR_NAME` | The `$dynamicAnchor` name that `$recursiveAnchor: true` is rewritten to |
| `UPGRADE_DIAGNOSTICS`, `upgradeDiagnostic` | Code table and a helper that builds a diagnostic by code |

## Set upgrade options

`UpgradeOptions`:

| Option | Default | Meaning |
|---|---|---|
| `version` | none | Version used when there is no recognizable `$schema`; usually needed for OpenAPI 3.0 / Swagger 2.0 Schema Objects |
| `acceptNewerKeywords` | `true` | Newer keywords that do not exist in the declared version: `true` keeps them with 2020-12 semantics and reports `JOTL3201`; `false` removes them and reports `JOTL3202`. `$defs` is kept under both values, because it is only a container referenced by `$ref` |
| `onConflict` | `"error"` | On old/new semantic conflicts (`JOTL33xx`): `"error"` reports an error and fails; `"preferDeclared"` follows the declared version; `"preferLatest"` follows 2020-12. The latter two report a warning and state the handling in `related` |
| `uri` | none | Document URI: the base for resolving relative `$id` / `$ref`, also written into the `document` of diagnostic locations |

Example: in draft-07, a `minLength` next to `$ref` is ignored, but in 2020-12 it takes effect. By default this reports a `JOTL3303` error; `preferDeclared` deletes `minLength`, and `preferLatest` keeps it.

`UpgradeDocumentsOptions` is `UpgradeOptions` without `uri`, plus `load: DocumentLoader`.

## Read diagnostics

Upgrade codes are `JOTL3xxx`; the code table is `UPGRADE_DIAGNOSTICS` in [`src/migrate/upgrade/diagnostics.ts`](../src/migrate/upgrade/diagnostics.ts). Locations are JSON Pointers (`location.kind === "pointer"`), with `document` set when several documents are involved.

| Range | Meaning |
|---|---|
| `30xx` | Input and version detection |
| `31xx` | Step-by-step rewrites, one info each |
| `32xx` | Lenient mode: newer keywords accepted or removed, legacy notation in newer documents |
| `33xx` | Old/new semantic conflicts; severity follows `onConflict` |
| `34xx` | Multi-document loading |

## Known limitations

Normalization rule 2 (named types only in the root `$defs`) does not hold for upgrade results. For this and other limitations see "确定不修" (Won't fix) in the root [`TODO.md`](../../../TODO.md).
