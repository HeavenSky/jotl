# 替换与登记 widget

[English](../../docs/custom-widgets.md) · **简体中文**

本页说明如何用自己的组件替换默认 widget，以及如何传入文件上传等适配器。组件本身怎么写见[编写 widget](widget-contract.md)。

## 覆盖一个内置名

```tsx
import { createDefaultRegistry } from "@jotl/form";

// 每次渲染新建注册表时, 登记内容(含父级)逐项浅相等则沿用上一次的, 不重新规划; 在组件外创建一次可省去比较.
const registry = createDefaultRegistry().extend();
registry.register({ name: "switch", level: "field", component: MySwitch });

<JotlForm schema={schema} registry={registry} adapters={{ upload: uploadToCdn }} />;
```

- 同名登记覆盖默认 widget，本级注册表覆盖父级。没有覆盖的 widget 仍用原生 HTML 默认实现。
- `name` 可以是内置 widget 名（完整清单是 `@jotl/form/core` 的 `BUILTIN_WIDGETS`），也可以是自定的名字，由 schema 用 `x-ui.widget` 选用。`level` 决定组件收到哪种 props（见[编写 widget](widget-contract.md)）；内置名取 `BUILTIN_WIDGETS` 中它的层级。
- `@jotl/form/core` 的 `createRegistry(registrations?, parent?)` 按列表建注册表；传入 `parent` 时等同于 `parent.extend()`。

## 登记项的可选字段

| 字段 | 用途 |
|---|---|
| `load` | 按需加载组件，参数为 `{ locale }`，即首个触发加载的表单的语言。加载完成前渲染 `component` 作为占位；失败时显示重试并改用下一个候选 widget |
| `accepts(schema)` | 拒绝 widget 处理不了的数据形态，被拒绝时按 F2 降级。内置名已由 `plan()` 检查形态，所以默认登记项不带 `accepts` |
| `match(schema, ctx)` | 按分值让 widget 成为候选：分值大于 0 才参与，分值高的排前，分值相同时 `list()` 中靠前的登记胜出（本级在父级之前）。匹配到的 widget 排在 `x-ui` 写明的名字之后、该形态的内置默认之前 |
| `claims(schema)` | 用于复合 widget：由它自己渲染的相对子数据路径，或 `"all"` |

## 传入适配器

`adapters` 原样传给每个 widget。三项都可以不传，缺少对应适配器的 widget 退回到更简单的形态，不报错：

| 适配器 | 使用者 | 不传时 |
|---|---|---|
| `upload(file, ctx)` | `image`、`file`：返回要存储的 URL；`ctx` 是发起上传的字段（`dataPath`、`schema`） | 只有 URL 输入框 |
| `loadOptions(source)` | 自己编写、需要拉取远程选项的 widget，返回 `{ value, label }[]`；默认 widget 不调用它 | |
| `richText(props)` | `richtext`：渲染编辑器；传入本包的 `richTextEditor` 即得到最小编辑器 | 多行文本框 |

## 避免多余的重渲染

`adapters` 按各键浅比较，`registry` 按登记内容浅比较，内容不变的新对象不会让表单重渲染或重新规划。每次渲染新建的函数（如内联箭头函数）算作变化；把它们定义在组件外或做 memo。

## 不用 `JotlForm` 时使用默认 widget

`createDefaultRegistry()` 已登记原生 HTML widget。用自己的渲染器时，可以把它们登记到任一实现 `@jotl/form/core` `Registry` 接口的注册表：

```ts
import { registerHtmlWidgets } from "@jotl/form";

// registry: 任一实现 @jotl/form/core `Registry` 接口的注册表.
registerHtmlWidgets(registry);

// 替换单个默认组件: 在实例级注册表登记同名组件, 本级覆盖父级.
const local = registry.extend();
local.register({ name: "input", level: "field", component: MyTextInput });
```

`htmlWidgets` 是同一批登记项的数组形式；各默认组件也单独导出（`InputWidget`、`FieldDecorator` 等），可登记到其他名字下。

需要 Ant Design 组件时，[`@jotl/antd`](../../../antd/zh/README.md) 提供现成的注册表。
