# 已知限制

[English](../../docs/known-limitations.md) · **简体中文**

本页列出表单行为与 schema 允许的范围或你的预期不一致的地方，有绕过办法的一并给出。

## 文本输入遇到 emoji 会提前截止

默认 `input`、`password`、`textarea` widget 把 `maxLength` 传给原生 `maxlength`，后者按 UTF-16 代码单元计数。含基本多文种平面以外字符（如多数 emoji）的文本，没到 schema 的 `maxLength`（按字符计数）就被拦下。校验仍按字符计数，所以输入框放行的文本不会被校验报错。想在输入时允许满额字符数，自己登记一个不设 `maxlength` 的文本 widget，见[替换与登记 widget](custom-widgets.md)。[`@jotl/antd`](../../../antd/zh/docs/coverage.md#与-schema-的已知差异) 的行为相同。

## 带 patternProperties 的对象按 JSON 编辑

schema 带 `patternProperties` 的对象整体降级为 `json` widget（F7，不支持的 schema 特性）。它的字段不会逐个排开，也没有「其他键」编辑。降级代码见[处理降级与诊断](core.md#处理降级与诊断)。

## 服务端渲染的 label 不带 `for`

字段外壳在渲染后确认内层元素是可关联的控件，才给 `<label>` 补上 `for`。服务端渲染的 HTML 不带 `for`，hydration 之后才补上；在此之前点击 label 不会聚焦控件。

## schema 模块按 field 级登记

根 `x-ui.widgets` 中声明的 widget 一律按 `field` 级登记，接管整个值；声明里不能指定其他级别。要按其他级别登记模块 widget，自己调用 `moduleWidgetRegistrations` 并传 `level`，再把结果登记到自己的注册表，见[不用 `JotlForm` 时登记模块](schema-modules.md#不用-jotlform-时登记模块)。

## 自带的富文本编辑器很简陋

不传 `adapters.richText` 时，`richtext` 是多行文本框。自带的 `richTextEditor` 是最简的 `contenteditable` 编辑器，未在 Safari 与 Firefox 中验证。正式使用时传入基于完整编辑器的适配器，见[传入适配器](custom-widgets.md#传入适配器)。

## 工具类带 `jt` 前缀且不含 preflight

样式表不会重置你的页面，工具类也不会与你的类名冲突，代价是它也不会像 Tailwind preflight 那样统一元素的基础样式。通过 `--jotl-*` 变量、`jotl-` 类名与 `className` 定制，见[为什么带前缀且不含 preflight](styling.md#为什么带前缀且不含-preflight)。
