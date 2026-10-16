// JSON Pointer(RFC 6901)的解析, 拼接, 转义, 求值与 `*` 通配匹配, 各包共用.
import { type Result, fail, ok } from "./diagnostic.js";
import { schemaDiagnostic } from "./diagnostics.js";

/** RFC 6901, "" 表示根. */
export type JsonPointer = string;

/** 通配片段: 匹配时代表任意单个片段, 数据模板路径中代表数组下标. */
export const POINTER_WILDCARD = "*";

export function escapePointerToken(token: string): string {
  // 先转 ~ 再转 /, 顺序颠倒会把 "/" 转成 "~01".
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

export function unescapePointerToken(token: string): string {
  // 先还原 ~1 再还原 ~0, 顺序颠倒会把 "~01" 还原成 "/".
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

/** 合法时返回片段数组, 否则返回 undefined. */
export function tryParsePointer(pointer: string): string[] | undefined {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) return undefined;
  const raw = pointer.slice(1).split("/");
  if (raw.some((t) => /~(?![01])/.test(t))) return undefined;
  return raw.map(unescapePointerToken);
}

export function parsePointer(pointer: string): Result<string[]> {
  const tokens = tryParsePointer(pointer);
  if (tokens === undefined) return fail([schemaDiagnostic("JOTL0001", { pointer })]);
  return ok(tokens);
}

export function isPointer(value: string): boolean {
  return tryParsePointer(value) !== undefined;
}

export function formatPointer(tokens: readonly (string | number)[]): JsonPointer {
  return tokens.map((t) => "/" + escapePointerToken(String(t))).join("");
}

/** 在指针末尾追加未转义的片段. */
export function appendPointer(base: JsonPointer, ...tokens: (string | number)[]): JsonPointer {
  return base + formatPointer(tokens);
}

/**
 * 拼接已转义的相对路径(如 "img", "0/img"), 用于 `renderChild(relativePath)`.
 * 相对路径为空串时返回 base.
 */
export function joinPointer(base: JsonPointer, relative: string): JsonPointer {
  if (relative === "") return base;
  return `${base}/${relative.replace(/^\//, "")}`;
}

export function parentPointer(pointer: JsonPointer): JsonPointer | undefined {
  if (pointer === "") return undefined;
  return pointer.slice(0, pointer.lastIndexOf("/"));
}

export function lastPointerToken(pointer: JsonPointer): string | undefined {
  const tokens = tryParsePointer(pointer);
  return tokens?.[tokens.length - 1];
}

export interface PointerLookup {
  found: boolean;
  value: unknown;
}

/** 按 RFC 6901 求值; 数组片段只接受规范的十进制下标. */
export function lookupPointer(document: unknown, pointer: JsonPointer): PointerLookup {
  const tokens = tryParsePointer(pointer);
  if (tokens === undefined) return { found: false, value: undefined };
  let current: unknown = document;
  for (const token of tokens) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(token)) return { found: false, value: undefined };
      const index = Number(token);
      if (index >= current.length) return { found: false, value: undefined };
      current = current[index];
    } else if (typeof current === "object" && current !== null && Object.hasOwn(current, token)) {
      current = (current as Record<string, unknown>)[token];
    } else {
      return { found: false, value: undefined };
    }
  }
  return { found: true, value: current };
}

export function evaluatePointer(document: unknown, pointer: JsonPointer): Result<unknown> {
  const parsed = parsePointer(pointer);
  if (parsed.value === undefined) return fail(parsed.diagnostics);
  const { found, value } = lookupPointer(document, pointer);
  if (!found) return fail([schemaDiagnostic("JOTL0002", { pointer })]);
  return ok(value);
}

/** 模式中值为 "*" 的片段匹配任意单个片段, 其余片段逐字相等; 片段数必须相同. */
export function matchPointer(pattern: JsonPointer, pointer: JsonPointer): boolean {
  const p = tryParsePointer(pattern);
  const t = tryParsePointer(pointer);
  if (p === undefined || t === undefined || p.length !== t.length) return false;
  return p.every((token, i) => token === POINTER_WILDCARD || token === t[i]);
}

/** 把模板路径中的 "*" 依次替换为实际下标; 下标不足时保留剩余的 "*". */
export function fillWildcards(template: JsonPointer, indexes: readonly number[]): JsonPointer {
  const tokens = tryParsePointer(template);
  if (tokens === undefined) return template;
  let next = 0;
  return formatPointer(tokens.map((t) => (t === POINTER_WILDCARD && next < indexes.length ? indexes[next++]! : t)));
}
