# Specification changelog

**English** · [简体中文](../../zh/docs/spec/CHANGELOG.md)

Entries follow repository release versions; the specification's own version remains v1.

## [0.0.4] - 2026-11-06

### Breaking changes

- Jotl `root_if` and `node_if` groups now use `{op: 'and', conditions: [...]}`, `{op: 'or', conditions: [...]}` and `{op: 'not', condition: ...}`. Replace the former `{and: [...]}`, `{or: [...]}` and `{not: ...}` objects; leaf expressions and path-string shorthand remain valid ([syntax](jotl.md#conditions)).
- `x-ui.visibleIf` leaves now use `left`, `op` and `right`; paths use lodash syntax. Convert former JSON Pointer `field` paths, move comparisons into `op` and `right`, and replace `all`, `any` and `not` groups with `op` objects. Keep `base: 'node'` for node-relative leaves ([contract](x-ui.md#visibility-conditions)).
- Nested rendering uses the `JotlForm` prop `nested` instead of `drill`. Replace `drill={false}` with `nested={false}`; use `collapsible` for panels on a single page ([rendering contract](x-ui.md#nested-rendering)).
