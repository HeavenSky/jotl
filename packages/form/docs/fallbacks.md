# Debug widget fallbacks

**English** · [简体中文](../zh/docs/fallbacks.md)

This page explains what the form does when a widget cannot be used and how to see which widget each field ended up with. The form never shows a blank screen: every failure has a replacement.

## What the form replaces, and with what

- A widget that throws while rendering is replaced by the alternatives in the render plan, in order (F4). A composite widget that throws is split, and each child node is rendered on its own (F5).
- Data whose type does not match the schema is kept as is, marked with an error, and edited with the JSON widget (F8).
- A lazily loaded widget that fails to load shows a placeholder with a retry button and falls back like F4 (F9).
- When the registry has no widget at all, the renderer's built-in JSON text box is the last resort.
- Fallbacks decided while planning (F1 not registered, F2 shape not accepted, F3 invalid `x-ui`, F7 unsupported schema feature) are described in [Build a renderer with `@jotl/form/core`](core.md#handle-fallbacks-and-diagnostics).

## Log every fallback

`onDegrade(event)` is called once per fallback. The event (`DegradeEvent`) contains the code (F1 to F9), the data path, the schema pointer, the original widget and the replacement; for F4 and F9 it also carries the original error. A replacement that is not a widget name is one of `DEGRADE_TARGETS`: `split`, `minimal-json` or `none`.

## Show a debug view

```tsx
const log = useDegradeLog();
<JotlForm schema={schema} onDegrade={log.onDegrade} />
<JotlDebug schema={schema} events={log.events} />
```

- `<JotlDebug schema registry events />` lists each node's chosen widget, where the choice came from, and its fallback records. Pass the same `registry` (and `scene`, `mode`, `maxDepth`) as the form, or the results will differ.
- `useDegradeLog()` collects the events the form reports so `JotlDebug` can show them.
- `locale` sets the language of `JotlDebug`, defaulting to the global language from `getLocale()`.
