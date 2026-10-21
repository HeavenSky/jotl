// @jotl/data 的诊断代码表(JOTL4xxx); B1 预分配, 之后由 S4b 维护, 代码一旦发布不复用.
import { defineDiagnostics, getLocale, setLocale, type Locale } from '@jotl/core';

// {label} 为字段的 title, 无 title 时为键名; 根节点为 "数据".
export const DATA_DIAGNOSTICS = {
  JOTL4001: { severity: 'error', message: '{label} 的类型应为{expected}', en: '{label} should be of type {expected}' },
  JOTL4002: { severity: 'error', message: '缺少必填字段 {label}', en: 'Missing required field {label}' },
  JOTL4003: { severity: 'error', message: '{label} 超出范围: {detail}', en: '{label} is out of range: {detail}' },
  JOTL4004: { severity: 'error', message: '{label} 的长度应{detail}', en: '{label} length should be {detail}' },
  JOTL4005: {
    severity: 'error',
    message: '{label} 不符合格式要求 {pattern}',
    en: '{label} does not match the pattern {pattern}',
  },
  JOTL4006: { severity: 'error', message: '{label} 不在可选值中', en: '{label} is not one of the allowed values' },
  JOTL4007: { severity: 'error', message: '{label} 的项数应{detail}', en: '{label} item count should be {detail}' },
  JOTL4008: { severity: 'error', message: '不允许的字段 {name}', en: 'Field {name} is not allowed' },
  JOTL4009: { severity: 'error', message: '{label} 不是有效的 {format}', en: '{label} is not a valid {format}' },
  JOTL4010: {
    severity: 'error',
    message: '{label} 应为 {multipleOf} 的倍数',
    en: '{label} should be a multiple of {multipleOf}',
  },
  JOTL4011: { severity: 'error', message: '{label} 中有重复项', en: '{label} contains duplicate items' },
  JOTL4012: {
    severity: 'error',
    message: '{label} 不符合任何一种可选结构{detail}',
    en: '{label} does not match any of the allowed structures{detail}',
  },
  JOTL4013: { severity: 'error', message: '{label} 的值应为 {value}', en: '{label} should be {value}' },
  JOTL4014: {
    severity: 'error',
    message: '{label} 的字段数应{detail}',
    en: '{label} property count should be {detail}',
  },
  JOTL4015: {
    severity: 'error',
    message: '{label} 同时符合多种可选结构, 只能符合一种',
    en: '{label} matches more than one of the allowed structures, but must match exactly one',
  },
  JOTL4016: {
    severity: 'warning',
    message: '无法解析引用 {ref}, 该节点按无值处理',
    en: 'Cannot resolve reference {ref}; the node is treated as having no value',
  },
  JOTL4017: {
    severity: 'error',
    message: 'schema 无法用于校验, 校验器编译失败',
    en: 'The schema cannot be used for validation: validator compilation failed',
  },
  JOTL4018: {
    severity: 'error',
    message: '选项 {name} 的值无效: {value}',
    en: 'Invalid value for option {name}: {value}',
  },
  JOTL4019: {
    severity: 'warning',
    message: '无法为 {label} 生成满足约束的 Mock 数据: {detail}',
    en: 'Cannot generate mock data satisfying the constraints of {label}: {detail}',
  },
  JOTL4020: {
    severity: 'error',
    message: '{label} 的小数位数应不超过 {limit}',
    en: '{label} should have at most {limit} decimal places',
  },
  JOTL4021: {
    severity: 'error',
    message: '{label} 的数值超出范围: {detail}',
    en: '{label} value is out of range: {detail}',
  },
  JOTL4022: { severity: 'error', message: '{label} 不是有效的 JSON 文本', en: '{label} is not valid JSON text' },
  JOTL4023: {
    severity: 'error',
    message: '{label} 的 JSON 内容不符合结构要求',
    en: '{label} JSON content does not match the required structure',
  },
  JOTL4024: { severity: 'error', message: '{label} 的键名 {name} 不合法', en: '{label} has an invalid key {name}' },
  JOTL4025: {
    severity: 'error',
    message: '{label} 不符合存储格式 {format}',
    en: '{label} does not match the storage format {format}',
  },
  JOTL4099: { severity: 'error', message: '{label} 校验失败: {detail}', en: '{label} failed validation: {detail}' },
} as const;

export const dataDiagnostic = defineDiagnostics(DATA_DIAGNOSTICS);

// 拼进诊断参数 {label} {detail} {expected} {format} 的文案片段.
export const DATA_TEXT = {
  rootLabel: '数据',
  itemLabel: '{parent} 的第 {index} 项',
  typeSeparator: '或',
  types: {
    string: '字符串',
    number: '数字',
    integer: '整数',
    boolean: '布尔值',
    null: '空值',
    array: '数组',
    object: '对象',
  },
  minimum: '应不小于 {limit}',
  maximum: '应不大于 {limit}',
  exclusiveMinimum: '应大于 {limit}',
  exclusiveMaximum: '应小于 {limit}',
  atLeast: '不少于 {limit}',
  atMost: '不超过 {limit}',
  formats: {
    color: '颜色',
    date: '日期',
    'date-time': '日期时间',
    time: '时间',
    email: '邮箱地址',
    uri: '链接',
    'uri-reference': '链接',
    uuid: 'UUID',
    hostname: '主机名',
    ipv4: 'IPv4 地址',
    ipv6: 'IPv6 地址',
    duration: '时长',
    regex: '正则表达式',
  } as Readonly<Record<string, string>>,
  not: '不应符合被排除的结构',
  unionReason: ': {reason}',
  unionOwnReason: '{label} {reason}',
  unionDiscriminator: '{name} 的值 {value} 不在可选值 {options} 中',
  unionMissingDiscriminator: '缺少区分字段 {name}, 可选值 {options}',
  unionExpected: '应为 {types} 之一',
  unionListSeparator: ', ',
  otherStructure: '其他结构',
  falseSchema: '此处不允许有值',
  contains: '包含的符合要求的项数不对',
  unevaluatedItems: '有多余的项',
  unknownKeyword: '不满足 {keyword} 约束',
  compileUnknown: '未知错误',
  mockPattern: '无法生成匹配 {pattern} 的字符串',
  mockDepth: '引用嵌套超过 {limit} 层',
} as const;

type Widen<T> = T extends string ? string : { readonly [K in keyof T]: Widen<T[K]> };
export type DataText = Widen<typeof DATA_TEXT>;

export const DATA_TEXT_EN: DataText = {
  rootLabel: 'data',
  itemLabel: 'item {index} of {parent}',
  typeSeparator: ' or ',
  types: {
    string: 'string',
    number: 'number',
    integer: 'integer',
    boolean: 'boolean',
    null: 'null',
    array: 'array',
    object: 'object',
  },
  minimum: 'should be at least {limit}',
  maximum: 'should be at most {limit}',
  exclusiveMinimum: 'should be greater than {limit}',
  exclusiveMaximum: 'should be less than {limit}',
  atLeast: 'at least {limit}',
  atMost: 'at most {limit}',
  formats: {
    color: 'color',
    date: 'date',
    'date-time': 'date-time',
    time: 'time',
    email: 'email address',
    uri: 'URL',
    'uri-reference': 'URL',
    uuid: 'UUID',
    hostname: 'hostname',
    ipv4: 'IPv4 address',
    ipv6: 'IPv6 address',
    duration: 'duration',
    regex: 'regular expression',
  },
  not: 'should not match the excluded structure',
  unionReason: ': {reason}',
  unionOwnReason: '{label} {reason}',
  unionDiscriminator: 'value {value} of {name} is not one of the allowed values {options}',
  unionMissingDiscriminator: 'missing discriminator field {name}, allowed values {options}',
  unionExpected: 'should be one of {types}',
  unionListSeparator: ', ',
  otherStructure: 'other structure',
  falseSchema: 'no value is allowed here',
  contains: 'wrong number of matching items',
  unevaluatedItems: 'has extra items',
  unknownKeyword: 'does not satisfy the {keyword} constraint',
  compileUnknown: 'unknown error',
  mockPattern: 'cannot generate a string matching {pattern}',
  mockDepth: 'references nested more than {limit} levels deep',
};

/** 当前语言的文案片段. */
export function dataText(): DataText {
  return getLocale() === 'en' ? DATA_TEXT_EN : DATA_TEXT;
}

export interface LocaleOptions {
  /** 本次调用产生的诊断与消息所用语言; 缺省取全局 `getLocale()`. */
  locale?: Locale;
}

/** 在指定语言下执行 fn, 结束(含抛错)后恢复原全局语言. */
export function withLocale<T>(locale: Locale | undefined, fn: () => T): T {
  if (locale === undefined) return fn();
  const previous = getLocale();
  setLocale(locale);
  try {
    return fn();
  } finally {
    setLocale(previous);
  }
}
