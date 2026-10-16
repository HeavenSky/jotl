# Validate data

**English** · [简体中文](../zh/docs/validation.md)

This page shows what `validate` checks, which errors it reports, and how to word the messages yourself. Conventions shared by all functions, including `locale` and `at`, are in [Call the API](./api.md); the meaning of each code is in [Diagnostic codes](./diagnostic-codes.md).

## Read validation errors

```js
import { validate } from "@jotl/data";

const schema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 3, errorMessage: { maxLength: "At most 3 characters" } },
    items: { type: "array", items: { type: "integer" } },
  },
  required: ["name"],
};
validate(schema, { name: "abcd", items: [1, "x"] });
// value: { valid: false }
// diagnostics: JOTL4004 /name    "At most 3 characters"
//              JOTL4001 /items/1 "item 2 of items should be of type integer"
validate(schema, {}).diagnostics; // JOTL4002 /name "Missing required field name"
```

- `location.pointer` is a JSON Pointer into the data. Missing required fields (`JOTL4002`) and disallowed fields (`JOTL4008`) point to the field itself, not to the parent object.
- Field labels in messages: the field's own `title`; otherwise "item N of parent label" (`en`) or "父标签的第 N 项" (`zh-CN`) for array items, and the key name for the rest. The root is "data" or "数据".

## Know what is checked

- The validator uses the Ajv 2020 dialect with `allErrors` enabled. Field presence is decided by own properties only, so a missing field named like a prototype property, such as `constructor`, is still reported as required.
- Formats: every format of `ajv-formats`, plus `color`: a CSS hexadecimal color `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`, matched by `COLOR_PATTERN`.
- Keywords: `x-ui`, `x-deprecatedReason` and `errorMessage` are known; other keywords starting with `x-` are registered as annotations. Unknown keywords that do not start with `x-` make the schema fail to compile.

Jotl extension keywords are checked too:

- `x-decimals: n`: a number or integer has at most `n` decimal places, with exponent forms counted after expansion. Violations report `JOTL4020`.
- `x-decimalRange` on money and bigint objects compares `value` as an exact decimal. Violations report `JOTL4021` on the object; an invalid `value` itself reports only the pattern error.
- Strings with `contentMediaType: "application/json"` must pass `JSON.parse` (`JOTL4022`). With `contentSchema`, the parsed result is validated against it, and a mismatch reports one `JOTL4023` on that string field.
- `propertyNames`, the key constraint of maps, reports `JOTL4024` on the object.
- `x-valueFormat`, the storage format of date components: dayjs format strings are parsed strictly with `customParseFormat`; with a `Z` token any offset is accepted and compared using the original offset. Timestamps `x` and `X` only need to be integers. The aliases `iso`, `iso-x`, `utc` and `utc-x` accept any valid RFC 3339 date-time; together with `format: date-time`, only `format` reports the error. Mismatches report `JOTL4025`, and `errorMessage` can override the text through the keyword `x-valueFormat`.

When the schema cannot be compiled, for example because of an unknown keyword or an unresolvable reference, `validate` returns `JOTL4017` and `value` is `undefined`.

Compiled validators are cached by schema object identity. If you modify a schema object in place, it is not recompiled; pass a new object instead.

## Get one error per problem

- On a type mismatch (`JOTL4001`), no other constraints at the same location are reported.
- When all `anyOf` branches or all `oneOf` branches fail, only `JOTL4012` is reported; a labeled enum (the `const` branches of `oneOf`) that does not match reports only `JOTL4006`. Errors inside the branches are not reported. When the same `$defs` entry is also referenced outside the combinator, errors there are reported as usual.
- Matching several `oneOf` branches at once reports `JOTL4015`.
- A failing `if` is not reported itself; only the concrete errors in `then` or `else` are.
- Errors with the same code, pointer and message are kept once.

`JOTL4012` carries a reason:

- When a discriminator field is missing or its value is not among the branches, the allowed values are listed.
- Otherwise the branch is chosen by the data's JSON type, and its first error is given; errors on the value itself are written as `{label} {reason}`.
- When no branch matches the type, the allowed types are listed.

The last two are assertions only in `validate`; the official test suite still measures them as annotations.

## Word messages yourself

`errorMessage` replaces default messages. In Jotl it is the metadata `errorMessage: ...`, for example `string[errorMessage: {maxLength: 'At most 20 characters'}]`; see the [Jotl syntax specification](../../../docs/spec/jotl.md).

- A string replaces the messages of all errors on that node.
- An object is keyed by keyword name, such as `maxLength` or `required`, and replaces only errors of that keyword; other errors keep the default text.
- Lookup order: for a missing required field, the field's own schema first, then the parent object that declares `required`. For other errors, the node holding the violated keyword first, then the field nodes along the data path. The first match wins.
- The text can use message parameters such as `{label}`. Replacement changes only the message, not the code or the pointer.
