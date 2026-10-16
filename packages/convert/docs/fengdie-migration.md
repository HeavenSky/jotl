# Migrate Fengdie schemas

**English** · [简体中文](../zh/docs/fengdie-migration.md)

This page shows how to turn a Fengdie schema (source or umo JSON) into Jotl and JSON Schema 2020-12 from code, and what each Fengdie type and metadata key becomes. It assumes you have installed `@jotl/convert` as in the [README](../README.md#get-started); from the command line use `jotl migrate-schema` in the [`jotl` CLI](../../cli/README.md).

## Migrate a schema

```ts
import { migrateFengdie } from "@jotl/convert";

const { jotl, schema, umo, diagnostics } = migrateFengdie(
  `Object(首页) {
    title(标题): String[maxLength: 20, required: true]
    start(开始): Date
  }`,
  "home.fengdie",
);
// jotl:
// Root(首页): {
//   title(标题): string[maxLength: 20]
//   start(开始)?: datetime[value_format: 'x']
// }
```

The pipeline is: source → umo JSON isomorphic to toJson → JSON Schema 2020-12 → Jotl printed by `@jotl/core`'s `print`. Lexical and grammar rules follow umo-edit-sdk 0.0.8 as used by the Fengdie editor (`parse/schema.l` `schema.yy`).

## Four rules that shape the result

These rules are referred to as D1-D4 below.

- D1 `Date` becomes a millisecond timestamp integer (`datetime[value_format: 'x']`), so existing Fengdie data passes validation without conversion.
- D2 `group` on first-level fields becomes the root object's `x-ui.groups`, rendered as groups by group value.
- D3 Information with no Jotl notation goes to the node's `x-fengdie` (machine-readable, kept on round trip), not to `$comment`.
- D4 Only fields with `required: true` are required; the rest are optional, as in Fengdie.

## API

| Export | Purpose |
|---|---|
| `migrateFengdie(input, file?)` | `input` is source, umo JSON text (first non-whitespace character `{`) or a umo JSON object; returns `{ jotl?, schema?, umo?, diagnostics }`, with `jotl` `undefined` on errors. `schema` is deeply equal to the result of compiling `jotl` again |
| `fengdieToUmoJson(source, file?)` | Source → umo JSON, also returning `origins` (node to source location) |
| `umoJsonToSchema(umo, { origins?, file? })` | umo JSON → unsorted 2020-12 document; without `origins`, diagnostic locations are pointers into the umo JSON |
| `detectMigrateInput(text)` / `umoJsonFeature(json)` | Tell whether the input is Fengdie source, umo JSON or a regular JSON Schema, and give the reason |
| `MIGRATE_DIAGNOSTICS` | Fengdie diagnostic code table |

## Read diagnostics

- Lexical and syntax errors (`JOTL8001`-`JOTL8005`) stop at the first error, as jison does. umo JSON parse failures and invalid structure are `JOTL8006` and `JOTL8007`.
- Everything else is a warning (`JOTL81xx`) and does not affect the result. Warnings are reported only for information that is actually lost or rewritten, not for information kept losslessly in `x-fengdie`.
- Constructs that make umo-edit-sdk's toJson throw drop their metadata and report `JOTL8118`. These are metadata on types without a metadata table, such as `Array<string>[...]`, `Component[...]` and a root `OpenAction[...]`.

Other conventions:

- Strings and arrays may be empty, as Jotl allows by default; an explicit `minLength: 0` means unlimited and is not written out.
- `x-fengdie` is written as `x_fengdie` in Jotl (D3). Structural information uses the keys `type` `lottery` `public` `regExpFlags`; metadata with the same names is recorded as `metaType` and so on instead.

## Type mapping

| Fengdie type (umo `type`) | 2020-12 / Jotl | Notes |
|---|---|---|
| `String` (and omitted type) `Text` `RichText` `URL` `Color` `File` `Image` `Number` `Boolean` | `string` `text` `richtext` `url` `color` `file` `image` `number` `boolean` | Unknown type names fall back to `string`, reporting `JOTL8111` |
| `Date` | `datetime[value_format: 'x']` | The Fengdie editor uses a date-time picker and the data is a millisecond timestamp; the schema is `{type: integer, minimum: -MAX_SAFE_INTEGER, maximum: MAX_SAFE_INTEGER, x-valueFormat: 'x', x-ui: {widget: 'datetime'}}` |
| `Enum` | `enum`; `oneOf` when there are descriptions | `multiple: true` means multi-select; single-select with 2-5 items writes `widget: 'radio'`, multi-select writes `widget: 'checkbox'`; with no members it becomes a string (`JOTL8114`) |
| `Array<string>` `Array<number>` | `array[array_item: 'string' / 'number']` | |
| `Object` `Action` `OpenAction` `Spm` | Object | `Spm` is fixed to the three strings `spma` `spmb` `spmc` |
| `Array` | Array of objects | |
| `Module` `ModuleArray` `namespace.Component` `namespace.Component[Array]` | Object / array of objects | `namespace` `component` `version` `url` `dist` are recorded in `x-fengdie` |
| `Box` `Resource` `Plugin` `Animation` `Video` | Objects shaped like umo-edit-sdk mock data, not closed | |
| `Component` | `string` | Component instance id |
| Root `Lottery` / `public` | Object | `x-fengdie.lottery` / `x-fengdie.public`, no warning |
| `export a ... export b ...` | Each becomes a `$defs` type, the first being the root | Names that are not PascalCase are renamed by `print`'s rules, reporting `JOTL8117` |

The original type names of `Component` `Box` `Resource` `Plugin` `Animation` `Video` `Action` `OpenAction` `Spm` `Module` `ModuleArray` and namespace types are recorded in `x-fengdie.type`.

## Metadata mapping

| Fengdie metadata | Destination |
|---|---|
| Description `(...)` / `description` | `title` / `description` |
| `default` `defaultValue` | `default`, corrected by type (`JOTL8107`), dropped when it violates constraints (`JOTL8108`); when both appear `default` wins (`JOTL8115`) |
| `minLength` `maxLength` | Strings: `minLength` `maxLength`; arrays: `minItems` `maxItems` |
| `min` `max` / `step` | `minimum` `maximum` / `x-ui.props.step` |
| `regExp` | `pattern`; `"/^https:/gi"` has its delimiters removed; `i` is rewritten into the pattern (letters become `[hH]`, character classes get the other case added), and when Unicode property classes, backreferences etc. make a safe rewrite impossible it is kept as is with `JOTL8119`; `g` is ignored; `m` `s` `u` `y` report `JOTL8120`; flags that did not take effect are recorded in `x-fengdie.regExpFlags` |
| `errorMsg` | `errorMessage` |
| `placeholder`, and `width` `height` `maxWidth` `maxHeight` `aspectRatio` `maxSize` `setDefaultColorTo` of `Image` | `x-ui.props` |
| `if: "$.path"` | `x-ui.visibleIf` (Jotl `root_if`); other forms are recorded in `x-fengdie` |
| `required: true` | Parent object's `required` (D4) |
| `group` of first-level fields | Root object's `x-ui.groups`: `normal` General, `advance` Advanced, `developer` Developer, `operator` Operations (常规, 高级, 开发者, 运营 under `zh-CN`; D2); deeper levels are recorded in `x-fengdie` |
| `showKey` | `x-ui.summary`; dropped when not an element field (`JOTL8106`) |
| Others in the allowlist (`rule` `source` `searchType` `sourceType` `reuseable` `autoFetch` `entityType` `mappingRuleId` `defaultSourceType` `ucdp` `spmC` `spmD` `configId` `crossApp` `i18n` etc.) and `custom*` | Same-named entries in `x-fengdie`, no warning (D3) |
| Outside the allowlist | Dropped, reporting `JOTL8105` (consistent with toJson) |

The per-type metadata allowlists are `UMO_META_KEYS` in [`src/migrate/fengdie/umo-types.ts`](../src/migrate/fengdie/umo-types.ts), taken from umo-edit-sdk `lib/types.js`.

## Known limitations

- **Data saved under Fengdie can fail validation against the migrated schema.** `Image`, `File` and `URL` fields carry `format: "uri"`, and `Color` accepts only hexadecimal colors, following Jotl's own types. Values Fengdie accepted, such as relative addresses or colors in other notations, are reported by `validate` of [`@jotl/data`](../../data/README.md); fix them by hand. `migrate` of `@jotl/data` does not rewrite them either.
- **Fengdie extension metadata has no effect after migration.** Data sources (`source`, `sourceType`), `rule`, `reuseable`, semantic types such as `Component`, and conditional required or read-only settings have no Jotl notation. They are kept in `x-fengdie` and survive round trips, but forms and validation ignore them.
- **Only some `if` expressions become conditions.** These forms convert to `x-ui.visibleIf`: a path's truthiness, `===` and `!==`, `==` and `!=` against `null`, loose equality and numeric comparisons when the field type is known, and `&&`, `||`, `!` with parentheses. Function calls, other variables, arithmetic and the like are recorded in `x-fengdie`, and the field is then always shown.
- **Converted conditions can differ at the edges.** When a middle segment of the path is `undefined`, Fengdie's JavaScript throws, while the converted condition is simply false. Conversions that depend on the field type assume the data matches the declared type.
- **With several exports, the first one becomes the root.** A Jotl file always has a root, so put the export you want as the root first before migrating.
- **`regExp` with both `i` and `u` loses Unicode case folding.** After `i` is rewritten as `[kK]`-style classes, `k` no longer matches the Kelvin sign `K` (U+212A) and `s` no longer matches `ſ` (U+017F).
