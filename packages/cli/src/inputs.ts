// 输入的读取与解析: 按扩展名或 --from 判断格式, 把 Jotl, JSON Schema, TS 声明统一载入为 2020-12 schema.
import { type Diagnostic, type JsonSchema, type SourceRange, formatMessage, hasErrors, locateJsonError } from "@jotl/core";
import { compile } from "@jotl/core";
import { tsToSchema } from "@jotl/convert/from-ts";
import {
  type ConflictPolicy,
  SCHEMA_VERSIONS,
  type SchemaVersion,
  type UpgradeOptions,
  upgradeSchema,
} from "@jotl/convert";
import type { OptionSpec } from "./args.js";
import type { ConfigResolver } from "./config.js";
import type { CommandContext } from "./command.js";
import { cliDiagnostic } from "./diagnostics.js";
import { type CommandName, cliText } from "./messages.js";
import { type DiagnosticOrigin, UsageError, fsReason } from "./report.js";

export const INPUT_FORMATS = ["jotl", "schema", "ts"] as const;
export type InputFormat = (typeof INPUT_FORMATS)[number];

export const FORMAT_OPTION: OptionSpec = { type: "string", choices: INPUT_FORMATS };
export const SCHEMA_VERSION_OPTION: OptionSpec = { type: "string", choices: SCHEMA_VERSIONS };

const FALLBACK_VERSION: SchemaVersion = "2020-12";
export const BOM = "\uFEFF";
/** 输入文件参数写 `-` 时从 stdin 读入. */
export const STDIN = "-";

export function formatFromExtension(file: string): InputFormat | undefined {
  const lower = file.toLowerCase();
  if (lower.endsWith(".jotl")) return "jotl";
  if (lower.endsWith(".json")) return "schema";
  if (lower.endsWith(".ts")) return "ts";
  return undefined;
}

/** 无法判断格式时报用法错误; withFromHint 为 true 时提示可用 --from. */
export function resolveFormat(
  command: CommandName,
  file: string,
  from: InputFormat | undefined,
  withFromHint: boolean,
): InputFormat {
  const format = from ?? formatFromExtension(file);
  if (format !== undefined) return format;
  throw new UsageError(cliDiagnostic(withFromHint ? "JOTL9010" : "JOTL9009", { file }), command);
}

/** stdin 输入没有扩展名, 按内容判断: 首个非空白字符为 `{` 或 `[` 时为 JSON Schema, 否则为 Jotl 源码. */
export function formatFromContent(text: string): InputFormat {
  return /^\s*[{[]/.test(text) ? "schema" : "jotl";
}

const TS_HEAD = /^(?:export|declare|interface|type|import|enum|namespace|const|let|var|function|class|abstract)\s+[A-Za-z_$*{]/;
const JOTL_HEAD = /^(?:<|[A-Z][A-Za-z0-9]*\s*[(:[])/;

/** convert 的 stdin 输入还可能是 TS: 去掉开头注释后以 TS 声明关键字开头为 TS, 以 `<` 或大驼峰类型名开头为 Jotl; 其余返回 undefined. */
export function detectFormatWithTs(text: string): InputFormat | undefined {
  if (/^\s*[{[]/.test(text)) return "schema";
  const head = text.replace(/^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/, "");
  if (head === "") return "jotl";
  if (TS_HEAD.test(head)) return "ts";
  if (JOTL_HEAD.test(head)) return "jotl";
  return undefined;
}

/** schema 参数的格式; `-` 返回 undefined, 由 loadSchema 读入后按内容判断. */
export function resolveSchemaFormat(command: CommandName, file: string): InputFormat | undefined {
  return file === STDIN ? undefined : resolveFormat(command, file, undefined, false);
}

/** 同一命令中 `-` 至多出现一次; stdin 只能读一遍. */
export function assertSingleStdin(command: CommandName, files: readonly string[]): void {
  if (files.filter((f) => f === STDIN).length > 1) throw new UsageError(cliDiagnostic("JOTL9015"), command);
}

/** 读取失败时报 JOTL9050 并返回 undefined; 去掉开头的 BOM, bom 记录原文是否带 BOM. */
export function readInputText(ctx: CommandContext, file: string): { text: string; bom: boolean } | undefined {
  let text: string;
  try {
    text = file === STDIN ? ctx.io.readStdin() : ctx.io.readFile(file);
  } catch (error) {
    ctx.reporter.report([cliDiagnostic("JOTL9050", { file, reason: fsReason(error) })], { file });
    return undefined;
  }
  const bom = text.startsWith(BOM);
  return { text: bom ? text.slice(BOM.length) : text, bom };
}

export function readInput(ctx: CommandContext, file: string): string | undefined {
  return readInputText(ctx, file)?.text;
}

export function rangeAt(file: string, text: string, offset: number): SourceRange {
  const before = text.slice(0, offset);
  const line = before.split("\n").length;
  const column = offset - (before.lastIndexOf("\n") + 1) + 1;
  const position = { line, column, offset };
  return { file, start: position, end: position };
}

/** JSON 解析失败时报 JOTL9052(带第一个语法错误的行列)并返回 ok: false. */
export function parseJsonInput(ctx: CommandContext, file: string, text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    const located = locateJsonError(text);
    const detail = located === undefined
      ? (error instanceof Error ? error.message : String(error))
      : located.found === undefined
        ? cliText().jsonUnexpectedEnd
        : formatMessage(cliText().jsonUnexpectedChar, { char: located.found });
    const extras = located === undefined ? {} : { location: { kind: "source" as const, range: rangeAt(file, text, located.offset) } };
    ctx.reporter.report([cliDiagnostic("JOTL9052", { detail }, extras)], { file });
    return { ok: false };
  }
}

export interface SchemaInputFlags {
  version?: SchemaVersion;
  acceptNewerKeywords?: boolean;
  onConflict?: ConflictPolicy;
  /** 是否报告升级的变更清单(info 级); 只有 migrate-schema --to schema 为 true. */
  showChanges: boolean;
  /** Jotl 输入的编译选项(来自 jotl.config.json); 未给出时不登记扩展组件. */
  config?: ConfigResolver;
}

function visible(diagnostics: readonly Diagnostic[], showChanges: boolean): Diagnostic[] {
  return showChanges ? [...diagnostics] : diagnostics.filter((d) => d.severity !== "info");
}

/**
 * 把已解析的 JSON 升级到 2020-12.
 * 未指定版本且只因无法识别版本(JOTL3001)失败时, 按 2020-12 重试并报 JOTL9053.
 */
export function upgradeJson(ctx: CommandContext, file: string, json: unknown, flags: SchemaInputFlags): JsonSchema | undefined {
  const options: UpgradeOptions = {};
  if (flags.version !== undefined) options.version = flags.version;
  if (flags.acceptNewerKeywords !== undefined) options.acceptNewerKeywords = flags.acceptNewerKeywords;
  if (flags.onConflict !== undefined) options.onConflict = flags.onConflict;
  let result = upgradeSchema(json, options);
  const undetectable = result.value === undefined && flags.version === undefined
    && result.diagnostics.length > 0 && result.diagnostics.every((d) => d.code === "JOTL3001");
  if (undetectable) {
    ctx.reporter.report([cliDiagnostic("JOTL9053", undefined, { location: { kind: "pointer", pointer: "" } })], { file });
    result = upgradeSchema(json, { ...options, version: FALLBACK_VERSION });
  }
  ctx.reporter.report(visible(result.diagnostics, flags.showChanges), { file });
  return result.value?.schema;
}

export interface LoadedSchema {
  schema: JsonSchema;
  format: InputFormat;
  /** 报告与该 schema 有关的指针诊断时使用; Jotl 输入带源码映射. */
  origin: DiagnosticOrigin;
  /** Jotl 与 TS 输入的默认导出类型名(不在 schema 中), 生成 TS 时传给 `schemaToTs`, 打印 Jotl 时传给 `print`. */
  defaultExport?: string;
}

/**
 * 按格式载入 schema 并报告诊断; format 为 undefined 时用 detect 按内容判断; 有错误级诊断时返回 undefined.
 */
export function loadSchema(
  ctx: CommandContext,
  file: string,
  given: InputFormat | undefined,
  flags: SchemaInputFlags,
  detect: (text: string) => InputFormat = formatFromContent,
): LoadedSchema | undefined {
  const text = readInput(ctx, file);
  if (text === undefined) return undefined;
  const format = given ?? detect(text);
  switch (format) {
    case "jotl": {
      const options = flags.config === undefined ? {} : flags.config(file);
      if (options === undefined) return undefined;
      const result = compile(text, file, options);
      ctx.reporter.report(result.diagnostics, { file });
      if (result.value === undefined) return undefined;
      const loaded: LoadedSchema = { schema: result.value.schema, format, origin: { file, sourceMap: result.value.sourceMap } };
      if (result.value.defaultExport !== undefined) loaded.defaultExport = result.value.defaultExport;
      return loaded;
    }
    case "ts": {
      const result = tsToSchema(text, { fileName: file });
      ctx.reporter.report(result.diagnostics, { file });
      if (result.value === undefined || hasErrors(result.diagnostics)) return undefined;
      const loaded: LoadedSchema = { schema: result.value, format, origin: { file } };
      if (result.defaultExport !== undefined) loaded.defaultExport = result.defaultExport;
      return loaded;
    }
    case "schema": {
      const parsed = parseJsonInput(ctx, file, text);
      if (!parsed.ok) return undefined;
      const schema = upgradeJson(ctx, file, parsed.value, flags);
      return schema === undefined ? undefined : { schema, format, origin: { file } };
    }
  }
}
