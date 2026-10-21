// 编译期默认值校验: 按编译出的 schema 子集检查一个 JSON 值, 返回第一处违反.
import {
  type JsonSchema,
  type JsonSchemaObject,
  formatPointer,
  isSchemaObject,
  isValueFormatAlias,
  matchesValueFormat,
  unescapePointerToken,
} from '../schema/index.js';
import { type SyntaxReason, syntaxReason } from './diagnostics.js';

const DEFS_PREFIX = '#/$defs/';
/** 检查的递归层数上限(含 `$ref` 跳转与组合分支); 超过时整体按通过处理, 免得很长的引用链或极深的 schema 耗尽调用栈. */
const MAX_CHECK_DEPTH = 1000;

interface Issue {
  reason: SyntaxReason;
  params: Record<string, string | number>;
  path: (string | number)[];
}

/** 迭代比较, 极深的值不会耗尽调用栈. */
export function deepEqual(a: unknown, b: unknown): boolean {
  const pending: [unknown, unknown][] = [[a, b]];
  while (pending.length > 0) {
    const [x, y] = pending.pop()!;
    if (x === y) continue;
    if (Array.isArray(x)) {
      if (!Array.isArray(y) || x.length !== y.length) return false;
      for (let i = 0; i < x.length; i++) pending.push([x[i], y[i]]);
    } else if (isPlainObject(x) && isPlainObject(y)) {
      const keys = Object.keys(x);
      if (keys.length !== Object.keys(y).length || !keys.every(k => Object.hasOwn(y, k))) return false;
      for (const k of keys) pending.push([x[k], y[k]]);
    } else {
      return false;
    }
  }
  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesType(type: string, value: unknown): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isPlainObject(value);
    default:
      return true;
  }
}

function isMultipleOf(value: number, divisor: number): boolean {
  const quotient = value / divisor;
  return Math.abs(quotient - Math.round(quotient)) < 1e-9;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d:([0-5]\d|60)(\.\d+)?(z|[+-]([01]\d|2[0-3])(:?[0-5]\d)?)$/i;
const DAYS = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isDate(text: string): boolean {
  const m = DATE_RE.exec(text);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && !leap ? 28 : DAYS[month]!);
}

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function isIpv6(text: string): boolean {
  const halves = text.split('::');
  if (halves.length > 2) return false;
  const groups = halves.flatMap(h => (h === '' ? [] : h.split(':')));
  let count = groups.length;
  const last = groups[groups.length - 1];
  if (last?.includes('.')) {
    if (!IPV4_RE.test(last) || halves[1] === '') return false;
    groups.pop();
    count++;
  }
  if (!groups.every(g => /^[0-9a-f]{1,4}$/i.test(g))) return false;
  return halves.length === 2 ? count <= 7 : count === 8;
}

/** 常用 format 的宽松检查, 不严于 ajv-formats, 免得编译期拒绝运行期接受的值; 未列出的 format 不检查. */
const FORMAT_CHECKS: Readonly<Record<string, (text: string) => boolean>> = {
  email: t =>
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(
      t
    ),
  uri: t => /^[a-z][a-z0-9+.-]*:[^\s]*$/i.test(t),
  date: isDate,
  time: t => TIME_RE.test(t),
  'date-time': t => {
    const parts = t.split(/t|\s/i);
    return parts.length === 2 && isDate(parts[0]!) && TIME_RE.test(parts[1]!);
  },
  uuid: t => /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(t),
  color: t => /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(t),
  ipv4: t => IPV4_RE.test(t),
  ipv6: isIpv6,
  hostname: t =>
    /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i.test(t),
};

const SUBSCHEMA_KEYWORDS = new Set(['not', 'items', 'additionalProperties', 'propertyNames', 'contentSchema']);
const SUBSCHEMA_LIST_KEYWORDS = new Set(['oneOf', 'anyOf', 'allOf', 'prefixItems']);
/** 检查器完整判定的标量关键字与不影响校验的注解关键字. */
const CHECKED_KEYWORDS = new Set([
  'type',
  'const',
  'enum',
  'minLength',
  'maxLength',
  'x-valueFormat',
  'contentMediaType',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'x-decimals',
  'x-decimalRange',
  'minItems',
  'maxItems',
  'uniqueItems',
  'required',
  'minProperties',
  'maxProperties',
  'title',
  'description',
  'default',
  'examples',
  'deprecated',
  'readOnly',
  'writeOnly',
  '$comment',
  '$defs',
  '$schema',
  '$id',
]);

class ValueChecker {
  private readonly refStack: { ref: string; value: unknown }[] = [];
  private depth = 0;
  /** 有分支超过层数上限而未检查; 取反与计数的分支会因此误判, 结果不可信. */
  truncated = false;

  constructor(
    private readonly defs: Readonly<Record<string, JsonSchema>>,
    private readonly root: JsonSchema | undefined
  ) {}

  /** 有根文档时按 JSON 指针在其中解析任意 `#...` 引用, 否则只解析 `#/$defs/X`. */
  private resolve(ref: string): JsonSchema | undefined {
    if (this.root === undefined) {
      return ref.startsWith(DEFS_PREFIX) ? this.defs[unescapePointerToken(ref.slice(DEFS_PREFIX.length))] : undefined;
    }
    if (!ref.startsWith('#')) return undefined;
    let pointer: string;
    try {
      pointer = decodeURIComponent(ref.slice(1));
    } catch {
      return undefined;
    }
    if (pointer !== '' && !pointer.startsWith('/')) return undefined;
    let node: unknown = this.root;
    for (const token of pointer === '' ? [] : pointer.slice(1).split('/')) {
      const key = unescapePointerToken(token);
      if (Array.isArray(node)) node = /^(0|[1-9]\d*)$/.test(key) ? node[Number(key)] : undefined;
      else node = isPlainObject(node) && Object.hasOwn(node, key) ? node[key] : undefined;
      if (node === undefined) return undefined;
    }
    return typeof node === 'boolean' || isSchemaObject(node) ? (node as JsonSchema) : undefined;
  }

  check(schema: JsonSchema, value: unknown, path: (string | number)[]): Issue | undefined {
    if (schema === true) return undefined;
    if (schema === false) return { reason: 'notInEnum', params: {}, path };
    if (!isSchemaObject(schema)) return undefined;
    if (this.depth >= MAX_CHECK_DEPTH) {
      this.truncated = true;
      return undefined;
    }
    this.depth++;
    const issue = this.checkKeywords(schema, value, path);
    this.depth--;
    return issue;
  }

  private checkKeywords(schema: JsonSchemaObject, value: unknown, path: (string | number)[]): Issue | undefined {
    return (
      this.checkRef(schema, value, path) ??
      this.checkType(schema, value, path) ??
      this.checkEnum(schema, value, path) ??
      this.checkBranches(schema, value, path) ??
      this.checkString(schema, value, path) ??
      this.checkContent(schema, value, path) ??
      this.checkNumber(schema, value, path) ??
      this.checkArray(schema, value, path) ??
      this.checkObject(schema, value, path) ??
      this.checkDecimalRange(schema, value, path)
    );
  }

  private checkRef(schema: JsonSchemaObject, value: unknown, path: (string | number)[]): Issue | undefined {
    const ref = schema.$ref;
    if (ref === undefined) return undefined;
    const target = this.resolve(ref);
    if (target === undefined) return undefined;
    // 纯别名环(type A = B, type B = A)不消耗数据, 遇到同一引用与同一值时停止.
    if (this.refStack.some(e => e.ref === ref && e.value === value)) return undefined;
    this.refStack.push({ ref, value });
    const issue = this.check(target, value, path);
    this.refStack.pop();
    return issue;
  }

  private checkType(schema: JsonSchemaObject, value: unknown, path: (string | number)[]): Issue | undefined {
    if (schema.type === undefined) return undefined;
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (types.some(t => matchesType(t, value))) return undefined;
    return { reason: 'typeMismatch', params: { expected: types.join(' | ') }, path };
  }

  private checkEnum(schema: JsonSchemaObject, value: unknown, path: (string | number)[]): Issue | undefined {
    if ('const' in schema && !deepEqual(schema.const, value)) return { reason: 'notInEnum', params: {}, path };
    if (schema.enum !== undefined && !schema.enum.some(e => deepEqual(e, value))) {
      return { reason: 'notInEnum', params: {}, path };
    }
    return undefined;
  }

  private checkBranches(schema: JsonSchemaObject, value: unknown, path: (string | number)[]): Issue | undefined {
    if (schema.oneOf !== undefined) {
      const matched = schema.oneOf.filter(s => this.check(s, value, path) === undefined).length;
      if (matched === 0) {
        const constOnly = schema.oneOf.every(s => isSchemaObject(s) && 'const' in s);
        return { reason: constOnly ? 'notInEnum' : 'noMatchingBranch', params: {}, path };
      }
      if (matched > 1) return { reason: 'multipleMatchingBranches', params: {}, path };
    }
    for (const sub of schema.allOf ?? []) {
      const issue = this.check(sub, value, path);
      if (issue) return issue;
    }
    if (schema.anyOf !== undefined && !schema.anyOf.some(s => this.check(s, value, path) === undefined)) {
      return { reason: 'noMatchingBranch', params: {}, path };
    }
    // 不支持的关键字按通过处理, 取反后会误报, 所以子 schema 只含能完整校验的关键字时才判定.
    if (
      schema.not !== undefined &&
      this.fullyCheckable(schema.not, new Set(), 0) &&
      this.check(schema.not, value, path) === undefined
    ) {
      return { reason: 'matchesNot', params: {}, path };
    }
    return undefined;
  }

  /** schema 及其子 schema(含经 `$ref` 到达的)是否只含本检查器能完整判定的关键字; 超过层数上限时按不能判定处理. */
  private fullyCheckable(schema: JsonSchema, seen: Set<string>, depth: number): boolean {
    if (typeof schema === 'boolean') return true;
    if (!isSchemaObject(schema) || depth >= MAX_CHECK_DEPTH) return false;
    for (const [keyword, v] of Object.entries(schema)) {
      if (keyword === '$ref') {
        if (typeof v !== 'string') return false;
        if (seen.has(v)) continue;
        seen.add(v);
        const target = this.resolve(v);
        if (target === undefined || !this.fullyCheckable(target, seen, depth + 1)) return false;
      } else if (SUBSCHEMA_KEYWORDS.has(keyword)) {
        if (!this.fullyCheckable(v as JsonSchema, seen, depth + 1)) return false;
      } else if (SUBSCHEMA_LIST_KEYWORDS.has(keyword)) {
        if (!Array.isArray(v) || !v.every(s => this.fullyCheckable(s as JsonSchema, seen, depth + 1))) return false;
      } else if (keyword === 'properties') {
        if (!isPlainObject(v) || !Object.values(v).every(s => this.fullyCheckable(s as JsonSchema, seen, depth + 1)))
          return false;
      } else if (keyword === 'format') {
        if (typeof v !== 'string' || !Object.hasOwn(FORMAT_CHECKS, v)) return false;
      } else if (keyword === 'pattern') {
        try {
          new RegExp(String(v), 'u');
        } catch {
          return false;
        }
      } else if (!CHECKED_KEYWORDS.has(keyword) && !keyword.startsWith('x-')) {
        return false;
      }
    }
    return true;
  }

  private violation(keyword: string, limit: unknown, path: (string | number)[]): Issue {
    return { reason: 'keywordViolation', params: { keyword, limit: JSON.stringify(limit) }, path };
  }

  private checkString(schema: JsonSchemaObject, value: unknown, path: (string | number)[]): Issue | undefined {
    if (typeof value !== 'string') return undefined;
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength)
      return this.violation('minLength', schema.minLength, path);
    if (schema.maxLength !== undefined && length > schema.maxLength)
      return this.violation('maxLength', schema.maxLength, path);
    if (schema.pattern !== undefined) {
      let re: RegExp | undefined;
      try {
        re = new RegExp(schema.pattern, 'u');
      } catch {
        re = undefined;
      }
      if (re !== undefined && !re.test(value)) return this.violation('pattern', schema.pattern, path);
    }
    const format =
      typeof schema.format === 'string' && Object.hasOwn(FORMAT_CHECKS, schema.format)
        ? FORMAT_CHECKS[schema.format]
        : undefined;
    if (format !== undefined && !format(value)) return this.violation('format', schema.format, path);
    // 与运行期一致: 别名与 format: date-time 同时出现时由 format 断言.
    const vf = schema['x-valueFormat'];
    if (
      typeof vf === 'string' &&
      !(isValueFormatAlias(vf) && schema.format === 'date-time') &&
      !matchesValueFormat(vf, value)
    ) {
      return this.violation('x-valueFormat', vf, path);
    }
    return undefined;
  }

  private checkNumber(schema: JsonSchemaObject, value: unknown, path: (string | number)[]): Issue | undefined {
    if (typeof value !== 'number') return undefined;
    if (schema.minimum !== undefined && value < schema.minimum) return this.violation('minimum', schema.minimum, path);
    if (schema.maximum !== undefined && value > schema.maximum) return this.violation('maximum', schema.maximum, path);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      return this.violation('exclusiveMinimum', schema.exclusiveMinimum, path);
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      return this.violation('exclusiveMaximum', schema.exclusiveMaximum, path);
    }
    if (schema.multipleOf !== undefined && !isMultipleOf(value, schema.multipleOf)) {
      return this.violation('multipleOf', schema.multipleOf, path);
    }
    const decimals = schema['x-decimals'];
    if (typeof decimals === 'number' && decimalPlaces(value) > decimals)
      return this.violation('x-decimals', decimals, path);
    return undefined;
  }

  private checkArray(schema: JsonSchemaObject, value: unknown, path: (string | number)[]): Issue | undefined {
    if (!Array.isArray(value)) return undefined;
    if (schema.minItems !== undefined && value.length < schema.minItems)
      return this.violation('minItems', schema.minItems, path);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      return this.violation('maxItems', schema.maxItems, path);
    if (schema.uniqueItems === true && value.some((v, i) => value.findIndex(w => deepEqual(v, w)) !== i)) {
      return { reason: 'duplicateItems', params: {}, path };
    }
    const prefix = schema.prefixItems ?? [];
    for (let i = 0; i < value.length; i++) {
      const itemSchema = i < prefix.length ? prefix[i] : schema.items;
      if (itemSchema === undefined) continue;
      if (itemSchema === false && i >= prefix.length) return this.violation('maxItems', prefix.length, path);
      const issue = this.check(itemSchema, value[i], [...path, i]);
      if (issue) return issue;
    }
    return undefined;
  }

  private checkObject(schema: JsonSchemaObject, value: unknown, path: (string | number)[]): Issue | undefined {
    if (!isPlainObject(value)) return undefined;
    const keys = Object.keys(value);
    for (const name of schema.required ?? []) {
      if (!Object.hasOwn(value, name)) return { reason: 'missingRequired', params: { name }, path };
    }
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      return this.violation('minProperties', schema.minProperties, path);
    }
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
      return this.violation('maxProperties', schema.maxProperties, path);
    }
    if (schema.propertyNames !== undefined) {
      for (const key of keys) {
        const issue = this.check(schema.propertyNames, key, path);
        if (issue) return issue;
      }
    }
    for (const key of keys) {
      const propertySchema =
        schema.properties !== undefined && Object.hasOwn(schema.properties, key)
          ? schema.properties[key]
          : schema.additionalProperties;
      if (propertySchema === undefined) continue;
      if (propertySchema === false) return { reason: 'additionalProperty', params: { name: key }, path };
      const issue = this.check(propertySchema, value[key], [...path, key]);
      if (issue) return issue;
    }
    return undefined;
  }

  /** `contentMediaType: application/json` 的字符串必须能解析, 有 `contentSchema` 时解析结果按它校验(契约 C3). */
  private checkContent(schema: JsonSchemaObject, value: unknown, path: (string | number)[]): Issue | undefined {
    if (typeof value !== 'string' || schema.contentMediaType !== 'application/json') return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      return { reason: 'invalidJsonText', params: {}, path };
    }
    return schema.contentSchema === undefined ? undefined : this.check(schema.contentSchema, parsed, path);
  }

  /** `x-decimalRange` 作用于对象的 `value` 精确数字串(契约 C3). */
  private checkDecimalRange(schema: JsonSchemaObject, value: unknown, path: (string | number)[]): Issue | undefined {
    const range = schema['x-decimalRange'];
    if (!isPlainObject(range) || !isPlainObject(value) || typeof value.value !== 'string' || !EXACT.test(value.value))
      return undefined;
    const v = value.value;
    const checks: [string, (c: number) => boolean][] = [
      ['minimum', c => c >= 0],
      ['maximum', c => c <= 0],
      ['exclusiveMinimum', c => c > 0],
      ['exclusiveMaximum', c => c < 0],
    ];
    for (const [keyword, ok] of checks) {
      const limit = range[keyword];
      if (typeof limit === 'string' && EXACT.test(limit) && !ok(compareDecimal(v, limit))) {
        return this.violation(keyword, limit, [...path, 'value']);
      }
    }
    return undefined;
  }
}

const EXACT = /^-?\d+(\.\d+)?$/;

/** 十进制小数位数, 处理指数形式. */
function decimalPlaces(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const [mantissa = '', exponent] = String(value).toLowerCase().split('e');
  const fraction = mantissa.split('.')[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponent ?? 0));
}

/** 比较两个精确数字串, 返回 a - b 的符号. */
export function compareDecimal(a: string, b: string): number {
  const parse = (s: string) => {
    const negative = s.startsWith('-');
    const [int = '', frac = ''] = s.replace(/^-/, '').split('.');
    return { negative, int: int.replace(/^0+(?=\d)/, ''), frac: frac.replace(/0+$/, '') };
  };
  const x = parse(a);
  const y = parse(b);
  const zero = (n: { int: string; frac: string }) => /^0*$/.test(n.int) && n.frac === '';
  if (zero(x)) x.negative = false;
  if (zero(y)) y.negative = false;
  if (x.negative !== y.negative) return x.negative ? -1 : 1;
  const sign = x.negative ? -1 : 1;
  if (x.int.length !== y.int.length) return sign * (x.int.length - y.int.length > 0 ? 1 : -1);
  if (x.int !== y.int) return sign * (x.int > y.int ? 1 : -1);
  const len = Math.max(x.frac.length, y.frac.length);
  const fx = x.frac.padEnd(len, '0');
  const fy = y.frac.padEnd(len, '0');
  return fx === fy ? 0 : sign * (fx > fy ? 1 : -1);
}

/**
 * 校验 type, const, enum, oneOf, anyOf, allOf, not, $ref, 字符串, 数值, 数组与对象约束, 以及 Jotl 的 x-decimals x-decimalRange x-valueFormat 与 JSON 文本;
 * 常用 format(见 FORMAT_CHECKS); 不校验经 `schema` 写入的其他关键字.
 * root 为所在文档时按它解析任意 `#...` 引用(含指向根的 `#`), 否则只解析 defs 中的 `#/$defs/X`.
 * 通过时返回 undefined, 否则返回面向使用者的原因; 递归超过层数上限(很长的引用链等)时也按通过处理.
 */
export function checkDefaultValue(
  schema: JsonSchema,
  value: unknown,
  defs: Readonly<Record<string, JsonSchema>>,
  root?: JsonSchema
): string | undefined {
  const checker = new ValueChecker(defs, root);
  const issue = checker.check(schema, value, []);
  if (issue === undefined || checker.truncated) return undefined;
  const detail = syntaxReason(issue.reason, issue.params);
  return issue.path.length === 0 ? detail : syntaxReason('atPath', { path: formatPointer(issue.path), detail });
}
