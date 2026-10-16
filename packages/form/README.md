# @jotl/form

**English** · [简体中文](./README.zh-CN.md)

Read this page when rendering forms from JSON Schema (including `x-ui`) in a React app, replacing or extending Jotl form widgets, choosing how to wire in styles or regenerating and manually checking styles after changes, implementing a renderer for another UI framework, or querying in a tool which widget a schema node ends up with; it corresponds to `packages/form`.

`@jotl/form` consists of three parts:

- Main entry `@jotl/form`: the React renderer (`src/react/`) and native HTML default widgets (`src/html/`). The renderer renders the form from the render plan, using native HTML widgets by default; default data and validation come from `@jotl/data`.
- Subpath `@jotl/form/core` (`src/core/`): parses and merges `x-ui`, manages the widget registry, computes a data-independent render plan (a `RenderPlanNode` template tree) from the schema, and makes fallback decisions at planning time; it depends on no UI framework and neither reads nor writes data.
- Styles: the precompiled `@jotl/form/style.css`, plus `@jotl/form/tailwind.css` and `@jotl/form/theme.css` for Tailwind v4 hosts to compile themselves.

The contracts for fields, merge order, widget name candidates, the render plan and per-level props are in `docs/spec/x-ui.md` (Chinese); the default widget table and each widget's behavior conventions are in `docs/spec/html-widgets.md` (Chinese); this page does not repeat them.

## Installation

```sh
pnpm add @jotl/form react react-dom
```

`react` is an optional peer dependency supporting `^16.8.0 || ^17 || ^18 || ^19`; React is not needed when only using `@jotl/form/core`. The package compiles JSX with its own runtime `@jotl/form/jsx-runtime` (plain `React.createElement`), so it does not need `react/jsx-runtime`, which only exists from React 16.14; hosts need no configuration for it. `pnpm --filter @jotl/form run test:react-compat` runs the compatibility tests against React 16, 17, 18 and 19 in turn.

## Minimal example

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

- Uncontrolled: pass `defaultValue`; controlled: pass `value` and `onChange`; when the parent does not accept a change, the form reverts to `value`.
- `schema` is compared by content: a new object with the same content on every render does not affect the form. When uncontrolled, a content change re-initializes the data for the new schema (`defaultValue` filled with defaults, or per `initialData`), clears touched state and errors, and notifies `onChange` once; when controlled, data only comes from `value`.
- Fields missing from the initial value are filled from the schema's `default`; in controlled mode the filled result is reported once via `onChange`.
- The instance API is exposed via `ref`: `getValues()` `setValues(value)` `validate()` `reset()` `submit()`.
- `validateOn` takes `"change"` `"blur"` (default) `"submit"`, meaning the earliest validation moment; submission always validates, and after one validation every change re-validates. Before submitting or calling `validate()`, only errors of touched fields are shown.
- `mode` takes `"edit"` (default) `"view"` `"disabled"`; `scene` selects a scene from `x-ui.variants`.
- `locale` (`"zh-CN"` `"en"`) sets the language of the widgets' UI text and of validation messages; when omitted, `@jotl/core`'s global `getLocale()` is used (default `en`). Inside custom widgets, `useLocale()` reads the form's language and `useL10n()` returns `(zh, en) => string`; both read `LocaleContext`, falling back to the global language outside a form.
- With `initialData="mock"`, a form given neither `value` nor `defaultValue` generates its initial data with `@jotl/data`'s `mock()` (`mockSeed` fixes the random seed), and `reset()` returns to that data; the default `"defaults"` uses schema defaults. New array elements etc. still use defaults.
- Besides move up, move down and delete, each array item can be duplicated: it is deep-copied and inserted after itself; disabled at `maxItems`.

## Drill-down rendering

By default the form shows one page per level: scalar fields of the current level are edited directly; composite fields (objects, arrays, dictionaries, unions with object branches, recursive nodes) are shown as entry rows that you click to enter the next level; the breadcrumb at the top consists of each level's label, and clicking a parent level goes back.

```tsx
const [path, setPath] = useState("");
<JotlForm schema={schema} path={path} onPathChange={setPath} />;
```

- `path` is the data path (JSON Pointer) of the current page and can be synced to the host router; when not passed the form maintains it internally, starting at the root `""`; when passed it is controlled, and entering and going back are only notified via `onPathChange`.
- Objects with `x-ui.widget: "inline"` are expanded within the parent page; on array and dictionary pages scalar elements are edited directly and composite elements are entry rows.
- Entry rows show the label, a summary and the number of errors below. The summary takes the field specified by `x-ui.summary` (`summary` on arrays and dictionaries applies to elements); when not written, the first non-empty string field; array elements without one show `第 n 项` (item n); in the breadcrumb array elements likewise use the summary or index, and dictionary values use the key name.
- When submit validation fails it jumps to the level of the first error; when the array element or dictionary key currently shown is deleted (likewise when a dictionary key is renamed) it goes back to the level of the array or dictionary; both are notified via `onPathChange`.
- Errors not on the current page are shown in the form-level list at the top of the page, and the upper levels of the breadcrumb also mark the number of errors beneath them (and not in the next level); after clicking that level, entry rows indicate the location. Clicking an error in the form-level list switches to the page it is on, then scrolls to and focuses the field; without drill-down it focuses directly, and when the field is hidden it focuses the nearest visible ancestor.
- With `drill={false}` all levels are expanded on one page, with no entry rows or breadcrumb, and `path` is ignored; when `collapsible` is also passed, objects (except `inline`), arrays, dictionaries and unions with object branches are each wrapped in a collapsible panel whose header shows the title (`第 n 项` for array elements), the summary and the number of errors below, with the first level expanded by default.

## Replacing widgets

```tsx
import { createDefaultRegistry } from "@jotl/form";

// A registry created on every render is reused from the previous render when its registrations (including the parent's) are shallowly equal item by item, so the form does not re-plan; creating it once outside the component skips the comparison.
const registry = createDefaultRegistry().extend();
registry.register({ name: "switch", level: "field", component: MySwitch });

<JotlForm schema={schema} registry={registry} adapters={{ upload: uploadToCdn }} />;
```

- A registration with the same name overrides the default widget, this level overrides the parent level, and widgets not overridden keep using the default native HTML widgets; `adapters` is passed as is to every widget.
- A registration with `load` loads the widget on demand: before loading, `component` is rendered as a placeholder; on failure a retry is shown and the next candidate widget is used instead.
- `adapters` is compared key by key and `registry` by its registrations, both shallowly; a new object with unchanged content neither re-renders nor re-plans the form. Functions created on every render (such as inline arrow functions) count as changes.

## Extension component modules

Extension components declared with a module in Jotl (root entry metadata `widgets`, see the `@jotl/core` README) are compiled into the schema's root `x-ui.widgets` (name → `{ module, export? }`). With `schemaModules`, `JotlForm` registers these declarations into the form's own registry (overriding same-named widgets) and loads them on demand:

```tsx
// Compiled from: Form: [widgets: {ImagePicker: {base: 'url', module: 'https://esm.sh/image-picker'}}] { cover: ImagePicker }
<JotlForm schema={schema} locale="en" schemaModules />;

// Custom loading or a base for relative module addresses (./ ../ /)
<JotlForm schema={schema} schemaModules={{ baseUrl: "https://cdn.example.com/widgets/", importer: (url) => import(/* @vite-ignore */ url) }} />;
```

- `schemaModules` defaults to `false`; `true` uses dynamic `import()`; an object is passed as options `{ importer?, baseUrl? }`.
- A module's export (`export`, default `default`) must be a React component satisfying the widget contract: registered at the `field` level, receiving `FieldProps` from `@jotl/form/core` (`value` `onChange` `onBlur` `errors` `id` `schema` `mode` `props` etc.) and taking over the whole value. When loading fails or the export is not a component, an F9 failure with retry is shown.
- Third-party components usually do not follow this contract: they spread unknown props onto DOM elements (`schema`, `adapters`, etc. become attributes) and use their own prop names (e.g. `HexColorInput` reads `color`, not `value`). Export a thin wrapper that maps `FieldProps` to the component's props instead of pointing the module at the third-party component directly.
- In the browser, a remote module must use the host's single copy of React: map `react` (and `react/jsx-runtime` if the module uses it) via an import map, or an equivalent, to the same React instance as the host; otherwise hooks fail with two React copies.
- Without `JotlForm`: `schemaWidgetModules(schema)` reads the module declarations from the root `x-ui.widgets` (invalid items skipped), and `moduleWidgetRegistrations(modules, { importer?, baseUrl? })` turns name → `{ module, export?, level? }` into registrations with `load`, to register into your own registry; for module declarations from `jotl.config.json` (`readJotlConfig(...).config.modules` of `@jotl/core`), pass `baseUrl` as the configuration file's location.

## Fallback and debugging

- When a widget throws while rendering, the alternative widgets in the render plan are tried in turn, and a composite widget that throws is split into rendering each child node individually; when the data type does not match the schema, the original value is kept, an error is marked, and JSON editing is used instead.
- When the registry has no widget at all, the renderer's built-in JSON text box is the last resort; the screen never goes blank.
- `onDegrade(event)` is called once per fallback; the event contains the code (F1-F9), data path, schema pointer, original widget and replacement widget.
- `<JotlDebug schema registry events />` lists each node's chosen widget, its source and fallback records; `useDegradeLog()` collects the events reported by the form for it to display; `locale` sets its text language, defaulting to the global language.

```tsx
const log = useDegradeLog();
<JotlForm schema={schema} onDegrade={log.onDegrade} />
<JotlDebug schema={schema} events={log.events} />
```

## Node ids

The shell and the inner widget use the same id, composed of the form `id` and the data path, computable with `nodeId(formId, dataPath)`; when `id` is not passed, each form instance gets `jotl-f<n>` (`n` counts up per instance; `useId` is not used, since it only exists from React 18).

## Default HTML widgets

The default widgets implement `@jotl/form/core`'s built-in widget names with native HTML tags, all stateless controlled widgets; their appearance is expressed with Tailwind CSS v4 utility classes prefixed `jt:`, and the host does not need to use Tailwind. `createDefaultRegistry()` already registers them; when not using this package's React renderer, you can register them into your own registry:

```ts
import { registerHtmlWidgets } from "@jotl/form";

// registry: any registry implementing the @jotl/form/core `Registry` interface.
registerHtmlWidgets(registry);

// Replace a single default component: register a same-named component in an instance-level registry; this level overrides the parent.
const local = registry.extend();
local.register({ name: "input", level: "field", component: MyTextInput });
```

- UI text of the widgets (buttons, placeholders, messages) has Chinese and English versions chosen by the form's `locale`; the Chinese text is quoted below, with the English in parentheses.
- Image and file widgets show the "上传图片" (Upload image) / "上传文件" (Upload file) button only when `adapters.upload` is passed, otherwise only a URL input; during upload a status is shown, and on failure a readable message.
- Rich text `richtext` renders a rich-text editor only when `adapters.richText` is passed, otherwise a multi-line text box; passing this package's `richTextEditor` gives a minimal `contenteditable` editor (bold, italic, link, list; values cleaned by the `sanitizeHtml` allowlist), see "富文本编辑器" (Rich-text editor) in `docs/spec/html-widgets.md`.
- The "复制" (Duplicate) action on each `list` item appears only when the renderer provides `duplicate`.
- Registrations carry no `accepts`: the data shapes each built-in name accepts are checked by `@jotl/form/core`'s `plan()`, falling back to that shape's default widget when not accepted.
- `page` and `inline` are the same object widget; drill-down (one page per level, entry rows, breadcrumb) is done by the renderer, and the widget only lays out the current level.
- `money` `bigint` use a text box (`inputmode` `decimal` / `numeric`) whose value is a `{ type, value, ... }` object; on focus the raw value is shown, on blur and when read-only it is shown with thousands separators (on by default for `money`, controlled by `FieldProps.thousands`); while typing `,` `，` spaces and `_` are stripped, and invalid input keeps the draft with a message; `money` pads to fixed decimal places on blur, and currency and unit are shown as text or a dropdown per the schema's `const` / `enum`.
- `number` sets `step` from `x-decimals` and rounds on blur; with thousands separators enabled it uses a text box instead. `switch` is a checkbox with `role="switch"`; `checkbox` is a single checkbox for booleans and a group for enum arrays; `select` is a multi-select dropdown for enum arrays.
- `date` `time` `datetime` use the native `date` `time` `datetime-local` controls, displayed in the local time zone; reading and writing follow the node's storage format `x-valueFormat` (dayjs format strings, `x` `X` millisecond / second timestamps, aliases `iso` `iso-x` `utc` `utc-x`), falling back to the widget default (`YYYY-MM-DD` for `date`, `HH:mm:ss` for `time`, `iso` for `datetime`). Aliases accept any RFC 3339 date-time on read and are normalized to the alias on write; picking a `date` takes local midnight of that day, `time` takes that time today. When the storage format contains seconds (`ss`) or is an alias or timestamp, the control shows seconds (`step=1`), and a custom format with milliseconds (`SSS`) shows milliseconds (`step=0.001`). An existing value not matching the storage format is shown as is in a text box with a message, without rewriting the data; only typed text that parses with the storage format is written back.
- `json` for a string schema (`contentMediaType: application/json`) edits the raw text; the value remains a string and only needs to be parseable.

### Composite widgets and object layouts

| Widget or layout | What the user sees | Interaction conventions |
|---|---|---|
| `nullable` | "置为空" (Set to null) checkbox + the original widget | When checked the value is `null` and only "空值" (null) is shown; toggling only in `edit` mode |
| `union` | "类型" (Type) dropdown + the current branch's subform | No dropdown when there is only one branch; data after switching branches is provided by the renderer; with `x-ui.props.selector` `"buttons"` and at most 4 branches it becomes segmented buttons |
| `kv` | A list of key input + value + delete button, with "增加" (Add) at the end | New entries get unused key names like `key1` `key2`; when a key is cleared or duplicates another entry only a message is shown, data is unchanged |
| `tuple` | Items laid out by position, labeled by the item's `title` or `第 n 项` (item n) | Elements cannot be added or removed; extra elements allowed by `items` are not shown and the data is kept as is |
| `page` / `inline` + other keys | When the object also has `additionalProperties` in schema form, an "其他键" (Other keys) group after the fields | Same as `kv`: keys can be added, deleted and renamed, but cannot take declared property names |
| `tree` | "展开" (Expand) / "收起" (Collapse) button + content | Content is not rendered when collapsed; expandable in `view` mode, not in `disabled` mode |
| `page` / `inline` + `layout: "tabs"` | One tab per group, ungrouped fields on the first tab | Switching tabs does not change data; arrow keys, `Home`, `End` move between tabs; without groups it lays out as `stack`; not switchable in `disabled` mode; tabs show the number of errors of their fields (from `LayoutField.errorCount`) |
| `page` / `inline` + `layout: "grid"` | Fields arranged in `columns` columns, 2 by default | Each group forms its own grid; column width is set via an inline `--jotl-columns` and takes effect only with `style.css` included |

- Root elements of objects, arrays and the composite widgets above reference the shell label via `aria-labelledby`, so screen readers and `getByLabelText` can find them by field label. The shell decides after rendering: its `<label>` gets `for` only when the inner root element is a labelable control (`input` other than hidden, `select`, `textarea`, etc.); around composite widgets it has no `for`.
- Content controls inside nullable and union (ids ending in `+`, without their own shell) take the enclosing field's label via `aria-labelledby`; the `<pre>` of `json` in view state is likewise associated with the label via `aria-labelledby`.

## Wiring in styles

Styles are optional; without them widgets work as usual, just without basic layout (including the drill-down breadcrumb and entry rows).

Widgets output both `jotl-` semantic class names (for external overrides and test targeting) and Tailwind utility classes prefixed `jt:` (expressing appearance). All generated CSS lives in cascade layers (`theme` `components` `utilities`), without preflight; the host's unlayered styles naturally take precedence, so writing `.jotl-input { ... }` directly overrides them.

Colors and spacing can be reskinned by overriding `--jotl-gap` `--jotl-radius` `--jotl-border` `--jotl-divider` `--jotl-focus` `--jotl-focus-hover` `--jotl-focus-ring` `--jotl-error` `--jotl-text` `--jotl-muted` `--jotl-surface` `--jotl-disabled-bg` `--jotl-disabled-text` `--jotl-switch-off` `--jotl-option-hover` `--jotl-option-selected` on any outer element.

**Precompiled (host does not use Tailwind)**: import `@jotl/form/style.css`.

**Tailwind v4 host compiles itself**: create a separate CSS entry (do not merge it into the host's own `@import "tailwindcss"` entry; the `jt` prefix only applies to this entry), processed by the host's Tailwind build (e.g. `@tailwindcss/vite`); see `apps/playground/src/jotl.css` for reference:

```css
/* jotl.css */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme) prefix(jt);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@import "@jotl/form/tailwind.css";
```

- `tailwind.css` uses `@source` to scan the `src` published with the package, and `source(none)` turns off automatic scanning of the host project, so only utility classes used by widgets are generated.
- The design variables (`theme.css`, bound to `--jotl-*` via `@theme inline`) can also be imported alone with `@import "@jotl/form/theme.css"` for the host's `jt:` utility classes, e.g. `jt:text-muted` `jt:border-border` `jt:rounded-base`.

**Regenerating after style changes**: after widget class names or `tailwind.css` `theme.css` change, run `pnpm --filter @jotl/form run build:css` to regenerate `style.css` (entry `style.entry.css`, unminified); `test/package.test.ts` compares the regenerated result with the `style.css` in the repository, and fails if you forget to regenerate.

## Manual verification of style.css

jsdom does not compute styles, so the following can only be checked in a real browser.

1. Run `pnpm build` at the repository root.
2. In a package directory that depends on `@jotl/form` (e.g. `apps/playground`), run `node --input-type=module -e "console.log(import.meta.resolve('@jotl/form/style.css'))"`; the expected output is the `file://` path of `packages/form/style.css`.
3. In any React 19 + Vite page, `import "@jotl/form/style.css"` and use Jotl to render a schema containing strings, numbers, enums, booleans, images, object groups, object arrays, nullable fields, unions, dictionaries, recursive references, and objects with `[layout: 'tabs']` and `[layout: 'grid', columns: 3]`, then check each item in the table below.

| Action | Expected |
|---|---|
| Open the page | Fields are stacked vertically, labels above controls, with a red `*` after the label of required fields |
| Tab through inputs, dropdowns and buttons | Each focused control has a blue outline |
| Submit an invalid field | That field's border turns red and red error text appears below |
| Type incomplete JSON into the JSON fallback widget | A red message appears below the text box, and the typed text is not cleared |
| An array reaches `maxItems` | The "增加" (Add) button fades and the cursor shows the not-allowed style |
| Enter an image URL | The preview image does not exceed the container width and is no taller than about 12rem |
| Switch the form to `view` and `disabled` | Input backgrounds turn gray; in `view` there are no submit or array action buttons |
| Set `--jotl-focus: red` on an outer element of the page | The focus outline and primary button turn red |
| Look at an object with `tabs` layout | Tabs are laid out horizontally with a divider below; the selected tab is bold, in the focus color, and joined with the content below; only the selected tab's fields are shown |
| Look at an object with `grid` layout | Fields form a 3-column equal-width grid, and on narrow screens controls do not overflow their cells |
| Check "置为空" (Set to null) on a nullable field | The original widget disappears and a gray italic "空值" (null) is shown |
| Expand a recursive field | Content is below the button, indented with a vertical line on the left |
| Look at a dictionary field | Each row has a fixed-width key box on the left, the value in the middle and a delete button on the right; renaming a key to an existing name shows a red message below the box |
| Remove the `style.css` import and refresh | Widgets can still be typed into and submitted, only losing the layout above |

## @jotl/form/core

Use this subpath when implementing a Jotl renderer or widget package for another UI framework, or when querying widgets in a tool (such as the language service); it does not depend on React. This package's React renderer and default HTML widgets are both built on it.

```ts
import { BUILTIN_WIDGETS, createRegistry, evaluateCondition, plan } from "@jotl/form/core";

const schema = {
  type: "object",
  properties: {
    title: { type: "string", title: "标题", "x-ui": { widget: "headline" } },
    kind: { enum: ["a", "b"] },
    extra: { type: "string", "x-ui": { visibleIf: { field: "/kind", eq: "b" } } },
  },
  required: ["title"],
};

// A component package usually registers one implementation per built-in component name; here the name itself is a placeholder.
const registry = createRegistry(
  Object.entries(BUILTIN_WIDGETS).map(([name, { level }]) => ({ name, level, component: name })),
);

const { value: root, diagnostics } = plan(schema, registry);
// root.widget === "form", and its only child is the data root, with widget "page".
// /title: headline is not registered, falls back to "input", degraded is [{ reason: "F1", from: "headline" }].
// diagnostics: [JOTL5001 warning].
// /kind: an enum (with at least 2 options) defaults to "select"; when x-ui.widget names a built-in this shape does not accept (e.g. "switch"), it falls back to "select" via F2.

const extra = root!.children[0]!.children.find((c) => c.dataPath === "/extra")!;
evaluateCondition(extra.visibleIf!, { kind: "b" }, extra.dataPath); // true
```

- The render plan is a template tree: array indexes are written as `*`, and the number of array elements and the current branch of a union are decided by the renderer from the data.
- `summary` (objects, arrays, maps) and `thousands` (number money bigint; defaults to `true` for money) on nodes are taken from the merged `x-ui`, for the renderer's drill-down entry rows and numeric widgets.
- Widget values, validation and defaults are not in `core`; this package's React renderer uses `@jotl/data` for them.

### Public API

| Export | Purpose |
|---|---|
| `createRegistry(registrations?, parent?)` | Creates a registry; passing `parent` is equivalent to `parent.extend()`. In `list()` this level's registrations come first, and on equal matcher scores the earlier one wins |
| `plan(schema, registry, options?)` | Returns `Result<RenderPlanNode>`. With an empty `schemaPointer` (default) the root node is the view widget `form`; when it points to a child node, planning starts directly from that node, for on-demand planning at render time |
| `expand(node, schema, registry, ctx?)` | Expands a node with `lazy: true`, returning `Result<RenderPlanNode>`; scene, mode and `maxDepth` in `ctx` take precedence, then the values used when `plan()` produced the node in the same process, otherwise defaults |
| `resolvePlanNode(node, schema)` | The effective schema (`ResolvedNode`) of a render plan node, consistent with what `plan()` uses to decide shape: including branches split from a `type` array and the element template (empty schema) for arrays without `items`; after the node is copied or serialized it is resolved by `schemaPointer` |
| `resolveSchemaAt(schema, pointer)` `resolveSchema(document, schema, pointer?)` | Effective schema: shallow-merges along in-document `$ref` ("#" and "#/...") from far to near into the referencing site, and merges `allOf` members; `origin` gives the schema location of each keyword, `unresolvedRef` the unresolvable reference. `resolveSchemaAt` caches by document and pointer, and yields an empty schema when the pointer does not exist |
| `evaluateCondition(cond, data, dataPath)` | Evaluates `visibleIf` against data; `dataPath` is the actual path, and `*` in a condition's `field` takes the token at the same position from it; for leaves with `base: "node"`, `field` is relative to the object containing the current node; `gt` `gte` `lt` `lte` only compare numbers |
| `jsonEqual(a, b)` | Deep equality of JSON values used for condition comparisons |
| `resolveXUi(schema, schemaPointer?, options?)` | Queries the merged `x-ui` at a location, candidate widgets at each level, matched root `rules`, the chosen widget and fallbacks, returning `Result<ResolvedXUi>`; without `registry` it computes as if "all widget names are registered". For the language service and debug views |
| `checkXUi(value)` | Structural `x-ui` check without Ajv, returning the first problem or `undefined`; rules consistent with `@jotl/core`'s `xUiMetaSchema` |
| `matchBuiltinWidget(schema, document?)` | Computes the built-in widget name from schema shape only, ignoring `x-ui` and the registry |
| `builtinAccepts(name, schema, document?)` | Whether a built-in widget name can handle the data shape (accepted shapes in the built-in widget name table of `docs/spec/x-ui.md`); returns `undefined` for non-built-in names |
| `BUILTIN_WIDGETS` and `FORMAT_WIDGETS` | Built-in widget names and levels, and the mapping from `format` to widget name; widget packages should provide an implementation for every name in `BUILTIN_WIDGETS` |
| `decimalKind(schema)` `RICH_TEXT_MEDIA_TYPE` `JSON_TEXT_MEDIA_TYPE` `splitBranch` | Shape recognition: money / bigint value objects, rich-text and JSON-text strings, branches split from type arrays for nullable and union |
| `toBig(x)` `fromBig(b, template, decimals?)` `isDecimalValue` `EXACT_DECIMAL` | Exact decimals: converting numbers, exact numeric strings and money / bigint value objects to and from `Big` (big.js); no unit conversion |
| `valueFormatOf(schema, type)` `valueFormatWidget(format)` | Storage format `x-valueFormat` of date widgets: only recognized on strings without a standard `format` and on integers with format `x` `X`; without `x-ui.widget`, `date` `time` `datetime` is chosen from the format contents (timestamps and aliases are `datetime`; `valueFormatWidget` is `@jotl/core`'s `valueFormatComponent`); all three accept these shapes, except that `time` does not accept timestamps |
| `formatThousands(text)` `stripThousands(text)` | Thousands separators: inserts `,` every 3 digits only in the integer part of exact numeric strings; strips `,` `，` whitespace `_` |
| `enumOptions` `fieldLabel` `requiredKeys` `schemaTypes` `isBuiltinWidget` | Schema reading utilities shared by widget packages |
| Types `Registry` `WidgetRegistration` `RenderPlanNode` `PlanOptions` `Adapters` `UploadContext` and per-level props | Widget contracts, defined in `src/core/contracts.ts`; the `ctx` of `Adapters.upload(file, ctx)` is the field initiating the upload (`UploadContext`), and `ArrayProps.duplicate` is the optional element duplication capability |

Options of `plan()` and `expand()` (`PlanOptions`):

| Option | Default | Meaning |
|---|---|---|
| `scene` | `"default"` | Selects a scene from `x-ui.variants` |
| `mode` | `"edit"` | `"edit"` `"view"` `"disabled"`, written into the resolution context for matchers |
| `schemaPointer` | `""` | Planning start; reports `JOTL5102` when it does not exist or is not a schema |
| `dataPath` | `""` | Template data path corresponding to the start |
| `depth` `parentWidget` | `0`, none | Passed when planning from a child node, consistent with the renderer's context |
| `maxDepth` | `DEFAULT_MAX_DEPTH` (2) | Maximum number of levels a recursive reference to the same type is expanded along one path; beyond it the node is marked `lazy: true` without children, and `expand()` is called at render time |

### Planning-time fallback and diagnostics

- Data shapes of built-in widget names are checked against the built-in widget name table of `docs/spec/x-ui.md`: when `x-ui.widget` names a built-in that the shape does not accept, it falls back via F2 to the shape's default widget (e.g. `radio` on a multi-select enum falls back to `select`); a registration's `accepts` applies additionally. On nullable nodes (type arrays or `anyOf` / `oneOf: [T, null]`), built-in field widget names apply to the content node.
- Fallbacks during `plan()` are recorded in the node's `degraded`, coded F1 (not registered), F2 (shape not accepted or rejected by `accepts`), F3 (invalid `x-ui`), F7 (unsupported schema feature); each fallback also produces a warning diagnostic. F4-F9 belong to render time; for ownership see "降级归属" (Fallback ownership) in `docs/spec/x-ui.md`.
- `fallbackChain` is the list of alternative widget names after the chosen widget, always ending with `json`; the renderer substitutes them in order when a widget throws.
- The diagnostic code range is `JOTL5xxx`: `JOTL5001`-`JOTL5005` are fallback warnings, `JOTL51xx` are argument errors (with `value` `undefined`). The code table is `UI_CORE_DIAGNOSTICS` in `src/core/diagnostics.ts`, and F3 reason phrases are `XUI_ISSUE_REASONS` in the same file.
- When the same `x-ui` is referenced in several places, the same diagnostic is reported only once.

## Known limitations

See "确定不修" (Won't fix) in the root `TODO.md`.
