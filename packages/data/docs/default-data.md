# Generate default data

**English** · [简体中文](../zh/docs/default-data.md)

This page shows how to produce initial data from a schema with `getDefaults`, and how to complete partial data with `fillDefaults`. Conventions shared by all functions, including `locale` and `at`, are in [Call the API](./api.md).

## Choose a strategy

```js
import { getDefaults } from "@jotl/data";

const schema = {
	type: "object",
	properties: {
		title: { type: "string", maxLength: 5, default: "Home" },
		count: { type: "integer", minimum: 1 },
		color: { type: "string", format: "color" },
		tags: { type: "array", minItems: 1, items: { type: "string" } },
	},
	required: ["title", "count"],
};

getDefaults(schema).value; // { title: "Home" }
getDefaults(schema, { strategy: "required" }).value; // { title: "Home", count: 1 }
getDefaults(schema, { strategy: "all" }).value; // { title: "Home", count: 1, color: "", tags: [""] }
```

A node that has a `default`, directly or through a node merged via `$ref` or `allOf`, always gets a copy of that `default`. Otherwise the strategy decides:

| Node   | `explicit` (default)                                                                          | `required`                                                                                                                                                                                                      | `all`                                       |
| ------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Object | Only properties that produce a value; if none, the root is `{}` and other objects are omitted | Required properties are produced recursively; optional properties take only explicit defaults. When an optional object appears because a child has a default, its required fields are filled too. At least `{}` | All properties produced recursively         |
| Array  | Omitted, even if its items have defaults                                                      | When required, `minItems` items, using zero values for items without a value                                                                                                                                    | Same as `required`, and optional arrays too |
| Scalar | Omitted                                                                                       | Zero value when required                                                                                                                                                                                        | Zero value                                  |

## Set the other options

Options are `DefaultsOptions` of `@jotl/core`; their defaults are `DEFAULT_DEFAULTS_OPTIONS`: `strategy: "explicit"`, `arrayItems: "minItems"`, `oneOf: "firstWithDefault"`, `maxDepth: 3`. An invalid option value reports `JOTL4018`, and `value` is `undefined`.

- `arrayItems: "none"` makes every array that needs generating an empty array.
- `oneOf` applies to `anyOf` and `oneOf`, except labeled enums. `"firstWithDefault"` takes the first branch that produces a value, or the first branch if none does; `"first"` always takes the first branch.
- `maxDepth` limits how many times the same `$ref` target is expanded along the current path; it is not the nesting depth of the data. Once reached, that reference is not expanded and the node is treated as having no value. For example, a required recursive `Node.child` with the default `3` produces `{ name, child: { name, child: { name } } }`.

An unresolvable `$ref` reports a `JOTL4016` warning, and the node is treated as having no value.

## Know what zero values look like

Zero values fill required fields that have no default:

- Enums and `const`: the first allowed value.
- Strings `""`, numbers and integers `minimum` (or `0` without one), booleans `false`, `null`, objects `{}`, arrays `[]`.
- Strings with `x-valueFormat`: local `2000-01-01 00:00:00` written in that format; timestamp integers stay `0`.
- Strings with `format: "date"`, `"time"` or `"date-time"` and no `x-valueFormat`: the same moment as `2000-01-01`, `00:00:00±HH:mm`, or RFC 3339 with the local offset.
- The `value` of money and bigint objects (recognized by `properties.type.const`): a value that satisfies the decimal places of its pattern and `x-decimalRange`, trying `"0"`, `minimum`, `maximum`, `exclusiveMinimum` + 1 and `exclusiveMaximum` - 1 in order and padding decimal places. An unconstrained currency takes `CNY`.
- JSON text (`contentMediaType: "application/json"`): the serialized default data of `contentSchema`, or `"{}"` without `contentSchema`.

Apart from these cases, zero values ignore constraints such as `format`, `minLength` and `pattern`, so the result is not guaranteed to pass `validate`.

## Complete existing data

`fillDefaults(schema, data, opts?)` takes the same options as `getDefaults` except `at`, and never overwrites existing values.

```js
import { fillDefaults } from "@jotl/data";

const schema = {
	type: "object",
	properties: { title: { type: "string", default: "Home" }, count: { type: "integer" } },
};
fillDefaults(schema, { count: 2 }).value; // { data: { count: 2, title: "Home" }, filled: ["/title"] }
```

- Values are produced only for missing declared properties. Existing fields, including `null` and empty strings, are kept and filled further down.
- Arrays are filled item by item; no items are added or removed.
- A missing subtree is produced as a whole by the strategy, and `filled` records only the pointer of the subtree root.
- For union types, one branch is chosen by the data's type and field overlap.
- When `data` is `undefined`, the call equals `getDefaults`, and `filled` is `[""]` when a value was produced.
