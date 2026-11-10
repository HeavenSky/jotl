# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## [0.0.4] - 2026-11-06

### Breaking changes

- `JotlForm` renames its `drill` prop to `nested`; replace `drill={false}` with `nested={false}` and keep `collapsible` to show panels on one page ([guide](docs/nested.md)).
- Visibility conditions use the new `left` / `op` / `right` and `op` group format. Update hand-written `x-ui.visibleIf` conditions before rendering existing schemas ([migration](../core/CHANGELOG.md)).

### Changed

- Entry rows and collapsible panels use consistent title and summary styles, and dictionary keys provide the labels for simple values.

### Fixed

- Replacing form data clears cached values from the previous record's union branches, while controlled echoes preserve the cache.
