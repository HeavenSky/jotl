// 精确数字符串与小数位: x-decimals 的位数计算, x-decimalRange 的精确比较, money/bigint 节点识别与零值.
import { isSchemaObject, type JsonSchemaObject } from '@jotl/core';
import { allowedValues, propertySchemas } from './schema-resolver.js';

export const DECIMAL_STRING = /^-?\d+(\.\d+)?$/;

export const RANGE_KEYS = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
export type DecimalRange = Partial<Record<RangeKey, string>>;

/** 按 String(value) 计十进制小数位, 指数形式按展开后计(1e-7 为 7 位, 1.5e-7 为 8 位). */
export function countDecimals(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const match = /^-?\d+(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(value));
  if (match === null) return 0;
  return Math.max(0, (match[1]?.length ?? 0) - Number(match[2] ?? 0));
}

interface Parts {
  negative: boolean;
  int: string;
  frac: string;
}

function parts(text: string): Parts {
  const negative = text.startsWith('-');
  const [int = '', frac = ''] = (negative ? text.slice(1) : text).split('.');
  const i = int.replace(/^0+/, '') || '0';
  const f = frac.replace(/0+$/, '');
  return { negative: negative && (i !== '0' || f !== ''), int: i, frac: f };
}

function compareAbs(a: Parts, b: Parts): number {
  if (a.int.length !== b.int.length) return a.int.length < b.int.length ? -1 : 1;
  if (a.int !== b.int) return a.int < b.int ? -1 : 1;
  const width = Math.max(a.frac.length, b.frac.length);
  const fa = a.frac.padEnd(width, '0');
  const fb = b.frac.padEnd(width, '0');
  return fa === fb ? 0 : fa < fb ? -1 : 1;
}

/** 两个精确数字符串(须匹配 DECIMAL_STRING)的大小: -1, 0, 1. */
export function compareDecimal(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  if (pa.negative !== pb.negative) return pa.negative ? -1 : 1;
  const abs = compareAbs(pa, pb);
  return pa.negative ? -abs : abs;
}

/** 第一个被违反的边界; value 或边界不是精确数字符串时不比较(value 由 pattern 报错). */
export function rangeViolation(range: unknown, value: unknown): { key: RangeKey; limit: string } | undefined {
  if (!isSchemaObject(range) || typeof value !== 'string' || !DECIMAL_STRING.test(value)) return undefined;
  for (const key of RANGE_KEYS) {
    const limit: unknown = (range as Record<string, unknown>)[key];
    if (typeof limit !== 'string' || !DECIMAL_STRING.test(limit)) continue;
    const cmp = compareDecimal(value, limit);
    const violated =
      key === 'minimum' ? cmp < 0 : key === 'maximum' ? cmp > 0 : key === 'exclusiveMinimum' ? cmp <= 0 : cmp >= 0;
    if (violated) return { key, limit };
  }
  return undefined;
}

export type DecimalKind = 'money' | 'bigint';

/** 按 properties.type.const 识别 money/bigint 对象节点. */
export function decimalKind(nodes: readonly JsonSchemaObject[]): DecimalKind | undefined {
  for (const sub of propertySchemas(nodes, 'type')) {
    if (!isSchemaObject(sub)) continue;
    const allowed = allowedValues([sub]);
    if (allowed?.length === 1 && (allowed[0] === 'money' || allowed[0] === 'bigint')) return allowed[0];
  }
  return undefined;
}

/** value 的 pattern 规定的定长小数位; 不限时为 undefined. */
export function patternDecimals(nodes: readonly JsonSchemaObject[]): number | undefined {
  for (const sub of propertySchemas(nodes, 'value')) {
    if (!isSchemaObject(sub) || typeof sub.pattern !== 'string') continue;
    const fixed = /\\\.\\d\{(\d+)\}\$$/.exec(sub.pattern);
    if (fixed) return Number(fixed[1]);
    if (sub.pattern === '^-?\\d+$') return 0;
  }
  return undefined;
}

export function decimalRangeOf(nodes: readonly JsonSchemaObject[]): DecimalRange | undefined {
  for (const node of nodes) {
    const range = node['x-decimalRange'];
    if (isSchemaObject(range)) return range as unknown as DecimalRange;
  }
  return undefined;
}

/** 把精确数字符串补齐或截断为 decimals 位小数; decimals 为 undefined 时原样返回. */
export function withDecimals(text: string, decimals: number | undefined): string {
  if (decimals === undefined) return text;
  const negative = text.startsWith('-');
  const [int = '0', frac = ''] = (negative ? text.slice(1) : text).split('.');
  const body = decimals === 0 ? int : `${int}.${frac.padEnd(decimals, '0').slice(0, decimals)}`;
  return negative ? `-${body}` : body;
}

/** 精确数字符串加上整数 delta. */
function addInteger(text: string, delta: number): string {
  const [int = '0', frac = ''] = text.replace(/^-/, '').split('.');
  const scale = 10n ** BigInt(frac.length);
  const sum = (text.startsWith('-') ? -1n : 1n) * BigInt(int + frac) + BigInt(delta) * scale;
  const abs = (sum < 0n ? -sum : sum).toString().padStart(frac.length + 1, '0');
  const body = frac.length === 0 ? abs : `${abs.slice(0, -frac.length)}.${abs.slice(-frac.length)}`;
  return sum < 0n ? `-${body}` : body;
}

/** 满足范围的默认值: 先取 0, 再依次试 minimum, maximum, exclusiveMinimum + 1, exclusiveMaximum - 1, 再取区间中点; 区间内无可用值时为 0. */
export function defaultDecimal(range: DecimalRange | undefined, decimals: number | undefined): string {
  const exclusive = (key: 'exclusiveMinimum' | 'exclusiveMaximum', delta: number): string | undefined => {
    const limit = range?.[key];
    return typeof limit === 'string' && DECIMAL_STRING.test(limit) ? addInteger(limit, delta) : undefined;
  };
  const candidates = [
    '0',
    range?.minimum,
    range?.maximum,
    exclusive('exclusiveMinimum', 1),
    exclusive('exclusiveMaximum', -1),
  ].filter((c): c is string => typeof c === 'string' && DECIMAL_STRING.test(c));
  for (const candidate of candidates) {
    const text = withDecimals(candidate, decimals);
    if (rangeViolation(range, text) === undefined) return text;
  }
  // 开区间比 1 还窄时取区间中点; 小数位不限时从 0 位起逐位加精度, 到端点位数加 1 必有解.
  const widths = Object.values(range ?? {}).map(t => (typeof t === 'string' ? (t.split('.')[1]?.length ?? 0) : 0));
  const limit = decimals ?? Math.max(0, ...widths) + 1;
  for (let d = decimals ?? 0; d <= limit; d++) {
    const bounds = scaledBounds(range, d);
    if (bounds.lo !== undefined && bounds.hi !== undefined && bounds.lo <= bounds.hi) {
      return fromScaled((bounds.lo + bounds.hi) / 2n, d);
    }
  }
  return withDecimals('0', decimals);
}

/** 精确数字符串乘以 10^d 后向下(floor)或向上(ceil)取整. */
function toScaled(text: string, d: number, ceil: boolean): bigint {
  const negative = text.startsWith('-');
  const [int = '0', frac = ''] = (negative ? text.slice(1) : text).split('.');
  const abs = BigInt(int + frac.padEnd(d, '0').slice(0, d));
  const inexact = /[1-9]/.test(frac.slice(d));
  if (!negative) return inexact && ceil ? abs + 1n : abs;
  return inexact && !ceil ? -abs - 1n : -abs;
}

/** 整数 n 除以 10^d 写成 d 位小数的精确数字符串. */
export function fromScaled(n: bigint, d: number): string {
  const abs = (n < 0n ? -n : n).toString().padStart(d + 1, '0');
  const body = d === 0 ? abs : `${abs.slice(0, -d)}.${abs.slice(-d)}`;
  return n < 0n ? `-${body}` : body;
}

/** 区间内 d 位小数的值乘以 10^d 后的整数闭区间; 无界一侧为 undefined. */
export function scaledBounds(
  range: DecimalRange | undefined,
  d: number
): { lo: bigint | undefined; hi: bigint | undefined } {
  const valid = (key: RangeKey): string | undefined => {
    const t = range?.[key];
    return typeof t === 'string' && DECIMAL_STRING.test(t) ? t : undefined;
  };
  const lows: bigint[] = [];
  const highs: bigint[] = [];
  const min = valid('minimum');
  const max = valid('maximum');
  const exMin = valid('exclusiveMinimum');
  const exMax = valid('exclusiveMaximum');
  if (min !== undefined) lows.push(toScaled(min, d, true));
  if (exMin !== undefined) lows.push(toScaled(exMin, d, false) + 1n);
  if (max !== undefined) highs.push(toScaled(max, d, false));
  if (exMax !== undefined) highs.push(toScaled(exMax, d, true) - 1n);
  return {
    lo: lows.length > 0 ? lows.reduce((a, b) => (a > b ? a : b)) : undefined,
    hi: highs.length > 0 ? highs.reduce((a, b) => (a < b ? a : b)) : undefined,
  };
}
