# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## [0.0.4] - 2026-11-06

### Breaking changes

- `root_if` and `node_if` groups now use `{op: 'and', conditions: [...]}`, `{op: 'or', conditions: [...]}` and `{op: 'not', condition: ...}`. Replace the former `{and: [...]}`, `{or: [...]}` and `{not: ...}` objects; leaf expressions and path-string shorthand keep their syntax ([syntax](../../docs/spec/jotl.md#conditions)).
- `x-ui.visibleIf` leaves now use `{left: 'kind', op: 'eq', right: 'b'}` instead of `{field: '/kind', eq: 'b'}`. Convert JSON Pointer paths to lodash paths, move the comparison and value into `op` and `right`, and replace `all`, `any` and `not` groups with the `op` objects above; keep `base: 'node'` on node-relative leaves ([contract](../../docs/spec/x-ui.md#visibility-conditions)).
