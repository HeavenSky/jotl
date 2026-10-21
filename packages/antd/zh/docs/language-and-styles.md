# 语言与样式

[English](../../docs/language-and-styles.md) · **简体中文**

本页说明 antd 渲染的表单由哪些设置决定语言，以及需要哪些样式表。

## 设置语言

- 本包 widget 自己的文案（提交、重置、新增、删除、占位、标签页错误数）随表单语言：`JotlForm` 的 `locale`，未指定时取全局 `getLocale()`。见[设置表单语言](../../../form/zh/docs/locale.md)。
- antd 自身组件（日期面板、取色器、空状态）的语言由宿主的 `ConfigProvider locale` 决定；日期面板另受 `dayjs.locale(...)` 影响。

三处设为同一种语言，表单才一致：

```tsx
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/en';

dayjs.locale('en');

<ConfigProvider locale={enUS}>
  <JotlForm schema={schema} registry={registry} locale="en" />
</ConfigProvider>;
```

## 引入样式

- antd 样式无需引入（CSS-in-JS）。
- 回落的原生 widget，以及 `@jotl/form` 的钻取入口行与面包屑，引入 `@jotl/form/style.css` 后外观更好；可以不引入。见[表单样式](../../../form/zh/docs/styling.md)。
