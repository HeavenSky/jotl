# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## [0.0.5] - 2026-11-27

- Validate `x-enumFrom` selections against the current source array. Validation compares typed values, including the `value` of labeled options, and reports `JOTL4006` at the field or failing array item. [Enum validation](../../docs/spec/jotl.md#enums)

## [0.0.4] - 2026-11-06

### Fixed

- Data migration keeps common fields and constraints when selecting a union branch, uses discriminator values to choose the branch, and repairs an ordinary enum field without discarding the rest of the object.
- Defaults and migration combine declarations that apply to the same property or array item.
- Subschema validation preserves nested `$id` and `$anchor` scopes and correctly locates property names containing literal `%` sequences.
