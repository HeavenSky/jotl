# 登记扩展组件

[English](../../docs/extension-components.md) · **简体中文**

读完本页，你能在 Jotl 源码里使用 `ImagePicker`、`Rating` 这类自定义组件。前提是已按[编译与打印 Jotl](./compile-and-print.md) 调用 `compile`；组件命名与可用元数据的规则见 [Jotl 语法规范](../../../../zh/docs/spec/jotl.md#条目)。

组件位置上的大驼峰名，必须是同一文件声明的类型或已登记的扩展组件。登记有三个入口：按调用、按文件、在项目配置 `jotl.config.json` 中。

## 按调用登记

给 `compile` 传 `options.widgets`：组件名 → 底层 schema 的映射。本包不读任何配置文件，传什么由调用方决定。

```ts
import { compile } from "@jotl/core";

const result = compile("Form: {\n  score: Rating[maximum: 5]\n}", "form.jotl", {
  widgets: { Rating: { type: "integer" } },
});
result.value?.schema.$defs.Form.properties.score;
// { type: "integer", maximum: 5, "x-ui": { widget: "Rating" } }
```

## 在源码文件里登记

根条目的元数据 `widgets` 只为本文件登记组件。它与 `options.widgets` 合并，同名时以文件内为准。

```ts
import { compile } from "@jotl/core";

const result = compile(
  `Form: [widgets: {ImagePicker: {base: 'url', module: 'https://esm.sh/image-picker'}}] {
  cover(Cover): ImagePicker
}`,
  "form.jotl",
);
result.value?.schema["x-ui"];
// { version: 1, widgets: { ImagePicker: { base: "url", module: "https://esm.sh/image-picker" } } }
result.value?.schema.$defs.Form.properties.cover;
// { title: "Cover", type: "string", format: "uri", "x-ui": { widget: "ImagePicker" } }
```

每个取值的写法与 `jotl.config.json` 相同：

- 底层类型，如 `'integer'` 或 `'url'`。
- 模块声明 `{ base?, module, export? }`。`base` 缺省为 `object`，`export` 缺省为 `default`。

模块声明编译进根 `x-ui.widgets`（名字 → `{ base?, module, export? }`，类型 `XUiWidgetModule`）；只有 `base` 不是 `object` 时才带上 `base`。类型名与这类组件重名报 `JOTL1028`，取值不合法报 `JOTL1020`。`print` 把根 `x-ui.widgets` 写回根条目的 `widgets`。

## 加载 jotl.config.json

`@jotl/core` 负责处理配置内容，查找和读取文件由你来做。文件名常量是 `JOTL_CONFIG_FILE`（`"jotl.config.json"`）。

1. 读取文件并 `JSON.parse`，把结果传给 `readJotlConfig`。它校验内容，并把底层类型换算成 schema。

   ```ts
   import { configCompileOptions, readJotlConfig } from "@jotl/core";

   const { config, issues } = readJotlConfig({
     widgets: { Rating: "integer", ImagePicker: { base: "url", module: "./widgets/image-picker.js" }, star: "string", Bad: 3 },
   });
   // config.widgets: { Rating: { type: "integer" }, ImagePicker: { type: "string", format: "uri" }, star: { type: "string" } }
   // config.modules: { ImagePicker: { module: "./widgets/image-picker.js" } }
   // issues: [{ pointer: "/widgets/Bad", message: "base type of `Bad` must be a JSON Schema primitive type name, ..." }]
   ```

   不合法的项会被跳过，并以 `{ pointer, message }` 记入 `issues`；其余项照常返回。

2. 把 widgets 换成编译选项。`configCompileOptions(widgets, widgetTypes)` 在 `widgets` 中只保留大驼峰名，即扩展组件；其他名字只登记为 widget 名。同时传入 `config.widgetTypes`，字段类型不被这类名字的底层类型接受时会报 `JOTL1052` 警告。

   ```ts
   const options = configCompileOptions(config.widgets, config.widgetTypes);
   // { widgets: { Rating: { type: "integer" }, ImagePicker: { type: "string", format: "uri" } } }
   ```

3. 自行加载模块。`config.modules` 列出写成模块声明的项，`module` 原样保留；相对路径按配置文件所在目录解析。配置中的模块声明不会写进编译出的 schema。

要在编辑器里校验配置文件本身，用 `createJotlConfigJsonSchema()` 取它的 JSON Schema，其 `$id` 为 `JOTL_CONFIG_SCHEMA_ID`。

## 给 JSON 错误标上行列

两个辅助函数让 `jotl.config.json` 等 JSON 输入的诊断带上位置。它们都不依赖 Node API，可以在浏览器运行。

- `locateJsonError(text)` 返回第一个语法错误的 `{ offset, found }`，合法 JSON 返回 `undefined`。文本提前结束时 `found` 为 `undefined`：`locateJsonError('{"a": }')` 得到 `{ offset: 6, found: "}" }`，`locateJsonError('{"a": 1')` 得到 `{ offset: 7 }`。
- `jsonPointerOffsets(text)` 返回一个 `Map`，把合法 JSON 中每个值的指针映射到文本偏移，对象成员取键名的起点：`jsonPointerOffsets('{"a": [1, 2]}')` 得到 `"" → 0`、`"/a" → 1`、`"/a/0" → 7`、`"/a/1" → 10`。不合法的 JSON 返回 `undefined`。
