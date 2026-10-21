# 配置 TSDoc 与 ESLint

[English](../../docs/lint-presets.md) · **简体中文**

加载下面的预设后，TSDoc 与 eslint-plugin-jsdoc 就认识 [标签协议](./tag-protocol.md) 中的自定义标签。不加载时，两者都会把 `@asType`、`@enumTitles` 这类标签报为未知标签。项目里需要已安装 `@jotl/convert`。

## 继承 TSDoc 预设

使用 TSDoc 的工具（如 eslint-plugin-tsdoc、API Extractor）在项目的 `tsdoc.json` 中继承预设：

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json",
  "extends": ["@jotl/convert/tsdoc.json"]
}
```

eslint-plugin-tsdoc 读取 ESLint 运行目录（启用类型感知 lint 时为 TypeScript 程序所在目录）下的 `tsdoc.json`，不读被检查文件旁边的，所以把它放在项目根目录。然后启用规则：

```js
import tsParser from '@typescript-eslint/parser';
import tsdoc from 'eslint-plugin-tsdoc';

export default [
  { files: ['**/*.ts'], languageOptions: { parser: tsParser }, plugins: { tsdoc }, rules: { 'tsdoc/syntax': 'warn' } },
];
```

## 给 eslint-plugin-jsdoc 传 definedTags

`definedTags` 包含全部自定义标签，另加 `defaultValue` 与 `privateRemarks`：

```js
import tsParser from '@typescript-eslint/parser';
import jsdoc from 'eslint-plugin-jsdoc';
import { definedTags } from '@jotl/convert/eslint';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { jsdoc },
    rules: { 'jsdoc/check-tag-names': ['error', { definedTags }] },
  },
];
```

配置中必须注册 `jsdoc` 插件；只写 `rules` 时 ESLint 报 `Could not find plugin "jsdoc"` 并停止。已展开 `jsdoc.configs["flat/recommended-typescript"]` 等预设时，在其后覆盖 `jsdoc/check-tag-names`。

## 测试覆盖情况

测试覆盖 `tsdoc.json` 的 `extends`，并用上面两份配置检查 `schemaToTs` 的产物（含全部自定义标签）：加载预设时，eslint 10.13、eslint-plugin-jsdoc 65.4、eslint-plugin-tsdoc 0.5.4 与 @typescript-eslint/parser 8.72 没有告警；不加载时，两个插件都报出自定义标签。插件仍把自定义标签报为错误时，检查 ESLint 是否在 `tsdoc.json` 所在目录运行，以及 `definedTags` 是否传给了规则。
