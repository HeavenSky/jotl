# 加载 schema 声明的 widget

[English](../../docs/schema-modules.md) · **简体中文**

本页说明如何让 schema 以 JavaScript 模块的形式自带 widget。前提是 schema 由 Jotl 编译而来，并含有声明了 `module` 的扩展组件（根条目元数据 `widgets`，见 [`@jotl/core`](../../../core/zh/README.md)）；它们编译进 schema 根 `x-ui.widgets`，形如名字 → `{ module, export? }`。

## 开启模块加载

```tsx
// 编译自: Form: [widgets: {ImagePicker: {base: 'url', module: 'https://esm.sh/image-picker'}}] { cover: ImagePicker }
<JotlForm schema={schema} locale="en" schemaModules />;

// 自定义加载, 或为相对模块地址(./ ../ /)指定基准
<JotlForm
	schema={schema}
	schemaModules={{
		baseUrl: "https://cdn.example.com/widgets/",
		importer: url => import(/* @vite-ignore */ url),
	}}
/>;
```

传 `schemaModules` 时，`JotlForm` 把这些声明登记到本表单自己的注册表（同名覆盖），并按需加载各模块。

- `schemaModules` 默认 `false`。`true` 用动态 `import()` 加载。传对象时作为选项：`importer` 替换加载函数；`baseUrl` 用于解析以 `./`、`../` 或 `/` 开头的地址（其他地址原样交给 importer）；`locale` 决定加载失败文案的语言（缺省取表单的 `locale`）。
- 模块加载失败，或导出不是组件时，该字段按 F9 显示失败与重试按钮。

## 编写模块

- 模块的导出（`export`，缺省 `default`）必须是遵守 widget 契约的 React 组件：按 `field` 级登记，接收 `@jotl/form/core` 的 `FieldProps`（`value` `onChange` `onBlur` `errors` `id` `schema` `mode` `props` 等），接管整个值。见[编写 widget](widget-contract.md)。
- 第三方组件通常不遵守这一契约：会把未知 props 原样写到 DOM 上（`schema`、`adapters` 等成为属性），并使用自己的属性名（如 `HexColorInput` 读 `color` 而不是 `value`）。应导出一层薄包装，把 `FieldProps` 映射为该组件的 props，不要让模块直接指向第三方组件。
- 在浏览器中，远程模块必须与宿主共用同一份 React：用 import map 或等效手段把模块中的 `react`（模块用到 `react/jsx-runtime` 时也包括它）指向宿主的 React 实例。两份 React 并存时 hooks 会失效。

## 不用 `JotlForm` 时登记模块

- `schemaWidgetModules(schema)` 从根 `x-ui.widgets` 读出模块声明，跳过不合法的项。
- `moduleWidgetRegistrations(modules, { importer?, baseUrl?, locale? })` 把名字 → `{ module, export?, level? }` 转为带 `load` 的登记项，供登记到自己的注册表；`level` 缺省为 `field`；不传 `locale` 时加载失败文案取首个加载该 widget 的表单的语言。
- 模块声明来自 `jotl.config.json`（`@jotl/core` 的 `readJotlConfig(...).config.modules`）时，`baseUrl` 传配置文件的位置。
