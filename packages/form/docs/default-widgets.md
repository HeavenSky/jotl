# Default HTML widgets

**English** · [简体中文](../zh/docs/default-widgets.md)

This page describes what each default widget renders and how it handles input, so you can predict a form before you open it. The full widget table is in the [native HTML widgets specification](../../../docs/spec/html-widgets.md).

The default widgets implement every built-in widget name of `@jotl/form/core` with native HTML tags. They are stateless controlled widgets styled with Tailwind CSS v4 utility classes prefixed `jt:`; your app does not need Tailwind (see [Style the form](styling.md)). Their UI text (buttons, placeholders, messages) has English and Chinese versions chosen by the form's `locale`; this page quotes the English text.

## Scalar widgets

- **Image and file**: `image` and `file` show the "Upload image" / "Upload file" button only when `adapters.upload` is passed; otherwise there is only a URL input. During upload a status is shown, and a failure shows a readable message.
- **Rich text**: `richtext` renders an editor only when `adapters.richText` is passed; otherwise it is a multi-line text box. Passing this package's `richTextEditor` gives a minimal `contenteditable` editor (bold, italic, link, list) whose value is cleaned by the `sanitizeHtml` allowlist.
- **Money and big integers**: `money` and `bigint` use a text box (`inputmode` `decimal` / `numeric`) whose value is a `{ type, value, ... }` object. On focus the raw value is shown; on blur and when read-only it is shown with thousands separators (on by default for `money`, controlled by `x-ui.thousands`). While typing, `,` `，` spaces and `_` are stripped, and invalid input keeps the draft with a message. `money` pads to fixed decimal places on blur, and its currency and unit appear as text or a dropdown according to the schema's `const` / `enum`.
- **Numbers**: `number` sets `step` from `x-decimals` and rounds on blur; with thousands separators turned on it switches to a text box.
- **Booleans and enums**: `switch` is a checkbox with `role="switch"`. `checkbox` is a single checkbox for booleans and a checkbox group for enum arrays. `select` is a multi-select dropdown for enum arrays.
- **JSON text**: `json` on a string schema (`contentMediaType: application/json`) edits the raw text; the value stays a string and only has to parse.

## Dates and times

`date`, `time` and `datetime` use the native `date`, `time` and `datetime-local` controls in the local time zone.

- Values are read and written in the node's storage format `x-valueFormat`: a dayjs format string, `x` / `X` for millisecond / second timestamps, or the aliases `iso`, `iso-x`, `utc`, `utc-x`. Without one, the widget default applies: `YYYY-MM-DD` for `date`, `HH:mm:ss` for `time`, `iso` for `datetime`.
- Aliases accept any RFC 3339 date-time on read and are normalized to the alias on write. Picking a `date` stores local midnight of that day; picking a `time` stores that time today.
- The control shows seconds (`step=1`) when the storage format contains `ss` or is an alias or timestamp, and milliseconds (`step=0.001`) when a custom format contains `SSS`.
- A stored value that does not match the storage format is shown as is in a text box with a message, and the data is not rewritten; only typed text that parses with the storage format is written back.

## Composite widgets and object layouts

| Widget or layout                        | What the user sees                                                                                    | Interaction                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list`                                  | One numbered row per item with "Up", "Down", "Duplicate" and "Remove" buttons, and "Add"              | "Duplicate" appears only when the renderer provides `duplicate`; "Add" and "Duplicate" are disabled at `maxItems`                                                                                                                                                                                                                                          |
| `nullable`                              | A "Set to null" checkbox and the original widget                                                      | When checked the value is `null` and only "null" is shown; toggling works only in `edit` mode                                                                                                                                                                                                                                                              |
| `union`                                 | A "Type" dropdown and the current branch's subform                                                    | No dropdown with a single branch; the renderer provides the data after a branch switch; with `x-ui.props.selector: "buttons"` and at most 4 branches it becomes segmented buttons                                                                                                                                                                          |
| `kv`                                    | Rows of key input, value and delete button, with "Add" at the end                                     | New entries get unused key names such as `key1` `key2`; a cleared or duplicate key only shows a message and leaves the data unchanged                                                                                                                                                                                                                      |
| `tuple`                                 | Items laid out by position, labeled by the item's `title` or `Item n`                                 | Positions cannot be added or removed. When `items` is `true` or a schema, extra elements follow the positions with "Add", and each one has "Up", "Down", "Duplicate" and "Remove"; they move only among themselves, never into a position, and "Add" and "Duplicate" are disabled at `maxItems`; otherwise extra elements are not shown and are kept as is |
| `page` / `inline` with other keys       | An "Other keys" group after the fields when the object also has `additionalProperties` in schema form | Same as `kv`: keys can be added, deleted and renamed, but cannot take declared property names                                                                                                                                                                                                                                                              |
| `tree`                                  | An "Expand" / "Collapse" button and the content                                                       | Collapsed content is not rendered; expandable in `view` mode, not in `disabled` mode                                                                                                                                                                                                                                                                       |
| `page` / `inline` with `layout: "tabs"` | One tab per group, ungrouped fields on the first tab                                                  | Switching tabs does not change data; arrow keys, `Home` and `End` move between tabs; without groups it lays out as `stack`; tabs cannot be switched in `disabled` mode; each tab shows the error count of its fields                                                                                                                                       |
| `page` / `inline` with `layout: "grid"` | Fields in `columns` columns, 2 by default                                                             | Each group forms its own grid; the column count is set through an inline `--jotl-columns` and takes effect only with `style.css` included                                                                                                                                                                                                                  |

`page` and `inline` are the same object widget: it lays out the current level only, and nested (pages, entry rows, breadcrumb) is done by the renderer, see [Navigate nested data](nested.md).

## Shape checks

The default registrations carry no `accepts`. `plan()` of `@jotl/form/core` checks the data shape each built-in name accepts, and a name the shape does not accept falls back to that shape's default widget (F2), see [Debug widget fallbacks](fallbacks.md).

## Accessibility

- Root elements of objects, arrays and the composite widgets above point to the shell label with `aria-labelledby`, so screen readers and `getByLabelText` find them by field label.
- The shell decides after rendering whether its `<label>` gets `for`: only when the inner root element is a labelable control (an `input` other than hidden, `select`, `textarea` and so on). Around composite widgets it has no `for`.
- Content controls inside `nullable` and `union` (ids ending in `+`, without their own shell) take the enclosing field's label through `aria-labelledby`; the `<pre>` of `json` in `view` mode is labeled the same way.
