# 控制表单数据与校验

[English](../../docs/form-state.md) · **简体中文**

本页说明如何把数据交给 `JotlForm`、如何读回，以及校验何时运行。前提是你已经按 [README](../README.md#把表单跑起来) 渲染出表单。

## 经 ref 读写值

```tsx
import { useRef } from "react";
import { JotlForm, type JotlFormHandle } from "@jotl/form";
import "@jotl/form/style.css";

const schema = {
  type: "object",
  properties: { title: { type: "string", title: "标题", maxLength: 20 } },
  required: ["title"],
};

export function Page() {
  const form = useRef<JotlFormHandle>(null);
  return <JotlForm ref={form} schema={schema} defaultValue={{}} onSubmit={(value) => console.log(value)} />;
}
```

`ref` 暴露实例 API：

| 方法 | 作用 |
|---|---|
| `getValues()` | 返回当前值 |
| `setValues(value)` | 整体替换表单值并通知 `onChange`；不填充默认值 |
| `validate()` | 校验整个表单并显示全部错误，返回 `ValidationResult` |
| `reset()` | 回到初始值（已填充默认值），清除错误与触碰记录 |
| `submit()` | 校验，通过时调用 `onSubmit`；返回 `ValidationResult` |

## 选择受控或非受控

- 非受控传 `defaultValue`；受控传 `value` 与 `onChange`，父组件不采纳改动时表单恢复为 `value`。
- 初始值缺失的字段按 schema 的 `default` 补全；受控模式下补全结果经 `onChange` 回报一次。`defaults` 属性把选项传给这一补全过程（`@jotl/core` 的 `DefaultsOptions`）。
- `schema` 按内容比较，每次渲染新建内容相同的对象不影响表单。非受控时内容变化会按新 schema 重新初始化数据（`defaultValue` 补默认值，或按 `initialData`），清掉触碰与错误，并经 `onChange` 通知一次；受控时数据只来自 `value`。

## 从生成的数据开始

`initialData="mock"` 时，未传 `value` 与 `defaultValue` 的表单用 `@jotl/data` 的 `mock()` 生成初始数据，`reset()` 回到这份数据。`mockSeed` 固定随机种子，同一种子生成同样的数据；不传时每次挂载随机。默认值 `"defaults"` 按 schema 默认值补全。新增数组元素等新增数据仍按默认值。

## 决定错误何时出现

- `validateOn` 取 `"change"`、`"blur"`（默认）或 `"submit"`，表示最早的校验时机。提交总会校验，校验过一次之后每次改动都重新校验。
- 提交或调用 `validate()` 之前，只显示已触碰字段的错误。
- `onValidate(result)` 在每次校验后调用；`onSubmit(value)` 只在提交且校验通过时调用。

## 切换模式与场景

- `mode` 取 `"edit"`（默认）、`"view"` 或 `"disabled"`。`view` 下没有提交与数组操作按钮。
- `scene` 选择 `x-ui.variants` 中的场景（默认 `"default"`）。
- `maxDepth` 设定递归类型在一条路径上展开几层后改为按需规划（默认 2），见 [`PlanOptions`](core.md#规划选项)。
- `locale` 决定 widget 文案与校验消息的语言，见[设置表单语言](locale.md)。

## 编辑数组项

数组每项可以上移、下移、删除和复制。复制会深拷贝该项并插入其后，数组达到 `maxItems` 时禁用。

## 按 id 定位字段

字段外壳与内层 widget 共用一个 id，由表单 `id` 与数据路径组成，可用 `nodeId(formId, dataPath)` 求出。未传 `id` 属性时，每个表单实例取 `jotl-f<n>`，`n` 按实例递增。
