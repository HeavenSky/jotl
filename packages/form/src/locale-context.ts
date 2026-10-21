// 表单界面语言的 React 上下文: JotlForm 的 locale prop 经此下发给 widget.
import { createContext, useContext } from 'react';
import { getLocale, l10n, type Locale } from '@jotl/core';

export const LocaleContext = createContext<Locale | undefined>(undefined);

/** 取 JotlForm 指定的语言, 未指定时取 `@jotl/core` 的全局语言. */
export function useLocale(): Locale {
  return useContext(LocaleContext) ?? getLocale();
}

/** 按当前表单语言取文案的函数. */
export function useL10n(): (zh: string, en: string) => string {
  const locale = useLocale();
  return (zh, en) => l10n(zh, en, locale);
}
