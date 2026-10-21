// core/(x-ui 解析, 注册与渲染计划)的诊断代码表(JOTL5xxx).
import { defineDiagnostics, l10n } from '@jotl/core';

export const UI_CORE_DIAGNOSTICS = {
  JOTL5001: {
    severity: 'warning',
    message: 'widget {widget} 未注册, 已改用下一个候选 widget(F1)',
    en: 'widget {widget} is not registered; fell back to the next candidate widget (F1)',
  },
  JOTL5002: {
    severity: 'warning',
    message: 'widget {widget} 不能处理该数据形态, 已改用下一个候选 widget(F2)',
    en: 'widget {widget} cannot handle this data shape; fell back to the next candidate widget (F2)',
  },
  JOTL5003: {
    severity: 'warning',
    message: 'x-ui 不合法({path}: {reason}), 该节点已按没有 x-ui 处理(F3)',
    en: 'invalid x-ui ({path}: {reason}); the node is rendered as if it had no x-ui (F3)',
  },
  JOTL5004: {
    severity: 'warning',
    message: 'schema 使用了渲染器不支持的特性 {feature}, 该节点已改用 json widget(F7)',
    en: 'the schema uses {feature}, which the renderer does not support; the node falls back to the json widget (F7)',
  },
  JOTL5005: {
    severity: 'warning',
    message: '无法解析引用 {ref}, 该节点已改用 json widget(F7)',
    en: 'cannot resolve reference {ref}; the node falls back to the json widget (F7)',
  },
  JOTL5101: { severity: 'error', message: 'schema 必须是对象或布尔值', en: 'schema must be an object or a boolean' },
  JOTL5102: {
    severity: 'error',
    message: 'schemaPointer 不是合法的 JSON Pointer 或指向的位置不存在: {pointer}',
    en: 'schemaPointer is not a valid JSON Pointer or points to a missing location: {pointer}',
  },
  JOTL5103: {
    severity: 'error',
    message: 'dataPath 不是合法的 JSON Pointer: {pointer}',
    en: 'dataPath is not a valid JSON Pointer: {pointer}',
  },
  JOTL5104: {
    severity: 'error',
    message: 'maxDepth 必须是非负整数, 实际为 {value}',
    en: 'maxDepth must be a non-negative integer, got {value}',
  },
  JOTL5105: {
    severity: 'error',
    message: 'depth 必须是非负整数, 实际为 {value}',
    en: 'depth must be a non-negative integer, got {value}',
  },
} as const;

export type UiCoreDiagnosticCode = keyof typeof UI_CORE_DIAGNOSTICS;

export const uiCoreDiagnostic = defineDiagnostics(UI_CORE_DIAGNOSTICS);

/** F3 的原因短语; 与 JOTL5003 的 {reason} 搭配. */
export const XUI_ISSUE_REASONS = {
  type: '类型不符',
  unknownKey: '未知字段',
  empty: '不能为空字符串',
  enum: '取值不在允许范围内',
  minimum: '必须是不小于 1 的整数',
  required: '缺少必填字段',
  condition: '显示条件必须是 field(可带 base) 加且仅加一个比较项, 或 all any not 组合',
} as const;

export type XUiIssueKind = keyof typeof XUI_ISSUE_REASONS;

/** XUI_ISSUE_REASONS 的英文版, 键必须与之一致. */
export const XUI_ISSUE_REASONS_EN: Readonly<Record<XUiIssueKind, string>> = {
  type: 'type mismatch',
  unknownKey: 'unknown key',
  empty: 'must not be an empty string',
  enum: 'value is not one of the allowed values',
  minimum: 'must be an integer not less than 1',
  required: 'missing required key',
  condition:
    'a visibility condition must be field (optionally with base) plus exactly one comparison, or an all / any / not combination',
};

/** 按当前全局语言取 F3 的原因短语. */
export function xuiIssueReason(kind: XUiIssueKind): string {
  return l10n(XUI_ISSUE_REASONS[kind], XUI_ISSUE_REASONS_EN[kind]);
}
