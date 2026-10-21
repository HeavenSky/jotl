# Write a widget

**English** · [简体中文](../zh/docs/widget-contract.md)

This page tells you which props your component receives and what it must do with them. Register the finished component as described in [Replace and register widgets](custom-widgets.md).

## A minimal field widget

```tsx
import type { FieldProps } from "@jotl/form/core";
import type { ReactNode } from "react";

export function MySwitch({
	id,
	value,
	onChange,
	onBlur,
	mode,
	errors,
}: FieldProps<boolean, ReactNode>) {
	return (
		<input
			id={id}
			type="checkbox"
			role="switch"
			checked={value === true}
			disabled={mode !== "edit"}
			aria-invalid={errors.length > 0}
			onChange={event => onChange(event.target.checked)}
			onBlur={onBlur}
		/>
	);
}
```

Register it with `{ name: "switch", level: "field", component: MySwitch }`. The field shell around it renders the label, description and errors.

## Rules every widget follows

- Widgets are stateless and controlled: the value comes only from `value`, and changes go only through `onChange`.
- The one allowed local state is draft text that is not yet valid while typing (a lone `-` in a number box, an unclosed bracket in JSON); call `onChange` as soon as it becomes valid. `number`, `money` and `bigint` also keep focus state to switch between the raw value and the thousands-separated display.
- Respect `mode`: `edit` is editable, `view` is read-only display, `disabled` is disabled.
- Use `id` on the control so the shell's `<label for>` and `aria-describedby` reach it.
- A missing adapter is not an error: fall back to a simpler form.

## Props by level

The level you register decides the props type. All types are exported from `@jotl/form/core` and defined in [`src/core/contracts.ts`](../src/core/contracts.ts); `N` is the node type, `ReactNode` in React.

| Level       | Props                                                                         | Built-in names                                                       | What the widget gets beyond `BaseProps`                                                                                                |
| ----------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `view`      | `ViewProps<N>`                                                                | `form`                                                               | `submit()` `reset()` `children`; `errors` that belong to no visible field; optional `goToError(error)` to jump to one                  |
| `decorator` | `DecoratorProps<N>` (not `BaseProps`)                                         | `field`                                                              | `id` `label?` `description?` `required` `errors` `hidden` `children`                                                                   |
| `layout`    | `LayoutProps<N>`                                                              | `page` `inline`                                                      | `fields` (ordered, with `hidden` and `errorCount`), `groups`, `layout`, `columns`, optional `additional` for keys outside `properties` |
| `field`     | `FieldProps<V, N>`                                                            | `input` `number` `switch` `select` `date` and the other scalar names | `required` `value` `onChange(value)` `onBlur()` `errors` `thousands?`                                                                  |
| `composite` | `ArrayProps` `TupleProps` `MapProps` `UnionProps` `NullableProps` `TreeProps` | `list` `tuple` `kv` `union` `nullable` `tree`                        | Item lists with stable keys and add / remove / move operations, or branch, null and expand state with a `renderContent()`              |

`BaseProps<N>`, shared by every level except `decorator`, carries `id`, `schema`, `dataPath` (the actual path, with numeric array indexes), `mode`, `props` (the merged `x-ui.props`), `adapters` and `renderChild(relativePath)`.

## Render children

Container widgets do not render their children's widgets themselves; they call `renderChild` with a relative data path such as `"img"`, `"0"` or `"0/img"`, and the child's own `x-ui` still applies. `union`, `nullable` and `tree` call `renderContent()` instead, which renders the active content at the same data path.

## Reuse the default look

`styles` (the utility classes of each default widget) and `cn` (class name merging) are exported from `@jotl/form`, so a custom widget can match the default appearance. `useLocale()` and `useL10n()` give it the form's language; see [Set the form language](locale.md).

The full field-by-field contract, including the render plan, is in the [`x-ui` specification](../../../docs/spec/x-ui.md#widget-props-by-level).
