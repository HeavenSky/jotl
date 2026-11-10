# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## [0.0.4] - 2026-11-06

### Breaking changes

- Compilation and schema printing follow the new condition format. Update `root_if`, `node_if` and hand-written `x-ui.visibleIf` groups before compiling or printing existing schemas ([migration](../core/CHANGELOG.md)).

### Changed

- `migrate-schema` emits node-relative visibility conditions for supported Fengdie `if` expressions. Re-run migration to regenerate the output ([conversion changes](../convert/CHANGELOG.md)).

### Fixed

- CLI validation and data migration include the union-branch and subschema fixes from `@jotl/data` ([details](../data/CHANGELOG.md)).
