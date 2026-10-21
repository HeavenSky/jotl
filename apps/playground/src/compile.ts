// 纯函数: Jotl 源码编译为 JSON Schema 文本, schema 生成 TS 文本, 两者的诊断统一换算成源码行列.
import { compile, getLocale, type CompileOptions } from '@jotl/core';
import {
  parentPointer,
  type Diagnostic,
  type JsonSchema,
  type JsonSchemaObject,
  type Result,
  type Severity,
  type SourceMap,
  type SourceRange,
} from '@jotl/core';
import type { ConfigReport } from './config.js';
import { copyOf, type DiagnosticStage } from './copy.js';

/** 编译时使用的文件名, 也是源码定位诊断中 range.file 的取值. */
export const PLAYGROUND_FILE = 'playground.jotl';

export type { DiagnosticStage };

/** line 与 column 从 1 起, column 按 UTF-16 代码单元计. */
export interface LineColumn {
  line: number;
  column: number;
}

export interface PlaygroundDiagnostic {
  stage: DiagnosticStage;
  /** 内部错误没有代码. */
  code?: string;
  severity: Severity;
  message: string;
  /** 无法换算到源码时缺省. */
  start?: LineColumn;
  end?: LineColumn;
}

export interface CompiledSchema {
  schema: JsonSchemaObject;
  schemaText: string;
  sourceMap: SourceMap;
  /** 默认导出的类型名, 生成 TS 时传入. */
  defaultExport?: string;
}

export interface CompileReport {
  source: string;
  /** 有 error 级诊断时缺省. */
  output?: CompiledSchema;
  diagnostics: PlaygroundDiagnostic[];
}

export type SchemaToTs = (schema: JsonSchema, options?: { defaultExport?: string }) => Result<string>;

export interface TsReport {
  /** 生成失败时缺省. */
  text?: string;
  diagnostics: PlaygroundDiagnostic[];
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function rangeOf(range: SourceRange): Pick<PlaygroundDiagnostic, 'start' | 'end'> {
  return {
    start: { line: range.start.line, column: range.start.column },
    end: { line: range.end.line, column: range.end.column },
  };
}

/** 指针在源码映射中查不到时逐级取父指针, 定位到最近的已映射祖先. */
function pointerRange(pointer: string, sourceMap: SourceMap | undefined): SourceRange | undefined {
  if (sourceMap === undefined) return undefined;
  for (let current: string | undefined = pointer; current !== undefined; current = parentPointer(current)) {
    const span = sourceMap.get(current);
    if (span !== undefined) return span.keyRange ?? span.range;
  }
  return undefined;
}

function toPlayground(
  diagnostic: Diagnostic,
  stage: DiagnosticStage,
  sourceMap: SourceMap | undefined
): PlaygroundDiagnostic {
  const base: PlaygroundDiagnostic = {
    stage,
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
  };
  const location = diagnostic.location;
  if (location === undefined) return base;
  if (location.kind === 'source')
    return location.range.file === PLAYGROUND_FILE ? { ...base, ...rangeOf(location.range) } : base;
  if (location.document !== undefined) return base;
  const range = pointerRange(location.pointer, sourceMap);
  return range === undefined ? base : { ...base, ...rangeOf(range) };
}

export function formatSchema(schema: JsonSchema): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}

/** 编译器自身抛出的异常也转为一条诊断, 不向外抛. */
export function compileSource(source: string, options: CompileOptions = {}): CompileReport {
  let result: ReturnType<typeof compile>;
  try {
    result = compile(source, PLAYGROUND_FILE, options);
  } catch (error) {
    return {
      source,
      diagnostics: [
        {
          stage: 'compile',
          severity: 'error',
          message: copyOf(getLocale()).diagnostics.internalError(errorDetail(error)),
        },
      ],
    };
  }
  const sourceMap = result.value?.sourceMap;
  const diagnostics = result.diagnostics.map(d => toPlayground(d, 'compile', sourceMap));
  if (result.value === undefined) return { source, diagnostics };
  const { schema, defaultExport } = result.value;
  const output: CompiledSchema = { schema, schemaText: formatSchema(schema), sourceMap: result.value.sourceMap };
  if (defaultExport !== undefined) output.defaultExport = defaultExport;
  return { source, output, diagnostics };
}

/** 生成器的指针诊断经编译结果的源码映射换算到源码行列. */
export function generateTs(compiled: CompiledSchema, schemaToTs: SchemaToTs): TsReport {
  let result: Result<string>;
  try {
    result = schemaToTs(
      compiled.schema,
      compiled.defaultExport === undefined ? {} : { defaultExport: compiled.defaultExport }
    );
  } catch (error) {
    return {
      diagnostics: [
        {
          stage: 'ts',
          severity: 'error',
          message: copyOf(getLocale()).diagnostics.tsInternalError(errorDetail(error)),
        },
      ],
    };
  }
  const diagnostics = result.diagnostics.map(d => toPlayground(d, 'ts', compiled.sourceMap));
  return result.value === undefined ? { diagnostics } : { text: result.value, diagnostics };
}

export interface PlaygroundBuild {
  report: CompileReport;
  /** 编译失败时缺省. */
  ts?: TsReport;
  /** 编译时使用的 jotl.config.json; 没有配置时缺省. */
  config?: ConfigReport;
}

export function buildPlayground(source: string, schemaToTs: SchemaToTs, config?: ConfigReport): PlaygroundBuild {
  const report = compileSource(source, config?.compileOptions);
  const build: PlaygroundBuild =
    report.output === undefined ? { report } : { report, ts: generateTs(report.output, schemaToTs) };
  if (config !== undefined) build.config = config;
  return build;
}

/** 配置诊断在前, 其后是编译诊断与 TS 诊断. */
export function allDiagnostics(build: PlaygroundBuild): PlaygroundDiagnostic[] {
  return [...(build.config?.diagnostics ?? []), ...build.report.diagnostics, ...(build.ts?.diagnostics ?? [])];
}

export function countBySeverity(diagnostics: readonly PlaygroundDiagnostic[]): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const d of diagnostics) {
    if (d.severity === 'error') errors += 1;
    else if (d.severity === 'warning') warnings += 1;
  }
  return { errors, warnings };
}
