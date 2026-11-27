# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

Entries follow repository release versions rather than the private application's package version.

## [0.0.6] - 2026-11-27

- Preview data-driven enums by editing their source array in the form. A label change updates the visible option while the submitted value keeps its original type. [Example](../../docs/spec/jotl.md#enums)

## [0.0.4] - 2026-11-06

### Breaking changes

- Jotl and JSON Schema input use the new visibility condition format. Update existing condition groups and hand-written `x-ui.visibleIf` leaves before loading them ([migration](../../packages/core/CHANGELOG.md)).

### Added

- Paste fengdie DSL schema or Fengdie `toJson` output to preview the migrated form, then copy the generated source from the “Migrated Jotl” tab ([guide](README.md)).

### Changed

- Form previews use consistent entry-row titles, summaries and collapsible-panel styles.

### Fixed

- Jotl types named `Object`, `String` or another Fengdie keyword correctly enter the Jotl compiler.
- Replacing preview data clears union-branch values cached for the previous record; branch migration and subschema validation include the fixes from `@jotl/data` ([details](../../packages/data/CHANGELOG.md)).
