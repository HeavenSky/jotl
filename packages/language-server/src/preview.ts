// 预览内容(E6): 给定源码返回编译出的 JSON Schema 文本, TS 声明文本与各自的诊断, 经自定义请求 `jotl/preview` 提供给插件的预览面板.
import { type Diagnostic, type JsonPointer, parentPointer, type Severity, type SourceMap, type XUiWidgetModule } from "@jotl/core";
import { compile } from "@jotl/core";
import { schemaToTs } from "@jotl/convert";
import { collectJotlDiagnostics } from "./document-diagnostics.js";
import { compileOptions, type LanguageServiceOptions } from "./options.js";
import type { ProjectConfig } from "./project-config.js";

export const PREVIEW_REQUEST_METHOD = "jotl/preview";
/** 服务端处理完 jotl.config.json 变更后发出的通知(无参数); 预览收到后重新请求. */
export const PREVIEW_CONFIG_CHANGED_METHOD = "jotl/configChanged";

export interface PreviewParams {
  textDocument: { uri: string };
}

export interface PreviewDiagnostic {
  severity: Severity;
  code: string;
  message: string;
  /** 行列从 1 起; 没有源码位置且无法经 SourceMap 换算时为 undefined. */
  line: number | undefined;
  column: number | undefined;
  /** 诊断定位在 schema 指针上时的指针(TS 转换的诊断). */
  pointer: JsonPointer | undefined;
}

export interface PreviewContent {
  uri: string;
  /** 两个空格缩进的 JSON 文本; 有 error 级诊断时为 undefined. */
  schema: string | undefined;
  diagnostics: PreviewDiagnostic[];
  /** `schemaToTs` 的产物; 编译失败或转换失败时为 undefined. */
  typescript: string | undefined;
  /** `schemaToTs` 的诊断; 编译失败时为空. */
  typescriptDiagnostics: PreviewDiagnostic[];
  /** 文档所属 jotl.config.json 的绝对路径; 没有时为 undefined. */
  configFile: string | undefined;
  /** 配置文件中的模块声明; `module` 原样保留, 相对路径按 `configFile` 所在目录解析. */
  modules: Record<string, XUiWidgetModule>;
}

/** 指针本身不在 SourceMap 中时取最近的祖先节点, 字段与声明取键名位置. */
function sourceStart(sourceMap: SourceMap, pointer: JsonPointer): { line: number; column: number } | undefined {
  for (let current: JsonPointer | undefined = pointer; current !== undefined; current = parentPointer(current)) {
    const span = sourceMap.get(current);
    if (span !== undefined) return (span.keyRange ?? span.range).start;
  }
  return undefined;
}

function toPreviewDiagnostic(d: Diagnostic, sourceMap: SourceMap | undefined): PreviewDiagnostic {
  const location = d.location;
  const pointer = location?.kind === "pointer" ? location.pointer : undefined;
  const start =
    location?.kind === "source" ? location.range.start : pointer !== undefined && sourceMap ? sourceStart(sourceMap, pointer) : undefined;
  return { severity: d.severity, code: d.code, message: d.message, line: start?.line, column: start?.column, pointer };
}

export function getPreview(
  text: string,
  uri: string,
  options: LanguageServiceOptions = {},
  config?: Pick<ProjectConfig, "file" | "modules">,
): PreviewContent {
  const compiled = compile(text, uri, compileOptions(options)).value;
  const diagnostics = collectJotlDiagnostics(text, uri, options).map((d) => toPreviewDiagnostic(d, undefined));
  const project = { configFile: config?.file, modules: config?.modules ?? {} };
  if (compiled === undefined) return { uri, schema: undefined, diagnostics, typescript: undefined, typescriptDiagnostics: [], ...project };
  const ts = schemaToTs(compiled.schema, compiled.defaultExport === undefined ? {} : { defaultExport: compiled.defaultExport });
  return {
    ...project,
    uri,
    schema: JSON.stringify(compiled.schema, null, 2),
    diagnostics,
    typescript: ts.value,
    typescriptDiagnostics: ts.diagnostics.map((d) => toPreviewDiagnostic(d, compiled.sourceMap)),
  };
}
