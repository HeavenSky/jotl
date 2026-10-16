# @jotl/antd

**English** · [简体中文](./README.zh-CN.md)

Read this page when rendering `@jotl/form`'s `JotlForm` with Ant Design components, or when checking which built-in widget names use antd and which fall back to the native HTML widgets; it corresponds to `packages/antd`.

## Usage

Peer dependencies: `antd` 5 or 6, `react` 18 or 19.

```tsx
import dayjs from "dayjs";
import { JotlForm } from "@jotl/form";
import { createAntdRegistry } from "@jotl/antd";

// Create it once outside the component; a new registry on every render makes the form re-plan.
const registry = createAntdRegistry({ dayjs });

<JotlForm schema={schema} registry={registry} onSubmit={save} />;
```

- `createAntdRegistry(options?)`: a new registry whose parent is `createDefaultRegistry()` of `@jotl/form`, with the antd widgets registered; names without an antd implementation resolve to the native widget in the parent.
- `antdWidgets(options?)`: the registrations (`WidgetRegistration[]`, no `accepts`; shape checks are done by `plan()` of `@jotl/form/core`); `registerAntdWidgets(registry, options?)` registers them into any registry, overriding same-named widgets.
- `options.dayjs`: pass the same `dayjs` that antd uses (antd loads the `customParseFormat` and `advancedFormat` plugins on it). Without it `date` `time` `datetime` are not registered and fall back to the native date inputs.
- Each widget component is also exported (`AntdInputWidget`, `AntdFieldDecorator`, ...) for registering under other names.

## Coverage

| widget name | antd component | Notes |
|---|---|---|
| `form` | native `<form>` + `Form` (`component={false}`, vertical layout) + `Button` + `Alert` | Submit / reset buttons; errors not belonging to a visible field in an `Alert`; `mode="disabled"` disables antd controls through `Form`'s `disabled` |
| `field` | `Form.Item` | Label, required mark, `description` as `extra`, errors as `help` with `validateStatus="error"` |
| `page` `inline` | `Card` for groups, `Tabs` for `layout: "tabs"`, CSS grid for `layout: "grid"` | Other keys (`additional`) reuse `EntryEditor` of `@jotl/form` |
| `list` | one `Card` per item, `Button` | Move up / down, duplicate (when provided), remove, add |
| `input` `password` `textarea` | `Input`, `Input.Password`, `Input.TextArea` | `maxLength` passed through |
| `url` `email` | `Input` with `type` | Clearing writes `undefined` |
| `number` | `InputNumber` | Empty writes `undefined`; `minimum` / `maximum`; integer and `x-decimals` via `precision`; `thousands` via formatter |
| `range` | `Slider` | |
| `switch` | `Switch` | |
| `checkbox` | `Checkbox`; `Checkbox.Group` for enum arrays | |
| `radio` | `Radio.Group` | |
| `select` | `Select`; `mode="multiple"` for enum arrays | Clearable when not required; values outside the options are kept at the end |
| `date` `time` `datetime` | `DatePicker`, `TimePicker`, `DatePicker showTime` | Only with `options.dayjs`; read and write in the storage format (`x-valueFormat`, else by `format`), local time zone; a stored value that does not parse is handed to the native widget, shown as is and not rewritten |
| `color` | `ColorPicker` | Writes `#rrggbb`; clearing writes `undefined` |
| others: `richtext` `money` `bigint` `output` `image` `file` `json` `kv` `union` `nullable` `tree` `tuple` | native widgets of `@jotl/form` | Through the parent registry |

## Language and styles

- Texts rendered by these widgets (submit, reset, add, remove, placeholders, tab error counts) follow the form language: `JotlForm`'s `locale`, else the global `getLocale()`.
- The language of antd's own components (date panels, color picker, empty states) is decided by the host's `ConfigProvider locale`, and the date panel's locale also by `dayjs.locale(...)`.
- antd styles need no import (CSS-in-JS). The native fallback widgets and the drill-down entry rows / breadcrumbs of `@jotl/form` look best with `@jotl/form/style.css`; it is optional.
