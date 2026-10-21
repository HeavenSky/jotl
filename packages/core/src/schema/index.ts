// Jotl 公共契约: JSON Schema 2020-12 与 x-ui 类型, 源码映射, 诊断与数据能力接口.
export {
  JSON_SCHEMA_DIALECT,
  SUBSCHEMA_KEYWORDS,
  isSchemaObject,
  orderKeywords,
  type JsonSchema,
  type JsonSchemaObject,
  type JsonSchemaType,
  type JsonValue,
} from './json-schema.js';
export type { SourceMap, SourcePosition, SourceRange, SourceSpan } from './source.js';
export {
  defineDiagnostics,
  fail,
  formatMessage,
  hasErrors,
  ok,
  type Diagnostic,
  type DiagnosticCode,
  type DiagnosticDefinition,
  type DiagnosticExtras,
  type DiagnosticFactory,
  type DiagnosticFix,
  type DiagnosticLocation,
  type DiagnosticTable,
  type Result,
  type Severity,
} from './diagnostic.js';
export { SCHEMA_DIAGNOSTICS, schemaDiagnostic } from './diagnostics.js';
export { DEFAULT_LOCALE, getLocale, l10n, resolveLocale, setLocale, type Locale } from './locale.js';
export {
  POINTER_WILDCARD,
  appendPointer,
  escapePointerToken,
  evaluatePointer,
  fillWildcards,
  formatPointer,
  isPointer,
  joinPointer,
  lastPointerToken,
  lookupPointer,
  matchPointer,
  parentPointer,
  parsePointer,
  tryParsePointer,
  unescapePointerToken,
  type JsonPointer,
  type PointerLookup,
} from './json-pointer.js';
export {
  DEFAULT_GRID_COLUMNS,
  DEFAULT_SCENE,
  type Condition,
  type ConditionBase,
  type UiRule,
  type UiRuleMatch,
  type XUi,
  type XUiGroup,
  type XUiLayout,
  type XUiVariant,
  type XUiWidgetModule,
} from './x-ui.js';
export { xUiMetaSchema } from './x-ui-meta-schema.js';
export {
  DEFAULT_DEFAULTS_OPTIONS,
  type DataApi,
  type DefaultsOptions,
  type FillDefaults,
  type GetDefaults,
  type Migrate,
  type Mock,
  type MockOptions,
  type Validate,
} from './data-api.js';
export {
  DEFAULT_VALUE_FORMATS,
  TIMESTAMP_VALUE_FORMATS,
  VALUE_FORMAT_ALIASES,
  isRfc3339DateTime,
  isTimestampValueFormat,
  isValueFormatAlias,
  matchesValueFormat,
  matchesValueFormatText,
  valueFormatComponent,
  type TemporalComponent,
} from './value-format.js';
