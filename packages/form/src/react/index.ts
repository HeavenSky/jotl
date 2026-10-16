// React 表单渲染器: 按 core/ 的渲染计划渲染表单, 默认使用 html/ 的原生组件.
export { JotlForm } from "./jotl-form.js";
export { JotlDebug, useDegradeLog, type DegradeLog, type JotlDebugProps } from "./jotl-debug.js";
export { createDefaultRegistry } from "./registry.js";
export { moduleWidgetRegistrations, schemaWidgetModules, type ModuleWidgetOptions, type WidgetModule } from "./module-widgets.js";
export { nodeId } from "./child-resolver.js";
export { REACT_DIAGNOSTICS, reactDiagnostic, type ReactDiagnosticCode } from "./diagnostics.js";
export { LocaleContext, useL10n, useLocale } from "../locale-context.js";
export {
  DEGRADE_TARGETS,
  type DegradeCode,
  type DegradeEvent,
  type JotlFormHandle,
  type JotlFormProps,
  type ReactAdapters,
  type ReactRegistry,
  type ReactWidgetComponent,
  type ValidateTrigger,
  type ValidationResult,
} from "./types.js";
