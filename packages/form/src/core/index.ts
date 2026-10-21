// x-ui 解析与合并, 组件注册与解析, 降级决策; 不依赖 UI 框架.
export type {
  Adapters,
  ArrayProps,
  BaseProps,
  BlobLike,
  DecoratorProps,
  EntryEditing,
  EvaluateCondition,
  ExpandFunction,
  FieldProps,
  LayoutField,
  LayoutProps,
  MapProps,
  NullableProps,
  PlanDegradeReason,
  PlanFunction,
  PlanOptions,
  Registry,
  RenderMode,
  RenderPlanNode,
  ResolveContext,
  ResolveSource,
  TreeProps,
  TupleProps,
  TupleRest,
  UnionProps,
  UploadContext,
  ViewProps,
  WidgetLevel,
  WidgetRegistration,
} from './contracts.js';
export {
  BUILTIN_WIDGETS,
  DECORATOR_WIDGET,
  FALLBACK_WIDGET,
  FORMAT_WIDGETS,
  ROOT_WIDGET,
  enumOptions,
  fieldLabel,
  isBuiltinWidget,
  requiredKeys,
  schemaTypes,
  type BuiltinWidget,
  type BuiltinWidgetName,
  type EnumOption,
  type WidgetPriority,
} from './builtin-widgets.js';
export { createRegistry } from './registry.js';
export { DEFAULT_MAX_DEPTH, expand, plan, resolvePlanNode } from './plan.js';
export { resolveSchema, resolveSchemaAt, type RefTarget, type ResolvedNode, type SchemaSite } from './schema-node.js';
export { evaluateCondition, jsonEqual } from './condition.js';
export { resolveXUi, type Degrade, type ResolvedXUi, type ResolveXUiOptions } from './resolve.js';
export type { MergedUi, WidgetCandidate } from './x-ui-merge.js';
export {
  JSON_TEXT_MEDIA_TYPE,
  RICH_TEXT_MEDIA_TYPE,
  builtinAccepts,
  decimalKind,
  matchBuiltinWidget,
  splitBranch,
  valueFormatOf,
  valueFormatWidget,
  type DecimalKind,
} from './schema-shape.js';
export {
  EXACT_DECIMAL,
  formatThousands,
  fromBig,
  isDecimalValue,
  stripThousands,
  toBig,
  type DecimalValue,
} from './decimal.js';
export { checkXUi, type XUiIssue } from './x-ui-check.js';
export {
  UI_CORE_DIAGNOSTICS,
  XUI_ISSUE_REASONS,
  XUI_ISSUE_REASONS_EN,
  uiCoreDiagnostic,
  xuiIssueReason,
  type UiCoreDiagnosticCode,
  type XUiIssueKind,
} from './diagnostics.js';
