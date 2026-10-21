// Jotl v1 语法的解析, 语义检查, 编译到 JSON Schema 2020-12, 打印与格式化.
import { type JsonSchemaObject, type Result, type SourceMap, hasErrors } from '../schema/index.js';
import type { JotlFile } from './ast.js';
import { type CompileOptions, compileFile } from './compiler.js';
import { byPosition } from './diagnostics.js';
import { parseSource } from './parser.js';

export type * from './ast.js';
export type { CompileOptions } from './compiler.js';
export {
  COMPONENT_NAMES,
  COMPONENT_WIDGETS,
  CONDITION_OPS,
  CURRENCY_DIGITS,
  ERROR_MESSAGE_KEYWORDS,
  FORMAT_COMPONENTS,
  LAYOUTS,
  META_KEYS,
  META_KEY_NAMES,
  META_KEY_TARGETS,
  RESERVED_COMPONENT_WORDS,
  STRING_COMPONENTS,
  type ComponentName,
  type MetaKeyRule,
  type MetaScope,
  type MetaTarget,
  customMetaKey,
  customMetaKeyword,
  isComponentName,
  isTypeName,
  metaAppliesTo,
  valueFormatSchema,
} from './builtins.js';
export {
  DEFAULT_VALUE_FORMATS,
  TIMESTAMP_VALUE_FORMATS,
  VALUE_FORMAT_ALIASES,
  valueFormatComponent,
} from '../schema/index.js';
export {
  BUILTIN_WIDGETS,
  EXTENSION_CONSTRAINT_KEYS,
  type ExtensionBase,
  acceptsWidget,
  defaultWidget,
  extensionBase,
  extensionConstraintKeys,
} from './shapes.js';
export { SYNTAX_DIAGNOSTICS, type SyntaxDiagnosticCode } from './diagnostics.js';
export {
  JOTL_CONFIG_FILE,
  JOTL_CONFIG_SCHEMA_ID,
  type JotlConfig,
  type JotlConfigIssue,
  configCompileOptions,
  createJotlConfigJsonSchema,
  readJotlConfig,
} from './config.js';

export interface CompileOutput {
  /** 规范化的 JSON Schema 2020-12 文档, 关键字已按规范化规则排列. */
  schema: JsonSchemaObject;
  /** schema 指针到源码位置; 字段与 `$defs` 条目的 keyRange 指向键. */
  sourceMap: SourceMap;
  ast: JotlFile;
  /** 默认导出的类型名(`<default/>`, 未写时跟随根); 没有条目时为 undefined. 不进 schema, 生成 TS 时传给 `schemaToTs` 的 `defaultExport`. */
  defaultExport: string | undefined;
}

/** 只做词法与语法分析; 有语法错误时仍返回尽力恢复出的 AST. */
export function parse(text: string, file: string): Result<JotlFile> {
  const { ast, diagnostics } = parseSource(text, file);
  return { value: ast, diagnostics: diagnostics.sort(byPosition) };
}

/** 解析, 语义检查并编译; 有 error 级诊断时 value 为 undefined. options.widgets 为已登记的扩展组件. */
export function compile(text: string, file: string, options: CompileOptions = {}): Result<CompileOutput> {
  const parsed = parseSource(text, file);
  const compiled = compileFile(parsed.ast, options);
  const diagnostics = [...parsed.diagnostics, ...compiled.diagnostics].sort(byPosition);
  if (hasErrors(diagnostics)) return { value: undefined, diagnostics };
  return {
    value: {
      schema: compiled.schema,
      sourceMap: compiled.sourceMap,
      ast: parsed.ast,
      defaultExport: compiled.defaultExport,
    },
    diagnostics,
  };
}
export { print, type PrintOptions } from './print/print.js';
export { format } from './print/format.js';
