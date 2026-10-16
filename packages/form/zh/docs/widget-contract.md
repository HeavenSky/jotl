# 编写 widget

[English](../../docs/widget-contract.md) · **简体中文**

本页说明你的组件会收到哪些 props，以及必须如何使用它们。写好的组件按[替换与登记 widget](custom-widgets.md)登记。

## 最小的字段 widget

```tsx
import type { FieldProps } from "@jotl/form/core";
import type { ReactNode } from "react";

export function MySwitch({ id, value, onChange, onBlur, mode, errors }: FieldProps<boolean, ReactNode>) {
  return (
    <input
      id={id}
      type="checkbox"
      role="switch"
      checked={value === true}
      disabled={mode !== "edit"}
      aria-invalid={errors.length > 0}
      onChange={(event) => onChange(event.target.checked)}
      onBlur={onBlur}
    />
  );
}
```

用 `{ name: "switch", level: "field", component: MySwitch }` 登记。外层的字段外壳负责渲染标签、说明与错误。

## 每个 widget 都要遵守的规则

- widget 一律无状态受控：值只来自 `value`，变更只通过 `onChange`。
- 唯一允许的局部状态是输入中尚不合法的草稿文本（数字框中单独的 `-`、JSON 中未闭合的括号），一旦合法立即调用 `onChange`。`number`、`money`、`bigint` 另外用聚焦状态切换原值与千分位显示。
- 遵守 `mode`：`edit` 可编辑，`view` 只读显示，`disabled` 禁用。
- 把 `id` 设在控件上，外壳的 `<label for>` 与 `aria-describedby` 才能指向它。
- 缺少适配器不是错误：退回到更简单的形态即可。

## 各层的 props

登记的层级决定 props 类型。全部类型从 `@jotl/form/core` 导出，定义在 [`src/core/contracts.ts`](../../src/core/contracts.ts)；`N` 是节点类型，React 下为 `ReactNode`。

| 层级 | props | 内置名 | 在 `BaseProps` 之外得到的内容 |
|---|---|---|---|
| `view` | `ViewProps<N>` | `form` | `submit()` `reset()` `children`；不属于任何可见字段的 `errors`；可选的 `goToError(error)` 用于跳到某条错误 |
| `decorator` | `DecoratorProps<N>`（不继承 `BaseProps`） | `field` | `id` `label?` `description?` `required` `errors` `hidden` `children` |
| `layout` | `LayoutProps<N>` | `page` `inline` | `fields`（已排序，含 `hidden` 与 `errorCount`）、`groups`、`layout`、`columns`，以及用于 `properties` 之外键名的可选 `additional` |
| `field` | `FieldProps<V, N>` | `input` `number` `switch` `select` `date` 等标量名 | `required` `value` `onChange(value)` `onBlur()` `errors` `thousands?` |
| `composite` | `ArrayProps` `TupleProps` `MapProps` `UnionProps` `NullableProps` `TreeProps` | `list` `tuple` `kv` `union` `nullable` `tree` | 带稳定 key 的条目列表与增、删、移动操作，或分支、空值、展开状态加 `renderContent()` |

除 `decorator` 外各层共有的 `BaseProps<N>` 包含 `id`、`schema`、`dataPath`（实际路径，数组下标为具体数字）、`mode`、`props`（合并后的 `x-ui.props`）、`adapters` 与 `renderChild(relativePath)`。

## 渲染子节点

容器 widget 不自己渲染子节点的 widget，而是用相对数据路径调用 `renderChild`，如 `"img"`、`"0"`、`"0/img"`，子节点自身的 `x-ui` 照常生效。`union`、`nullable`、`tree` 改用 `renderContent()`，在同一数据路径上渲染当前内容。

## 沿用默认外观

`@jotl/form` 导出 `styles`（各默认 widget 的工具类）与 `cn`（合并类名），自定义 widget 可借此与默认外观保持一致。`useLocale()` 与 `useL10n()` 让它拿到表单语言，见[设置表单语言](locale.md)。

逐字段的完整契约（含渲染计划）见 [`x-ui` 规范](../../../../zh/docs/spec/x-ui.md#各层-widget-props)。
