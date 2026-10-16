# @jotl/antd

[English](./README.md) · **简体中文**

用 Ant Design 组件渲染 `@jotl/form` 的 `JotlForm`, 或查询哪些内置 widget 名用 antd, 哪些回落到原生 HTML 组件时读本页; 对应 `packages/antd`.

## 用法

peer 依赖: `antd` 5 或 6, `react` 18 或 19.

```tsx
import dayjs from "dayjs";
import { JotlForm } from "@jotl/form";
import { createAntdRegistry } from "@jotl/antd";

// 在组件外创建一次; 每次渲染新建注册表会让表单重新规划.
const registry = createAntdRegistry({ dayjs });

<JotlForm schema={schema} registry={registry} onSubmit={save} />;
```

- `createAntdRegistry(options?)`: 以 `@jotl/form` 的 `createDefaultRegistry()` 为父级的新注册表, 登记了 antd 组件; 没有 antd 实现的名字取父级的原生组件.
- `antdWidgets(options?)`: 登记项(`WidgetRegistration[]`, 不带 `accepts`, 形态检查由 `@jotl/form/core` 的 `plan()` 完成); `registerAntdWidgets(registry, options?)` 把它们登记到任意注册表, 同名覆盖.
- `options.dayjs`: 传入 antd 所用的同一个 `dayjs`(antd 已为它加载 `customParseFormat` 与 `advancedFormat` 插件). 不传时不登记 `date` `time` `datetime`, 回落到原生日期控件.
- 各组件也单独导出(`AntdInputWidget`, `AntdFieldDecorator` 等), 可登记到其他名字.

## 覆盖表

| widget 名 | antd 组件 | 要点 |
|---|---|---|
| `form` | 原生 `<form>` + `Form`(`component={false}`, 纵向布局) + `Button` + `Alert` | 提交, 重置按钮; 不属于可见字段的错误显示在 `Alert`; `mode="disabled"` 经 `Form` 的 `disabled` 禁用 antd 控件 |
| `field` | `Form.Item` | 标签, 必填标记, `description` 作为 `extra`, 错误作为 `help` 并设 `validateStatus="error"` |
| `page` `inline` | 分组用 `Card`, `layout: "tabs"` 用 `Tabs`, `layout: "grid"` 用 CSS grid | 其他键(`additional`)复用 `@jotl/form` 的 `EntryEditor` |
| `list` | 每项一张 `Card`, `Button` | 上移, 下移, 复制(渲染器提供时), 删除, 新增 |
| `input` `password` `textarea` | `Input`, `Input.Password`, `Input.TextArea` | 透传 `maxLength` |
| `url` `email` | 带 `type` 的 `Input` | 清空写回 `undefined` |
| `number` | `InputNumber` | 空值写回 `undefined`; `minimum` / `maximum`; integer 与 `x-decimals` 经 `precision`; `thousands` 经 formatter |
| `range` | `Slider` | |
| `switch` | `Switch` | |
| `checkbox` | `Checkbox`; 枚举数组用 `Checkbox.Group` | |
| `radio` | `Radio.Group` | |
| `select` | `Select`; 枚举数组用 `mode="multiple"` | 非必填可清除; 不在选项中的已有值保留在末尾 |
| `date` `time` `datetime` | `DatePicker`, `TimePicker`, `DatePicker showTime` | 仅在传入 `options.dayjs` 时; 按存储格式(`x-valueFormat`, 没有时按 `format`)读写, 本地时区; 解析不了的存量值交给原生组件原样显示, 不改写数据 |
| `color` | `ColorPicker` | 写回 `#rrggbb`; 清除写回 `undefined` |
| 其余: `richtext` `money` `bigint` `output` `image` `file` `json` `kv` `union` `nullable` `tree` `tuple` | `@jotl/form` 的原生组件 | 经父级注册表 |

## 语言与样式

- 本包组件自己的文案(提交, 重置, 新增, 删除, 占位, 标签页错误数)随表单语言: `JotlForm` 的 `locale`, 未指定时为全局 `getLocale()`.
- antd 自身组件(日期面板, 取色器, 空状态)的语言由宿主的 `ConfigProvider locale` 决定, 日期面板另受 `dayjs.locale(...)` 影响.
- antd 样式无需引入(CSS-in-JS). 回落的原生组件, 以及 `@jotl/form` 的钻取入口行与面包屑, 引入 `@jotl/form/style.css` 后外观更好; 可不引入.
