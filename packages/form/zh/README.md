# @jotl/form

[English](../README.md) · **简体中文**

包页与市场页只显示英文版。

直接按 JSON Schema 渲染带校验的 React 表单，用哪个 widget、怎么排版都写在 schema 里。

`@jotl/form` 提供一个组件 `JotlForm`，把 JSON Schema 2020-12 文档变成能用的表单：输入框、必填标记、默认值、校验提示和提交一应俱全。它面向已经用 JSON Schema（或用 [Jotl](../../core/zh/README.md) 编写）描述数据的 React 开发者，省去手写表单再与 schema 保持同步的工作。widget 选择、排版、显示条件和标签写在 schema 的 `x-ui` 关键字里，不需要另一份 UI 配置文件；嵌套数据每层一页，层级很深的配置对象也能顺手编辑。

## 看看渲染结果

```tsx
import { JotlForm, type JotlFormProps } from "@jotl/form";
import "@jotl/form/style.css";

const schema: JotlFormProps["schema"] = {
  type: "object",
  properties: {
    title: { type: "string", title: "Title", maxLength: 20 },
    status: { enum: ["draft", "published"], title: "Status", "x-ui": { widget: "radio" } },
    featured: { type: "boolean", title: "Featured", default: false },
  },
  required: ["title"],
};

export default function App() {
  return <JotlForm schema={schema} locale="en" onSubmit={(value) => console.log(value)} />;
}
```

页面上依次出现：标签为 Title、带必填标记的文本框，Status 的单选组，Featured 的开关（取默认值 `false`），以及 Submit 和 Reset 按钮。Title 为空时提交，错误显示在该字段下方，不调用 `onSubmit`；校验通过时在控制台打印表单值。

## 把表单跑起来

1. 新建 React 应用：`pnpm create vite my-form --template react-ts`
2. 安装本包：`cd my-form && pnpm add @jotl/form`
3. 把上面的示例存为 `src/App.tsx`，运行 `pnpm dev` 并打开输出的地址。

`react` 是可选的 peer 依赖（16.8 到 19），见 [React 版本兼容](docs/react-compat.md)。

## 能得到什么

- **一份 schema 驱动整个表单。** widget 名、分组、`tabs` 或 `grid` 布局、`visibleIf` 条件和入口摘要都写在 `x-ui` 里，紧挨着它描述的数据；默认值与校验经 `@jotl/data` 取自同一份 schema。见[控制表单数据与校验](docs/form-state.md)。
- **深层数据也能找得到。** 对象、数组和字典各自打开为一页，带面包屑和逐层错误数；也可以改成单页展开加折叠面板。见[浏览嵌套数据](docs/drill-down.md)。
- **只换一个 widget，其余照旧。** 把自己的组件登记到 `switch` 这类内置名下，用 [`@jotl/antd`](../../antd/zh/README.md) 换成 Ant Design，或加载 schema 声明的模块 widget。见[替换与登记 widget](docs/custom-widgets.md)。
- **不会白屏。** 渲染报错的 widget 依次换成下一个候选，最后落到 JSON 编辑框，每次降级都经 `onDegrade` 上报。见[排查 widget 降级](docs/fallbacks.md)。
- **容易接入现有应用。** 样式可选，并放在 cascade layer 中，宿主 CSS 可直接覆盖；Tailwind v4 宿主可以用自己的主题编译；不依赖 UI 框架的规划器 `@jotl/form/core` 可用来为其他框架写渲染器。见[表单样式](docs/styling.md)和[用 `@jotl/form/core` 实现渲染器](docs/core.md)。

## 不适合的场景

widget 是 React DOM 组件：在 Vue、Svelte 或 React Native 中只能用 `@jotl/form/core` 的规划器，widget 要自己写。输入必须是 JSON Schema 2020-12；旧版 draft 与 OpenAPI schema 先用 [`@jotl/convert`](../../convert/zh/README.md) 转换。已知限制与绕过办法见[已知限制](docs/known-limitations.md)。

## 延伸阅读

- [guide 索引](docs/README.md)：本包全部任务页。
- [`x-ui` 规范](../../../zh/docs/spec/x-ui.md)：字段、合并顺序、内置 widget 名与各层 props。
- [原生 HTML 默认 widget 规范](../../../zh/docs/spec/html-widgets.md)：默认 widget 表与行为约定。
- [`@jotl/core`](../../core/zh/README.md) 介绍如何用 Jotl 编写 schema，[`@jotl/data`](../../data/zh/README.md) 负责默认值、校验与 Mock 数据。

## 许可证

[MIT](../../../LICENSE)
