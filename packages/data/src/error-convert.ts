// 把 Ajv 的错误折叠为 "一处违反只报一条" 的 Diagnostic, 用字段标签渲染中文文案并应用 errorMessage.
import type { ErrorObject } from 'ajv';
import {
  SUBSCHEMA_KEYWORDS,
  appendPointer,
  formatMessage,
  isSchemaObject,
  parentPointer,
  tryParsePointer,
  type Diagnostic,
  type JsonPointer,
  type JsonSchema,
  type JsonSchemaObject,
} from '@jotl/core';
import { rangeViolation } from './decimal.js';
import { dataDiagnostic, dataText } from './diagnostics.js';
import {
  createResolver,
  expand,
  isLabeledEnum,
  itemSchemas,
  propertySchemas,
  type SchemaResolver,
} from './schema-resolver.js';

type DataCode = Parameters<typeof dataDiagnostic>[0];

interface Converted {
  code: DataCode;
  pointer: JsonPointer;
  keyword: string;
  params: Record<string, string | number>;
  /** 违反的关键字所在的 schema 节点. */
  node: JsonSchemaObject | undefined;
}

const COMBINATORS = new Set(['anyOf', 'oneOf', 'propertyNames', 'contentSchema']);

export function convertErrors(
  root: JsonSchema,
  errors: readonly ErrorObject[],
  document: JsonSchema = root
): Diagnostic[] {
  const resolver = createResolver(document, root);
  const kept = collapseCombinators(resolver, errors);
  const reasons = unionReasons(resolver, errors);
  const ownReasons = new Map<Converted, string>();
  const converted = kept
    .map(error => {
      const c = convertOne(error);
      const reason = reasons.get(error);
      if (c !== undefined && c.code === 'JOTL4012' && reason !== undefined) {
        if (reason.own) ownReasons.set(c, reason.text);
        else c.params.detail = formatMessage(dataText().unionReason, { reason: reason.text });
      }
      return c;
    })
    .filter((c): c is Converted => c !== undefined);
  const typeMismatch = new Set(converted.filter(c => c.code === 'JOTL4001').map(c => c.pointer));
  const seen = new Set<string>();
  const out: Diagnostic[] = [];
  for (const c of converted) {
    if (typeMismatch.has(c.pointer) && c.code !== 'JOTL4001') continue;
    const label = labelAt(resolver, c.pointer);
    const params = { ...c.params, label };
    const diagnostic = dataDiagnostic(c.code, params, { location: { kind: 'pointer', pointer: c.pointer } });
    const own = ownReasons.get(c);
    if (own !== undefined) diagnostic.message = formatMessage(dataText().unionOwnReason, { label, reason: own });
    const custom = customMessage(resolver, c);
    if (custom !== undefined) diagnostic.message = formatMessage(custom, params);
    const key = `${diagnostic.code}\u0000${c.pointer}\u0000${diagnostic.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(diagnostic);
  }
  return out;
}

/** 去掉组合关键字分支内产生的错误, 只留组合关键字自身的一条. */
function collapseCombinators(resolver: SchemaResolver, errors: readonly ErrorObject[]): ErrorObject[] {
  const dropped = new Set<ErrorObject>();
  for (const combinator of errors) {
    if (!COMBINATORS.has(combinator.keyword) || dropped.has(combinator)) continue;
    const reach = reachable(resolver, combinator.schema);
    for (const error of errors) {
      if (error === combinator || !isSchemaObject(error.parentSchema) || !reach.has(error.parentSchema)) continue;
      if (
        error.instancePath === combinator.instancePath ||
        error.instancePath.startsWith(combinator.instancePath + '/')
      ) {
        dropped.add(error);
      }
    }
  }
  return errors.filter(e => !dropped.has(e) && e.keyword !== 'if');
}

function jsonTypeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function constOf(nodes: readonly JsonSchemaObject[], name: string): { value: unknown } | undefined {
  for (const node of nodes) {
    const property = isSchemaObject(node.properties) ? node.properties[name] : undefined;
    if (isSchemaObject(property) && 'const' in property) return { value: property.const };
  }
  return undefined;
}

/** 各分支都以同一个字段的 const 区分时返回该字段名. */
function discriminatorOf(branches: readonly JsonSchemaObject[][]): string | undefined {
  const [first] = branches;
  if (first === undefined || branches.length < 2) return undefined;
  for (const node of first) {
    for (const name of Object.keys(isSchemaObject(node.properties) ? node.properties : {})) {
      const values = branches.map(nodes => constOf(nodes, name));
      if (
        values.every(v => v !== undefined) &&
        new Set(values.map(v => JSON.stringify(v!.value))).size === values.length
      )
        return name;
    }
  }
  return undefined;
}

function branchName(nodes: readonly JsonSchemaObject[]): string {
  const title = nodes.find(n => typeof n.title === 'string')?.title;
  if (title !== undefined) return title;
  const type = nodes.find(n => n.type !== undefined)?.type;
  if (type !== undefined) return typeText(type);
  return nodes.some(n => n.properties !== undefined) ? dataText().types.object : dataText().otherStructure;
}

function typeMatches(nodes: readonly JsonSchemaObject[], actual: string): boolean {
  const declared = nodes.find(n => n.type !== undefined)?.type;
  if (declared === undefined) {
    if (nodes.some(n => Array.isArray(n.oneOf) || Array.isArray(n.anyOf))) return actual !== 'null';
    return actual === 'object' ? nodes.some(n => n.properties !== undefined) : false;
  }
  const types = Array.isArray(declared) ? declared.map(String) : [String(declared)];
  return types.includes(actual) || (actual === 'integer' && types.includes('number'));
}

/**
 * "不符合任何一种可选结构" 的原因: 区分字段的值不在可选值中; 否则按数据的 JSON 类型选出最接近的分支, 取它的第一条错误;
 * 没有类型相符的分支时列出可选的类型.
 */
interface UnionReason {
  text: string;
  /** 原因描述的是联合节点自身的值(而不是其中某个字段), 文案中省去 "不符合任何一种可选结构". */
  own: boolean;
}

function unionReasons(resolver: SchemaResolver, errors: readonly ErrorObject[]): Map<ErrorObject, UnionReason> {
  const out = new Map<ErrorObject, UnionReason>();
  const done = new Set<ErrorObject>();
  const isUnion = (e: ErrorObject): boolean =>
    (e.keyword === 'anyOf' || e.keyword === 'oneOf') &&
    Array.isArray(e.schema) &&
    !Array.isArray((e.params as Record<string, unknown>)['passingSchemas']);
  const reasonOf = (combinator: ErrorObject): UnionReason | undefined => {
    if (done.has(combinator)) return out.get(combinator);
    done.add(combinator);
    const reason = compute(combinator);
    if (reason !== undefined) out.set(combinator, reason);
    return reason;
  };
  const compute = (combinator: ErrorObject): UnionReason | undefined => {
    const branches = (combinator.schema as JsonSchema[]).map(b => expand(resolver, b).nodes);
    const data = combinator.data;
    let chosen: number | undefined;
    const disc = discriminatorOf(branches);
    const options = (): string =>
      branches
        .map(nodes => {
          const value = JSON.stringify(constOf(nodes, disc!)!.value);
          const title = nodes.find(n => typeof n.title === 'string')?.title;
          return title === undefined ? value : `${title}(${value})`;
        })
        .join(dataText().unionListSeparator);
    if (disc !== undefined && typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const record = data as Record<string, unknown>;
      if (!Object.hasOwn(record, disc))
        return {
          text: formatMessage(dataText().unionMissingDiscriminator, { name: disc, options: options() }),
          own: false,
        };
      const index = branches.findIndex(
        nodes => JSON.stringify(constOf(nodes, disc)!.value) === JSON.stringify(record[disc])
      );
      if (index === -1)
        return {
          text: formatMessage(dataText().unionDiscriminator, {
            name: disc,
            value: JSON.stringify(record[disc]) ?? 'null',
            options: options(),
          }),
          own: false,
        };
      chosen = index;
    } else {
      const index = branches.findIndex(nodes => typeMatches(nodes, jsonTypeOf(data)));
      if (index !== -1) chosen = index;
    }
    if (chosen === undefined)
      return {
        text: formatMessage(dataText().unionExpected, {
          types: branches.map(branchName).join(dataText().unionListSeparator),
        }),
        own: true,
      };
    const reach = reachable(resolver, (combinator.schema as JsonSchema[])[chosen]);
    const nested = errors.filter(
      error =>
        error !== combinator &&
        isSchemaObject(error.parentSchema) &&
        reach.has(error.parentSchema) &&
        (error.instancePath === combinator.instancePath || error.instancePath.startsWith(combinator.instancePath + '/'))
    );
    // 分支本身又是联合(如可空包着可区分联合)时, 原因取内层联合的原因.
    const inner = nested.find(error => isUnion(error) && error.instancePath === combinator.instancePath);
    if (inner !== undefined) return reasonOf(inner);
    for (const error of nested) {
      const c = convertOne(error);
      if (c === undefined) continue;
      if (c.code === 'JOTL4012') {
        const deeper = isUnion(error) ? reasonOf(error) : undefined;
        if (deeper !== undefined) return deeper;
        continue;
      }
      const label = labelAt(resolver, c.pointer);
      const message = dataDiagnostic(c.code, { ...c.params, label }).message;
      const own = c.pointer === combinator.instancePath && message.startsWith(`${label} `);
      return { text: own ? message.slice(label.length + 1) : message, own };
    }
    return undefined;
  };
  for (const error of errors) if (isUnion(error)) reasonOf(error);
  return out;
}

/** 从组合关键字的值出发, 经子 schema 与 $ref 可达的全部 schema 对象. */
function reachable(resolver: SchemaResolver, start: unknown): Set<object> {
  const out = new Set<object>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isSchemaObject(node) || out.has(node)) return;
    out.add(node);
    if (typeof node.$ref === 'string') visit(resolver.resolveRef(node.$ref, node));
    if (typeof node.$dynamicRef === 'string') visit(resolver.resolveRef(node.$dynamicRef, node));
    for (const key of SUBSCHEMA_KEYWORDS.single) visit(node[key]);
    for (const key of SUBSCHEMA_KEYWORDS.array) visit(node[key]);
    for (const key of SUBSCHEMA_KEYWORDS.map) {
      const map = node[key];
      if (isSchemaObject(map)) for (const sub of Object.values(map)) visit(sub);
    }
  };
  visit(start);
  return out;
}

function convertOne(error: ErrorObject): Converted | undefined {
  const params = error.params as Record<string, unknown>;
  const node = isSchemaObject(error.parentSchema) ? error.parentSchema : undefined;
  const at = (
    code: DataCode,
    extra: Record<string, string | number> = {},
    pointer = error.instancePath
  ): Converted => ({
    code,
    pointer,
    keyword: error.keyword,
    params: extra,
    node,
  });
  const limit = String(params['limit']);
  const bound = (text: string): string => formatMessage(text, { limit });
  switch (error.keyword) {
    case 'type':
      return at('JOTL4001', { expected: typeText(params['type']) });
    case 'required':
    case 'dependentRequired':
      return at('JOTL4002', {}, appendPointer(error.instancePath, String(params['missingProperty'])));
    case 'minimum':
    case 'maximum':
    case 'exclusiveMinimum':
    case 'exclusiveMaximum':
      return at('JOTL4003', { detail: bound(dataText()[error.keyword]) });
    case 'minLength':
      return at('JOTL4004', { detail: bound(dataText().atLeast) });
    case 'maxLength':
      return at('JOTL4004', { detail: bound(dataText().atMost) });
    case 'pattern':
      return at('JOTL4005', { pattern: String(params['pattern']) });
    case 'enum':
      return at('JOTL4006');
    case 'minItems':
      return at('JOTL4007', { detail: bound(dataText().atLeast) });
    case 'maxItems':
    case 'items':
      return at('JOTL4007', { detail: bound(dataText().atMost) });
    case 'additionalProperties':
      return at(
        'JOTL4008',
        { name: String(params['additionalProperty']) },
        appendPointer(error.instancePath, String(params['additionalProperty']))
      );
    case 'unevaluatedProperties':
      return at(
        'JOTL4008',
        { name: String(params['unevaluatedProperty']) },
        appendPointer(error.instancePath, String(params['unevaluatedProperty']))
      );
    case 'format': {
      const format = String(params['format']);
      return at('JOTL4009', { format: dataText().formats[format] ?? format });
    }
    case 'multipleOf':
      return at('JOTL4010', { multipleOf: String(params['multipleOf']) });
    case 'uniqueItems':
      return at('JOTL4011');
    case 'anyOf':
      return at('JOTL4012', { detail: '' });
    case 'oneOf':
      if (Array.isArray(params['passingSchemas'])) return at('JOTL4015');
      return node !== undefined && isLabeledEnum(node) ? at('JOTL4006') : at('JOTL4012', { detail: '' });
    case 'const':
      return at('JOTL4013', { value: JSON.stringify(params['allowedValue']) ?? 'null' });
    case 'minProperties':
      return at('JOTL4014', { detail: bound(dataText().atLeast) });
    case 'maxProperties':
      return at('JOTL4014', { detail: bound(dataText().atMost) });
    case 'x-valueFormat':
      return at('JOTL4025', { format: String(error.schema) });
    case 'x-decimals':
      return at('JOTL4020', { limit: String(error.schema) });
    case 'x-decimalRange': {
      const violation = rangeViolation(error.schema, (error.data as Record<string, unknown> | undefined)?.['value']);
      if (violation === undefined) return undefined;
      return at('JOTL4021', { detail: formatMessage(dataText()[violation.key], { limit: violation.limit }) });
    }
    case 'contentMediaType':
      return at('JOTL4022');
    case 'contentSchema':
      return at('JOTL4023');
    case 'not':
      return at('JOTL4099', { detail: dataText().not });
    case 'false schema':
      return at('JOTL4099', { detail: dataText().falseSchema });
    case 'contains':
      return at('JOTL4099', { detail: dataText().contains });
    case 'unevaluatedItems':
      return at('JOTL4099', { detail: dataText().unevaluatedItems });
    case 'propertyNames':
      return at('JOTL4024', { name: String(params['propertyName']) });
    default:
      return at('JOTL4099', { detail: formatMessage(dataText().unknownKeyword, { keyword: error.keyword }) });
  }
}

function typeText(type: unknown): string {
  const types = Array.isArray(type) ? type : String(type).split(',');
  return types
    .map(t => (dataText().types as Record<string, string>)[String(t)] ?? String(t))
    .join(dataText().typeSeparator);
}

/**
 * errorMessage 的查找顺序: 缺少必填字段时先看该字段自身, 再看父对象; 其余错误先看违反的关键字所在节点, 再看字段节点.
 * 字符串形态替换全部错误, 对象形态只替换同名关键字的错误.
 */
function customMessage(resolver: SchemaResolver, c: Converted): string | undefined {
  const fieldNodes = directNodes(resolver, c.pointer);
  const candidates =
    c.keyword === 'required' || c.keyword === 'dependentRequired' ? [...fieldNodes, c.node] : [c.node, ...fieldNodes];
  for (const node of candidates) {
    const custom = node?.errorMessage;
    if (typeof custom === 'string') return custom;
    if (isSchemaObject(custom) && typeof custom[c.keyword] === 'string') return custom[c.keyword] as string;
  }
  return undefined;
}

/** 字段标签: 字段节点自身的 title; 没有时数组元素为 "父标签的第 N 项", 其余为键名; 根为 "数据". */
export function labelAt(resolver: SchemaResolver, pointer: JsonPointer): string {
  const tokens = tryParsePointer(pointer);
  if (tokens === undefined || tokens.length === 0) return dataText().rootLabel;
  for (const node of directNodes(resolver, pointer)) if (typeof node.title === 'string') return node.title;
  const last = tokens[tokens.length - 1]!;
  const parent = parentPointer(pointer) ?? '';
  if (
    /^(0|[1-9]\d*)$/.test(last) &&
    nodesAt(resolver, parent).some(n => n.items !== undefined || n.prefixItems !== undefined)
  ) {
    return formatMessage(dataText().itemLabel, { parent: labelAt(resolver, parent), index: Number(last) + 1 });
  }
  return last;
}

/** 数据路径上直接声明的字段节点(未经 $ref 展开); 根为根 schema. */
function directNodes(resolver: SchemaResolver, pointer: JsonPointer): JsonSchemaObject[] {
  const tokens = tryParsePointer(pointer);
  if (tokens === undefined) return [];
  if (tokens.length === 0) return isSchemaObject(resolver.root) ? [resolver.root] : [];
  const parents = nodesAt(resolver, parentPointer(pointer) ?? '');
  return childrenOf(parents, tokens[tokens.length - 1]!).filter(isSchemaObject);
}

/** 数据路径上适用的全部 schema 节点, 含 $ref, allOf 展开与 anyOf/oneOf 分支. */
function nodesAt(resolver: SchemaResolver, pointer: JsonPointer): JsonSchemaObject[] {
  const tokens = tryParsePointer(pointer) ?? [];
  let current = withBranches(resolver, [resolver.root]);
  for (const token of tokens) current = withBranches(resolver, childrenOf(current, token));
  return current;
}

function childrenOf(nodes: readonly JsonSchemaObject[], token: string): JsonSchema[] {
  const asIndex = /^(0|[1-9]\d*)$/.test(token) ? Number(token) : undefined;
  return [...propertySchemas(nodes, token), ...(asIndex === undefined ? [] : itemSchemas(nodes, asIndex))];
}

function withBranches(resolver: SchemaResolver, schemas: readonly JsonSchema[]): JsonSchemaObject[] {
  const out: JsonSchemaObject[] = [];
  const visit = (schema: JsonSchema | undefined): void => {
    for (const node of expand(resolver, schema).nodes) {
      if (out.includes(node)) continue;
      out.push(node);
      for (const branch of [...(node.anyOf ?? []), ...(node.oneOf ?? [])]) visit(branch);
    }
  };
  for (const schema of schemas) visit(schema);
  return out;
}
