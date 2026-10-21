# 设置表单语言

[English](../../docs/locale.md) · **简体中文**

本页说明如何按表单或为整个应用把 widget 文案与校验消息设为中文或英文。支持两种语言：`"en"`（默认）与 `"zh-CN"`。

## 按表单设置

```tsx
<JotlForm schema={schema} locale="zh-CN" />
```

`locale` 决定 widget 界面文案（按钮、占位、提示）与校验消息的语言。不传时取 `@jotl/core` 的 `getLocale()` 返回的全局语言。

## 为整个应用设置

```ts
import { resolveLocale, setLocale } from "@jotl/form";

setLocale(resolveLocale(navigator.language));
```

`setLocale` 与 `getLocale` 设置和读取全局语言；`@jotl/form` 从 `@jotl/core` 转导出它们，以及 `resolveLocale` 与 `DEFAULT_LOCALE`。`resolveLocale(tag)` 把 BCP 47 语言标签或 `zh_CN.UTF-8` 这样的 POSIX 语言环境归到支持的语言：以 `zh` 开头为 `"zh-CN"`，其余为 `"en"`，空值取默认。

## 在自定义 widget 中

- `useLocale()` 返回所在表单的语言。
- `useL10n()` 返回函数 `(zh, en) => string`，按该语言取文案。
- 两者都读 `LocaleContext`，在表单外回落到全局语言。

```tsx
import { useL10n } from "@jotl/form";

function ClearButton({ onClick }: { onClick: () => void }) {
	const t = useL10n();
	return (
		<button type="button" onClick={onClick}>
			{t("清空", "Clear")}
		</button>
	);
}
```

## 其他接受语言设置的地方

- `<JotlDebug locale>` 决定调试视图的语言，缺省取全局语言；见[排查 widget 降级](fallbacks.md)。
- 使用 `schemaModules` 时，加载失败文案随表单的 `locale`，除非选项中另传 `locale`；见[加载 schema 声明的 widget](schema-modules.md)。
