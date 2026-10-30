# Style the form

**English** · [简体中文](../zh/docs/styling.md)

This page shows the two ways to include the form's styles and how to reskin them. Styles are optional: without them widgets still work, they only lose basic layout (including the nested breadcrumb and entry rows).

## Include the precompiled stylesheet

If your app does not use Tailwind, import the precompiled CSS once:

```ts
import "@jotl/form/style.css";
```

## Override styles with your own CSS

Every element carries a `jotl-` semantic class (for overrides and test targeting) and Tailwind utility classes prefixed `jt:` (for appearance). All generated CSS sits in cascade layers (`theme` `components` `utilities`) and includes no preflight, so your unlayered styles win: writing `.jotl-input { ... }` directly overrides the input. Only the `jotl-` classes are a stable interface; the utility classes may change.

## Reskin with CSS variables

Set any of these variables on an outer element to change colors and spacing for everything inside it:

`--jotl-gap` `--jotl-radius` `--jotl-border` `--jotl-divider` `--jotl-focus` `--jotl-focus-hover` `--jotl-focus-ring` `--jotl-error` `--jotl-text` `--jotl-muted` `--jotl-surface` `--jotl-disabled-bg` `--jotl-disabled-text` `--jotl-switch-off` `--jotl-option-hover` `--jotl-option-selected`

```css
.checkout-form {
	--jotl-focus: #0a7c4a;
	--jotl-radius: 6px;
}
```

The defaults are in [`theme.css`](../theme.css).

## Compile with your Tailwind v4 build

Create a separate CSS entry for the form and let your Tailwind build (for example `@tailwindcss/vite`) process it. Do not merge it into your own `@import "tailwindcss"` entry: the `jt` prefix only applies to this entry. [`apps/playground/src/jotl.css`](../../../apps/playground/src/jotl.css) is a working example.

```css
/* jotl.css */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme) prefix(jt);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@import "@jotl/form/tailwind.css";
```

- `tailwind.css` scans the `src` published with the package through `@source`, and `source(none)` turns off scanning of your project, so only the utility classes the widgets use are generated.
- The design variables in `theme.css` map to `--jotl-*` through `@theme inline`. Import them alone with `@import "@jotl/form/theme.css"` to use them in your own `jt:` classes, for example `jt:text-muted` `jt:border-border` `jt:rounded-base`.

## Why the prefix and no preflight

A library stylesheet with preflight would reset your whole page, and unprefixed utility classes would collide with same-named classes from your own Tailwind build. The project keeps both choices; customize through the `--jotl-*` variables, the `jotl-` classes and `className` instead.

To restyle a custom widget the same way as the defaults, reuse `styles` and `cn` from `@jotl/form`, see [Write a widget](widget-contract.md#reuse-the-default-look).
