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

## 给 eslint-plugin-jsdoc 传 definedTags

`definedTags` 包含全部自定义标签，另加 `defaultValue` 与 `privateRemarks`：

```js
import { definedTags } from "@jotl/convert/eslint";

export default [{ rules: { "jsdoc/check-tag-names": ["error", { definedTags }] } }];
```

## 测试覆盖情况

`tsdoc.json` 的 `extends` 有测试覆盖。eslint-plugin-tsdoc 与 eslint-plugin-jsdoc 加载预设后的实际表现尚未测试：两个插件都不是本包的依赖。插件仍把自定义标签报为错误时，检查它是否读到了上文的 `tsdoc.json` 或 `definedTags`。
