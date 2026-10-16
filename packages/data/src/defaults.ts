// 按 DefaultsOptions 口径生成默认数据(getDefaults), 以及用默认值补全已有数据而不覆盖已有值(fillDefaults).
import {
  DEFAULT_DEFAULTS_OPTIONS,
  appendPointer,
  isSchemaObject,
  ok,
  fail,
  type DefaultsOptions,
  type Diagnostic,
  type JsonPointer,
  type JsonSchema,
  type JsonSchemaObject,
  type Result,
} from "@jotl/core";
import { DECIMAL_STRING, decimalKind, decimalRangeOf, defaultDecimal, patternDecimals } from "./decimal.js";
import { dataDiagnostic, withLocale, type LocaleOptions } from "./diagnostics.js";
import { fixedMoment, formatValueFormat } from "./value-format.js";
import { cloneJson, isPlainObject, jsonEqual, setOwn } from "./json-value.js";
import {
  acceptsType,
  allowedValues,
  createResolver,
  hasOwn,
  isLabeledEnum,
  itemSchemas,
  pick,
  propertySchemas,
  schemaTypes,
  subschemaAt,
  type SchemaResolver,
  type SubschemaOptions,
} from "./schema-resolver.js";

type Produced = { has: true; value: unknown } | { has: false };

const NONE: Produced = { has: false };

/** money 币种不受 const/enum 约束时的默认币种. */
const DEFAULT_CURRENCY = "CNY";

export interface ProduceContext {
  resolver: SchemaResolver;
  opts: DefaultsOptions;
  diagnostics: Diagnostic[];
  /** 当前路径上每个 $ref 目标已展开的次数. */
  refDepth: Map<object, number>;
}

export function createProduceContext(schema: JsonSchema, opts: DefaultsOptions): ProduceContext {
  return { resolver: createResolver(schema), opts, diagnostics: [], refDepth: new Map() };
}

/** 校验并补齐选项; 非法时返回诊断. */
export function resolveDefaultsOptions(opts: Partial<DefaultsOptions> | undefined): Result<DefaultsOptions> {
  const merged: DefaultsOptions = { ...DEFAULT_DEFAULTS_OPTIONS };
  for (const [key, value] of Object.entries(opts ?? {})) {
    if (value !== undefined) (merged as unknown as Record<string, unknown>)[key] = value;
  }
  const invalid: Diagnostic[] = [];
  const check = (name: keyof DefaultsOptions, valid: boolean): void => {
    if (!valid) invalid.push(dataDiagnostic("JOTL4018", { name, value: JSON.stringify(merged[name]) ?? "undefined" }));
  };
  check("strategy", ["explicit", "required", "all"].includes(merged.strategy));
  check("arrayItems", ["minItems", "none"].includes(merged.arrayItems));
  check("oneOf", ["first", "firstWithDefault"].includes(merged.oneOf));
  check("maxDepth", Number.isInteger(merged.maxDepth) && merged.maxDepth >= 0);
  return invalid.length > 0 ? fail(invalid) : ok(merged);
}

export function getDefaults(schema: JsonSchema, opts?: Partial<DefaultsOptions> & SubschemaOptions & LocaleOptions): Result<unknown> {
  const { at, locale, ...rest } = opts ?? {};
  return withLocale(locale, () => getDefaultsIn(schema, at, rest));
}

function getDefaultsIn(schema: JsonSchema, at: SubschemaOptions["at"], rest: Partial<DefaultsOptions>): Result<unknown> {
  const options = resolveDefaultsOptions(rest);
  if (options.value === undefined) return fail(options.diagnostics);
  const target = subschemaAt(schema, at);
  if (target === undefined) return fail([dataDiagnostic("JOTL4018", { name: "at", value: JSON.stringify(at) })]);
  const ctx = createProduceContext(schema, options.value);
  const produced = produce(ctx, target, ctx.opts.strategy !== "explicit", true);
  return ok(produced.has ? produced.value : undefined, ctx.diagnostics);
}

export function fillDefaults(
  schema: JsonSchema,
  data: unknown,
  opts?: Partial<DefaultsOptions> & LocaleOptions,
): Result<{ data: unknown; filled: JsonPointer[] }> {
  const { locale, ...rest } = opts ?? {};
  return withLocale(locale, () => fillDefaultsIn(schema, data, rest));
}

function fillDefaultsIn(schema: JsonSchema, data: unknown, opts: Partial<DefaultsOptions>): Result<{ data: unknown; filled: JsonPointer[] }> {
  const options = resolveDefaultsOptions(opts);
  if (options.value === undefined) return fail(options.diagnostics);
  const ctx = createProduceContext(schema, options.value);
  const filled: JsonPointer[] = [];
  if (data === undefined) {
    const produced = produce(ctx, schema, ctx.opts.strategy !== "explicit", true);
    if (produced.has) filled.push("");
    return ok({ data: produced.has ? produced.value : undefined, filled }, ctx.diagnostics);
  }
  const copy = cloneJson(data);
  fillInto(ctx, schema, copy, "", filled);
  return ok({ data: copy, filled }, ctx.diagnostics);
}

/** 在已有数据上补齐缺失字段; 原地修改 value(调用方传入拷贝). */
export function fillInto(ctx: ProduceContext, schema: JsonSchema, value: unknown, pointer: JsonPointer, filled: JsonPointer[]): void {
  const nodes = expandNodes(ctx, schema);
  if (isPlainObject(value)) {
    const required = requiredKeys(nodes);
    const declared = new Set<string>();
    for (const node of nodes) for (const key of Object.keys(node.properties ?? {})) declared.add(key);
    for (const key of declared) {
      const child = propertySchemas(nodes, key)[0];
      if (child === undefined) continue;
      if (!hasOwn(value, key)) {
        const produced = produce(ctx, child, childNeed(ctx, required.has(key), true), false);
        if (produced.has) {
          setOwn(value, key, produced.value);
          filled.push(appendPointer(pointer, key));
        }
      } else {
        fillInto(ctx, child, value[key], appendPointer(pointer, key), filled);
      }
    }
    for (const key of Object.keys(value)) {
      if (declared.has(key)) continue;
      const child = propertySchemas(nodes, key)[0];
      if (child !== undefined) fillInto(ctx, child, value[key], appendPointer(pointer, key), filled);
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const child = itemSchemas(nodes, index)[0];
      if (child !== undefined) fillInto(ctx, child, item, appendPointer(pointer, index), filled);
    });
  }
  const branch = matchBranch(ctx, nodes, value);
  if (branch !== undefined) fillInto(ctx, branch, value, pointer, filled);
}

/** 按值的类型与字段重合度为 anyOf/oneOf 选一个分支; 带标签枚举与无组合关键字时为 undefined. */
export function matchBranch(ctx: ProduceContext, nodes: readonly JsonSchemaObject[], value: unknown): JsonSchema | undefined {
  const branches = unionBranches(nodes);
  if (branches === undefined) return undefined;
  let best: JsonSchema | undefined;
  let bestScore = -1;
  for (const branch of branches) {
    const branchNodes = expandNodes(ctx, branch);
    if (!acceptsType(schemaTypes(branchNodes), value)) continue;
    const allowed = allowedValues(branchNodes);
    if (allowed !== undefined && !allowed.some((v) => jsonEqual(v, value))) continue;
    let score = 0;
    if (isPlainObject(value)) {
      for (const key of Object.keys(value)) if (branchNodes.some((n) => n.properties?.[key] !== undefined)) score++;
    }
    if (score > bestScore) {
      best = branch;
      bestScore = score;
    }
  }
  return best;
}

/** 非带标签枚举的 anyOf/oneOf 分支. */
export function unionBranches(nodes: readonly JsonSchemaObject[]): JsonSchema[] | undefined {
  for (const node of nodes) {
    if (isLabeledEnum(node)) return undefined;
    if (Array.isArray(node.oneOf) && node.oneOf.length > 0) return node.oneOf;
    if (Array.isArray(node.anyOf) && node.anyOf.length > 0) return node.anyOf;
  }
  return undefined;
}

export function requiredKeys(nodes: readonly JsonSchemaObject[]): Set<string> {
  const out = new Set<string>();
  for (const node of nodes) for (const key of node.required ?? []) out.add(key);
  return out;
}

function childNeed(ctx: ProduceContext, required: boolean, parentNeeded: boolean): boolean {
  if (ctx.opts.strategy === "all") return true;
  return ctx.opts.strategy === "required" && required && parentNeeded;
}

/** 展开 $ref 与 allOf, 不受 maxDepth 限制; 用于沿已有数据下行. */
export function expandNodes(ctx: ProduceContext, schema: JsonSchema | undefined): JsonSchemaObject[] {
  const nodes: JsonSchemaObject[] = [];
  const visit = (node: JsonSchema | undefined): void => {
    if (!isSchemaObject(node) || nodes.includes(node)) return;
    nodes.push(node);
    if (typeof node.$ref === "string") visit(resolveOrWarn(ctx, node.$ref, node));
    for (const sub of node.allOf ?? []) visit(sub);
  };
  visit(schema);
  return nodes;
}

function resolveOrWarn(ctx: ProduceContext, ref: string, from: JsonSchemaObject): JsonSchema | undefined {
  const target = ctx.resolver.resolveRef(ref, from);
  if (target === undefined && !ctx.diagnostics.some((d) => d.code === "JOTL4016" && d.message.includes(ref))) {
    ctx.diagnostics.push(dataDiagnostic("JOTL4016", { ref }));
  }
  return target;
}

/**
 * 展开 $ref 与 allOf; 同一个 $ref 目标在当前路径上已展开 maxDepth 次时不再展开.
 * 返回展开节点与本次新增的引用计数, 调用方在子节点处理完后用 release 归还.
 */
function enter(ctx: ProduceContext, schema: JsonSchema): { nodes: JsonSchemaObject[]; release: () => void } {
  const nodes: JsonSchemaObject[] = [];
  const entered: object[] = [];
  const visit = (node: JsonSchema | undefined): void => {
    if (!isSchemaObject(node) || nodes.includes(node)) return;
    nodes.push(node);
    if (typeof node.$ref === "string") {
      const target = resolveOrWarn(ctx, node.$ref, node);
      if (isSchemaObject(target)) {
        const depth = ctx.refDepth.get(target) ?? 0;
        if (depth < ctx.opts.maxDepth) {
          ctx.refDepth.set(target, depth + 1);
          entered.push(target);
          visit(target);
        }
      }
    }
    for (const sub of node.allOf ?? []) visit(sub);
  };
  visit(schema);
  return {
    nodes,
    release: () => {
      for (const target of entered) ctx.refDepth.set(target, (ctx.refDepth.get(target) ?? 1) - 1);
    },
  };
}

/** need 为 true 时节点必须产出值(必填或 all 策略), 否则只产出显式默认值能推出的值. */
export function produce(ctx: ProduceContext, schema: JsonSchema | undefined, need: boolean, isRoot: boolean): Produced {
  if (!isSchemaObject(schema)) return NONE;
  const { nodes, release } = enter(ctx, schema);
  try {
    return produceNodes(ctx, nodes, need, isRoot);
  } finally {
    release();
  }
}

function produceNodes(ctx: ProduceContext, nodes: JsonSchemaObject[], need: boolean, isRoot: boolean): Produced {
  const withDefault = nodes.find((n) => hasOwn(n, "default"));
  if (withDefault) return { has: true, value: cloneJson(withDefault.default) };

  const allowed = allowedValues(nodes);
  if (allowed !== undefined) return need && allowed.length > 0 ? { has: true, value: cloneJson(allowed[0]) } : NONE;

  const branches = unionBranches(nodes);
  if (branches !== undefined) {
    const chosen = chooseBranch(ctx, branches, isRoot);
    const produced = produce(ctx, chosen, need, isRoot);
    if (produced.has || !need) return produced;
  }

  const type = schemaTypes(nodes)[0];
  if (type === "object") return patchDecimal(nodes, produceObject(ctx, nodes, need, isRoot));
  if (type === "array") {
    if (!need) return NONE;
    return { has: true, value: produceItems(ctx, nodes) };
  }
  if (!need) return NONE;
  if (type === "string" && pick(nodes, "contentMediaType") === "application/json") return { has: true, value: jsonTextDefault(ctx, nodes) };
  return zeroValue(nodes);
}

/** JSON 文本的默认值: contentSchema 的默认数据序列化; 无 contentSchema 时为 "{}", 与 Mock 一致. */
function jsonTextDefault(ctx: ProduceContext, nodes: JsonSchemaObject[]): string {
  const content = pick(nodes, "contentSchema");
  if (content === undefined) return "{}";
  // JSON 文本一旦产出就须整体合法, explicit 下也按 required 补齐 contentSchema 的必填字段.
  const inner = ctx.opts.strategy === "explicit" ? { ...ctx, opts: { ...ctx.opts, strategy: "required" as const } } : ctx;
  const produced = produce(inner, content, true, true);
  return JSON.stringify(produced.has ? produced.value : null);
}

/** money/bigint 的 value 零值 "" 与无约束币种 "" 不合法, 换成满足 pattern 与 x-decimalRange 的值; 显式默认值不动. */
function patchDecimal(nodes: JsonSchemaObject[], produced: Produced): Produced {
  const kind = decimalKind(nodes);
  if (kind === undefined || !produced.has || !isPlainObject(produced.value)) return produced;
  const out = produced.value;
  if (typeof out["value"] !== "string" || !DECIMAL_STRING.test(out["value"])) {
    setOwn(out, "value", defaultDecimal(decimalRangeOf(nodes), kind === "bigint" ? 0 : patternDecimals(nodes)));
  }
  if (kind === "money" && out["currency"] === "") setOwn(out, "currency", DEFAULT_CURRENCY);
  return produced;
}

function chooseBranch(ctx: ProduceContext, branches: JsonSchema[], isRoot: boolean): JsonSchema | undefined {
  if (ctx.opts.oneOf === "firstWithDefault") {
    const withValue = branches.find((b) => produce(ctx, b, false, isRoot).has);
    if (withValue !== undefined) return withValue;
  }
  return branches[0];
}

function produceObject(ctx: ProduceContext, nodes: JsonSchemaObject[], need: boolean, isRoot: boolean): Produced {
  const required = requiredKeys(nodes);
  const keys: string[] = [];
  for (const node of nodes) for (const key of Object.keys(node.properties ?? {})) if (!keys.includes(key)) keys.push(key);
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const key of keys) {
    const child = propertySchemas(nodes, key)[0];
    const produced = produce(ctx, child, childNeed(ctx, required.has(key), need), false);
    if (produced.has) {
      setOwn(out, key, produced.value);
      count++;
    }
  }
  // 可选对象因子字段的显式默认值而出现时, 按出现的对象重新产出, 让 required 策略补上它的必填字段.
  if (!need && count > 0 && ctx.opts.strategy === "required") return produceObject(ctx, nodes, true, isRoot);
  if (count > 0 || need || isRoot) return { has: true, value: out };
  return NONE;
}

function produceItems(ctx: ProduceContext, nodes: JsonSchemaObject[]): unknown[] {
  const count = ctx.opts.arrayItems === "minItems" ? (pick(nodes, "minItems") ?? 0) : 0;
  const items: unknown[] = [];
  for (let i = 0; i < count; i++) {
    const child = itemSchemas(nodes, i)[0];
    const produced = produce(ctx, child, true, false);
    if (produced.has) items.push(produced.value);
    else items.push(zeroOf(ctx, child));
  }
  return items;
}

/** 元素无值时的零值; 类型未知时为 null. */
function zeroOf(ctx: ProduceContext, schema: JsonSchema | undefined): unknown {
  const zero = zeroValue(expandNodes(ctx, schema));
  return zero.has ? zero.value : null;
}

export function zeroValue(nodes: readonly JsonSchemaObject[]): Produced {
  const allowed = allowedValues(nodes);
  if (allowed !== undefined) return allowed.length > 0 ? { has: true, value: cloneJson(allowed[0]) } : NONE;
  const valueFormat = pick(nodes, "x-valueFormat");
  switch (schemaTypes(nodes)[0]) {
    case "string":
      // 空串不符合存储格式; 用固定时刻保证结果可重复.
      if (typeof valueFormat === "string") return { has: true, value: String(formatValueFormat(valueFormat, fixedMoment())) };
      return { has: true, value: formatZero(pick(nodes, "format")) };
    case "number":
    case "integer":
      return { has: true, value: pick(nodes, "minimum") ?? 0 };
    case "boolean":
      return { has: true, value: false };
    case "null":
      return { has: true, value: null };
    case "object":
      return { has: true, value: {} };
    case "array":
      return { has: true, value: [] };
    default:
      return NONE;
  }
}

function formatZero(format: string | undefined): string {
  switch (format) {
    case "date":
      return fixedMoment().format("YYYY-MM-DD");
    case "time":
      return fixedMoment().format("HH:mm:ssZ");
    case "date-time":
      return String(formatValueFormat("iso", fixedMoment()));
    default:
      return "";
  }
}
