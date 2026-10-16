// 诊断与 Result 的类型, 以及按代码表生成诊断的工具.
import type { JsonPointer } from "./json-pointer.js";
import { getLocale } from "./locale.js";
import type { SourceRange } from "./source.js";

export type Severity = "error" | "warning" | "info";

export type DiagnosticCode = `JOTL${number}`;

export type DiagnosticLocation =
  | { kind: "source"; range: SourceRange }
  | { kind: "pointer"; pointer: JsonPointer; document?: string };

export interface DiagnosticFix {
  title: string;
  edits: { range: SourceRange; newText: string }[];
}

export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  /** 面向使用者, 语言取创建时的 `getLocale()`. */
  message: string;
  location?: DiagnosticLocation;
  related?: { message: string; location: DiagnosticLocation }[];
  fixes?: DiagnosticFix[];
}

/** 有 error 时 value 可以为空. */
export interface Result<T> {
  value: T | undefined;
  diagnostics: Diagnostic[];
}

export function ok<T>(value: T, diagnostics: Diagnostic[] = []): Result<T> {
  return { value, diagnostics };
}

export function fail<T>(diagnostics: Diagnostic[]): Result<T> {
  return { value: undefined, diagnostics };
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}

export interface DiagnosticDefinition {
  severity: Severity;
  /** 中文消息模板, `{name}` 由参数替换. */
  message: string;
  /** 英文消息模板, 参数同 message; 缺省时英文环境也用中文模板. */
  en?: string;
}

export type DiagnosticTable = Readonly<Record<DiagnosticCode, DiagnosticDefinition>>;

export interface DiagnosticExtras {
  location?: DiagnosticLocation;
  related?: Diagnostic["related"];
  fixes?: DiagnosticFix[];
  /** 覆盖代码表中的默认级别. */
  severity?: Severity;
}

export type DiagnosticFactory<C extends DiagnosticCode> = (
  code: C,
  params?: Readonly<Record<string, string | number>>,
  extras?: DiagnosticExtras,
) => Diagnostic;

export function formatMessage(template: string, params: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** 由各包 `src/diagnostics.ts` 的代码表生成诊断工厂; 消息只在代码表中书写. */
export function defineDiagnostics<T extends DiagnosticTable>(table: T): DiagnosticFactory<keyof T & DiagnosticCode> {
  return (code, params, extras = {}) => {
    const def = table[code];
    if (def === undefined) throw new Error(`诊断代码表中没有 ${code}`);
    const diagnostic: Diagnostic = {
      code,
      severity: extras.severity ?? def.severity,
      message: formatMessage(getLocale() === "en" && def.en !== undefined ? def.en : def.message, params),
    };
    if (extras.location) diagnostic.location = extras.location;
    if (extras.related) diagnostic.related = extras.related;
    if (extras.fixes) diagnostic.fixes = extras.fixes;
    return diagnostic;
  };
}
