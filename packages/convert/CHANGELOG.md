# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## [0.0.4] - 2026-11-06

### Breaking changes

- Fengdie conversion uses `fengdie` names throughout its public API. Replace `fengdieToUmoJson`, `umoJsonToSchema`, `isKnownUmoType` and `umoJsonFeature` with `parseFengdieJson`, `fengdieJsonToSchema`, `isKnownFengdieJsonType` and `fengdieJsonFeature`; read `migrateFengdie(...).fengdieJson` instead of `.umo`. Rename `UmoJson` to `FengdieJson`, `UmoToSchemaOptions` to `FengdieJsonToSchemaOptions`, `FengdieUmoResult` to `FengdieJsonResult`, and the remaining `Umo*` types to `FengdieJson*`; the default source filename is now `default.schema` ([API](docs/fengdie-migration.md)).
- Generated visibility conditions use the new `left` / `op` / `right` and `op` group format. Update hand-written conditions before combining them with converted schemas ([migration](../core/CHANGELOG.md)).

### Changed

- Fengdie `if` expressions that can be represented as `visibleIf` now read paths relative to the object containing the field, matching the editor's evaluation context. Re-run migration to regenerate node-relative conditions ([supported expressions](docs/fengdie-migration.md)).
