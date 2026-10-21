# @jotl/form

**English** · [简体中文](./zh/README.md)

Render a validated React form straight from a JSON Schema, with widgets and layout chosen in the schema itself.

`@jotl/form` gives you one component, `JotlForm`, that turns a JSON Schema 2020-12 document into a working form: inputs, required marks, defaults, validation messages and submit. It is for React developers who already describe their data with JSON Schema (or write it in [Jotl](../core/README.md)) and do not want to hand-build a form and keep it in sync with that schema. Widget choice, layout, visibility conditions and labels live in the schema's `x-ui` keyword rather than in a second UI file, and nested data is shown one level per page, so a deep config object stays usable.

## See what it renders

```tsx
import { JotlForm, type JotlFormProps } from '@jotl/form';
import '@jotl/form/style.css';

const schema: JotlFormProps['schema'] = {
  type: 'object',
  properties: {
    title: { type: 'string', title: 'Title', maxLength: 20 },
    status: { enum: ['draft', 'published'], title: 'Status', 'x-ui': { widget: 'radio' } },
    featured: { type: 'boolean', title: 'Featured', default: false },
  },
  required: ['title'],
};

export default function App() {
  return <JotlForm schema={schema} locale="en" onSubmit={value => console.log(value)} />;
}
```

This renders a text box labeled "Title" with a required mark, a radio group for "Status", a switch for "Featured" set to its default `false`, and Submit and Reset buttons. Submitting with an empty title shows the error under that field and does not call `onSubmit`; a valid submit logs the form value.

## Get a form on screen

1. Create a React app: `pnpm create vite my-form --template react-ts`
2. Add the package: `cd my-form && pnpm add @jotl/form`
3. Save the example above as `src/App.tsx`, then run `pnpm dev` and open the printed URL.

`react` is an optional peer dependency (16.8 to 19); see [React version compatibility](docs/react-compat.md).

## What you get

- **One schema drives the whole form.** Widget names, groups, `tabs` or `grid` layouts, `visibleIf` conditions and entry summaries sit in `x-ui` next to the data they describe; defaults and validation come from the same schema through `@jotl/data`. See [Control form data and validation](docs/form-state.md).
- **Deep data stays navigable.** Objects, arrays and dictionaries open as their own page with a breadcrumb and per-level error counts; switch to a single page with collapsible panels when you prefer. See [Navigate nested data](docs/drill-down.md).
- **Replace one widget and keep the rest.** Register your component under a built-in name such as `switch`, use [`@jotl/antd`](../antd/README.md) for Ant Design, or load widgets from modules the schema declares. See [Replace and register widgets](docs/custom-widgets.md).
- **No blank screens.** A widget that throws is replaced by the next candidate, ending at a JSON editor, and `onDegrade` reports every fallback. See [Debug widget fallbacks](docs/fallbacks.md).
- **Fits an existing app.** Styles are optional and live in cascade layers your own CSS overrides, Tailwind v4 hosts can compile them with their theme, and the UI-free planner `@jotl/form/core` lets you build a renderer for another framework. See [Style the form](docs/styling.md) and [Build a renderer with `@jotl/form/core`](docs/core.md).

## When to use something else

The widgets are React DOM components: for Vue, Svelte or React Native you get only the planner in `@jotl/form/core` and write the widgets yourself. The input must be JSON Schema 2020-12; convert older drafts and OpenAPI schemas with [`@jotl/convert`](../convert/README.md) first. Known limitations and their workarounds are listed in [Known limitations](docs/known-limitations.md).

## Read more

- [Guide index](docs/README.md): every task page for this package.
- [`x-ui` specification](../../docs/spec/x-ui.md): fields, merge order, built-in widget names and per-level props.
- [Native HTML widgets specification](../../docs/spec/html-widgets.md): the default widget table and behavior conventions.
- [`@jotl/core`](../core/README.md) for writing schemas in Jotl, [`@jotl/data`](../data/README.md) for defaults, validation and Mock data.

## License

[MIT](../../LICENSE)
