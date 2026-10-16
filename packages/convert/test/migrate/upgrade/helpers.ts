// 测试辅助: 按代码筛选诊断, 深度冻结输入以证明升级不修改它.
import type { Diagnostic } from "@jotl/core";

export function codes(diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map((d) => d.code);
}

export function find(diagnostics: readonly Diagnostic[], code: string): Diagnostic | undefined {
  return diagnostics.find((d) => d.code === code);
}

export function pointerOf(diagnostic: Diagnostic | undefined): string | undefined {
  return diagnostic?.location?.kind === "pointer" ? diagnostic.location.pointer : undefined;
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
