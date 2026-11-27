# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## [0.0.5] - 2026-11-27

- Enum completion suggests `options_from`. Hover help explains how to read local or root arrays and how `{label, value}` entries are displayed and stored. [Enum syntax](../../docs/spec/jotl.md#enums)

## [0.0.4] - 2026-11-06

### Breaking changes

- The language server compiles Jotl conditions using the new `op` group format. Replace the former `and`, `or` and `not` group objects in `.jotl` sources; migrate hand-written `x-ui.visibleIf` conditions to `left` / `op` / `right` leaves and `op` groups ([migration](../core/CHANGELOG.md)).

### Changed

- Object widget hover text uses “nested” terminology to match the form rendering options.
