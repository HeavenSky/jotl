# Known limitations

**English** · [简体中文](../zh/docs/known-limitations.md)

This page lists where compiling and printing do not do what you might expect, and how to work around each case when a workaround exists.

## Some schemas do not round-trip through print

`print` keeps a schema deeply equal on the way back only when Jotl can express it. These shapes print, but compiling the output gives a different schema:

- `allOf` is merged into one object only when every member is a `$ref` to an object type that holds nothing but `type`, `properties`, `required`, `title`, `description`, `$comment` and `examples`, and no property name appears twice. Any other `allOf` makes the whole node print as `any[schema: {...}]`.
- `anyOf` made of constants plus one open branch of the same type, such as `anyOf: [{ const: "a" }, { type: "string" }]`, prints as that type. The constants go into `examples` unless the node already has `examples`, and the `title` and `description` of each constant branch are lost.
- When an extension component is registered with base `'integer'`, a node `{ type: "integer", "x-ui": { widget: "Rating" } }` without bounds prints as `integer[widget: 'Rating']`. Compiling that adds the safe-integer bounds of `integer` (`minimum: -9007199254740991`, `maximum: 9007199254740991`). Write explicit `minimum` and `maximum` in the schema to keep it stable.

See [Print a schema as Jotl](compile-and-print.md#print-a-schema-as-jotl) for how the rest of the input is mapped.

## Very deep JSON is rejected before printing

`print` checks the depth of the input first and fails with `JOTL1029` ("Nesting depth exceeds the limit of 256") when the JSON is nested deeper than 1024 levels. One Jotl level takes several JSON levels, so 1024 is a conservative estimate of the 256-level Jotl limit: rarely, a document that would print within the limit is rejected. Move deep subschemas into `$defs` and reference them with `$ref` to reduce the depth.

## Some date formats are not checked at compile time

The compiler checks `default` against the `value_format` of `date`, `time` and `datetime` only when the format uses the tokens `YYYY MM DD HH mm ss SSS Z ZZ A a` and `[..]` escapes. With any other dayjs token, such as `Do` or `Q`, the value passes compilation unchecked; `validate` of [`@jotl/data`](../../data/README.md) still checks it at run time. See [Check date storage formats](schema-contract.md#check-date-storage-formats).

## Base types of lowercase widget names are not used

In `jotl.config.json`, names that are not PascalCase register only a widget name. The base type written for them is checked for syntax only: the compiler does not use it, and nothing checks that the widget fits the field it is used on. Use a PascalCase name when you want the base type to apply, see [Load jotl.config.json](extension-components.md#load-jotlconfigjson).
