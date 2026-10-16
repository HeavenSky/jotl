// @jotl/language-server 的诊断代码表(JOTL7xxx)与补全项说明文字.
import { defineDiagnostics, getLocale } from "@jotl/core";

export const LSP_DIAGNOSTICS = {
  JOTL7001: {
    severity: "warning",
    message: "widget `{widget}` 未注册, 渲染时将降级",
    en: "widget `{widget}` is not registered and will fall back when rendering",
  },
  JOTL7002: {
    severity: "warning",
    message: "配置文件 `{file}` 有误, 已忽略出错的部分: {reason}",
    en: "config file `{file}` has errors, the invalid parts are ignored: {reason}",
  },
} as const;

export type LspDiagnosticCode = keyof typeof LSP_DIAGNOSTICS;

export const lspDiagnostic = defineDiagnostics(LSP_DIAGNOSTICS);

/** 补全项的 detail 文字. */
export const COMPLETION_DETAILS = {
  component: "内置组件",
  namedType: "本文件声明的类型",
  extension: "扩展组件",
  metaKey: "元数据",
  builtinWidget: "内置 widget",
  registeredWidget: "已登记 widget",
  conditionOp: "条件运算",
  valueFormat: "存储格式",
  valueFormatAlias: "存储格式别名(RFC 3339)",
  marker: "标识",
  sceneKey: "场景覆盖(x-ui 字段)",
  itemTypeName: "类型串中的名字",
} as const;

const COMPLETION_DETAILS_EN: Readonly<Record<keyof typeof COMPLETION_DETAILS, string>> = {
  component: "Built-in component",
  namedType: "Type declared in this file",
  extension: "Extension component",
  metaKey: "Metadata",
  builtinWidget: "Built-in widget",
  registeredWidget: "Registered widget",
  conditionOp: "Condition operator",
  valueFormat: "Storage format",
  valueFormatAlias: "Storage format alias (RFC 3339)",
  marker: "Marker",
  sceneKey: "Scene override (x-ui field)",
  itemTypeName: "Name in the type string",
};

/** 按当前语言取补全项的 detail 文字. */
export function completionDetails(): Readonly<Record<keyof typeof COMPLETION_DETAILS, string>> {
  return getLocale() === "en" ? COMPLETION_DETAILS_EN : COMPLETION_DETAILS;
}

/** 诊断的 source 字段. */
export const DIAGNOSTIC_SOURCE = "jotl";
