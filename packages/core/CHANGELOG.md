# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## [0.0.5] - 2026-11-27

- Compile and print `enum[options_from: 'choices']` for both single and multiple selection. The compiled schema stores the source path in `x-enumFrom`, on `items` for multiple selection. [Enum syntax](../../docs/spec/jotl.md#enums)
- If you previously used `x_enum_from` for custom metadata, rename that key before recompiling. The compiler now reserves `x-enumFrom` for the options path.

## [0.0.4] - 2026-11-06

### Breaking changes

- `root_if` and `node_if` groups now use `{op: 'and', conditions: [...]}`, `{op: 'or', conditions: [...]}` and `{op: 'not', condition: ...}`. Replace the former `{and: [...]}`, `{or: [...]}` and `{not: ...}` objects; leaf expressions and path-string shorthand keep their syntax ([syntax](../../docs/spec/jotl.md#conditions)).
- `x-ui.visibleIf` leaves now use `{left: 'kind', op: 'eq', right: 'b'}` instead of `{field: '/kind', eq: 'b'}`. Convert JSON Pointer paths to lodash paths, move the comparison and value into `op` and `right`, and replace `all`, `any` and `not` groups with the `op` objects above; keep `base: 'node'` on node-relative leaves ([contract](../../docs/spec/x-ui.md#visibility-conditions)).
