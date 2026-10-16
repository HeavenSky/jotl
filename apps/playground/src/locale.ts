// 界面语言的选取: 用户保存过的选择优先, 否则按浏览器语言归到支持的语言.
import { resolveLocale, type Locale } from "@jotl/core";

export const LOCALES: readonly Locale[] = ["zh-CN", "en"];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function initialLocale(saved: string | undefined, browserLanguage: string | undefined): Locale {
  return isLocale(saved) ? saved : resolveLocale(browserLanguage);
}

export function browserLanguage(): string | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.language;
}
