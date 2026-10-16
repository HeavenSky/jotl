# Generate mock data

**English** · [简体中文](../zh/docs/mock.md)

This page shows how to produce test data that satisfies a schema with `mock(schema, opts?)`. It accepts `seed` and `locale`; other conventions are in [Call the API](./api.md).

```js
import { mock } from "@jotl/data";

const schema = {
  type: "object",
  properties: {
    e: { type: "string", format: "email" },
    c: { type: "string", format: "color" },
    p: { type: "string", pattern: "^[A-Z]{3}-[0-9]{2}$" },
  },
  required: ["e", "c", "p"],
};
mock(schema, { seed: 2 }).value; // { e: "hnwqmj@example.com", c: "#1c36d9", p: "JZB-11" }
```

- The same `seed` gives the same result (32-bit mulberry32 PRNG). Without `seed` a random one is used. A `seed` that is not a finite number reports `JOTL4018`.
- The output is validated automatically; validation errors are downgraded to warnings and attached in `diagnostics`.
- After the same `$ref` has been expanded 3 times along a path, only the required parts are generated; after 8 times generation stops with a `JOTL4019` warning. Optional recursive references are not expanded up to the limit.
- When no string can be generated for a `pattern`, a `JOTL4019` warning is reported.
- Dates: a random moment between 2000 and 2030, written in the field's format.
- JSON text (`contentMediaType: "application/json"`): data generated from `contentSchema`, then serialized.
- The `value` of money and bigint objects follows the same rules as [zero values](./default-data.md#know-what-zero-values-look-like).
