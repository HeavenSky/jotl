// 按 seed 可复现地生成满足 schema 的 Mock 数据, 生成结果不通过校验时附带 warning.
import {
  appendPointer,
  isSchemaObject,
  isTimestampValueFormat,
  fail,
  formatMessage,
  ok,
  type Diagnostic,
  type JsonPointer,
  type JsonSchema,
  type JsonSchemaObject,
  type MockOptions,
  type Result,
} from '@jotl/core';
import {
  decimalKind,
  decimalRangeOf,
  defaultDecimal,
  fromScaled,
  patternDecimals,
  rangeViolation,
  scaledBounds,
  type DecimalKind,
} from './decimal.js';
import { dataDiagnostic, dataText, withLocale, type LocaleOptions } from './diagnostics.js';
import { labelAt } from './error-convert.js';
import { cloneJson, jsonEqual, setOwn } from './json-value.js';
import { sampleRegex, type Random } from './regex-sample.js';
import {
  allowedValues,
  createResolver,
  itemSchemas,
  pick,
  propertySchemas,
  schemaTypes,
  type SchemaResolver,
} from './schema-resolver.js';
import { requiredKeys, unionBranches } from './defaults.js';
import { validate } from './validate.js';
import { dayjs, formatValueFormat } from './value-format.js';

/** 同一个 $ref 目标在当前路径上展开到这个次数后只生成必需的部分. */
const MINIMAL_DEPTH = 3;
/** 同一个 $ref 目标在当前路径上展开到这个次数后停止, 防止必填的递归引用无限展开. */
const MAX_DEPTH = 8;
/** 没有上限约束时, 数组与映射最多比下限多生成的项数. */
const EXTRA_ITEMS = 3;
const NUMBER_SPAN = 100;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

interface MockContext {
  resolver: SchemaResolver;
  random: Random;
  refDepth: Map<object, number>;
  diagnostics: Diagnostic[];
}

type Generated = { has: true; value: unknown } | { has: false };

export function mock(schema: JsonSchema, opts: MockOptions & LocaleOptions = {}): Result<unknown> {
  return withLocale(opts.locale, () => mockIn(schema, opts));
}

function mockIn(schema: JsonSchema, opts: MockOptions): Result<unknown> {
  const seed = opts.seed ?? Math.floor(Math.random() * 0x100000000);
  if (!Number.isFinite(seed)) return fail([dataDiagnostic('JOTL4018', { name: 'seed', value: String(seed) })]);
  const ctx: MockContext = {
    resolver: createResolver(schema),
    random: mulberry32(seed),
    refDepth: new Map(),
    diagnostics: [],
  };
  const generated = gen(ctx, schema, '', false);
  const value = generated.has ? generated.value : undefined;
  const checked = validate(schema, value);
  const warnings = checked.diagnostics.map(d => ({ ...d, severity: 'warning' as const }));
  return ok(value, [...ctx.diagnostics, ...warnings]);
}

/** 32 位种子的 mulberry32 伪随机数, 返回 [0, 1). */
function mulberry32(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function randomInt(ctx: MockContext, min: number, max: number): number {
  return min + Math.floor(ctx.random() * (max - min + 1));
}

function choose<T>(ctx: MockContext, items: readonly T[]): T {
  return items[Math.floor(ctx.random() * items.length)]!;
}

function gen(ctx: MockContext, schema: JsonSchema | undefined, pointer: JsonPointer, minimal: boolean): Generated {
  if (schema === true) return { has: true, value: null };
  if (!isSchemaObject(schema)) return { has: false };
  const nodes: JsonSchemaObject[] = [];
  const entered: object[] = [];
  let deep = minimal;
  let cut = false;
  const visit = (node: JsonSchema | undefined): void => {
    if (!isSchemaObject(node) || nodes.includes(node)) return;
    nodes.push(node);
    if (typeof node.$ref === 'string') {
      const target = ctx.resolver.resolveRef(node.$ref, node);
      if (target === undefined) ctx.diagnostics.push(dataDiagnostic('JOTL4016', { ref: node.$ref }));
      else if (isSchemaObject(target)) {
        const depth = ctx.refDepth.get(target) ?? 0;
        if (depth >= MAX_DEPTH) cut = true;
        else {
          if (depth >= MINIMAL_DEPTH) deep = true;
          ctx.refDepth.set(target, depth + 1);
          entered.push(target);
          visit(target);
        }
      }
    }
    for (const sub of node.allOf ?? []) visit(sub);
  };
  visit(schema);
  try {
    if (cut) {
      ctx.diagnostics.push(
        dataDiagnostic('JOTL4019', {
          label: labelAt(ctx.resolver, pointer),
          detail: formatMessage(dataText().mockDepth, { limit: MAX_DEPTH }),
        })
      );
      return { has: false };
    }
    return genNodes(ctx, nodes, pointer, deep);
  } finally {
    for (const target of entered) ctx.refDepth.set(target, (ctx.refDepth.get(target) ?? 1) - 1);
  }
}

function genNodes(ctx: MockContext, nodes: JsonSchemaObject[], pointer: JsonPointer, minimal: boolean): Generated {
  const allowed = allowedValues(nodes);
  if (allowed !== undefined)
    return allowed.length > 0 ? { has: true, value: cloneJson(choose(ctx, allowed)) } : { has: false };

  const branches = unionBranches(nodes);
  if (branches !== undefined) {
    const simple = branches.filter(b => isSchemaObject(b) && b.$ref === undefined);
    const branch = minimal && simple.length > 0 ? simple[0] : choose(ctx, branches);
    return gen(ctx, branch, pointer, minimal);
  }

  const types = schemaTypes(nodes);
  const type = types.length === 0 ? 'string' : choose(ctx, types);
  const valueFormat = pick(nodes, 'x-valueFormat');
  if (
    typeof valueFormat === 'string' &&
    (type === 'string' || (type === 'integer' && isTimestampValueFormat(valueFormat)))
  ) {
    return { has: true, value: genValueFormat(ctx, valueFormat) };
  }
  switch (type) {
    case 'object': {
      const value = genObject(ctx, nodes, pointer, minimal);
      const kind = decimalKind(nodes);
      if (kind !== undefined) setOwn(value, 'value', genDecimal(ctx, nodes, kind));
      return { has: true, value };
    }
    case 'array':
      return { has: true, value: genArray(ctx, nodes, pointer, minimal) };
    case 'string':
      return { has: true, value: genString(ctx, nodes, pointer) };
    case 'number':
    case 'integer':
      return { has: true, value: genNumber(ctx, nodes, type === 'integer') };
    case 'boolean':
      return { has: true, value: ctx.random() < 0.5 };
    default:
      return { has: true, value: null };
  }
}

function genObject(
  ctx: MockContext,
  nodes: JsonSchemaObject[],
  pointer: JsonPointer,
  minimal: boolean
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const required = requiredKeys(nodes);
  const declared: string[] = [];
  for (const node of nodes)
    for (const key of Object.keys(node.properties ?? {})) if (!declared.includes(key)) declared.push(key);
  const minProperties = pick(nodes, 'minProperties') ?? 0;
  const add = (key: string): void => {
    const generated = gen(ctx, propertySchemas(nodes, key)[0], appendPointer(pointer, key), minimal);
    if (generated.has) setOwn(out, key, generated.value);
  };
  const optional: string[] = [];
  for (const key of declared) {
    if (required.has(key) || (!minimal && ctx.random() < 0.5)) add(key);
    else optional.push(key);
  }
  for (const key of required) if (!declared.includes(key)) add(key);
  for (const key of optional) if (Object.keys(out).length < minProperties) add(key);
  const additional = pick(nodes, 'additionalProperties');
  if (isSchemaObject(additional) || additional === true) {
    const maxProperties = pick(nodes, 'maxProperties') ?? minProperties + EXTRA_ITEMS;
    const target = minimal ? minProperties : randomInt(ctx, minProperties, Math.max(minProperties, maxProperties));
    const names = pick(nodes, 'propertyNames');
    for (let i = 1; Object.keys(out).length < target && i <= target + EXTRA_ITEMS * 4; i++) {
      const key = isSchemaObject(names) ? genString(ctx, [names], pointer) : `key${i}`;
      if (Object.hasOwn(out, key)) continue;
      const generated = gen(ctx, additional, appendPointer(pointer, key), minimal);
      if (!generated.has) break;
      setOwn(out, key, generated.value);
    }
  }
  return out;
}

function genArray(ctx: MockContext, nodes: JsonSchemaObject[], pointer: JsonPointer, minimal: boolean): unknown[] {
  const minItems = pick(nodes, 'minItems') ?? 0;
  const prefix = pick(nodes, 'prefixItems') ?? [];
  let maxItems = pick(nodes, 'maxItems') ?? minItems + EXTRA_ITEMS;
  if (pick(nodes, 'items') === false) maxItems = Math.min(maxItems, prefix.length);
  const count = minimal ? minItems : randomInt(ctx, minItems, Math.max(minItems, maxItems));
  const unique = pick(nodes, 'uniqueItems') === true;
  const out: unknown[] = [];
  for (let index = 0; out.length < count && index < count * 10 + 10; index++) {
    const generated = gen(ctx, itemSchemas(nodes, out.length)[0], appendPointer(pointer, out.length), minimal);
    if (!generated.has) break;
    if (unique && out.some(v => jsonEqual(v, generated.value))) continue;
    out.push(generated.value);
  }
  return out;
}

/** money/bigint 的 value: 按 x-decimalRange 换算成整数区间后精确随机取值, 区间内无可用值时退回默认值. */
function genDecimal(ctx: MockContext, nodes: JsonSchemaObject[], kind: DecimalKind): string {
  const decimals = kind === 'bigint' ? 0 : (patternDecimals(nodes) ?? 2);
  const range = decimalRangeOf(nodes);
  const span = BigInt(NUMBER_SPAN * 10) * 10n ** BigInt(decimals);
  let { lo, hi } = scaledBounds(range, decimals);
  if (lo === undefined && hi === undefined) [lo, hi] = [0n, span];
  else if (hi === undefined) hi = lo! + span;
  else if (lo === undefined) lo = hi - span;
  if (lo! > hi) return defaultDecimal(range, decimals);
  const width = hi - lo! + 1n;
  const offset = (width * BigInt(Math.floor(ctx.random() * 2 ** 53))) / 2n ** 53n;
  const text = fromScaled(lo! + offset, decimals);
  return rangeViolation(range, text) === undefined ? text : defaultDecimal(range, decimals);
}

function genString(ctx: MockContext, nodes: JsonSchemaObject[], pointer: JsonPointer): string {
  if (pick(nodes, 'contentMediaType') === 'application/json') {
    const content = pick(nodes, 'contentSchema');
    if (content === undefined) return '{}';
    const generated = gen(ctx, content, pointer, true);
    return JSON.stringify(generated.has ? generated.value : null);
  }
  const format = pick(nodes, 'format');
  if (format !== undefined) {
    const formatted = genFormat(ctx, format);
    if (formatted !== undefined) return formatted;
  }
  const pattern = pick(nodes, 'pattern');
  if (pattern !== undefined) {
    const sample = sampleRegex(pattern, ctx.random);
    if (sample !== undefined) return sample;
    ctx.diagnostics.push(
      dataDiagnostic('JOTL4019', {
        label: labelAt(ctx.resolver, pointer),
        detail: formatMessage(dataText().mockPattern, { pattern }),
      })
    );
  }
  const minLength = pick(nodes, 'minLength') ?? 1;
  const maxLength = Math.max(minLength, pick(nodes, 'maxLength') ?? minLength + 8);
  return word(ctx, randomInt(ctx, minLength, Math.min(maxLength, minLength + 8)));
}

function word(ctx: MockContext, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += choose(ctx, [...LETTERS]);
  return out;
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

function genFormat(ctx: MockContext, format: string): string | undefined {
  const date = (): string =>
    `${randomInt(ctx, 2000, 2030)}-${pad(randomInt(ctx, 1, 12))}-${pad(randomInt(ctx, 1, 28))}`;
  const time = (): string =>
    `${pad(randomInt(ctx, 0, 23))}:${pad(randomInt(ctx, 0, 59))}:${pad(randomInt(ctx, 0, 59))}Z`;
  const hex = (length: number): string => {
    let out = '';
    for (let i = 0; i < length; i++) out += randomInt(ctx, 0, 15).toString(16);
    return out;
  };
  switch (format) {
    case 'date':
      return date();
    case 'time':
      return time();
    case 'date-time':
      return `${date()}T${time()}`;
    case 'email':
    case 'idn-email':
      return `${word(ctx, 6)}@example.com`;
    case 'uri':
    case 'url':
    case 'iri':
    case 'uri-reference':
    case 'iri-reference':
      return `https://example.com/${word(ctx, 6)}`;
    case 'uri-template':
      return `https://example.com/{${word(ctx, 4)}}`;
    case 'hostname':
    case 'idn-hostname':
      return `${word(ctx, 6)}.example.com`;
    case 'ipv4':
      return [0, 0, 0, 0].map(() => randomInt(ctx, 1, 254)).join('.');
    case 'ipv6':
      return `2001:db8::${hex(4)}`;
    case 'uuid':
      return `${hex(8)}-${hex(4)}-4${hex(3)}-${choose(ctx, ['8', '9', 'a', 'b'])}${hex(3)}-${hex(12)}`;
    case 'color':
      return `#${hex(6)}`;
    case 'duration':
      return `P${randomInt(ctx, 1, 30)}D`;
    case 'json-pointer':
      return `/${word(ctx, 4)}`;
    case 'relative-json-pointer':
      return '0';
    case 'regex':
      return '^[a-z]+$';
    default:
      return undefined;
  }
}

/** 2000-2030 年间按秒取的随机时刻, 按存储格式写出. */
function genValueFormat(ctx: MockContext, fmt: string): string | number {
  const from = Date.UTC(2000, 0, 1) / 1000;
  const to = Date.UTC(2030, 11, 31) / 1000;
  return formatValueFormat(fmt, dayjs(randomInt(ctx, from, to) * 1000));
}

function genNumber(ctx: MockContext, nodes: JsonSchemaObject[], integer: boolean): number {
  const minimum = pick(nodes, 'minimum');
  const maximum = pick(nodes, 'maximum');
  const exclusiveMinimum = pick(nodes, 'exclusiveMinimum');
  const exclusiveMaximum = pick(nodes, 'exclusiveMaximum');
  let lo = Math.max(minimum ?? -Infinity, exclusiveMinimum ?? -Infinity);
  let hi = Math.min(maximum ?? Infinity, exclusiveMaximum ?? Infinity);
  if (!Number.isFinite(lo) && !Number.isFinite(hi)) [lo, hi] = [0, NUMBER_SPAN];
  else if (!Number.isFinite(hi)) hi = lo + NUMBER_SPAN;
  else if (!Number.isFinite(lo)) lo = hi - NUMBER_SPAN;
  const inRange = (v: number): boolean =>
    v >= lo && v <= hi && v !== exclusiveMinimum && v !== exclusiveMaximum && (!integer || Number.isInteger(v));
  const multipleOf = pick(nodes, 'multipleOf');
  if (multipleOf !== undefined && multipleOf > 0) {
    const candidates: number[] = [];
    for (let k = Math.ceil(lo / multipleOf); k <= Math.floor(hi / multipleOf) && candidates.length < 1000; k++) {
      const v = Number((k * multipleOf).toPrecision(12));
      if (inRange(v)) candidates.push(v);
    }
    if (candidates.length > 0) return choose(ctx, candidates);
  }
  if (integer) {
    const min = Math.ceil(lo) + (Math.ceil(lo) === exclusiveMinimum ? 1 : 0);
    const max = Math.floor(hi) - (Math.floor(hi) === exclusiveMaximum ? 1 : 0);
    return max >= min ? randomInt(ctx, min, max) : Math.ceil(lo);
  }
  const declared = nodes.map(n => n['x-decimals']).find((d): d is number => typeof d === 'number');
  const scale = 10 ** Math.min(2, declared ?? 2);
  const value = Math.round((lo + ctx.random() * (hi - lo)) * scale) / scale;
  return inRange(value) ? value : Math.round(((lo + hi) / 2) * scale) / scale;
}
