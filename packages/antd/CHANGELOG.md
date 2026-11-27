# Changelog

**English** · [简体中文](./zh/CHANGELOG.md)

## [0.0.5] - 2026-11-27

- Ant Design Select, Radio and Checkbox widgets support options supplied by form data. They display `label` and write the original `value`; making a new multiple selection drops values removed from the source. [Enum syntax](../../docs/spec/jotl.md#enums)

## [0.0.4] - 2026-11-06

### Breaking changes

- Forms rendered with the Ant Design registry follow the `@jotl/form` upgrade: replace `drill` with `nested` and migrate hand-written visibility conditions to the new format ([migration](../form/CHANGELOG.md)).

### Fixed

- Ant Design form titles and spacing follow the shared form presentation, including nested entry rows and collapsible panels.
