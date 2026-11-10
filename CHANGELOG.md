# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## [0.0.4] - 2026-11-06

- Reissue the changes from [0.1.0](#010---2026-11-05) on the `0.0.x` release line. When upgrading from `0.0.3`, follow the breaking-change migration steps below.

## [0.1.0] - 2026-11-05

### Breaking changes

- Jotl `root_if` and `node_if` groups now use `{op: 'and', conditions: [...]}`, `{op: 'or', conditions: [...]}` and `{op: 'not', condition: ...}`; replace the former `{and: [...]}`, `{or: [...]}` and `{not: ...}` objects. Leaf expressions and path-string shorthand keep their syntax ([syntax](https://github.com/HeavenSky/jotl/blob/HEAD/docs/spec/jotl.md)).
- JSON Schema `x-ui.visibleIf` leaves now use `{left: 'kind', op: 'eq', right: 'b'}` instead of `{field: '/kind', eq: 'b'}`. Convert JSON Pointer paths to lodash paths, move the comparison name and value into `op` and `right`, and replace `all`, `any` and `not` groups with the corresponding `op` objects above; keep `base: 'node'` on node-relative leaves ([contract](https://github.com/HeavenSky/jotl/blob/HEAD/docs/spec/x-ui.md)).
- `JotlForm` renames its `drill` prop to `nested`; replace `drill={false}` with `nested={false}` and keep `collapsible` to show panels on one page ([guide](https://github.com/HeavenSky/jotl/blob/HEAD/packages/form/docs/nested.md)).
- Fengdie conversion uses `fengdie` names throughout its public API. Replace `fengdieToUmoJson`, `umoJsonToSchema`, `isKnownUmoType` and `umoJsonFeature` with `parseFengdieJson`, `fengdieJsonToSchema`, `isKnownFengdieJsonType` and `fengdieJsonFeature`; read `migrateFengdie(...).fengdieJson` instead of `.umo`. Rename `UmoJson` to `FengdieJson`, `UmoToSchemaOptions` to `FengdieJsonToSchemaOptions`, `FengdieUmoResult` to `FengdieJsonResult`, and the remaining `Umo*` types to `FengdieJson*`; the default source filename is now `default.schema` ([API](https://github.com/HeavenSky/jotl/blob/HEAD/packages/convert/docs/fengdie-migration.md)).

### Added

- The Playground accepts pasted fengdie DSL schema and Fengdie `toJson` output, previews the migrated form, and provides a “Migrated Jotl” tab with a copy button ([guide](https://github.com/HeavenSky/jotl/blob/HEAD/apps/playground/README.md)).

### Changed

- Fengdie `if` expressions that can be represented as `visibleIf` now read paths relative to the object containing the field, matching the editor's evaluation context. Re-run migration to regenerate node-relative conditions ([supported expressions](https://github.com/HeavenSky/jotl/blob/HEAD/packages/convert/docs/fengdie-migration.md)).
- Form entry rows and collapsible panels use consistent title and summary styles; Ant Design form titles and spacing follow the same presentation.

### Fixed

- Data migration keeps common fields and constraints when selecting a union branch, uses discriminator values to choose the branch, and repairs an ordinary enum field without discarding the rest of the object. Defaults and migration combine declarations that apply to the same property or array item.
- Subschema validation preserves nested `$id` and `$anchor` scopes and correctly locates property names containing literal `%` sequences.
- Replacing form data clears cached values from the previous record's union branches, while controlled echoes preserve the cache.
- The Playground compiles Jotl types named `Object`, `String` or another Fengdie keyword through the Jotl compiler.
