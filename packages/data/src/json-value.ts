// JSON 值的类型判断, 深度相等与深拷贝.
import type { JsonSchemaType } from "@jotl/core";

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 整数值记为 integer. */
export function jsonType(value: unknown): JsonSchemaType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  return "object";
}

/** 对象不比较键顺序. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && jsonEqual(a[k], b[k]));
}

/** 运行时不依赖 structuredClone(不在 ES2023 标准库中). */
export function cloneJson<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v: unknown) => cloneJson(v)) as T;
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) setOwn(out, k, cloneJson(v));
  return out as T;
}

/** 键来自用户数据时必须用它写入: 直接赋值 obj["__proto__"] 会改原型而不是写字段. */
export function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}
