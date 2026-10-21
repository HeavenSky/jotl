// 由组件参数生成的固定 schema 形态(money, bigint, 数字串模式)与按数据形态选默认组件(契约 C1 C2); 编译器与打印器共用, 打印器据此反推并核对.
import type { JsonSchema, JsonSchemaObject } from '../schema/index.js';
import { TIMESTAMP_VALUE_FORMATS, isSchemaObject, valueFormatComponent } from '../schema/index.js';
import { CURRENCY_DIGITS } from './builtins.js';

export const UNLIMITED_DECIMAL_PATTERN = '^-?\\d+(\\.\\d+)?$';
export const INTEGER_PATTERN = '^-?\\d+$';
export const CURRENCY_PATTERN = '^[A-Z]{3}$';

/** 小数位 d 定长的精确数字串模式; undefined 为不限. */
export function decimalPattern(digits: number | undefined): string {
  if (digits === undefined) return UNLIMITED_DECIMAL_PATTERN;
  return digits === 0 ? INTEGER_PATTERN : `^-?\\d+\\.\\d{${digits}}$`;
}

export interface MoneyOptions {
  currency?: string | string[];
  unit?: string | string[];
  decimals?: number;
}

/** money 的值小数位: `decimals` 优先; 否则无 `unit` 且币种都已知且位数相同时取 ISO 4217 位数; 否则不限. */
export function moneyDigits(options: MoneyOptions): number | undefined {
  if (options.decimals !== undefined) return options.decimals;
  if (options.unit !== undefined || options.currency === undefined) return undefined;
  const list = typeof options.currency === 'string' ? [options.currency] : options.currency;
  const digits = list.map(c => (Object.hasOwn(CURRENCY_DIGITS, c) ? CURRENCY_DIGITS[c] : undefined));
  const first = digits[0];
  return first !== undefined && digits.every(d => d === first) ? first : undefined;
}

function choice(value: string | string[] | undefined, fallback: JsonSchemaObject): JsonSchemaObject {
  if (value === undefined) return fallback;
  return typeof value === 'string' ? { type: 'string', const: value } : { type: 'string', enum: [...value] };
}

export function moneySchema(options: MoneyOptions): JsonSchemaObject {
  const required = ['type', 'value', 'currency'];
  if (typeof options.unit === 'string') required.push('unit');
  return {
    type: 'object',
    properties: {
      type: { type: 'string', const: 'money' },
      value: { type: 'string', pattern: decimalPattern(moneyDigits(options)) },
      currency: choice(options.currency, { type: 'string', pattern: CURRENCY_PATTERN }),
      unit: choice(options.unit, { type: 'string' }),
    },
    required,
    additionalProperties: false,
  };
}

export function bigintSchema(): JsonSchemaObject {
  return {
    type: 'object',
    properties: { type: { type: 'string', const: 'bigint' }, value: { type: 'string', pattern: INTEGER_PATTERN } },
    required: ['type', 'value'],
    additionalProperties: false,
  };
}

/** 对象节点的 `properties.type.const`, 用于识别 money 与 bigint. */
export function specialObjectKind(schema: JsonSchemaObject): 'money' | 'bigint' | undefined {
  if (schema.type !== 'object' || !isSchemaObject(schema.properties)) return undefined;
  const t = (schema.properties as Record<string, JsonSchema>).type;
  if (!isSchemaObject(t)) return undefined;
  return t.const === 'money' || t.const === 'bigint' ? t.const : undefined;
}

/** C2 中的全部内置 widget 名; 不在其中的名字视为扩展 widget, 编译器不检查候选. */
export const BUILTIN_WIDGETS: ReadonlySet<string> = new Set([
  'form',
  'field',
  'page',
  'inline',
  'input',
  'textarea',
  'password',
  'richtext',
  'number',
  'range',
  'money',
  'bigint',
  'switch',
  'checkbox',
  'select',
  'radio',
  'output',
  'date',
  'time',
  'datetime',
  'url',
  'email',
  'color',
  'image',
  'file',
  'json',
  'list',
  'tuple',
  'kv',
  'union',
  'nullable',
  'tree',
]);

const FORMAT_WIDGETS: Readonly<Record<string, string>> = {
  date: 'date',
  time: 'time',
  'date-time': 'datetime',
  uri: 'url',
  email: 'email',
  color: 'color',
};

type Shape =
  | 'string'
  | 'number'
  | 'money'
  | 'bigint'
  | 'boolean'
  | 'enum'
  | 'const'
  | 'enumArray'
  | 'object'
  | 'array'
  | 'tuple'
  | 'map'
  | 'union'
  | 'any'
  | 'ref'
  | 'other';

export type RefResolver = (ref: string) => JsonSchema | undefined;

function isEnumLike(schema: JsonSchema, resolve: RefResolver | undefined, depth = 0): boolean {
  if (!isSchemaObject(schema) || depth > 16) return false;
  if (typeof schema.$ref === 'string') {
    const target = resolve?.(schema.$ref);
    return target !== undefined && isEnumLike(target, resolve, depth + 1);
  }
  if ('const' in schema || Array.isArray(schema.enum)) return true;
  return Array.isArray(schema.oneOf) && schema.oneOf.every(b => isSchemaObject(b) && 'const' in b);
}

function shapeOf(schema: JsonSchemaObject, resolve?: RefResolver): Shape {
  if (typeof schema.$ref === 'string') return 'ref';
  if ('const' in schema && schema.oneOf === undefined) return 'const';
  if (isEnumLike(schema, undefined)) return 'enum';
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) return 'union';
  const type = Array.isArray(schema.type) ? schema.type.find(t => t !== 'null') : schema.type;
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object': {
      const special = specialObjectKind(schema);
      if (special) return special;
      return schema.properties === undefined && isSchemaObject(schema.additionalProperties) ? 'map' : 'object';
    }
    case 'array':
      if (Array.isArray(schema.prefixItems)) return 'tuple';
      return schema.items !== undefined && isEnumLike(schema.items, resolve) ? 'enumArray' : 'array';
    case undefined:
      return Object.keys(schema).length === 0 ? 'any' : 'other';
    default:
      return 'other';
  }
}

const SHAPE_DEFAULTS: Readonly<Partial<Record<Shape, string>>> = {
  number: 'number',
  money: 'money',
  bigint: 'bigint',
  boolean: 'switch',
  enum: 'select',
  const: 'output',
  enumArray: 'select',
  object: 'page',
  array: 'list',
  tuple: 'tuple',
  map: 'kv',
  union: 'union',
  any: 'json',
};

/** 带 `x-valueFormat` 且没有标准 format 的字符串或整数: 日期组件按存储格式编译出的形态. */
function valueFormatOf(schema: JsonSchemaObject, shape: Shape): string | undefined {
  const vf = schema['x-valueFormat'];
  if (typeof vf !== 'string' || schema.format !== undefined) return undefined;
  if (shape === 'string' || (shape === 'number' && TIMESTAMP_VALUE_FORMATS.includes(vf))) return vf;
  return undefined;
}

/** 按数据形态选出的默认组件(C2 "作为默认的形态"); 引用与无法判定的形态返回 undefined. */
export function defaultWidget(schema: JsonSchemaObject, resolve?: RefResolver): string | undefined {
  const shape = shapeOf(schema, resolve);
  const vf = valueFormatOf(schema, shape);
  if (vf !== undefined) return valueFormatComponent(vf);
  if (shape === 'string') {
    if (schema.contentMediaType === 'text/html') return 'richtext';
    if (schema.contentMediaType === 'application/json') return 'json';
    if (typeof schema.format === 'string' && Object.hasOwn(FORMAT_WIDGETS, schema.format))
      return FORMAT_WIDGETS[schema.format];
    return 'input';
  }
  return SHAPE_DEFAULTS[shape];
}

const SHAPE_ACCEPTS: Readonly<Partial<Record<Shape, readonly string[]>>> = {
  number: ['number', 'range'],
  money: ['money'],
  bigint: ['bigint'],
  boolean: ['switch', 'checkbox'],
  enum: ['select', 'radio'],
  const: ['select', 'radio'],
  enumArray: ['select', 'checkbox'],
  object: ['page', 'inline'],
  array: ['list'],
  tuple: ['tuple'],
  map: ['kv'],
  union: ['union'],
};

/** 内置 widget 是否接受该形态(C2 "接受的形态"); `output` 与 `json` 接受任意形态. */
export function acceptsWidget(schema: JsonSchemaObject, widget: string, resolve?: RefResolver): boolean {
  if (widget === 'output' || widget === 'json') return true;
  const shape = shapeOf(schema, resolve);
  if (shape === 'ref' || shape === 'other') return true;
  const vf = valueFormatOf(schema, shape);
  if (
    vf !== undefined &&
    (widget === 'date' || widget === 'datetime' || (widget === 'time' && !TIMESTAMP_VALUE_FORMATS.includes(vf)))
  )
    return true;
  if (shape === 'string') {
    if (['input', 'textarea', 'password', 'richtext'].includes(widget)) return true;
    if (schema.format === 'uri' && (widget === 'image' || widget === 'file')) return true;
    return typeof schema.format === 'string' && FORMAT_WIDGETS[schema.format] === widget;
  }
  return SHAPE_ACCEPTS[shape]?.includes(widget) ?? false;
}

/** 扩展组件按底层 schema 放行约束元数据时所比照的内置组件. */
export type ExtensionBase = 'string' | 'number' | 'integer' | 'money' | 'bigint' | 'array' | 'object';

const RANGE_META = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'];

/** 各底层类型放行的约束元数据; 每个键都必须在 `META_KEYS` 中适用于同名内置组件. */
export const EXTENSION_CONSTRAINT_KEYS: Readonly<Record<ExtensionBase, readonly string[]>> = {
  string: ['minLength', 'maxLength', 'pattern', 'format'],
  number: [...RANGE_META, 'decimals'],
  integer: RANGE_META,
  money: RANGE_META,
  bigint: RANGE_META,
  array: ['minItems', 'maxItems', 'uniqueItems'],
  object: ['minProperties', 'maxProperties'],
};

/** 扩展组件底层 schema 比照的内置组件: money bigint 按对象形态识别, 其余取去掉 "null" 后唯一的 `type`; 无 type 或多类型时为 undefined, 不放行任何约束元数据. */
export function extensionBase(schema: JsonSchemaObject): ExtensionBase | undefined {
  const special = specialObjectKind(schema);
  if (special !== undefined) return special;
  const types = (Array.isArray(schema.type) ? schema.type : [schema.type]).filter(t => t !== 'null');
  if (types.length !== 1) return undefined;
  const type = types[0];
  return type === 'string' || type === 'number' || type === 'integer' || type === 'array' || type === 'object'
    ? type
    : undefined;
}

/** 扩展组件可写的约束元数据键; 通用键另按 `metaAppliesTo(key, "ext")` 判定. */
export function extensionConstraintKeys(schema: JsonSchemaObject): readonly string[] {
  const base = extensionBase(schema);
  return base === undefined ? [] : EXTENSION_CONSTRAINT_KEYS[base];
}

/** 底层类型与字段类型兼容检查所比较的值类别: JSON 类型, money bigint 单列; 名字与同名内置组件一致. */
export type ValueKind = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'money' | 'bigint';

const VALUE_KINDS: ReadonlySet<string> = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object']);

function scalarKind(value: unknown): ValueKind | 'null' | undefined {
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'string' || typeof value === 'boolean') return typeof value as 'string' | 'boolean';
  if (Array.isArray(value)) return 'array';
  return typeof value === 'object' ? 'object' : undefined;
}

function collectKinds(schema: JsonSchemaObject, out: Set<ValueKind>, depth: number): boolean {
  if (depth > 16) return false;
  const special = specialObjectKind(schema);
  if (special !== undefined) {
    out.add(special);
    return true;
  }
  if (schema.type !== undefined) {
    for (const t of Array.isArray(schema.type) ? schema.type : [schema.type]) {
      if (t === 'null') continue;
      if (!VALUE_KINDS.has(t)) return false;
      out.add(t as ValueKind);
    }
    return true;
  }
  const values = 'const' in schema ? [schema.const] : Array.isArray(schema.enum) ? schema.enum : undefined;
  if (values !== undefined) {
    for (const v of values) {
      const kind = scalarKind(v);
      if (kind === undefined) return false;
      if (kind !== 'null') out.add(kind);
    }
    return true;
  }
  const branches = Array.isArray(schema.oneOf) ? schema.oneOf : Array.isArray(schema.anyOf) ? schema.anyOf : undefined;
  if (branches === undefined) return false;
  return branches.every(b => isSchemaObject(b) && collectKinds(b, out, depth + 1));
}

/** schema 可取的值类别(不含 null); 无 type, 引用, 不可判定的组合等无法判断时为 undefined. */
export function valueKinds(schema: JsonSchemaObject): ValueKind[] | undefined {
  const out = new Set<ValueKind>();
  return collectKinds(schema, out, 0) && out.size > 0 ? [...out] : undefined;
}

/** 各底层类别额外接受的字段类别: integer ⊂ number; 对象接受 money bigint 这类特定对象形态. */
const KIND_WIDENS: Readonly<Partial<Record<ValueKind, readonly ValueKind[]>>> = {
  number: ['integer'],
  object: ['money', 'bigint'],
};

/** 非内置 widget 的底层 schema 是否接受字段的数据形态: 字段每个类别都要被底层某个类别接受; 任一方无法判断时视为接受. */
export function widgetTypeAccepts(base: JsonSchemaObject, schema: JsonSchemaObject): boolean {
  const baseKinds = valueKinds(base);
  const fieldKinds = valueKinds(schema);
  if (baseKinds === undefined || fieldKinds === undefined) return true;
  return fieldKinds.every(k => baseKinds.some(b => b === k || (KIND_WIDENS[b]?.includes(k) ?? false)));
}
