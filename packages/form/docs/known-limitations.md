# Known limitations

**English** · [简体中文](../zh/docs/known-limitations.md)

This page lists where the form behaves differently from what the schema allows or from what you might expect, and how to work around each case when a workaround exists.

## Text inputs stop early on emoji

`maxLength` of the default `input`, `password` and `textarea` widgets is passed to the native `maxlength`, which counts UTF-16 code units, so the widgets add the number of surrogate-pair characters already in the value and typing is counted by characters. Two cases still stop before the schema's `maxLength`: typing a character outside the Basic Multilingual Plane, such as many emoji, when only one character is left, and pasting text that contains them. Validation still counts characters, so it never reports text the input let through. To allow the full count in those cases, register your own text widget that does not set `maxlength`, see [Replace and register widgets](custom-widgets.md). [`@jotl/antd`](../../antd/docs/coverage.md#known-differences-from-the-schema) behaves the same way.

## Objects with patternProperties are edited as JSON

An object whose schema has `patternProperties` falls back to the `json` widget as a whole (F7, unsupported schema feature). Its fields are not laid out one by one, and the "Other keys" editor is not available. See [Handle fallbacks and diagnostics](core.md#handle-fallbacks-and-diagnostics) for the fallback codes.

## Server-rendered labels have no `for`

The field shell adds `for` to its `<label>` after rendering, once it knows the inner element is a labelable control. HTML rendered on the server has no `for`, and it is added after hydration. Until then, clicking a label does not focus its control.

## Schema modules register at the field level

Widgets declared in the root `x-ui.widgets` are registered at the `field` level and take over the whole value; a declaration cannot choose another level. To register a module widget at another level, call `moduleWidgetRegistrations` with `level` and add the result to your registry, see [Register modules without `JotlForm`](schema-modules.md#register-modules-without-jotlform).

## The bundled rich text editor is minimal

`richtext` is a multi-line text box unless you pass `adapters.richText`. The bundled `richTextEditor` is a minimal `contenteditable` editor and has not been verified in Safari or Firefox. For production, pass an adapter built on a full editor, see [Pass adapters](custom-widgets.md#pass-adapters).

## Utility classes carry the `jt` prefix and no preflight

The stylesheet does not reset your page and its utility classes do not collide with yours, so it also does not normalize elements the way a Tailwind preflight would. Customize through the `--jotl-*` variables, the `jotl-` classes and `className`, see [Why the prefix and no preflight](styling.md#why-the-prefix-and-no-preflight).
