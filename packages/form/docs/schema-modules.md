# Load widgets declared in the schema

**English** · [简体中文](../zh/docs/schema-modules.md)

This page shows how to let a schema bring its own widgets as JavaScript modules. You need a schema compiled from Jotl with extension components that declare a `module` (root entry metadata `widgets`, see [`@jotl/core`](../../core/README.md)); they end up in the schema's root `x-ui.widgets` as name → `{ module, export? }`.

## Turn on module loading

```tsx
// Compiled from: Form: [widgets: {ImagePicker: {base: 'url', module: 'https://esm.sh/image-picker'}}] { cover: ImagePicker }
<JotlForm schema={schema} locale="en" schemaModules />;

// Custom loading or a base for relative module addresses (./ ../ /)
<JotlForm schema={schema} schemaModules={{ baseUrl: "https://cdn.example.com/widgets/", importer: (url) => import(/* @vite-ignore */ url) }} />;
```

With `schemaModules`, `JotlForm` registers these declarations into the form's own registry, overriding same-named widgets, and loads each module on demand.

- `schemaModules` defaults to `false`. `true` loads with dynamic `import()`. An object is used as options: `importer` replaces the loader, `baseUrl` resolves addresses starting with `./`, `../` or `/` (other addresses go to the importer unchanged), and `locale` sets the language of load-failure messages (defaulting to the form's `locale`).
- When a module fails to load, or its export is not a component, the field shows an F9 failure with a retry button.

## Write the module

- The module's export (`export`, default `default`) must be a React component that follows the widget contract: it is registered at the `field` level, receives `FieldProps` from `@jotl/form/core` (`value` `onChange` `onBlur` `errors` `id` `schema` `mode` `props` and so on), and takes over the whole value. See [Write a widget](widget-contract.md).
- Third-party components usually do not follow this contract: they spread unknown props onto DOM elements (`schema`, `adapters` and others become attributes) and use their own prop names (for example `HexColorInput` reads `color`, not `value`). Export a thin wrapper that maps `FieldProps` to the component's props instead of pointing the module at the third-party component.
- In the browser, a remote module must use the host's single copy of React: map `react` (and `react/jsx-runtime` if the module uses it) to the host's React instance with an import map or an equivalent. With two copies of React, hooks fail.

## Register modules without `JotlForm`

- `schemaWidgetModules(schema)` reads the module declarations from the root `x-ui.widgets` and skips invalid items.
- `moduleWidgetRegistrations(modules, { importer?, baseUrl?, locale? })` turns name → `{ module, export?, level? }` into registrations with `load` for your own registry; `level` defaults to `field`.
- For module declarations from `jotl.config.json` (`readJotlConfig(...).config.modules` of `@jotl/core`), pass the configuration file's location as `baseUrl`.
