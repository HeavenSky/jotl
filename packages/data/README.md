# @jotl/data

**English** · [简体中文](./zh/README.md)

Generate defaults, validate, migrate and mock data from a JSON Schema 2020-12, with errors that name the field and say what is wrong.

`@jotl/data` is for apps and tools whose forms, configs or payloads are described by JSON Schema: it fills in initial data, checks user input, repairs data saved under an older schema, and produces test data. `@jotl/form` and the `jotl validate` and `jotl defaults` commands use it for the same work.

Compared with calling Ajv directly, each violation becomes one diagnostic with a stable code, a pointer into the data, and a message built from the field's `title`, in English or Chinese. Failed `anyOf` / `oneOf` branches do not flood the output, and `errorMessage` replaces any message you want to word yourself. Defaults, migration and mock data come from the same package, so one dependency covers the whole life of your data.

## One schema, four jobs

```js
import { getDefaults, migrate, validate } from "@jotl/data";

const schema = {
  type: "object",
  properties: {
    title: { type: "string", title: "Title", maxLength: 5, default: "Home" },
    count: { type: "integer", minimum: 1 },
    color: { type: "string", format: "color", errorMessage: "Use a hex color" },
  },
  required: ["title", "count"],
};

console.log(getDefaults(schema, { strategy: "required" }).value);
for (const d of validate(schema, { title: 1, count: 0, color: "red" }).diagnostics) {
  console.log(d.code, d.location?.pointer, d.message);
}
console.log(migrate(schema, { title: 12, count: "3", old: true }).value);
```

Output:

```text
{ title: 'Home', count: 1 }
JOTL4001 /title Title should be of type string
JOTL4003 /count count is out of range: should be at least 1
JOTL4009 /color Use a hex color
{
  data: { title: '12', count: 3 },
  changed: [ '/title', '/count', '/old' ]
}
```

`mock(schema, { seed: 1 })` adds the fourth job: data that satisfies the schema, identical on every run with the same seed.

## Validate your first object

The package is ESM only, so the script uses the `.mjs` extension.

1. Install the package:

   ```sh
   pnpm add @jotl/data
   ```

2. Save this as `check.mjs`:

   ```js
   import { validate } from "@jotl/data";

   const schema = {
     type: "object",
     properties: { email: { type: "string", title: "Email", format: "email" } },
     required: ["email"],
   };
   for (const d of validate(schema, { email: "not-an-email" }).diagnostics) {
     console.log(d.code, d.location?.pointer, d.message);
   }
   ```

3. Run it and see `JOTL4009 /email Email is not a valid email address`:

   ```sh
   node check.mjs
   ```

## What you get

- **One readable error per violation.** A type mismatch hides other errors at the same place, a failed union reports one `JOTL4012` with the likely reason, and identical errors are merged.
- Defaults at the level you need: only explicit `default` values, every required field, or every field; `fillDefaults` completes existing data without overwriting anything.
- Safe migration of old data: undeclared fields are removed, mismatched types are converted where possible, and every change is listed as a pointer.
- Reproducible mock data: a seeded generator that respects formats, patterns and recursion limits, and validates its own output.
- Never throws and never mutates input: every function returns `{ value, diagnostics }` from `@jotl/core`, and messages follow the global language or a per-call `locale`.

## When to use something else

`@jotl/data` speaks only the JSON Schema 2020-12 dialect, and a schema with unknown keywords that do not start with `x-` fails with `JOTL4017`. Upgrade older drafts and OpenAPI schemas with [`@jotl/convert`](../convert/README.md) first. If you need Ajv's raw error objects or your own custom keywords, use Ajv directly.

## Further reading

- [Guides](./docs/README.md): call conventions, default data, validation, migration, mock data, diagnostic codes
- [`@jotl/core`](../core/README.md) for `Result`, diagnostics and the data capability interfaces
- Known limitations, such as the scope of reference resolution and differences between Ajv and the official test suite: the "确定不修" (Won't fix) section of [TODO.md](../../TODO.md)

## License

MIT, see [LICENSE](../../LICENSE).
