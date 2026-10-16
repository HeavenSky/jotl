# @jotl/playground

**English** · [简体中文](./README.zh-CN.md)

Read this page when starting, building or manually accepting the Jotl Playground in the browser; it corresponds to `apps/playground`.

## Start and build

Run at the repository root:

```sh
pnpm build                                   # build each package's dist first; the Playground references build output
pnpm --filter @jotl/playground dev           # dev server; the terminal prints the local address
pnpm --filter @jotl/playground run build     # type check + production build, output in apps/playground/dist
pnpm --filter @jotl/playground preview       # preview the production build locally
pnpm exec vitest run apps/playground         # unit tests
```

- After changing source under `packages/*`, run `pnpm build` again so the dev server picks up the new dist.
- Form styles are wired in the Tailwind-host way: `src/jotl.css` imports `@jotl/form/tailwind.css`, compiled by `@tailwindcss/vite` (scanning each package's `src`, not going through the precompiled `style.css`).
- If the production build reports an error `typescript 被打包进了 …` ("typescript was bundled into …"), the `typescript` compiler has ended up in the output; first check whether something is mistakenly imported from `@jotl/convert/from-ts`.
- The dev server does not tree-shake, so the first load fetches the full `typescript` package and is slower than the production build; the production output does not contain it.
- The first entry of the example dropdown, `v1-showcase`, is `src/examples/showcase.jotl` (covering object drill-down, `inline`, `money` `bigint`, both kinds of `union`, enum multi-select, arrays and dictionaries, `root_if` `node_if`), followed by `fixtures/*/source.jotl` bundled at build time; after adding a sample, rebuild or restart the dev server for it to appear.
- The current source is saved under the `jotl-playground:source` key in the browser's `localStorage`; clearing that key and refreshing returns to the default example `v1-showcase`.

## Language and widget modules

- **Language**: switch between 中文 and English in the header. The first visit follows the browser language and the choice is remembered; diagnostics, outputs and form texts follow it.
- **Widget modules**: register a widget in the `widgets` of the `jotl.config.json` tab on the left, e.g. `{ "base": "integer", "module": "./widgets/rating.js", "export": "default" }` (the demo `Stars` is registered by default), then use it in the source as `score: Stars`. You can also declare modules in the root entry metadata, `Form: [widgets: {Rating: {base: 'integer', module: './widgets/rating.js'}}] {...}` (see the `widget-module` example); the preview then shows a notice listing the module URLs it will load and run. Relative URLs resolve against the page directory. A module must be an ESM React component that follows the field-level widget contract (`value`, `onChange`, `onBlur`, `props`, ...); its `import "react"` and `react/jsx-runtime` resolve, through the page's import map (`index.html`, shims in `public/shims/`), to the Playground's own React. When a module fails to load, the field shows an error with a Retry button.

## Manual verification

jsdom does not compute layout or styles, so the following can only be checked in a real browser. On a page opened by the dev server or `preview`, perform the steps in order:

| Action | Expected |
|---|---|
| Open the page for the first time (or refresh after clearing the `localStorage` key above) | The left editor shows the `v1-showcase` source, with line numbers aligned line by line; the right side defaults to "表单预览" (Form preview), "联系方式" is expanded within the root page, and "搜索优化", "轮播图" etc. are shown as entry rows |
| Click the "搜索优化" entry row, then click "店铺" in the breadcrumb | Enters the subpage with a breadcrumb at the top; clicking the breadcrumb returns to the root page |
| In the editor change `name(店名)` to `name(全名)` and stop typing | The status bar briefly shows "等待编译…" (Waiting to compile…) and then it disappears; the field label in the form becomes "全名" |
| Type a shop name into the form | "当前表单数据" (Current form data) shows the entered value in real time |
| Move the cursor or use the arrow keys | "行 X, 列 Y" (Line X, Column Y) below the editor updates accordingly |
| Misspell a type name (e.g. change `string` to `strng`) | An error appears in the diagnostics list and the corresponding line number turns red; a yellow "已过期" (Stale) notice appears at the top right, and the preview keeps the previous result and fades out |
| With a long source, scroll to the bottom and then click that diagnostic | The editor scrolls to the error line, selects the offending word, and the status bar shows the line and column given by the diagnostic |
| Fix the error | The diagnostics list shows "没有诊断" (No diagnostics) and the "已过期" notice disappears |
| Switch through the "JSON Schema", "TS 输出" (TS output), "降级调试" (Fallback debug) tabs, then move between tabs with the arrow keys, `Home`, `End` | Shows respectively the formatted schema, the TS declarations starting with the generated header, and each node's widget, source and fallback records |
| At the top of the form preview switch "呈现" (Presentation) to "折叠面板" (Collapse panels) | Entry rows become collapsible panels whose header shows title and summary, with the first level expanded; after adding an item to "轮播图", that item's panel title is "第 1 项" (Item 1) plus a summary and can be copied; switching back to "钻取" (Drill-down) restores entry rows |
| Switch "初始数据" (Initial data) to "Mock" | The form remounts and "当前表单数据" is replaced with randomly generated data |
| In "Logo" click "上传图片" (Upload image) and pick a local image | "上传中…" (Uploading…) shows briefly, then the URL box receives a `blob:` address and shows a preview (no network request) |
| Enter the "正文" (Body) of a text block | The rich-text editing area has a formatting toolbar; selecting text and clicking bold, italic, link, list takes effect, and "当前表单数据" contains HTML |
| Select `013-x-ui-basic` in the example dropdown | The source is replaced with that example and compiled immediately; "降级调试" shows fallback records for unregistered widgets such as `headline` |
| Select `016-errors` | The diagnostics list shows all errors; the right side keeps the previous example's result marked "已过期" |
| Edit anything and then refresh the page | The editor restores the source from before the refresh |
| Edit in browser private mode or with site storage disabled | A "浏览器禁止本地存储" (Browser blocks local storage) notice appears at the top; editing and preview work as usual |
| Shrink the window width below 900px | The editor and output areas stack vertically with no horizontal overflow |
