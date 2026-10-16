# @jotl/antd

**English** · [简体中文](./zh/README.md)

Render Jotl forms with Ant Design components: one registry swaps the native widgets of @jotl/form for antd.

`@jotl/antd` is for apps already built on Ant Design that render forms from JSON Schema with [`@jotl/form`](../form/README.md). Instead of mapping every field type to an antd component yourself, you pass one registry to `JotlForm`: labels become `Form.Item`, numbers `InputNumber`, enums `Select` or `Radio.Group`, dates `DatePicker`. Names without an antd implementation keep the native widget, so every schema still renders completely, and the `JotlForm` API stays the same.

## See the difference

```tsx
import dayjs from "dayjs";
import { JotlForm } from "@jotl/form";
import { createAntdRegistry } from "@jotl/antd";

// Create it once outside the component; a new registry on every render makes the form re-plan.
const registry = createAntdRegistry({ dayjs });

<JotlForm schema={schema} registry={registry} onSubmit={save} />;
```

With the same `schema`, the form now uses antd's vertical `Form` layout: each field is a `Form.Item` with label, required mark and error help, strings use `Input`, booleans `Switch`, `format: "date"` strings `DatePicker`, and the submit and reset buttons are antd `Button`s.

## Switch an existing form to antd

1. Add the packages: `pnpm add @jotl/form @jotl/antd antd dayjs`
2. Create the registry once with `createAntdRegistry({ dayjs })`, as above.
3. Pass it to every `JotlForm` as `registry={registry}`.

Peer dependencies: `antd` 5 or 6, `react` 18 or 19.

## What you get

- **Antd look without per-field wiring.** Seventeen built-in widget names (twenty with `dayjs`), from `form` and `field` to `select` and `color`, render with antd components; see [Which widgets use antd](docs/coverage.md).
- **Nothing breaks for the rest.** Names without an antd version (`money`, `kv`, `union` and others) resolve to the native widgets of `@jotl/form` through the parent registry.
- **Dates in your dayjs.** Pass the `dayjs` antd already uses and `date`, `time` and `datetime` read and write in the schema's storage format; leave it out and they fall back to native date inputs.
- **Mix and override.** `antdWidgets()` and `registerAntdWidgets()` add the antd widgets to any registry, and each component is exported for registration under other names.

## When to use something else

Use the default widgets of `@jotl/form` if your app is not on Ant Design or runs React 16 or 17: this package needs React 18 or 19 and antd 5 or 6. For another component library, register your own widgets as described in [Replace and register widgets](../form/docs/custom-widgets.md).

## Read more

- [Guide index](docs/README.md): coverage table, language and styles.
- [`@jotl/form`](../form/README.md): the form component, drill-down, fallbacks and the widget contract.

## License

[MIT](../../LICENSE)
