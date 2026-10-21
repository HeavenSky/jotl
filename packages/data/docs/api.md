# Call the API

**English** · [简体中文](../zh/docs/api.md)

This page covers the conventions every `@jotl/data` function follows: what it returns, which language it uses, and how to work on part of a document. It assumes `@jotl/data` is installed, as in [Quick start](../README.md#validate-your-first-object).

## Functions and results

Every function returns the `Result` of `@jotl/core`, never throws, and does not modify the schema or data you pass in. How to read a `Result` is described in [Handle results and diagnostics](../../core/docs/diagnostics.md).

| Function                            | Returns in `value`                                                  | Guide                                      |
| ----------------------------------- | ------------------------------------------------------------------- | ------------------------------------------ |
| `getDefaults(schema, opts?)`        | Default data                                                        | [Generate default data](./default-data.md) |
| `fillDefaults(schema, data, opts?)` | `{ data, filled }`: completed data and the filled pointers          | [Generate default data](./default-data.md) |
| `validate(schema, data, opts?)`     | `{ valid }`; errors are diagnostics with `location.kind: "pointer"` | [Validate data](./validation.md)           |
| `migrate(schema, data, opts?)`      | `{ data, changed }`: repaired data and the changed pointers         | [Migrate old data](./migration.md)         |
| `mock(schema, opts?)`               | Data that satisfies the schema                                      | [Generate mock data](./mock.md)            |

`dataApi` bundles these five functions as a `DataApi` of `@jotl/core`, for code that takes the implementation as a parameter.

Other exports:

- `DATA_DIAGNOSTICS` and `dataDiagnostic`: the code table (with English `en` templates) and its diagnostic factory.
- `DATA_TEXT`, `DATA_TEXT_EN`, `dataText()` and the type `DataText`: the Chinese and English fragments spliced into messages, such as labels and type names; `dataText()` returns the set for the current global language.
- `COLOR_PATTERN`: the regular expression of the `color` format.

## Set the language

The option `locale` (`"zh-CN"` or `"en"`, type `LocaleOptions`) sets the language of the diagnostics and messages of that call only. Without it, the global `getLocale()` of `@jotl/core` applies, which defaults to `en`.

```js
import { validate } from "@jotl/data";

const schema = { type: "object", properties: { title: { type: "string", title: "Title" } } };
validate(schema, { title: 1 }, { locale: "zh-CN" }).diagnostics[0].message; // "Title 的类型应为字符串"
```

## Work on part of a document

`getDefaults` and `validate` accept the option `at` (type `SubschemaOptions`, `{ at?: JsonPointer | JsonSchema }`) to compute defaults or validate against one subschema of a larger document.

```js
import { getDefaults, validate } from "@jotl/data";

const doc = {
	$defs: {
		Address: {
			type: "object",
			properties: {
				city: { type: "string", title: "City", default: "Paris" },
				zip: { type: "string", pattern: "^[0-9]{5}$" },
			},
			required: ["city"],
		},
	},
};
getDefaults(doc, { at: "/$defs/Address" }).value; // { city: "Paris" }
validate(doc, { city: 1, zip: "x" }, { at: "/$defs/Address" }).diagnostics.map(
	d => d.location.pointer
); // ["/city", "/zip"]
```

- A JSON pointer selects the subschema at that location. A schema value is used as is, for example an effective schema you synthesized from a document node.
- In both forms, references are resolved against the whole document with the same rules as without `at`.
- The data root sits at the subschema: pointers and labels of validation errors are relative to it, and the root label is "data" (`en`) or "数据" (`zh-CN`).
- A pointer that does not exist or does not point to a schema reports `JOTL4018`.
- `$id` and `$schema` carried by the subschema itself are ignored during validation.
