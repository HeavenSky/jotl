// 显示条件(D43)求值: eq ne in notIn 按 JSON 值深度相等, gt gte lt lte 比较数值; field 从数据根或当前节点所在对象(base: "node")起算, "*" 取当前节点实际路径中同一位置的片段.
import {
  POINTER_WILDCARD,
  formatPointer,
  lookupPointer,
  tryParsePointer,
  type Condition,
  type JsonPointer,
} from '@jotl/core';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JSON 值的深度相等: 对象比较键集合与各键的值, 数组按位置比较. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((item, i) => jsonEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every(key => Object.hasOwn(b, key) && jsonEqual(a[key], b[key]));
  }
  return false;
}

/**
 * 取 field 指向的值; 找不到(含 "*" 位置超出 dataPath)时返回 undefined.
 * base 为 "node" 时 field 从当前节点所在的对象(dataPath 的父路径)起算, "*" 按拼接后的绝对位置取 dataPath 中的片段.
 */
function readField(field: unknown, base: unknown, data: unknown, dataPath: JsonPointer): unknown {
  if (typeof field !== 'string') return undefined;
  const relative = tryParsePointer(field);
  const pathTokens = tryParsePointer(dataPath) ?? [];
  if (relative === undefined) return undefined;
  const tokens = base === 'node' ? [...pathTokens.slice(0, -1), ...relative] : relative;
  const filled: string[] = [];
  for (const [i, token] of tokens.entries()) {
    if (token !== POINTER_WILDCARD) {
      filled.push(token);
      continue;
    }
    const actual = pathTokens[i];
    if (actual === undefined) return undefined;
    filled.push(actual);
  }
  const { found, value } = lookupPointer(data, formatPointer(filled));
  return found ? value : undefined;
}

function compareNumber(value: unknown, bound: unknown, test: (a: number, b: number) => boolean): boolean {
  return typeof value === 'number' && typeof bound === 'number' && test(value, bound);
}

/**
 * 条件形态不可识别时求值为 false; 字段不存在时 eq in truthy:true 为假, ne notIn truthy:false 为真;
 * gt gte lt lte 只比较数值, 任一侧不是数值时为假.
 */
export function evaluateCondition(cond: Condition, data: unknown, dataPath: JsonPointer): boolean {
  const c: unknown = cond;
  if (!isPlainObject(c)) return false;
  if (Array.isArray(c.all)) return c.all.every((sub: Condition) => evaluateCondition(sub, data, dataPath));
  if (Array.isArray(c.any)) return c.any.some((sub: Condition) => evaluateCondition(sub, data, dataPath));
  if (Object.hasOwn(c, 'not')) return !evaluateCondition(c.not as Condition, data, dataPath);
  if (!Object.hasOwn(c, 'field')) return false;
  const value = readField(c.field, c.base, data, dataPath);
  if (Object.hasOwn(c, 'eq')) return value !== undefined && jsonEqual(value, c.eq);
  if (Object.hasOwn(c, 'ne')) return value === undefined || !jsonEqual(value, c.ne);
  if (Array.isArray(c.in)) return value !== undefined && c.in.some(option => jsonEqual(value, option));
  if (Array.isArray(c.notIn)) return value === undefined || !c.notIn.some(option => jsonEqual(value, option));
  if (typeof c.truthy === 'boolean') return Boolean(value) === c.truthy;
  if (Object.hasOwn(c, 'gt')) return compareNumber(value, c.gt, (a, b) => a > b);
  if (Object.hasOwn(c, 'gte')) return compareNumber(value, c.gte, (a, b) => a >= b);
  if (Object.hasOwn(c, 'lt')) return compareNumber(value, c.lt, (a, b) => a < b);
  if (Object.hasOwn(c, 'lte')) return compareNumber(value, c.lte, (a, b) => a <= b);
  return false;
}
