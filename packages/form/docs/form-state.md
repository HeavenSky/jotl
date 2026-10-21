# Control form data and validation

**English** · [简体中文](../zh/docs/form-state.md)

This page shows how to feed data into `JotlForm`, read it back, and decide when validation runs. It assumes you already render a form as in the [README](../README.md#get-a-form-on-screen).

## Read and write values through a ref

```tsx
import { useRef } from "react";
import { JotlForm, type JotlFormHandle, type JotlFormProps } from "@jotl/form";
import "@jotl/form/style.css";

const schema: JotlFormProps["schema"] = {
	type: "object",
	properties: { title: { type: "string", title: "标题", maxLength: 20 } },
	required: ["title"],
};

export function Page() {
	const form = useRef<JotlFormHandle>(null);
	return (
		<JotlForm
			ref={form}
			schema={schema}
			defaultValue={{}}
			onSubmit={value => console.log(value)}
		/>
	);
}
```

The `ref` exposes the instance API:

| Method             | Effect                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------- |
| `getValues()`      | Returns the current value                                                               |
| `setValues(value)` | Replaces the whole value and notifies `onChange`; does not fill defaults                |
| `validate()`       | Validates the whole form and shows all errors; returns the `ValidationResult`           |
| `reset()`          | Returns to the initial value (with defaults filled) and clears errors and touched state |
| `submit()`         | Validates and calls `onSubmit` when valid; returns the `ValidationResult`               |

## Choose controlled or uncontrolled

- Uncontrolled: pass `defaultValue`. Controlled: pass `value` and `onChange`; when the parent does not accept a change, the form reverts to `value`.
- Fields missing from the initial value are filled from the schema's `default`; in controlled mode the filled result is reported once through `onChange`. The `defaults` prop passes options to that filling (`DefaultsOptions` of `@jotl/core`).
- `schema` is compared by content, so a new object with the same content on every render does not affect the form. When uncontrolled, a content change re-initializes the data for the new schema (`defaultValue` filled with defaults, or per `initialData`), clears touched state and errors, and notifies `onChange` once; when controlled, data only comes from `value`.

## Start from generated data

With `initialData="mock"`, a form given neither `value` nor `defaultValue` generates its initial data with `mock()` from `@jotl/data`, and `reset()` returns to that data. `mockSeed` fixes the random seed, so the same seed generates the same data; without it each mount is random. The default `"defaults"` fills schema defaults. New array elements and other added data still use defaults.

## Decide when errors appear

- `validateOn` takes `"change"`, `"blur"` (default) or `"submit"` and sets the earliest validation moment. Submitting always validates, and after one validation every change re-validates.
- Before a submit or a `validate()` call, only errors of touched fields are shown.
- `onValidate(result)` is called after every validation; `onSubmit(value)` only after a submit that passes.

## Switch modes and scenes

- `mode` takes `"edit"` (default), `"view"` or `"disabled"`. In `view` there are no submit or array action buttons.
- `scene` selects a scene from `x-ui.variants` (default `"default"`).
- `maxDepth` sets how many levels a recursive type is expanded along one path before it is planned lazily (default 2); see [`PlanOptions`](core.md#plan-options).
- `locale` sets the language of widget text and validation messages; see [Set the form language](locale.md).

## Edit array items

Each array item can be moved up, moved down, deleted and duplicated. Duplicating deep-copies the item and inserts it after itself, and is disabled once the array reaches `maxItems`.

## Address fields by id

The field shell and the inner widget share one id built from the form `id` and the data path; compute it with `nodeId(formId, dataPath)`. Without an `id` prop each form instance gets `jotl-f<n>`, where `n` counts up per instance.
