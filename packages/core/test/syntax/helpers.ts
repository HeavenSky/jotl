// 测试辅助: 解析或编译一段源码, 取出诊断的代码与位置.
import type { Diagnostic, JsonSchemaObject } from "../../src/schema/index.js";
import { expect } from "vitest";
import { type CompileOptions, type JotlFile, compile, parse } from "../../src/syntax/index.js";

export const FILE = "test.jotl";

export interface Located {
  code: string;
  line: number;
  column: number;
}

export function located(diagnostics: readonly Diagnostic[]): Located[] {
  return diagnostics.map((d) => ({
    code: d.code,
    line: d.location?.kind === "source" ? d.location.range.start.line : 0,
    column: d.location?.kind === "source" ? d.location.range.start.column : 0,
  }));
}

export function codes(diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map((d) => d.code);
}

/** 解析且要求没有诊断. */
export function parseOk(text: string): JotlFile {
  const result = parse(text, FILE);
  expect(result.diagnostics).toEqual([]);
  return result.value!;
}

export function parseCodes(text: string): string[] {
  return codes(parse(text, FILE).diagnostics);
}

export function compileCodes(text: string, options?: CompileOptions): string[] {
  return codes(compile(text, FILE, options).diagnostics);
}

/** 编译且要求没有诊断, 返回整个文档. */
export function compileDoc(text: string, options?: CompileOptions): JsonSchemaObject {
  const result = compile(text, FILE, options);
  expect(result.diagnostics).toEqual([]);
  return result.value!.schema;
}

/** 编译且要求没有诊断, 返回 `$defs` 中指定类型(默认 `A`)的 schema. */
export function compileDef(text: string, name = "A", options?: CompileOptions): JsonSchemaObject {
  return compileDoc(text, options).$defs![name] as JsonSchemaObject;
}

/** 编译 `A: { x<field> }` 并返回字段 x 的 schema; extra 为追加在后面的顶层条目. */
export function compileField(field: string, extra = "", options?: CompileOptions): JsonSchemaObject {
  const def = compileDef(`A: {\n  x${field}\n}\n${extra}`, "A", options);
  return def.properties!.x as JsonSchemaObject;
}

/** 编译 `A: { x<field> }` 并返回诊断代码. */
export function fieldCodes(field: string, extra = "", options?: CompileOptions): string[] {
  return compileCodes(`A: {\n  x${field}\n}\n${extra}`, options);
}
