# Load widget modules in the preview

**English** · [简体中文](../zh/docs/widget-modules.md)

After this page, the preview form renders your own React widget components instead of the fallback display. You need a widget declared with an underlying type (see [Register project widgets](project-widgets.md)) and an ES module that exports the component.

## Turn on module loading

1. Point the widget at a module, either in `jotl.config.json`:

   ```json
   {
     "widgets": {
       "ImagePicker": {
         "base": "url",
         "module": "https://esm.sh/my-image-picker?external=react,react-dom",
         "export": "default"
       }
     }
   }
   ```

   or in the `widgets` metadata of the file's root entry, which wins over the config for the same name:

   ```jotl
   Page: [widgets: {ImagePicker: {base: 'url', module: './widgets/image-picker.js'}}] {
     cover: ImagePicker
   }
   ```

2. Set `jotl.preview.loadWidgetModules` to `true` in your user or workspace settings:

   ```json
   { "jotl.preview.loadWidgetModules": true }
   ```

   The preview reloads at once and the Form tab renders the module's component in the `cover` field.

**The setting is off by default, because loading a module runs its code inside the preview.** While it is off, these widgets use the fallback display and the preview shows a notice. In an untrusted workspace the workspace value is ignored, so a repository cannot turn loading on by itself; only your user setting counts.

## Write a module the preview can load

- `module` is an `https:` URL or a path relative to the file that declares it (`./`, `../`, or an absolute path). Local files are served to the preview from the workspace.
- The module is an ES module whose export (named by `export`, default `default`) is a React component that follows the widget contract of [`@jotl/form`](../../form/README.md).
- Do not bundle React into the module. The preview shares its own React: bare imports of `react`, `react/jsx-runtime`, `react-dom` and `react-dom/client` resolve to the preview's copy. With esm.sh, add `?external=react,react-dom` to the URL.
- Module declarations from the root entry are compiled into the root `x-ui.widgets` of the schema, so other hosts of the schema can load them too. Declarations in `jotl.config.json` are not written to the schema.

## When a module does not show up

- **`Failed to load the widget` with a Retry button in the field.** The module failed to load or its export is not a component. Check the URL or path and the `export` name, then click Retry; the rest of the form keeps working.
- **`Extension widget modules are not loaded in the preview: …` at the top of the preview.** `jotl.preview.loadWidgetModules` is off, or the workspace is untrusted and the setting is only in the workspace. Turn it on in your user settings or trust the workspace.

## Know what the preview cannot load

The preview's content security policy lets modules load only from `https:` URLs and from local files, which rules out these cases:

- **Modules from an `http:` dev server.** Serve the module over `https:`, or build it into a file in the workspace.
- **A module's own stylesheet and its `fetch` requests.** Style the component through the `style` prop, or reuse `styles` and `cn` from `@jotl/form`, and pass data in through the schema instead of fetching it.
- **Local dependencies outside the workspace.** Bundle them into the module file.
- **Relative paths in an untitled document.** Save the file first, so the path has a directory to resolve against.

Windows drive paths and `file:` addresses are mapped to preview addresses, but this has not been tested on Windows.

The same policy allows `'unsafe-eval'`, because the form's validator compiles validation functions from the schema at run time and the schema changes as you type. Scripts still run only from the preview's own tags, plus local files and `https:` while module loading is on.
