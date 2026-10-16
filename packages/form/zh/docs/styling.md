# 表单样式

[English](../../docs/styling.md) · **简体中文**

本页介绍引入表单样式的两种方式，以及如何换肤。样式是可选的：不引入时 widget 照常工作，只是没有基础排版（含钻取的面包屑与入口行）。

## 引入预编译样式表

宿主不用 Tailwind 时，引入一次预编译 CSS：

```ts
import "@jotl/form/style.css";
```

## 用自己的 CSS 覆盖

每个元素同时带 `jotl-` 语义类名（供覆盖与测试定位）和带 `jt:` 前缀的 Tailwind 工具类（表达外观）。生成的 CSS 全部在 cascade layer（`theme` `components` `utilities`）中，不含 preflight，宿主未分层的样式天然优先：直接写 `.jotl-input { ... }` 就能覆盖输入框。只有 `jotl-` 类名是稳定接口，工具类可能变化。

## 用 CSS 变量换肤

在外层元素上设置下列任一变量，即可改变其内部全部表单的颜色与间距：

`--jotl-gap` `--jotl-radius` `--jotl-border` `--jotl-divider` `--jotl-focus` `--jotl-focus-hover` `--jotl-focus-ring` `--jotl-error` `--jotl-text` `--jotl-muted` `--jotl-surface` `--jotl-disabled-bg` `--jotl-disabled-text` `--jotl-switch-off` `--jotl-option-hover` `--jotl-option-selected`

```css
.checkout-form {
  --jotl-focus: #0a7c4a;
  --jotl-radius: 6px;
}
```

默认值见 [`theme.css`](../../theme.css)。

## 交给宿主的 Tailwind v4 构建编译

为表单新建一个独立的 CSS 入口，交给宿主的 Tailwind 构建（如 `@tailwindcss/vite`）处理。不要并入宿主自己的 `@import "tailwindcss"` 入口：`jt` 前缀只对这个入口生效。可参照 [`apps/playground/src/jotl.css`](../../../../apps/playground/src/jotl.css)。

```css
/* jotl.css */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme) prefix(jt);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@import "@jotl/form/tailwind.css";
```

- `tailwind.css` 用 `@source` 扫描随包发布的 `src`，`source(none)` 关掉对宿主项目的扫描，只生成 widget 用到的工具类。
- `theme.css` 中的设计变量经 `@theme inline` 接到 `--jotl-*`。单独 `@import "@jotl/form/theme.css"` 后，宿主自己的 `jt:` 工具类也能用它们，如 `jt:text-muted` `jt:border-border` `jt:rounded-base`。

## 为什么带前缀且不含 preflight

库样式带 preflight 会重置宿主整页，不加前缀的工具类会与宿主 Tailwind 构建中的同名类互相覆盖。项目保留这两项取舍；定制请通过 `--jotl-*` 变量、`jotl-` 类名与 `className`。

想让自定义 widget 与默认外观一致，可复用 `@jotl/form` 的 `styles` 与 `cn`，见[编写 widget](widget-contract.md#沿用默认外观)。
