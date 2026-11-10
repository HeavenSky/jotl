# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## [0.0.4] - 2026-11-06

### Fixed

- Data migration keeps common fields and constraints when selecting a union branch, uses discriminator values to choose the branch, and repairs an ordinary enum field without discarding the rest of the object.
- Defaults and migration combine declarations that apply to the same property or array item.
- Subschema validation preserves nested `$id` and `$anchor` scopes and correctly locates property names containing literal `%` sequences.
