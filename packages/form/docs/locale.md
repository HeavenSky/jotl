# Set the form language

**English** · [简体中文](../zh/docs/locale.md)

This page shows how to show widget text and validation messages in English or Chinese, per form or for the whole app. Two languages are supported: `"en"` (the default) and `"zh-CN"`.

## Per form

```tsx
<JotlForm schema={schema} locale="zh-CN" />
```

`locale` sets the language of the widgets' UI text (buttons, placeholders, messages) and of validation messages. Without it the form uses the global language from `getLocale()` of `@jotl/core`.

## For the whole app

```ts
import { resolveLocale, setLocale } from '@jotl/form';

setLocale(resolveLocale(navigator.language));
```

`setLocale` and `getLocale` set and read the global language; `@jotl/form` re-exports them from `@jotl/core` together with `resolveLocale` and `DEFAULT_LOCALE`. `resolveLocale(tag)` maps a BCP 47 tag or a POSIX locale such as `zh_CN.UTF-8` to a supported language: tags starting with `zh` give `"zh-CN"`, everything else gives `"en"`, and an empty value gives the default.

## Inside your own widgets

- `useLocale()` returns the language of the enclosing form.
- `useL10n()` returns a function `(zh, en) => string` that picks the text for that language.
- Both read `LocaleContext` and fall back to the global language outside a form.

```tsx
import { useL10n } from '@jotl/form';

function ClearButton({ onClick }: { onClick: () => void }) {
  const t = useL10n();
  return (
    <button type="button" onClick={onClick}>
      {t('清空', 'Clear')}
    </button>
  );
}
```

## Other places that take a language

- `<JotlDebug locale>` sets the language of the debug view, defaulting to the global language; see [Debug widget fallbacks](fallbacks.md).
- With `schemaModules`, load-failure messages follow the form's `locale` unless the options pass their own `locale`; see [Load widgets declared in the schema](schema-modules.md).
