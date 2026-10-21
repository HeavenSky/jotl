// 面向使用者文案的语言: 全局当前语言与按语言取文案.
export type Locale = "zh-CN" | "en";

export const DEFAULT_LOCALE: Locale = "en";

let current: Locale = DEFAULT_LOCALE;

export function getLocale(): Locale {
	return current;
}

export function setLocale(locale: Locale): void {
	current = locale;
}

/** 把 BCP 47 语言标签或 POSIX 语言环境(如 `zh_CN.UTF-8`)归到支持的语言; 以 zh 开头为中文, 其余为英文, 空值取默认. */
export function resolveLocale(tag: string | undefined | null): Locale {
	if (tag === undefined || tag === null || tag.trim() === "") return DEFAULT_LOCALE;
	return /^zh\b|^zh[-_]/i.test(tag.trim()) ? "zh-CN" : "en";
}

/** 按语言取文案; 不传 locale 时取当前全局语言. */
export function l10n(zh: string, en: string, locale: Locale = current): string {
	return locale === "en" ? en : zh;
}
