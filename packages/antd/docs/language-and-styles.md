# Language and styles

**English** · [简体中文](../zh/docs/language-and-styles.md)

This page tells you which settings control the language of an antd-rendered form and which stylesheets you need.

## Set the language

- Text rendered by this package's widgets (submit, reset, add, remove, placeholders, tab error counts) follows the form language: `JotlForm`'s `locale`, otherwise the global `getLocale()`. See [Set the form language](../../form/docs/locale.md).
- The language of antd's own components (date panels, color picker, empty states) comes from your `ConfigProvider locale`; the date panel also follows `dayjs.locale(...)`.

Set all three to the same language for a consistent form:

```tsx
import { ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import dayjs from "dayjs";
import "dayjs/locale/en";

dayjs.locale("en");

<ConfigProvider locale={enUS}>
	<JotlForm schema={schema} registry={registry} locale="en" />
</ConfigProvider>;
```

## Include styles

- antd styles need no import (CSS-in-JS).
- The native fallback widgets and the nested entry rows and breadcrumb of `@jotl/form` look best with `@jotl/form/style.css`; it is optional. See [Style the form](../../form/docs/styling.md).
