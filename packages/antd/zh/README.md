# @jotl/antd

[English](../README.md) · **简体中文**

包页与市场页只显示英文版。

用 Ant Design 组件渲染 Jotl 表单：一个注册表就把 @jotl/form 的原生 widget 换成 antd。

`@jotl/antd` 面向已经基于 Ant Design、并用 [`@jotl/form`](../../form/zh/README.md) 按 JSON Schema 渲染表单的应用。不必逐个字段类型去对应 antd 组件，只要把一个注册表传给 `JotlForm`：标签变成 `Form.Item`，数字用 `InputNumber`，枚举用 `Select` 或 `Radio.Group`，日期用 `DatePicker`。没有 antd 实现的名字保留原生 widget，任何 schema 都能完整渲染，`JotlForm` 的 API 不变。

## 看看有什么不同

```tsx
import dayjs from "dayjs";
import { JotlForm } from "@jotl/form";
import { createAntdRegistry } from "@jotl/antd";

// 在组件外创建一次; 每次渲染新建注册表会让表单重新规划.
const registry = createAntdRegistry({ dayjs });

<JotlForm schema={schema} registry={registry} onSubmit={save} />;
```

同一份 `schema`，表单改用 antd 的纵向 `Form` 布局：每个字段是带标签、必填标记与错误提示的 `Form.Item`，字符串用 `Input`，布尔用 `Switch`，`format: "date"` 的字符串用 `DatePicker`，提交与重置按钮是 antd 的 `Button`。

## 把现有表单切到 antd

1. 安装依赖：`pnpm add @jotl/form @jotl/antd antd dayjs`
2. 按上例用 `createAntdRegistry({ dayjs })` 创建一次注册表。
3. 以 `registry={registry}` 传给每个 `JotlForm`。

peer 依赖：`antd` 5 或 6，`react` 18 或 19。

## 能得到什么

- **不必逐字段接线就是 antd 外观。** 21 个内置 widget 名（传入 `dayjs` 时 24 个），从 `form`、`field` 到 `select`、`color`，都用 antd 组件渲染；见[哪些 widget 用 antd](docs/coverage.md)。
- **其余部分照常工作。** 没有 antd 版本的名字（`money`、`kv`、`json` 等）经父级注册表取 `@jotl/form` 的原生 widget。
- **日期用你自己的 dayjs。** 传入 antd 所用的 `dayjs`，`date`、`time`、`datetime` 按 schema 的存储格式读写；不传时回落到原生日期控件。
- **可混用，可覆盖。** `antdWidgets()` 与 `registerAntdWidgets()` 把 antd widget 加到任意注册表，各组件也单独导出，可登记到其他名字下。

## 不适合的场景

应用不用 Ant Design，或运行在 React 16、17 上时，用 `@jotl/form` 的默认 widget：本包要求 React 18 或 19、antd 5 或 6。换用其他组件库时，按[替换与登记 widget](../../form/zh/docs/custom-widgets.md)登记自己的 widget。

## 延伸阅读

- [guide 索引](docs/README.md)：覆盖表、语言与样式。
- [`@jotl/form`](../../form/zh/README.md)：表单组件、钻取、降级与 widget 契约。

## 许可证

[MIT](../../../LICENSE)
