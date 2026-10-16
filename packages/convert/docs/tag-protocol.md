# Tag protocol

**English** · [简体中文](../zh/docs/tag-protocol.md)

This page is the full mapping between JSON Schema keywords and their TS notation, used by both `schemaToTs` and `tsToSchema`. Read it to hand-write or proofread the JSDoc tags in a Jotl-generated `.d.ts`; for the conversion API see [Convert between JSON Schema and TypeScript](./ts-conversion.md).

## Map keywords to TS notation

| JSON Schema | TS notation |
|---|---|
| `description` | JSDoc body |
| `title` | `@title text` |
| `$comment` | `@privateRemarks text` |
| `type: "integer"` | Type written as `number`, plus `@asType integer` (omitted when the node is an enum or const) |
| `minLength` `maxLength` `minimum` `maximum` `exclusiveMinimum` `exclusiveMaximum` `multipleOf` `minItems` `maxItems` `minProperties` `maxProperties` | Same-named tag, value is a number |
| `format` `contentMediaType` `contentEncoding` | Same-named tag, value is text |
| `pattern` | `@pattern`, value is a regex |
| `uniqueItems: true` `writeOnly: true` | `@uniqueItems` `@writeOnly` (modifier tags, no value) |
| `readOnly: true` | `@readonly` |
| `deprecated: true` (+ `x-deprecatedReason`) | `@deprecated reason`; without a reason the default text is written, `已弃用.` under `zh-CN` and `Deprecated.` under `en`; either text produces no `x-deprecatedReason` when read back |
| `default` | `@defaultValue JSON` |
| `examples` | One `@example JSON` per example |
| Labeled enum `oneOf: [{ const, title }]` | Type is a literal union, plus an `@enumTitles` JSON object (keys are member values: strings as themselves, others as JSON text); when array elements are enums it goes on the array property |
| `description` of enum members | `@enumDescriptions` JSON object, keys as in `@enumTitles` |
| `allOf` whose items each contain only `$ref` | Intersection type `X & Y & rest`, e.g. a discriminated union branch `X & { kind: "x" }`; with no rest and only one reference, `X & unknown` |
| `title` of discriminated union branches | `@branchTitles` JSON array in branch order, `null` for branches without `title`; output only when the union node can carry a comment |
| Both `properties` and `additionalProperties` | Index signature written as `(extra type) \| property types...`, with `undefined` added for optional properties; only the extra type in parentheses is read back |
| `x-valueFormat` (storage format of date components) | `@valueFormat format`, value is text |
| The type pointed to by the root `$ref` differs from the default export | `@root` on the root type's comment (modifier tag, no value) |
| Root `$id` (only on the root type) | `@id URI`, value is text |
| Root `x-ui.rules` (only on the root type) | `@rules rule array`, value is JSON |
| Root `x-ui.widgets` (widget modules, only on the root type) | `@widgets module map`, value is a JSON object |
| `x-ui` | `@widget name` when it has only `widget`, otherwise `` @ui `{...}` `` |
| `x-ui` of array elements | Written on the array property: `@itemWidget name` when it has only `widget`, otherwise `` @itemUi `{...}` ``; the n-th tag applies to the n-th level of elements (`items`, `items.items`...), and skipped levels are written as `` @itemUi `{}` `` |
| `errorMessage` | `@errorMessage JSON` (string or object) |

Tags follow the keyword order of normalization rule 7 in the [Jotl syntax spec](../../../docs/spec/jotl.md).

## Know what is dropped

Keywords without a place in the table are dropped with a `JOTL2002` warning; the output is otherwise unaffected.

- Element-level constraints and annotations (such as `maxLength` on array elements) have no place to attach a comment, except `x-ui` of array elements. They are dropped in non-typia mode; typia mode can express them.
- The Jotl extension keywords `x-decimals` `x-decimalRange`, as well as `contentSchema`, `propertyNames` and `allOf` with non-reference members, have no notation.
- Fixed shapes the compiler generates for built-in components are not reported: `additionalProperties: false`, `x-decimalRange` and `x-decimals` on `money` / `bigint` value objects (`properties.type` is the `money` or `bigint` constant), and `title` of discriminated union branches in places that cannot carry comments (such as array elements and union branches).

## Write root-level tags

Document-level information goes on the root type's comment. The root type is the declaration with `@root`, or the default export when there is none.

- The root `$id` and root `x-ui.rules` are written as `@id` and `@rules`; root `x-ui.widgets` likewise as `@widgets`. An `x-ui` on the root that contains only `version` and `rules` is document-level.
- Without a root type they are dropped with `JOTL2002`.
- Writing `@root`, `@id` or `@rules` outside the root type reports `JOTL2115`.
- With a root type, `tsToSchema` writes `x-ui: { version: 1 }` and any `rules` it reads onto the root, consistent with the compiler.

## Encode tag values

- Text values (body, `@title` etc.): TSDoc syntax characters (backslash, `@`, `{`, `}`, `<`, `>` and backtick) are escaped with a preceding backslash, and `*/` is written as `*\/`.
- JSON values: objects, and values containing TSDoc syntax characters or backslashes, are wrapped in backticks; others are written as plain JSON (e.g. `"欢迎"` `1`).
- Regexes: written in backticks. When a regex contains backticks, newlines or `*/`, starts with a quote, has leading or trailing whitespace, or is empty, it is written as a JSON string in backticks instead.
- Examples: objects, and arrays containing objects, are written as `json` code blocks.

## Hand-written input that tsToSchema also accepts

`tsToSchema` reads more than `schemaToTs` writes, and reports anything it cannot use.

- Aliases `@default` `@readOnly` `@examples` `@comment` `@description`; tag names are case-insensitive.
- Backticks around JSON values may be omitted.
- Values that are not valid JSON are treated as strings with a `JOTL2113` warning.
- TSDoc standard tags (such as `@remarks` `@see`) are silently ignored; unknown tags report a `JOTL2114` warning.
- Tags used on inapplicable types report a `JOTL2115` warning.
- `@asType` only accepts `integer`; other values report a `JOTL2118` warning.
