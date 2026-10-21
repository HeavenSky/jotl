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

eslint-plugin-tsdoc reads the `tsdoc.json` in the directory ESLint runs from (with typed linting, the directory of the TypeScript program), not one next to the linted file, so put it at the project root. Then enable the rule:

```js
import tsParser from "@typescript-eslint/parser";
import tsdoc from "eslint-plugin-tsdoc";

export default [
	{
		files: ["**/*.ts"],
		languageOptions: { parser: tsParser },
		plugins: { tsdoc },
		rules: { "tsdoc/syntax": "warn" },
	},
];
```

## Pass definedTags to eslint-plugin-jsdoc

`definedTags` lists the custom tags plus `defaultValue` and `privateRemarks`:

```js
import tsParser from "@typescript-eslint/parser";
import jsdoc from "eslint-plugin-jsdoc";
import { definedTags } from "@jotl/convert/eslint";

export default [
	{
		files: ["**/*.ts"],
		languageOptions: { parser: tsParser },
		plugins: { jsdoc },
		rules: { "jsdoc/check-tag-names": ["error", { definedTags }] },
	},
];
```

The `jsdoc` plugin must be registered in the config; a config with only the `rules` entry stops ESLint with `Could not find plugin "jsdoc"`. If you already spread a preset such as `jsdoc.configs["flat/recommended-typescript"]`, override `jsdoc/check-tag-names` after it.

## Test coverage

Tests cover `extends` in `tsdoc.json` and lint the output of `schemaToTs`, which carries every custom tag, with the two configurations above: with the presets, eslint 10.13, eslint-plugin-jsdoc 65.4, eslint-plugin-tsdoc 0.5.4 and @typescript-eslint/parser 8.72 report nothing; without them, both plugins flag the custom tags. If a plugin still flags a custom tag, check that ESLint runs from the directory holding `tsdoc.json` and that `definedTags` reaches the rule.
