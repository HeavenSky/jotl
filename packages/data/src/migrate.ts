// 用新 schema 修正旧数据: 删除已移除的字段, 转换类型, 修正不在可选值中的值, 补上带默认值的新字段.
import {
  DEFAULT_DEFAULTS_OPTIONS,
  appendPointer,
  ok,
  type JsonPointer,
  type JsonSchema,
  type JsonSchemaObject,
  type JsonSchemaType,
  type Result,
} from '@jotl/core';
import {
  createProduceContext,
  expandNodes,
  matchBranch,
  produce,
  requiredKeys,
  unionBranches,
  zeroValue,
  type ProduceContext,
} from './defaults.js';
import { cloneJson, isPlainObject, jsonEqual, jsonType, setOwn } from './json-value.js';
import { withLocale, type LocaleOptions } from './diagnostics.js';
import { acceptsType, allowedValues, hasOwn, itemSchemas, propertySchemas, schemaTypes } from './schema-resolver.js';

type Migrated = { keep: true; value: unknown } | { keep: false };

interface MigrateContext extends ProduceContext {
  changed: JsonPointer[];
}

export function migrate(
  schema: JsonSchema,
  data: unknown,
  opts?: LocaleOptions
): Result<{ data: unknown; changed: JsonPointer[] }> {
  return withLocale(opts?.locale, () => migrateIn(schema, data));
}

function migrateIn(schema: JsonSchema, data: unknown): Result<{ data: unknown; changed: JsonPointer[] }> {
  const ctx: MigrateContext = { ...createProduceContext(schema, { ...DEFAULT_DEFAULTS_OPTIONS }), changed: [] };
  if (data === undefined) {
    const produced = produce(ctx, schema, false, true);
    if (produced.has) ctx.changed.push('');
    return ok({ data: produced.has ? produced.value : undefined, changed: ctx.changed }, ctx.diagnostics);
  }
  const migrated = migrateValue(ctx, schema, cloneJson(data), '', true);
  return ok({ data: migrated.keep ? migrated.value : undefined, changed: ctx.changed }, ctx.diagnostics);
}

/** required 为 false 时, 无法保留的值被删除而不是替换为零值. */
function migrateValue(
  ctx: MigrateContext,
  schema: JsonSchema | undefined,
  value: unknown,
  pointer: JsonPointer,
  required: boolean
): Migrated {
  if (schema === false) return replace(ctx, [], pointer, required);
  const nodes = expandNodes(ctx, schema);
  if (nodes.length === 0) return { keep: true, value };

  const allowed = allowedValues(nodes);
  if (allowed !== undefined) {
    return allowed.some(v => jsonEqual(v, value)) ? { keep: true, value } : replace(ctx, nodes, pointer, required);
  }

  const branches = unionBranches(nodes);
  if (branches !== undefined) {
    const matched = matchBranch(ctx, nodes, value);
    if (matched !== undefined) return migrateValue(ctx, matched, value, pointer, required);
    for (const branch of branches) {
      const converted = convert(value, schemaTypes(expandNodes(ctx, branch)));
      if (converted.keep) {
        ctx.changed.push(pointer);
        return migrateValue(ctx, branch, converted.value, pointer, required);
      }
    }
    return replace(ctx, nodes, pointer, required);
  }

  const types = schemaTypes(nodes);
  let current = value;
  if (!acceptsType(types, current)) {
    const converted = convert(current, types);
    if (!converted.keep) return replace(ctx, nodes, pointer, required);
    ctx.changed.push(pointer);
    current = converted.value;
  }
  if (isPlainObject(current)) migrateObject(ctx, nodes, current, pointer);
  else if (Array.isArray(current)) current = migrateArray(ctx, nodes, current, pointer);
  return { keep: true, value: current };
}

function migrateObject(
  ctx: MigrateContext,
  nodes: JsonSchemaObject[],
  value: Record<string, unknown>,
  pointer: JsonPointer
): void {
  const required = requiredKeys(nodes);
  const declared = new Set<string>();
  for (const node of nodes) for (const key of Object.keys(node.properties ?? {})) declared.add(key);
  const dropUndeclared =
    declared.size > 0 &&
    nodes.every(
      n =>
        (n.additionalProperties === undefined || n.additionalProperties === false) &&
        n.patternProperties === undefined &&
        n.unevaluatedProperties === undefined
    );
  for (const key of Object.keys(value)) {
    const child = propertySchemas(nodes, key)[0];
    const childPointer = appendPointer(pointer, key);
    if (!declared.has(key) && (dropUndeclared || child === undefined)) {
      if (dropUndeclared) {
        delete value[key];
        ctx.changed.push(childPointer);
      }
      continue;
    }
    const migrated = migrateValue(ctx, child, value[key], childPointer, required.has(key));
    if (migrated.keep) setOwn(value, key, migrated.value);
    else delete value[key];
  }
  for (const key of declared) {
    if (hasOwn(value, key)) continue;
    const produced = produce(ctx, propertySchemas(nodes, key)[0], false, false);
    if (produced.has) {
      setOwn(value, key, produced.value);
      ctx.changed.push(appendPointer(pointer, key));
    }
  }
}

function migrateArray(
  ctx: MigrateContext,
  nodes: JsonSchemaObject[],
  value: unknown[],
  pointer: JsonPointer
): unknown[] {
  const out: unknown[] = [];
  value.forEach((item, index) => {
    const migrated = migrateValue(ctx, itemSchemas(nodes, index)[0], item, appendPointer(pointer, index), false);
    if (migrated.keep) out.push(migrated.value);
  });
  return out;
}

/** 无法保留的值: 有默认值时取默认值, 必填时取零值, 否则删除; 都记为改动. */
function replace(ctx: MigrateContext, nodes: JsonSchemaObject[], pointer: JsonPointer, required: boolean): Migrated {
  ctx.changed.push(pointer);
  const withDefault = nodes.find(n => hasOwn(n, 'default'));
  if (withDefault) return { keep: true, value: cloneJson(withDefault.default) };
  if (!required) return { keep: false };
  const zero = zeroValue(nodes);
  return zero.has ? { keep: true, value: zero.value } : { keep: false };
}

/** 按 types 的顺序尝试无损或近似无损的类型转换. */
function convert(value: unknown, types: readonly JsonSchemaType[]): Migrated {
  for (const type of types) {
    const converted = convertTo(value, type);
    if (converted.keep) return converted;
  }
  return { keep: false };
}

function convertTo(value: unknown, type: JsonSchemaType): Migrated {
  const from = jsonType(value);
  if (Array.isArray(value) && value.length === 1 && type !== 'array') return convertTo(value[0], type);
  switch (type) {
    case 'string':
      return from === 'number' || from === 'integer' || from === 'boolean'
        ? { keep: true, value: String(value) }
        : { keep: false };
    case 'number':
    case 'integer': {
      const number =
        typeof value === 'string' && value.trim() !== '' ? Number(value) : typeof value === 'number' ? value : NaN;
      if (!Number.isFinite(number)) return { keep: false };
      return { keep: true, value: type === 'integer' ? Math.round(number) : number };
    }
    case 'boolean':
      return value === 'true' || value === 'false' ? { keep: true, value: value === 'true' } : { keep: false };
    case 'array':
      return from !== 'null' ? { keep: true, value: [value] } : { keep: false };
    default:
      return { keep: false };
  }
}
