# Known limitations

**English** · [简体中文](../zh/docs/known-limitations.md)

This page lists where validation, default data, Mock data and migration differ from the JSON Schema specification or from what you might expect, and how to work around each case when a workaround exists.

## Some formats fail to compile or are checked loosely

A schema with `format` set to `idn-email`, `idn-hostname`, `iri` or `iri-reference` cannot be compiled, and `validate` returns `JOTL4017`. Use `email`, `hostname` or `uri`, or a `pattern`, instead.

For `email`, `hostname`, `date-time`, `time`, `duration`, `uri`, `uri-reference`, `uri-template` and `uuid`, `ajv-formats` accepts or rejects some edge cases differently from the official JSON Schema test suite. The formats in use are listed in [Know what is checked](validation.md#know-what-is-checked).

## Some keywords differ from the official test suite

Validation runs on Ajv's 2020-12 dialect, whose results differ from the official test suite in these cases:

- `$dynamicRef`
- `unevaluatedProperties` and `unevaluatedItems` combined with `contains` or `if`
- An empty `enum`
- `$vocabulary`
- Properties named `__proto__`

Jotl syntax has no notation for most of these; they usually appear in hand-written schemas or in keywords passed through the `schema` metadata.

## Reference resolution in default data, Mock data and messages is simplified

- When the same JavaScript object is reused under several `$id` resources, the `$ref`s inside it resolve against the base of whichever resource is reached first. Give each resource its own copy, for example with `structuredClone`, when the bases differ.
- `$dynamicRef` is resolved as a plain `$ref`.

## migrate leaves constraint violations in place

`migrate` does not repair values that break `maxItems`, `uniqueItems`, `maxLength` and similar constraints, or `format`, because truncating or rewriting them would lose data. Call `validate` after migrating and fix what it reports, see [Values that cannot be kept](migration.md#values-that-cannot-be-kept).
