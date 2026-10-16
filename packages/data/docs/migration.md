# Migrate old data

**English** · [简体中文](../zh/docs/migration.md)

This page shows how `migrate(schema, data, opts?)` repairs data saved under an older schema so it fits the new one. It accepts only the `locale` option; other conventions are in [Call the API](./api.md).

```js
import { migrate } from "@jotl/data";

const schema = {
  type: "object",
  properties: { title: { type: "string" }, count: { type: "integer" } },
  required: ["title", "count"],
};
migrate(schema, { title: 12, count: "3", old: true }).value;
// { data: { title: "12", count: 3 }, changed: ["/title", "/count", "/old"] }
```

The data you pass in is not modified; every changed location is recorded in `changed`.

## Removed and added fields

- Undeclared fields are removed when the object declares `properties`, none of the merged nodes has `patternProperties` or `unevaluatedProperties`, and `additionalProperties` is absent or `false`.
- Otherwise undeclared fields are migrated one by one against the `additionalProperties` or `patternProperties` schema; fields without a matching schema are kept as is.
- Missing declared properties are added only from explicit defaults, as with the `explicit` strategy of [default data](./default-data.md).

## Type conversions

On a type mismatch, conversion is tried in the order of the schema's types, and the first success is kept:

| Target type | Convertible values |
|---|---|
| `string` | Numbers and booleans → `String(value)` |
| `number` | Numbers, non-blank numeric strings |
| `integer` | Same as `number`, then rounded |
| `boolean` | The strings `"true"` and `"false"` |
| `array` | Any non-`null` value → single-item array |
| Any non-array type | A single-item array is unwrapped first, then converted by the rules above |

Union types first match a branch by data; when none matches, conversion to each branch's type is tried in order.

## Values that cannot be kept

A value cannot be kept when conversion fails, when it is not among the enum values, or when its schema is `false`. Then:

1. It takes the `default` when there is one.
2. Otherwise optional fields and array items are removed.
3. Otherwise required fields take the zero value, or are removed when there is none.

`migrate` does not repair constraint violations such as `maxItems`, `uniqueItems` or `maxLength`. Call `validate` after migrating.
