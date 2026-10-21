// x-ui 的轻量结构校验, 规则与 @jotl/core 的 xUiMetaSchema 一致, 用于 F3 判定(core/ 不依赖 Ajv).
import { appendPointer, type JsonPointer } from '@jotl/core';
import type { XUiIssueKind } from './diagnostics.js';

export interface XUiIssue {
  /** 相对 x-ui 对象的指针. */
  path: JsonPointer;
  kind: XUiIssueKind;
}

type Check = (value: unknown, path: JsonPointer) => XUiIssue | undefined;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const issue = (path: JsonPointer, kind: XUiIssueKind): XUiIssue => ({ path, kind });

const isString: Check = (v, p) => (typeof v === 'string' ? undefined : issue(p, 'type'));
const isBoolean: Check = (v, p) => (typeof v === 'boolean' ? undefined : issue(p, 'type'));
const isObject: Check = (v, p) => (isPlainObject(v) ? undefined : issue(p, 'type'));

const nonEmptyString: Check = (v, p) => isString(v, p) ?? (v === '' ? issue(p, 'empty') : undefined);

function arrayOf(item: Check): Check {
  return (v, p) => {
    if (!Array.isArray(v)) return issue(p, 'type');
    for (let i = 0; i < v.length; i++) {
      const found = item(v[i], appendPointer(p, i));
      if (found) return found;
    }
    return undefined;
  };
}

function oneOfValues(values: readonly unknown[]): Check {
  return (v, p) => (values.includes(v) ? undefined : issue(p, 'enum'));
}

/** 按字段表校验对象: 拒绝未知字段, 缺少必填字段时报错. */
function objectOf(fields: Readonly<Record<string, Check>>, required: readonly string[] = []): Check {
  return (v, p) => {
    if (!isPlainObject(v)) return issue(p, 'type');
    for (const key of required) if (!Object.hasOwn(v, key)) return issue(appendPointer(p, key), 'required');
    for (const [key, value] of Object.entries(v)) {
      const check = Object.hasOwn(fields, key) ? fields[key] : undefined;
      if (check === undefined) return issue(appendPointer(p, key), 'unknownKey');
      const found = check(value, appendPointer(p, key));
      if (found) return found;
    }
    return undefined;
  };
}

const COMPARISONS = ['eq', 'ne', 'in', 'notIn', 'truthy', 'gt', 'gte', 'lt', 'lte'] as const;
const NUMERIC_COMPARISONS = ['gt', 'gte', 'lt', 'lte'];

const checkCondition: Check = (v, p) => {
  if (!isPlainObject(v)) return issue(p, 'type');
  const keys = Object.keys(v);
  if (keys.length === 1 && (keys[0] === 'all' || keys[0] === 'any'))
    return arrayOf(checkCondition)(v[keys[0]], appendPointer(p, keys[0]));
  if (keys.length === 1 && keys[0] === 'not') return checkCondition(v.not, appendPointer(p, 'not'));
  const hasBase = Object.hasOwn(v, 'base');
  if (keys.length !== (hasBase ? 3 : 2) || !Object.hasOwn(v, 'field')) return issue(p, 'condition');
  if (hasBase && v.base !== 'node') return issue(appendPointer(p, 'base'), 'enum');
  const op = keys.find(k => k !== 'field' && k !== 'base');
  if (!(COMPARISONS as readonly (string | undefined)[]).includes(op)) return issue(p, 'condition');
  const fieldIssue = isString(v.field, appendPointer(p, 'field'));
  if (fieldIssue) return fieldIssue;
  if ((op === 'in' || op === 'notIn') && !Array.isArray(v[op])) return issue(appendPointer(p, op), 'type');
  if (op === 'truthy' && typeof v.truthy !== 'boolean') return issue(appendPointer(p, 'truthy'), 'type');
  if (NUMERIC_COMPARISONS.includes(op!) && typeof v[op!] !== 'number') return issue(appendPointer(p, op!), 'type');
  return undefined;
};

const checkColumns: Check = (v, p) => {
  if (typeof v !== 'number' || !Number.isInteger(v)) return issue(p, 'type');
  return v < 1 ? issue(p, 'minimum') : undefined;
};

const checkDecorator: Check = (v, p) => (v === false ? undefined : nonEmptyString(v, p));

const COMMON_FIELDS: Readonly<Record<string, Check>> = {
  widget: nonEmptyString,
  props: isObject,
  decorator: checkDecorator,
  order: arrayOf(isString),
  groups: arrayOf(objectOf({ title: isString, fields: arrayOf(isString) }, ['title', 'fields'])),
  layout: oneOfValues(['stack', 'tabs', 'grid']),
  columns: checkColumns,
  hidden: isBoolean,
  visibleIf: checkCondition,
  summary: nonEmptyString,
  thousands: isBoolean,
};

const checkVariant = objectOf(COMMON_FIELDS);

const checkRule = objectOf(
  {
    match: objectOf({ pointer: isString, type: isString, format: isString, enum: isBoolean, widget: isString }),
    ui: checkVariant,
  },
  ['match', 'ui']
);

const checkVariants: Check = (v, p) => {
  if (!isPlainObject(v)) return issue(p, 'type');
  for (const [name, variant] of Object.entries(v)) {
    const found = checkVariant(variant, appendPointer(p, name));
    if (found) return found;
  }
  return undefined;
};

const checkWidgetBase: Check = (v, p) => (isPlainObject(v) ? undefined : nonEmptyString(v, p));

const checkWidgetModules: Check = (v, p) => {
  if (!isPlainObject(v)) return issue(p, 'type');
  for (const [name, decl] of Object.entries(v)) {
    if (name === '') return issue(appendPointer(p, name), 'empty');
    const found = objectOf({ base: checkWidgetBase, module: nonEmptyString, export: nonEmptyString }, ['module'])(
      decl,
      appendPointer(p, name)
    );
    if (found) return found;
  }
  return undefined;
};

const checkXUiObject = objectOf({
  ...COMMON_FIELDS,
  variants: checkVariants,
  rules: arrayOf(checkRule),
  version: oneOfValues([1]),
  widgets: checkWidgetModules,
});

/** 返回第一处不符合 meta-schema 的位置; 合法时返回 undefined. */
export function checkXUi(value: unknown): XUiIssue | undefined {
  return checkXUiObject(value, '');
}
