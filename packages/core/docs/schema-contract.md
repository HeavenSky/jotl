# Use the schema contract

**English** · [简体中文](../zh/docs/schema-contract.md)

This page shows which shared types and helpers to use when your code reads or writes Jotl schemas: JSON Schema documents, the `x-ui` keyword, date storage formats, and the data capability interfaces. This part of `@jotl/core` has no runtime dependencies.

## Traverse JSON Schema documents

- `JsonSchema`, `JsonSchemaObject`, `JsonSchemaType` and `JsonValue` type 2020-12 documents; `JsonSchema` includes boolean schemas, and `isSchemaObject` narrows to the object form.
- `JSON_SCHEMA_DIALECT` is `"https://json-schema.org/draft/2020-12/schema"`.
- `SUBSCHEMA_KEYWORDS` lists the keywords that hold subschemas, in three groups by shape:

  ```ts
  {
    single: ["additionalProperties", "items", "contains", "propertyNames", "not", "if", "then", "else", "unevaluatedItems", "unevaluatedProperties", "contentSchema"],
    array: ["prefixItems", "allOf", "anyOf", "oneOf"],
    map: ["properties", "patternProperties", "$defs", "dependentSchemas"],
  }
  ```

- `orderKeywords(schema)` reorders keywords by normalization rule 7 of the [Jotl syntax specification](../../../docs/spec/jotl.md), recurses into subschemas, and returns a new object. For example, `{ type: "string", title: "T", maxLength: 1 }` becomes `{ title: "T", type: "string", maxLength: 1 }`.

## Read and validate x-ui

- `XUi` and its subtypes, `XUiWidgetModule`, `DEFAULT_SCENE` and `DEFAULT_GRID_COLUMNS` (exported from `src/schema/x-ui.ts`) are the types and defaults of the `x-ui` keyword. Their semantics are defined in the [`x-ui` specification](../../../docs/spec/x-ui.md).
- `xUiMetaSchema` is the 2020-12 meta-schema of `x-ui`. It forbids unknown fields; use it for validation and editor completion.

## Check date storage formats

`x-valueFormat` stores the value of a date component in a custom format. These exports share its rules across packages:

- `DEFAULT_VALUE_FORMATS`: the default format per component: `date` → `YYYY-MM-DD`, `time` → `HH:mm:ss`, `datetime` → `iso`.
- `VALUE_FORMAT_ALIASES` (`iso`, `iso-x`, `utc`, `utc-x`) with `isValueFormatAlias`, and `TIMESTAMP_VALUE_FORMATS` (`x`, `X`) with `isTimestampValueFormat`.
- `valueFormatComponent(format)` infers the component (type `TemporalComponent`) when there is no `x-ui.widget`: timestamps, aliases, and formats with both date and time tokens mean `datetime`; formats with only time tokens mean `time`; everything else means `date`. For example, `valueFormatComponent("HH:mm")` returns `"time"`.

To check a value without dayjs, use `matchesValueFormat(format, value)`, `matchesValueFormatText(format, text)` and `isRfc3339DateTime(text)`. Their conclusions match `@jotl/data`:

- Timestamps only need to be integers; aliases follow RFC 3339.
- Format strings match strictly position by position and validate calendar dates: `matchesValueFormat("YYYY-MM-DD", "2024-02-30")` is `false`.
- Only the tokens `YYYY MM DD HH mm ss SSS Z ZZ A a` and `[..]` escapes are supported. With any other token, `matchesValueFormatText` returns `undefined` and `matchesValueFormat` returns `true`, meaning "not determined".

## Implement or inject data capabilities

`DataApi`, `GetDefaults`, `FillDefaults`, `Validate`, `Migrate`, `Mock`, `DefaultsOptions` and `MockOptions` type the data capability interfaces, so your code can depend on the interface instead of a concrete package. `DEFAULT_DEFAULTS_OPTIONS` holds the default options: `strategy: "explicit"`, `arrayItems: "minItems"`, `oneOf: "firstWithDefault"`, `maxDepth: 3`.

The standard implementation is `@jotl/data`; its behavior is described in the [`@jotl/data` guides](../../data/docs/README.md).
