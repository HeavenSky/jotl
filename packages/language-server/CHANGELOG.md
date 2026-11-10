# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## [0.0.4] - 2026-11-06

### Breaking changes

- The language server compiles Jotl conditions using the new `op` group format. Replace the former `and`, `or` and `not` group objects in `.jotl` sources; migrate hand-written `x-ui.visibleIf` conditions to `left` / `op` / `right` leaves and `op` groups ([migration](../core/CHANGELOG.md)).

### Changed

- Object widget hover text uses “nested” terminology to match the form rendering options.
