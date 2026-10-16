# @jotl/form 使用指南

[English](../../docs/README.md) · **简体中文**

按要做的事找对应页面；安装与第一个表单见[包 README](../README.md)。

| 你想 | 阅读 |
|---|---|
| 选择受控或非受控数据，设定校验时机，调用 `validate()` 或 `reset()` | [控制表单数据与校验](form-state.md) |
| 让嵌套对象和数组每层一页，把当前页同步到路由，或改成单页加折叠面板 | [浏览嵌套数据](drill-down.md) |
| 用自己的组件替换默认 widget，或传入上传、富文本适配器 | [替换与登记 widget](custom-widgets.md) |
| 编写 widget 组件，了解各层收到哪些 props | [编写 widget](widget-contract.md) |
| 加载 schema 中声明的模块 widget | [加载 schema 声明的 widget](schema-modules.md) |
| 了解每个默认 HTML widget 渲染成什么、如何交互 | [默认 HTML widget](default-widgets.md) |
| 引入样式表，用 `--jotl-*` 变量换肤，或交给自己的 Tailwind v4 构建编译 | [表单样式](styling.md) |
| 改动 widget 类名后重新生成 `style.css` 并在浏览器中核对 | [重新生成与核对 style.css](style-maintenance.md) |
| 让 widget 文案与校验消息显示为中文或英文 | [设置表单语言](locale.md) |
| 查明某个字段为什么没用上预期的 widget | [排查 widget 降级](fallbacks.md) |
| 在 React 16.8、17、18 或 19 中使用表单 | [React 版本兼容](react-compat.md) |
| 依赖某个行为之前，先查已知限制与绕过办法 | [已知限制](known-limitations.md) |
| 为其他 UI 框架实现渲染器或 widget 包，或在工具中查询 widget | [用 `@jotl/form/core` 实现渲染器](core.md) |
