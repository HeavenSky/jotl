# Navigate nested data

**English** · [简体中文](../zh/docs/drill-down.md)

This page explains how `JotlForm` shows objects, arrays and dictionaries, and how to sync the current level with your router or turn drill-down off.

## One level per page

By default the form shows one page per level. Scalar fields of the current level are edited in place; composite fields (objects, arrays, dictionaries, unions with object branches, recursive nodes) appear as entry rows that open the next level. The breadcrumb at the top lists each level's label, and clicking a parent level goes back.

```tsx
const [path, setPath] = useState("");
<JotlForm schema={schema} path={path} onPathChange={setPath} />;
```

- `path` is the data path (JSON Pointer) of the current page and can be synced to your router. Without it the form tracks the page itself, starting at the root `""`; with it the page is controlled, and entering and going back are only reported through `onPathChange`.
- Objects with `x-ui.widget: "inline"` expand within the parent page. On array and dictionary pages, scalar elements are edited in place and composite elements are entry rows.

## What entry rows and breadcrumbs show

- An entry row shows the label, a summary and the number of errors below it.
- The summary is the field named by `x-ui.summary` (on arrays and dictionaries it applies to the elements). Without it, the first non-empty string field is used; array elements without one show `Item n` (`第 n 项` in Chinese).
- In the breadcrumb, array elements also use the summary or the index, and dictionary values use the key name.

## Where the form moves on its own

Both moves below are reported through `onPathChange`:

- When submit validation fails, the form jumps to the level of the first error.
- When the array element or dictionary key currently shown is deleted, or the key is renamed, the form goes back to the level of that array or dictionary. A `path` that points to a missing array element is handled the same way.

## Find errors on other pages

Errors not on the current page appear in the form-level list at the top, and each upper level in the breadcrumb shows how many errors lie beneath it (and not in the next level); after you click that level, entry rows point to the location. Clicking an error in the form-level list switches to its page, then scrolls to and focuses the field. Without drill-down the field is focused directly, and a hidden field focuses its nearest visible ancestor.

## Show everything on one page

```tsx
<JotlForm schema={schema} drill={false} collapsible />;
```

- `drill={false}` expands all levels on one page with no entry rows or breadcrumb, and ignores `path`.
- Adding `collapsible` wraps objects (except `inline`), arrays, dictionaries and unions with object branches in collapsible panels. Each panel header shows the title (`Item n` for array elements), the summary and the error count; the first level starts expanded and deeper levels start collapsed. `collapsible` is ignored while `drill` is `true`.
