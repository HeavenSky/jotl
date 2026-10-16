# Configure TSDoc and ESLint

**English** · [简体中文](../zh/docs/lint-presets.md)

Load the presets below and TSDoc and eslint-plugin-jsdoc accept the custom tags of the [tag protocol](./tag-protocol.md). Without them, both report tags such as `@asType` and `@enumTitles` as unknown. You need `@jotl/convert` installed in the project.

## Extend the TSDoc preset

For TSDoc-based tools (e.g. eslint-plugin-tsdoc, API Extractor), extend the preset in the project's `tsdoc.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json",
  "extends": ["@jotl/convert/tsdoc.json"]
}
```

## Pass definedTags to eslint-plugin-jsdoc

`definedTags` lists the custom tags plus `defaultValue` and `privateRemarks`:

```js
import { definedTags } from "@jotl/convert/eslint";

export default [{ rules: { "jsdoc/check-tag-names": ["error", { definedTags }] } }];
```

## Test coverage

`extends` in `tsdoc.json` is covered by tests. How eslint-plugin-tsdoc and eslint-plugin-jsdoc behave after loading the presets has not been tested: neither plugin is a dependency of this package. If a plugin still flags a custom tag, check that it reads the `tsdoc.json` or `definedTags` shown above.
