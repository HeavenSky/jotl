# 哪些 widget 用 antd

[English](../../docs/coverage.md) · **简体中文**

本页列出每个内置 widget 名对应的 antd 组件，以及改变覆盖范围的选项。前提是你已按 [README](../README.md#把现有表单切到-antd) 接好注册表。

## 选择登记方式

- `createAntdRegistry(options?)` 返回以 `@jotl/form` 的 `createDefaultRegistry()` 为父级的新注册表，已登记 antd widget。没有 antd 实现的名字取父级的原生 widget。每次调用都得到新的注册表，所以只创建一次。
- `antdWidgets(options?)` 返回登记项（`WidgetRegistration[]`）。它们不带 `accepts`，形态检查由 `@jotl/form/core` 的 `plan()` 完成。
- `registerAntdWidgets(registry, options?)` 把它们登记到任意注册表，同名覆盖。
- `options.dayjs` 是 antd 所用的同一个 `dayjs`（antd 已为它加载 `customParseFormat` 与 `advancedFormat` 插件）。不传时不登记 `date`、`time`、`datetime`，回落到原生日期控件。
- 各 widget 组件也单独导出（`AntdInputWidget`、`AntdFieldDecorator` 等），可登记到其他名字下。

## 覆盖表

| widget 名                                                            | antd 组件                                                                    | 要点                                                                                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form`                                                               | 原生 `<form>` + `Form`（`component={false}`，纵向布局）+ `Button` + `Alert`  | 提交与重置按钮；不属于可见字段的错误显示在 `Alert` 中；`mode="disabled"` 经 `Form` 的 `disabled` 禁用 antd 控件                                   |
| `field`                                                              | `Form.Item`                                                                  | 标签、必填标记，`description` 作为 `extra`，错误作为 `help` 并设 `validateStatus="error"`                                                         |
| `page` `inline`                                                      | 分组用 `Card`，`layout: "tabs"` 用 `Tabs`，`layout: "grid"` 用 CSS grid      | 其他键（`additional`）复用 `@jotl/form` 的 `EntryEditor`                                                                                          |
| `list`                                                               | 每项一张 `Card`，`Button`                                                    | 上移、下移、复制（渲染器提供时）、删除、新增                                                                                                      |
| `input` `password` `textarea`                                        | `Input`、`Input.Password`、`Input.TextArea`                                  | `maxLength` 按字符计数，见[与 schema 的已知差异](#与-schema-的已知差异)                                                                           |
| `url` `email`                                                        | 带 `type` 的 `Input`                                                         | 清空时写回 `undefined`                                                                                                                            |
| `number`                                                             | `InputNumber`                                                                | 空值写回 `undefined`；`minimum` / `maximum`；整数与 `x-decimals` 经 `precision`；`thousands` 经 formatter                                         |
| `range`                                                              | `Slider`                                                                     |                                                                                                                                                   |
| `switch`                                                             | `Switch`                                                                     |                                                                                                                                                   |
| `checkbox`                                                           | `Checkbox`；枚举数组用 `Checkbox.Group`                                      |                                                                                                                                                   |
| `radio`                                                              | `Radio.Group`                                                                |                                                                                                                                                   |
| `select`                                                             | `Select`；枚举数组用 `mode="multiple"`                                       | 非必填时可清除；不在选项中的已有值保留在末尾                                                                                                      |
| `date` `time` `datetime`                                             | `DatePicker`、`TimePicker`、`DatePicker showTime`                            | 仅在传入 `options.dayjs` 时。按存储格式（`x-valueFormat`，没有时按 `format`）读写，本地时区；解析不了的存量值交给原生 widget 原样显示，不改写数据 |
| `color`                                                              | `ColorPicker`                                                                | 写回 `#rrggbb`；清除时写回 `undefined`                                                                                                            |
| `output`                                                             | 原生 `<output>` 内的 `Typography.Text`                                       | 只读；没有值时显示 `const`                                                                                                                        |
| `nullable`                                                           | `Checkbox`                                                                   | “置为空”开关；值不为空时渲染内容 widget                                                                                                           |
| `union`                                                              | `Select`；`x-ui.props.selector: "buttons"` 且不超过 4 个分支时用 `Segmented` | 只有一个分支时不显示选择                                                                                                                          |
| `tree`                                                               | `Button`                                                                     | 展开与收起；只在展开时渲染内容                                                                                                                    |
| 其余：`richtext` `money` `bigint` `image` `file` `json` `kv` `tuple` | `@jotl/form` 的原生 widget                                                   | 经父级注册表；见[默认 HTML widget](../../../form/zh/docs/default-widgets.md)                                                                      |

## 与 schema 的已知差异

`Input`、`Input.Password`、`Input.TextArea` 输入时与校验一样按字符计数 `maxLength`：原生 `maxLength` 取 schema 的 `maxLength` 加上值中已有代理对字符（如多数 emoji）的个数。仍有两种情况会提前拦下：只剩 1 个字符时输入代理对字符，以及粘贴含这类字符的文本。校验按字符计数，所以输入框放行的文本不会被校验报错。想在这两种情况下也允许满额字符数，自己登记一个输入 widget，不传 `maxLength`，改传 antd 的 `count`，其中写 `max` 与 `strategy: (text) => [...text].length`；`count` 需要 antd 5.10 及以上。
