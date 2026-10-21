# Replace and register widgets

**English** · [简体中文](../zh/docs/custom-widgets.md)

This page shows how to swap a default widget for your own component and how to pass adapters such as file upload. To write the component itself, see [Write a widget](widget-contract.md).

## Override one built-in name

```tsx
import { createDefaultRegistry } from "@jotl/form";

// A registry created on every render is reused from the previous render when its registrations (including the parent's) are shallowly equal item by item, so the form does not re-plan; creating it once outside the component skips the comparison.
const registry = createDefaultRegistry().extend();
registry.register({ name: "switch", level: "field", component: MySwitch });

<JotlForm schema={schema} registry={registry} adapters={{ upload: uploadToCdn }} />;
```

- A registration with the same name overrides the default widget, and a registry level overrides its parent. Widgets you do not override keep using the native HTML defaults.
- `name` is a built-in widget name (the full list is `BUILTIN_WIDGETS` in `@jotl/form/core`) or a name of your own that schemas select with `x-ui.widget`. `level` decides which props the component receives (see [Write a widget](widget-contract.md)); for a built-in name, use its level from `BUILTIN_WIDGETS`.
- `createRegistry(registrations?, parent?)` from `@jotl/form/core` builds a registry from a list; passing `parent` is the same as `parent.extend()`.

## Optional registration fields

| Field                | Use                                                                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `load`               | Loads the component on demand; it receives `{ locale }`, the language of the form that first triggers loading. Until it resolves, `component` renders as a placeholder; on failure a retry is shown and the next candidate widget is used                                               |
| `accepts(schema)`    | Rejects data shapes the widget cannot handle; a rejected widget falls back with F2. Built-in names are already shape-checked by `plan()`, so the default registrations carry no `accepts`                                                                                               |
| `match(schema, ctx)` | Makes the widget a candidate by score: a score above 0 takes part, higher scores rank first, and on equal scores the earlier registration in `list()` wins (this level before the parent). Matched widgets rank after the names in `x-ui` and before the built-in default for the shape |
| `claims(schema)`     | For composite widgets: the relative child data paths the widget renders itself, or `"all"`                                                                                                                                                                                              |

## Pass adapters

`adapters` is passed as is to every widget. All three entries are optional, and a widget without its adapter falls back to a simpler form without errors:

| Adapter               | Used by                                                                                                          | Without it            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| `upload(file, ctx)`   | `image`, `file`: returns the URL to store; `ctx` is the field starting the upload (`dataPath`, `schema`)         | Only a URL text box   |
| `loadOptions(source)` | Your own widgets that fetch remote options, returned as `{ value, label }[]`; the default widgets do not call it |                       |
| `richText(props)`     | `richtext`: renders an editor; pass this package's `richTextEditor` for a minimal one                            | A multi-line text box |

## Avoid needless re-renders

`adapters` is compared key by key and `registry` by its registrations, both shallowly, so a new object with unchanged content neither re-renders nor re-plans the form. Functions created on every render, such as inline arrow functions, count as changes; define them outside the component or memoize them.

## Use the default widgets without `JotlForm`

`createDefaultRegistry()` already registers the native HTML widgets. When you render with your own renderer, register them into any registry that implements the `Registry` interface of `@jotl/form/core`:

```ts
import { registerHtmlWidgets } from "@jotl/form";

// registry: any registry implementing the @jotl/form/core `Registry` interface.
registerHtmlWidgets(registry);

// Replace a single default component: register a same-named component in an instance-level registry; this level overrides the parent.
const local = registry.extend();
local.register({ name: "input", level: "field", component: MyTextInput });
```

`htmlWidgets` is the same list as an array of registrations, and each default component is also exported (`InputWidget`, `FieldDecorator`, ...) for registration under another name.

For Ant Design components, [`@jotl/antd`](../../antd/README.md) provides a ready-made registry.
