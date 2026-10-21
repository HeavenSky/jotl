# Regenerate and verify style.css

**English** · [简体中文](../zh/docs/style-maintenance.md)

This page is for contributors who change widget classes, `tailwind.css` or `theme.css` in this repository. It shows how to regenerate the precompiled `style.css` and check it in a real browser.

## Regenerate after a change

```sh
pnpm --filter @jotl/form run build:css
```

This rebuilds `style.css` from the entry `style.entry.css`, unminified. `test/package.test.ts` regenerates it and compares the result with the committed `style.css`, so the test fails if you forget this step.

## Check it in a browser

jsdom does not compute styles, so the following can only be checked in a real browser.

1. Run `pnpm build` at the repository root.
2. In a package that depends on `@jotl/form` (for example `apps/playground`), run `node --input-type=module -e "console.log(import.meta.resolve('@jotl/form/style.css'))"`. Expected: the `file://` path of `packages/form/style.css`.
3. In any React 19 + Vite page, `import "@jotl/form/style.css"` and render a schema containing strings, numbers, enums, booleans, images, object groups, object arrays, nullable fields, unions, dictionaries, recursive references, and objects with `[layout: 'tabs']` and `[layout: 'grid', columns: 3]`. Then check each row of the table below.

| Action                                             | Expected                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Open the page                                      | Fields stack vertically, labels above controls, with a red `*` after the label of required fields                                                                              |
| Tab through inputs, dropdowns and buttons          | Each focused control has a blue outline                                                                                                                                        |
| Submit an invalid field                            | The field's border turns red and red error text appears below it                                                                                                               |
| Type incomplete JSON into the JSON fallback widget | A red message appears below the text box, and the typed text is kept                                                                                                           |
| Fill an array up to `maxItems`                     | The "Add" button fades and the cursor shows the not-allowed style                                                                                                              |
| Enter an image URL                                 | The preview does not exceed the container width and is no taller than about 12rem                                                                                              |
| Switch the form to `view` and `disabled`           | Input backgrounds turn gray; `view` has no submit or array action buttons                                                                                                      |
| Set `--jotl-focus: red` on an outer element        | The focus outline and the primary button turn red                                                                                                                              |
| Look at an object with `tabs` layout               | Tabs sit in a row with a divider below; the selected tab is bold, in the focus color, and joined to the content; only its fields are shown                                     |
| Look at an object with `grid` layout               | Fields form a 3-column equal-width grid, and on narrow screens controls do not overflow their cells                                                                            |
| Check "Set to null" on a nullable field            | The original widget disappears and a gray italic "null" is shown                                                                                                               |
| Expand a recursive field                           | Content appears below the button, indented with a vertical line on the left                                                                                                    |
| Look at a dictionary field                         | Each row has a fixed-width key box on the left, the value in the middle and a delete button on the right; renaming a key to an existing name shows a red message below the box |
| Remove the `style.css` import and reload           | Widgets can still be typed into and submitted; only the layout above is lost                                                                                                   |
