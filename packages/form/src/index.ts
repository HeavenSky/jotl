// React 表单渲染器(react/)与原生 HTML 默认组件(html/); 不依赖 UI 框架的部分见 @jotl/form/core.
export * from "./react/index.js";
export * from "./html/index.js";
export { DEFAULT_LOCALE, getLocale, l10n, resolveLocale, setLocale, type Locale } from "@jotl/core";
