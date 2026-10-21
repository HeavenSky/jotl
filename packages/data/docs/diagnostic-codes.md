# Diagnostic codes

**English** · [简体中文](../zh/docs/diagnostic-codes.md)

This page lists every `JOTL4xxx` code that `@jotl/data` reports, with its severity, the functions that report it, and its meaning. The code table is `DATA_DIAGNOSTICS` in `packages/data/src/diagnostics.ts`; `{label}` in its messages is the field label described in [Validate data](./validation.md#read-validation-errors).

| Code       | Severity | Reported by                               | Meaning                                                                                                       |
| ---------- | -------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `JOTL4001` | error    | validate                                  | Type mismatch                                                                                                 |
| `JOTL4002` | error    | validate                                  | Missing required field (including `dependentRequired`)                                                        |
| `JOTL4003` | error    | validate                                  | Outside `minimum`, `maximum`, `exclusiveMinimum` or `exclusiveMaximum`                                        |
| `JOTL4004` | error    | validate                                  | String length violates `minLength` or `maxLength`                                                             |
| `JOTL4005` | error    | validate                                  | Does not match `pattern`                                                                                      |
| `JOTL4006` | error    | validate                                  | Not among the values of `enum` or a labeled enum                                                              |
| `JOTL4007` | error    | validate                                  | Item count violates `minItems` or `maxItems`                                                                  |
| `JOTL4008` | error    | validate                                  | Disallowed field (`additionalProperties`, `unevaluatedProperties`)                                            |
| `JOTL4009` | error    | validate                                  | Does not conform to `format`                                                                                  |
| `JOTL4010` | error    | validate                                  | Not a multiple of `multipleOf`                                                                                |
| `JOTL4011` | error    | validate                                  | Duplicate items under `uniqueItems`                                                                           |
| `JOTL4012` | error    | validate                                  | No branch of `anyOf` / `oneOf` matches                                                                        |
| `JOTL4013` | error    | validate                                  | Not equal to `const`                                                                                          |
| `JOTL4014` | error    | validate                                  | Property count violates `minProperties` or `maxProperties`                                                    |
| `JOTL4015` | error    | validate                                  | Matches several `oneOf` branches at once                                                                      |
| `JOTL4016` | warning  | getDefaults, fillDefaults, migrate, mock  | Unresolvable `$ref`; the node is treated as having no value                                                   |
| `JOTL4017` | error    | validate                                  | The schema cannot be compiled; the original Ajv text is in `related`, with the root as pointer                |
| `JOTL4018` | error    | getDefaults, fillDefaults, validate, mock | Invalid option value, including an `at` pointer that does not exist or does not point to a schema             |
| `JOTL4019` | warning  | mock                                      | Cannot generate data that satisfies the constraints (reference too deep, or `pattern` cannot be generated)    |
| `JOTL4020` | error    | validate                                  | Decimal places exceed `x-decimals`                                                                            |
| `JOTL4021` | error    | validate                                  | The `value` of a money or bigint object is outside `x-decimalRange`                                           |
| `JOTL4022` | error    | validate                                  | A string with `contentMediaType: "application/json"` is not valid JSON                                        |
| `JOTL4023` | error    | validate                                  | Parsed JSON text does not match `contentSchema`                                                               |
| `JOTL4024` | error    | validate                                  | A key violates `propertyNames`                                                                                |
| `JOTL4025` | error    | validate                                  | A string does not match its `x-valueFormat` storage format                                                    |
| `JOTL4099` | error    | validate                                  | Other validation failures: `not`, a `false` schema, `contains`, `unevaluatedItems`, and unclassified keywords |
