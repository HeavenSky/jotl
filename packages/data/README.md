# @jotl/data

**English** · [简体中文](./README.zh-CN.md)

Read this page when generating default data from a JSON Schema, filling in, validating, migrating old data or generating Mock data, or when checking the behavior of these functions and the `JOTL4xxx` diagnostics; it corresponds to `packages/data`.

`@jotl/data` implements `@jotl/core`'s data capability interface `DataApi`; validation is based on Ajv 2020, and the other capabilities traverse the schema themselves. Defaults and validation in `@jotl/form`, as well as `jotl validate` `jotl defaults`, all go through this package.

## Installation

```sh
pnpm add @jotl/data
```

## Minimal example

```ts
import { fillDefaults, getDefaults, migrate, mock, validate } from "@jotl/data";

const schema = {
  type: "object",
  properties: {
    title: { type: "string", title: "标题", maxLength: 5, default: "首页" },
    count: { type: "integer", minimum: 1 },
    color: { type: "string", format: "color", errorMessage: "请填写十六进制颜色" },
    tags: { type: "array", minItems: 1, items: { type: "string" } },
  },
  required: ["title", "count"],
};

getDefaults(schema).value; // { title: "首页" }
getDefaults(schema, { strategy: "required" }).value; // { title: "首页", count: 1 }
getDefaults(schema, { strategy: "all" }).value; // { title: "首页", count: 1, color: "", tags: [""] }

fillDefaults(schema, { title: "自定义" }).value; // { data: { title: "自定义" }, filled: [] }

validate(schema, { title: 1, count: 0, color: "red" });
// value: { valid: false }
// diagnostics: JOTL4001 /title "标题 的类型应为字符串"
//              JOTL4003 /count "count 超出范围: 应不小于 1"
//              JOTL4009 /color "请填写十六进制颜色"

migrate(schema, { title: 12, count: "3", old: true }).value;
// { data: { title: "12", count: 3 }, changed: ["/title", "/count", "/old"] }

mock(schema, { seed: 1 }); // the same seed gives the same result every time

validate(schema, { title: 1, count: 0 }, { locale: "en" });
// diagnostics: JOTL4001 /title "标题 should be of type string"
//              JOTL4003 /count "count is out of range: should be at least 1"
```

## Public API

All functions return `@jotl/core`'s `Result`, never throw, and do not modify the schema or data passed in. The option `locale` (`"zh-CN" | "en"`, type `LocaleOptions`) sets the language of the diagnostics and messages produced by that call only; when omitted, `@jotl/core`'s global `getLocale()` is used (default `en`).

| Export | Signature | Notes |
|---|---|---|
| `getDefaults` | `(schema, opts?: Partial<DefaultsOptions> & SubschemaOptions & LocaleOptions) => Result<unknown>` | Generates default data; `at` see below |
| `fillDefaults` | `(schema, data, opts?: Partial<DefaultsOptions> & LocaleOptions) => Result<{ data, filled: JsonPointer[] }>` | Fills in on top of existing data; `filled` lists the filled locations |
| `validate` | `(schema, data, opts?: SubschemaOptions & LocaleOptions) => Result<{ valid: boolean }>` | Validates; errors are diagnostics with `location.kind = "pointer"`; `at` see below |
| `migrate` | `(schema, data, opts?: LocaleOptions) => Result<{ data, changed: JsonPointer[] }>` | Fixes old data against a new schema; `changed` lists the changed locations |
| `mock` | `(schema, opts?: { seed?: number } & LocaleOptions) => Result<unknown>` | Generates data satisfying the schema |
| `dataApi` | `DataApi` | The five functions above bundled, for injection by interface |
| `DATA_DIAGNOSTICS` `dataDiagnostic` `DATA_TEXT` `DATA_TEXT_EN` `dataText()` `DataText` | | Code table (with English `en` templates), diagnostic factory, Chinese and English fragments spliced into messages (labels, type names, etc.); `dataText()` returns the set for the current global language |
| `COLOR_PATTERN` | `RegExp` | Regex for the `color` format |
| `SubschemaOptions` | `{ at?: JsonPointer \| JsonSchema }` | Compute defaults or validate only against a subschema within the document |

When `at` is a JSON pointer, the subschema at that location in the document is used; when it is a schema value, it is used as is (e.g. an effective schema synthesized from a document node). In both forms references are resolved against the whole document, with the same rules as without `at`; the data root sits at the subschema: pointers and labels of validation errors are relative to the subschema, and the root label is "数据" (`zh-CN`) or "data" (`en`). A pointer that does not exist or does not point to a schema reports `JOTL4018`. `$id` `$schema` carried by the subschema itself are ignored during validation.

## Default data: getDefaults and fillDefaults

For the defaults of `DefaultsOptions` see `@jotl/core`'s `DEFAULT_DEFAULTS_OPTIONS` (`strategy: "explicit"`, `arrayItems: "minItems"`, `oneOf: "firstWithDefault"`, `maxDepth: 3`). Invalid option values report `JOTL4018` with `value` `undefined`.

When the node itself (or a node merged via `$ref` `allOf`) has a `default`, a copy of the `default` is always used; otherwise by strategy:

| Node | `explicit` | `required` | `all` |
|---|---|---|---|
| Object | Only properties that produce a value; if none, the root is `{}` and non-roots are omitted | Required properties are produced recursively, optional properties take only explicit defaults; when an optional object appears because of a child's default, its required fields are filled too; at least `{}` | All properties produced recursively |
| Array | Omitted (even if elements have defaults) | When required, generates `minItems` elements, using zero values for elements without a value | Same as `required`, optional arrays also generated |
| Scalar | Omitted | Zero value when required | Zero value |

- Zero values: enums and `const` take the first allowed value, strings `""`, numbers and integers `minimum` (`0` if absent), booleans `false`, `null`, objects `{}`, arrays `[]`. Zero values do not consider constraints such as `format` `minLength` `pattern`, and the result is not guaranteed to pass `validate`.
- With `arrayItems: "none"`, arrays that need generating are empty arrays.
- `anyOf` / `oneOf` (except labeled enums): `oneOf: "firstWithDefault"` takes the first branch that produces a value, or the first branch if none does; `"first"` always takes the first.
- `maxDepth` is the limit on how many times the same `$ref` target is expanded along the current path, not the data nesting depth: once reached, that reference is no longer expanded and the node is treated as having no value. Example: a required recursive `Node.child` with the default `3` produces `{ name, child: { name, child: { name } } }`.
- An unresolvable `$ref` reports a `JOTL4016` warning and the node is treated as having no value.

`fillDefaults` does not overwrite existing values:

- Values are produced only for missing declared properties; existing fields (including `null` and empty strings) are kept as is and filled further down; arrays are filled element by element without adding or removing elements.
- A missing subtree is produced as a whole by strategy, and `filled` records only the subtree root's pointer.
- For union types, one branch is chosen for filling by the data's type and field overlap.
- When `data` is `undefined` it is equivalent to `getDefaults`, with `filled` being `[""]` (when a value was produced).

## Validation: validate

- Uses the Ajv 2020 dialect with `allErrors` enabled; field presence is decided by own properties only (a field named like a prototype property such as `constructor` is still reported as required when missing).
- Formats: all formats of `ajv-formats`, plus a custom `color` (CSS hexadecimal color `#rgb` `#rgba` `#rrggbb` `#rrggbbaa`, regex `COLOR_PATTERN`). `x-ui` `x-deprecatedReason` `errorMessage` are known keywords; other keywords starting with `x-` are registered as annotations; unknown keywords not starting with `x-` make the schema fail to compile.
- Extended validation: `x-decimals: n` (decimal places of number/integer ≤ n, exponent forms counted after expansion; violations report `JOTL4020`); `x-decimalRange` (on money/bigint objects, compares `value` as exact decimals; violations report `JOTL4021` pointing at the object; an invalid `value` itself only reports pattern); strings with `contentMediaType: "application/json"` must `JSON.parse` (`JOTL4022`), and with `contentSchema` the parsed result is validated against it, a mismatch reporting only one `JOTL4023` on that string field. A `propertyNames` (map key constraint) mismatch reports `JOTL4024` pointing at the object. `x-valueFormat` (storage format of date components): dayjs format strings are parsed strictly with `customParseFormat` (with a `Z` token any offset is accepted and compared using the original offset), `x` `X` timestamps only require an integer, and aliases `iso` `iso-x` `utc` `utc-x` accept any valid RFC 3339 date-time (when appearing together with `format: date-time`, only format reports the error); mismatches report `JOTL4025`, and `errorMessage` can override the text via the keyword `x-valueFormat`.
- A union mismatch (`JOTL4012`) carries a reason: when a discriminator field is missing or its value is not among the branches, the allowed values are listed; otherwise the branch is chosen by the data's JSON type and its first error is given (errors on the value itself are written as `{label} {reason}`); when no branch matches the type, the allowed types are listed. The latter two are assertions only in `validate`; the official test suite still measures them as annotations.
- Default data and Mock: the zero value of a string with `x-valueFormat` is local `2000-01-01 00:00:00` written in that format (timestamp integers remain `0`); without `x-valueFormat`, the zero values of `format: date` `time` `date-time` strings are, for the same moment, `2000-01-01`, `00:00:00±HH:mm`, and RFC 3339 with the local offset; Mock takes a random moment between 2000 and 2030 written in the format.
- Default data and Mock: the `value` of money/bigint objects (recognized by `properties.type.const`) takes a value satisfying the pattern's decimal places and `x-decimalRange` (trying in order `"0"`, `minimum`, `maximum`, `exclusiveMinimum` + 1, `exclusiveMaximum` - 1, padding decimal places), and an unconstrained currency takes `CNY`; the zero value of JSON text (`contentMediaType: "application/json"`) is the serialization of `contentSchema`'s default data, or `"{}"` without `contentSchema`; Mock generates JSON text from `contentSchema` and then serializes it.
- When the schema cannot be compiled (unknown keywords not starting with `x-`, unresolvable references, etc.) `JOTL4017` is returned with `value` `undefined`.
- Compilation results are cached by schema object identity: modifying the same schema object in place does not trigger recompilation; pass a new object.
- A diagnostic's `pointer` is a JSON Pointer into the data; missing required fields (`JOTL4002`) and disallowed fields (`JOTL4008`) point to the field itself, not the parent object.
- Field labels in messages: the field's own `title`; otherwise array elements are "父标签的第 N 项" (`zh-CN`) or "item N of parent label" (`en`), others the key name; the root is "数据" or "data".

One violation reports only one error:

- On a type mismatch (`JOTL4001`) no other constraints at the same location are reported.
- When all `anyOf` branches fail only `JOTL4012` is reported, likewise `JOTL4012` when all `oneOf` branches fail, and a labeled enum (`const` branches of `oneOf`) mismatch reports only `JOTL4006`; errors inside branches and deeper are not reported. When the same `$defs` is referenced outside the combinator keyword, errors there are reported as usual.
- Matching several `oneOf` branches at once reports `JOTL4015`.
- Failure of `if` itself is not reported; only the concrete errors in `then` / `else` are.
- Errors with the same code, pointer and message are kept only once.

`errorMessage` custom messages (written in Jotl as the metadata `errorMessage: ...`, e.g. `string[errorMessage: {maxLength: '最多 20 字'}]`, see `docs/spec/jotl.md` (Chinese)):

- The string form replaces the messages of all errors on that node; the object form is keyed by keyword name (e.g. `maxLength` `required`) and replaces only errors of the same-named keyword, keeping the default text for the rest.
- Lookup order: for a missing required field, first the field's own schema, then the parent object declaring `required`; for other errors, first the node holding the violated keyword, then the field nodes along the data path. The first match wins.
- The text can reference message parameters such as `{label}`; replacement only changes the message, not the error code or pointer.

## Migration: migrate

Fixes old data with a new schema; the data passed in is not modified, and every changed location is recorded in `changed`.

- Removing undeclared fields: when the object declares `properties`, none of the merged nodes has `patternProperties` `unevaluatedProperties`, and `additionalProperties` is absent or `false`, fields not in `properties` are removed. Otherwise undeclared fields are migrated one by one against the `additionalProperties` / `patternProperties` schema, and those without a corresponding schema are kept as is.
- Adding fields: missing declared properties are added only from explicit defaults (same as the `explicit` strategy).
- On a type mismatch conversion is attempted in the order of the schema's types, and kept on success:

| Target type | Convertible values |
|---|---|
| `string` | Numbers, booleans → `String(value)` |
| `number` | Numbers, non-blank numeric strings |
| `integer` | Same as `number`, then rounded |
| `boolean` | Strings `"true"` `"false"` |
| `array` | Any non-`null` value → single-element array |
| Any non-array type | A single-element array is unwrapped first and then converted by the rules above |

- Values that cannot be kept (conversion failed, not among the enum values, `false` schema): take the `default` when present; optional fields and array elements are removed; required fields take the zero value, or are removed when there is none.
- Union types first match a branch by data; when none matches, conversion to each branch's type is tried in order.
- Constraint violations such as `maxItems` `uniqueItems` `maxLength` are not repaired; call `validate` again after migration.

## Mock: mock

- The same `seed` gives the same result (32-bit mulberry32 PRNG); when omitted, a random seed is used. A `seed` that is not a finite number reports `JOTL4018`.
- After generation `validate` runs automatically, and validation errors are downgraded to warnings attached in `diagnostics`.
- After the same `$ref` has been expanded 3 times along a path only the required parts are generated, and after 8 times it stops with a `JOTL4019` warning; optional recursive references are not expanded up to the limit.
- When no string satisfying a `pattern` can be generated, a `JOTL4019` warning is reported.

## Diagnostic codes

The code table is `DATA_DIAGNOSTICS` in `packages/data/src/diagnostics.ts`; `{label}` in messages is the field label.

| Code | Severity | Source | Meaning |
|---|---|---|---|
| `JOTL4001` | error | validate | Type mismatch |
| `JOTL4002` | error | validate | Missing required field (including `dependentRequired`) |
| `JOTL4003` | error | validate | Outside `minimum` `maximum` `exclusiveMinimum` `exclusiveMaximum` |
| `JOTL4004` | error | validate | String length violates `minLength` `maxLength` |
| `JOTL4005` | error | validate | Does not match `pattern` |
| `JOTL4006` | error | validate | Not among the values of `enum` or a labeled enum |
| `JOTL4007` | error | validate | Array item count violates `minItems` `maxItems` |
| `JOTL4008` | error | validate | Disallowed field (`additionalProperties` `unevaluatedProperties`) |
| `JOTL4009` | error | validate | Does not conform to `format` |
| `JOTL4010` | error | validate | Not a multiple of `multipleOf` |
| `JOTL4011` | error | validate | Duplicate items under `uniqueItems` |
| `JOTL4012` | error | validate | No branch of `anyOf` / `oneOf` matches |
| `JOTL4013` | error | validate | Not equal to `const` |
| `JOTL4014` | error | validate | Property count violates `minProperties` `maxProperties` |
| `JOTL4015` | error | validate | Matches several `oneOf` branches at once |
| `JOTL4016` | warning | getDefaults, fillDefaults, migrate, mock | Unresolvable `$ref`, node treated as having no value |
| `JOTL4017` | error | validate | Schema cannot be compiled; the Ajv original text is in `related` (pointer is the root) |
| `JOTL4018` | error | getDefaults, fillDefaults, validate, mock | Invalid option value (including an `at` pointer that does not exist or does not point to a schema) |
| `JOTL4019` | warning | mock | Cannot generate data satisfying the constraints (reference too deep or `pattern` cannot be generated) |
| `JOTL4020` | error | validate | Decimal places exceed `x-decimals` |
| `JOTL4021` | error | validate | money/bigint `value` outside `x-decimalRange` |
| `JOTL4022` | error | validate | String with `contentMediaType: "application/json"` is not valid JSON |
| `JOTL4023` | error | validate | Parsed JSON text does not match `contentSchema` |
| `JOTL4024` | error | validate | Key name violates `propertyNames` |
| `JOTL4025` | error | validate | String does not match the `x-valueFormat` storage format |
| `JOTL4099` | error | validate | Other validation failures: `not`, `false` schema, `contains`, `unevaluatedItems` and unclassified keywords |

## Known limitations

See "确定不修" (Won't fix) in the root `TODO.md`, including the scope of reference resolution, differences between Ajv and the official test suite, and constraints `migrate` does not repair.
