// 打印: JSON Schema → Jotl v1 规范形源码(定稿 §14); 按编译器口径还原组件与元数据, 无法表达的关键字归入 `schema: {...}`.
import {
  DEFAULT_VALUE_FORMATS,
  type Diagnostic,
  JSON_SCHEMA_DIALECT,
  type JsonPointer,
  type JsonSchema,
  type JsonSchemaObject,
  type Result,
  type SourceSpan,
  appendPointer,
  TIMESTAMP_VALUE_FORMATS,
  VALUE_FORMAT_ALIASES,
  formatPointer,
  isSchemaObject,
  valueFormatComponent,
} from "../../schema/index.js";
import type { Body, Entry, JotlFile, Key, Label, LiteralScalar, Marker, Meta, ObjectValueMember, StringLiteral, ValueNode } from "../ast.js";
import {
  COMPONENT_WIDGETS,
  type ComponentName,
  EXACT_DECIMAL_RE,
  GENERATED_EXTENSION_KEYWORDS,
  MAX_SAFE_INTEGER,
  type MetaTarget,
  ROOT_X_UI_KEYS,
  STRING_COMPONENTS,
  THOUSANDS_DEFAULTS,
  customMetaKey,
  isComponentName,
  isTypeName,
  metaAppliesTo,
} from "../builtins.js";
import { type SyntaxDiagnosticCode, syntaxDiagnostic } from "../diagnostics.js";
import {
  columnsIssue,
  errorMessageIssue,
  fileIdIssue,
  groupsIssue,
  layoutIssue,
  orderIssue,
  printCondition,
  printRules,
  printVariant,
  rulesIssue,
} from "../meta-values.js";
import {
  BUILTIN_WIDGETS,
  CURRENCY_PATTERN,
  type MoneyOptions,
  type RefResolver,
  acceptsWidget,
  bigintSchema,
  decimalPattern,
  defaultWidget,
  extensionConstraintKeys,
  moneyDigits,
  moneySchema,
  specialObjectKind,
} from "../shapes.js";
import { readWidgetDeclaration } from "../compiler.js";
import { checkDefaultValue, deepEqual } from "../value-check.js";
import { MAX_NESTING, parseSource } from "../parser.js";
import { renderFile } from "./render.js";

export interface PrintOptions {
  /** 输入的根不是指向 `$defs` 条目的引用时, 为根生成的类型名, 默认 `Root`; 应为大驼峰. */
  rootName?: string;
  /** 默认导出的类型名(`$defs` 的键, 同 `compile` 结果的 `defaultExport`); 与根不同时该条目标 `<default/>`, 根条目标 `<root/>`; 不是 `$defs` 的键时忽略. */
  defaultExport?: string;
}

type Raw = Record<string, unknown>;
/** 节点所在位置: 顶层类型, 字段(含元组位置与分支), 或类型串中的名字(不能带标签与体). */
type Position = "def" | "field" | "item";
type NullableMode = "merge" | "wrap" | undefined;

interface Printed {
  /** undefined 为省略组件的对象(总是带体). */
  comp: string | undefined;
  metas: Map<string, unknown>;
  body?: Entry[];
  title?: string;
  /** 归入 `schema` 的关键字. */
  leftover: string[];
  /** 组件自带的 `x-ui.widget`(按 value_format 还原的日期组件), 打印时省略. */
  ownWidget?: string;
}

const DEFS_PREFIX = "#/$defs/";
/**
 * 节点的嵌套层数上限. 子节点多数在源码中多一层括号; 对象元素(体并入数组, map 或 jsontext)与联合中提升的对象分支不多占一层,
 * 但其下的字段必然多一层, 所以源码每层括号至多对应两层节点, 超过时打印结果必然超过语法的嵌套上限.
 */
const MAX_NODE_DEPTH = 2 * MAX_NESTING;
/**
 * 节点上数据值(default, examples, x-ui 的各项等)的嵌套层数上限: 值写在元数据的方括号里, x-ui 的条件还原时最多少一层,
 * 超过时打印出的源码必然超过语法的嵌套上限.
 */
const MAX_VALUE_DEPTH = MAX_NESTING + 1;
/** 由打印器递归处理的子 schema 关键字; 其余关键字的值按数据检查嵌套层数. */
const SUBSCHEMA_KEYWORDS: ReadonlySet<string> = new Set(["properties", "items", "prefixItems", "additionalProperties", "anyOf", "oneOf", "allOf", "contentSchema"]);
const DEFAULT_ROOT_NAME = "Root";
const NO_SPAN: SourceSpan = {
  range: { file: "", start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
};
const RESERVED_SCHEMA_KEYWORDS = ["$schema", "$defs"];
const MERGEABLE: ReadonlySet<string> = new Set([...STRING_COMPONENTS, "number", "integer", "boolean"]);
const OUTER_KEYWORDS = ["title", "description", "default", "examples", "deprecated", "x-deprecatedReason", "readOnly", "writeOnly", "$comment"];
const OUTER_X_UI = ["hidden", "decorator", "visibleIf", "variants"];
const FORMAT_COMPONENT: Readonly<Record<string, ComponentName>> = {
  date: "date",
  "date-time": "datetime",
  email: "email",
  color: "color",
  uri: "url",
};
/** 打印出的元数据键顺序. */
const META_ORDER = [
  "multiple", "array_item", "map_item", "union_item", "json_item", "discriminator", "item_meta", "key_meta", "currency", "unit",
  "decimals", "minLength", "maxLength", "pattern", "format", "value_format", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
  "minItems", "maxItems", "uniqueItems", "minProperties", "maxProperties", "closed", "nullable", "description", "default",
  "examples", "deprecated", "readOnly", "writeOnly", "comment", "errorMessage", "widget", "props", "decorator", "hidden", "order",
  "groups", "layout", "columns", "summary", "thousands", "root_if", "node_if", "variants", "rules", "id", "widgets",
];
const FIELD_KEY_RE = /^[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*(?:-[\p{ID_Continue}$\u200C\u200D]+)*$/u;
const VALUE_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function isScalar(value: unknown): value is LiteralScalar {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function jsonTypeOf(value: LiteralScalar): string {
  if (value === null) return "null";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

/** 与编译器的规范化规则 4 一致. */
function typeOfValues(values: readonly LiteralScalar[]): string | string[] {
  const types = [...new Set(values.map(jsonTypeOf))];
  return types.length === 1 ? types[0]! : types;
}

function isUnique(values: readonly unknown[]): boolean {
  return values.every((v, i) => values.indexOf(v) === i);
}

/** 标签不能为空, 不能跨行, 首尾空白会被去掉. */
function isPrintableLabel(text: unknown): text is string {
  return typeof text === "string" && text !== "" && !/[\n\r]/.test(text) && text.replace(/^[\s\uFEFF\u00A0]+|[\s\uFEFF\u00A0]+$/gu, "") === text;
}

function isNonNegInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isValidPattern(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    new RegExp(value, "u");
    return true;
  } catch {
    return false;
  }
}

type JsonKind = "leaf" | "bad" | "node";

function jsonKind(value: unknown, ancestors: ReadonlySet<object>): JsonKind {
  if (value === null || typeof value === "string" || typeof value === "boolean") return "leaf";
  if (typeof value === "number") return Number.isFinite(value) ? "leaf" : "bad";
  if (typeof value !== "object" || ancestors.has(value)) return "bad";
  const proto: unknown = Object.getPrototypeOf(value);
  return Array.isArray(value) || proto === Object.prototype || proto === null ? "node" : "bad";
}

function childrenOf(value: object): [string | number, unknown][] {
  return Array.isArray(value) ? value.map((v, i) => [i, v]) : Object.keys(value).map((k) => [k, (value as Raw)[k]]);
}

/** 第一处不是 JSON 的位置(含循环引用); 迭代遍历, 极深输入不会耗尽调用栈. */
function findNonJson(root: unknown): (string | number)[] | undefined {
  const rootKind = jsonKind(root, new Set());
  if (rootKind !== "node") return rootKind === "bad" ? [] : undefined;
  const ancestors = new Set<object>([root as object]);
  const frames: { value: object; children: [string | number, unknown][]; next: number }[] = [
    { value: root as object, children: childrenOf(root as object), next: 0 },
  ];
  const path: (string | number)[] = [];
  while (frames.length > 0) {
    const frame = frames[frames.length - 1]!;
    if (frame.next >= frame.children.length) {
      frames.pop();
      ancestors.delete(frame.value);
      path.pop();
      continue;
    }
    const [key, child] = frame.children[frame.next++]!;
    const kind = jsonKind(child, ancestors);
    if (kind === "bad") return [...path, key];
    if (kind === "node") {
      path.push(key);
      ancestors.add(child as object);
      frames.push({ value: child as object, children: childrenOf(child as object), next: 0 });
    }
  }
  return undefined;
}

/** JSON 值的嵌套层数是否超过 limit; 迭代遍历, 共享的子对象只在更深时重访. */
function deeperThan(root: unknown, limit: number): boolean {
  const reached = new Map<object, number>();
  const stack: [unknown, number][] = [[root, 0]];
  while (stack.length > 0) {
    const [value, depth] = stack.pop()!;
    if (typeof value !== "object" || value === null) continue;
    if (depth >= limit) return true;
    if ((reached.get(value) ?? -1) >= depth) continue;
    reached.set(value, depth);
    for (const [, child] of childrenOf(value)) stack.push([child, depth + 1]);
  }
  return false;
}

/** 打印出的源码必然超过嵌套上限; 在递归深处抛出, 由 print 转为 JOTL1029. */
class TooDeep {
  constructor(readonly pointer: JsonPointer) {}
}

/** 数据值超过 MAX_VALUE_DEPTH 层时抛出 TooDeep; 先于递归处理该值的检查与转换, 免得极深的值耗尽调用栈. */
function limitValueDepth(value: unknown, pointer: JsonPointer): void {
  if (deeperThan(value, MAX_VALUE_DEPTH)) throw new TooDeep(pointer);
}

/** 枚举的 type: 缺省时编译器按成员值补出; number 可容纳全为整数的成员. */
function typeMatches(type: unknown, inferred: string | string[]): boolean {
  return type === undefined || deepEqual(type, inferred) || (type === "number" && inferred === "integer");
}

/** 合并 allOf 时被引用对象允许出现的关键字. */
const MERGE_KEYWORDS: ReadonlySet<string> = new Set(["type", "properties", "required", "title", "description", "$comment", "examples"]);
const OPEN_ENUM_TYPES: Readonly<Record<string, (v: unknown) => boolean>> = {
  string: (v) => typeof v === "string",
  number: (v) => typeof v === "number",
  integer: (v) => typeof v === "number" && Number.isInteger(v),
  boolean: (v) => typeof v === "boolean",
};

/**
 * `anyOf: [{const}..., {type: T}]` 且各 const 都是 T 时, 校验上等价于 T; 改写为 T, 常量值记入 examples.
 * 只认 anyOf: oneOf 下与 T 重叠的常量反而不合法.
 */
function openEnum(s: Raw): Raw | undefined {
  const list = s.anyOf;
  if (!Array.isArray(list) || list.length < 2 || Object.hasOwn(s, "oneOf") || !list.every(isSchemaObject)) return undefined;
  const open = (list as Raw[]).filter((b) => !Object.hasOwn(b, "const"));
  if (open.length !== 1) return undefined;
  const t = open[0]!;
  const fits = typeof t.type === "string" ? OPEN_ENUM_TYPES[t.type] : undefined;
  if (fits === undefined || Object.keys(t).some((k) => !["type", "title", "description"].includes(k))) return undefined;
  if (s.type !== undefined && s.type !== t.type) return undefined;
  const consts: unknown[] = [];
  for (const b of list as Raw[]) {
    if (b === t) continue;
    if (Object.keys(b).some((k) => !["const", "title", "description"].includes(k)) || !fits(b.const)) return undefined;
    consts.push(b.const);
  }
  const out: Raw = { ...s, type: t.type };
  delete out.anyOf;
  if (!Object.hasOwn(s, "examples")) out.examples = consts;
  return out;
}

/** 原样写出的片段中指向被改名条目的 `$ref` 改为新名. */
function renameRefs(value: unknown, renamed: ReadonlyMap<string, string>): unknown {
  if (renamed.size === 0) return value;
  if (Array.isArray(value)) return value.map((v) => renameRefs(v, renamed));
  if (!isSchemaObject(value)) return value;
  const out: Raw = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "$ref" && typeof v === "string") {
      let ref = v;
      for (const [from, to] of renamed) {
        if (v === from || v.startsWith(`${from}/`)) ref = to + v.slice(from.length);
      }
      out[k] = ref;
    } else out[k] = renameRefs(v, renamed);
  }
  return out;
}

// ---- 合成 AST ----

/** JSON5 单引号字符串. */
export function quote(text: string): string {
  let out = "'";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const code = text.charCodeAt(i);
    if (ch === "\\") out += "\\\\";
    else if (ch === "'") out += "\\'";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (ch === "\v") out += "\\v";
    else if (code < 0x20 || (code >= 0xd800 && code <= 0xdfff && !isPairedSurrogate(text, i))) {
      out += `\\u${code.toString(16).padStart(4, "0")}`;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      out += text.slice(i, i + 2);
      i++;
    } else out += ch;
  }
  return `${out}'`;
}

function isPairedSurrogate(text: string, i: number): boolean {
  const code = text.charCodeAt(i);
  if (code >= 0xd800 && code <= 0xdbff) {
    const next = text.charCodeAt(i + 1);
    return next >= 0xdc00 && next <= 0xdfff;
  }
  return false;
}

function stringLiteral(value: string, raw: string): StringLiteral {
  return { kind: "StringLiteral", value, raw, span: NO_SPAN };
}

function valueNode(value: unknown): ValueNode {
  if (Array.isArray(value)) return { kind: "ArrayValue", items: value.map(valueNode), span: NO_SPAN };
  if (isSchemaObject(value)) return { kind: "ObjectValue", members: members(Object.entries(value)), span: NO_SPAN };
  const scalar = value as LiteralScalar;
  const raw = typeof scalar === "string" ? quote(scalar) : JSON.stringify(scalar);
  return { kind: "LiteralValue", value: scalar, raw, span: NO_SPAN };
}

function members(entries: Iterable<[string, unknown]>): ObjectValueMember[] {
  return [...entries].map(([key, value]) => ({
    key: stringLiteral(key, VALUE_KEY_RE.test(key) ? key : quote(key)),
    value: valueNode(value),
  }));
}

function metaOrder(key: string): number {
  const i = META_ORDER.indexOf(key);
  if (i >= 0) return i;
  return key === "schema" ? META_ORDER.length + 1 : META_ORDER.length;
}

function metaNode(metas: Map<string, unknown>): Meta | undefined {
  if (metas.size === 0) return undefined;
  const sorted = [...metas].sort((a, b) => metaOrder(a[0]) - metaOrder(b[0]));
  return { kind: "Meta", members: members(sorted), span: NO_SPAN };
}

function fieldKey(name: string): Key {
  if (name === "*") return { kind: "Key", form: "star", name, value: name, raw: name, span: NO_SPAN };
  if (/^(0|[1-9]\d*)$/.test(name)) return { kind: "Key", form: "number", name, value: Number(name), raw: name, span: NO_SPAN };
  if (FIELD_KEY_RE.test(name)) return { kind: "Key", form: "identifier", name, value: name, raw: name, span: NO_SPAN };
  return { kind: "Key", form: "string", name, value: name, raw: quote(name), span: NO_SPAN };
}

/** 枚举成员或分支值的键; null 无法表达. */
function valueKey(value: LiteralScalar): Key | undefined {
  if (value === null) return undefined;
  if (typeof value === "boolean") return { kind: "Key", form: "identifier", name: String(value), value, raw: String(value), span: NO_SPAN };
  if (typeof value === "number") {
    const raw = JSON.stringify(value);
    return { kind: "Key", form: "number", name: raw, value, raw, span: NO_SPAN };
  }
  if (FIELD_KEY_RE.test(value) && value !== "true" && value !== "false") {
    return { kind: "Key", form: "identifier", name: value, value, raw: value, span: NO_SPAN };
  }
  return { kind: "Key", form: "string", name: value, value, raw: quote(value), span: NO_SPAN };
}

function label(text: string | undefined): Label | undefined {
  return text === undefined ? undefined : { kind: "Label", text, span: NO_SPAN };
}

function body(entries: Entry[] | undefined): Body | undefined {
  return entries === undefined ? undefined : { kind: "Body", entries, span: NO_SPAN };
}

const COLON = NO_SPAN.range;

/** 由打印结果组成条目; bare 时选填的无元数据 string 写成光秃的键. */
function entryOf(key: Key, printed: Printed, optional: boolean, bare: boolean, markers: Marker[] = []): Entry {
  const isBare = bare && optional && printed.comp === "string" && printed.metas.size === 0 && printed.body === undefined;
  if (isBare) {
    return { kind: "Entry", markers, key, label: label(printed.title), question: undefined, colon: undefined, component: undefined, meta: undefined, body: undefined, span: NO_SPAN };
  }
  return {
    kind: "Entry",
    markers,
    key,
    label: label(printed.title),
    question: optional ? NO_SPAN.range : undefined,
    colon: COLON,
    component: printed.comp === undefined ? undefined : { kind: "Identifier", name: printed.comp, span: NO_SPAN },
    meta: metaNode(printed.metas),
    body: body(printed.body ?? (printed.comp === undefined ? [] : undefined)),
    span: NO_SPAN,
  };
}

function enumMember(value: LiteralScalar, title: string | undefined, description: string | undefined): Entry | undefined {
  const key = valueKey(value);
  if (key === undefined) return undefined;
  const meta = description === undefined ? undefined : metaNode(new Map([["description", description]]));
  return { kind: "Entry", markers: [], key, label: label(title), question: undefined, colon: undefined, component: undefined, meta, body: undefined, span: NO_SPAN };
}

// ---- 打印器 ----

class SchemaPrinter {
  readonly diagnostics: Diagnostic[] = [];
  /** `#/$defs/X` → 打印出的类型名与 schema. */
  readonly refs = new Map<string, { name: string; schema: JsonSchema }>();
  /** 已占用的类型名. */
  readonly used = new Set<string>();
  /** 被改名的 `$defs` 条目: 旧引用 → 新引用; 用于改写原样写出片段中的 `$ref`. */
  readonly renamed = new Map<string, string>();
  /** 联合中的对象分支提升出的顶层类型, 按提升顺序; 按原节点对象去重, 重新打印同一节点时复用名字. */
  readonly promoted: { name: string; schema: JsonSchema; pointer: JsonPointer; title?: string }[] = [];
  private readonly promotedBy = new Map<object, string>();
  /** 根元数据 `widgets` 写回时登记的扩展组件: 组件名 → 底层 schema. */
  readonly extensions = new Map<string, JsonSchemaObject>();
  /** 正在打印的顶层类型名, 提升出的类型以它为前缀. */
  private owner = DEFAULT_ROOT_NAME;
  /** 当前节点外层的节点数, 见 MAX_NODE_DEPTH. */
  private depth = 0;
  private readonly resolve: RefResolver = (ref) => this.refs.get(ref)?.schema;

  constructor(
    private readonly defs: Readonly<Record<string, JsonSchema>>,
    private readonly root: JsonSchema,
  ) {}

  warn(code: SyntaxDiagnosticCode, params: Record<string, string>, pointer: JsonPointer): void {
    this.diagnostics.push(syntaxDiagnostic(code, params, { location: { kind: "pointer", pointer } }));
  }

  /** 失败的尝试要撤销其间产生的诊断与提升, 否则会留下重复诊断与无人引用的类型. */
  private mark(): [number, number] {
    return [this.diagnostics.length, this.promoted.length];
  }

  private rollback([diags, promoted]: [number, number]): void {
    this.diagnostics.length = diags;
    for (const p of this.promoted.splice(promoted)) {
      this.refs.delete(`${DEFS_PREFIX}${p.name}`);
      this.used.delete(p.name);
      this.promotedBy.delete(p.schema as object);
    }
  }

  /** 把联合中的对象分支提升为顶层类型, 返回类型名; 分支无标题时沿用联合节点的 title, 免得选择器只显示类型名. */
  private promote(schema: Raw, pointer: JsonPointer, title: unknown): string {
    const hit = this.promotedBy.get(schema);
    if (hit !== undefined) return hit;
    const name = uniqueName(`${this.owner}Object`, this.used);
    this.used.add(name);
    this.refs.set(`${DEFS_PREFIX}${name}`, { name, schema });
    this.promotedBy.set(schema, name);
    this.promoted.push(typeof title === "string" && !Object.hasOwn(schema, "title") ? { name, schema, pointer, title } : { name, schema, pointer });
    return name;
  }

  /** 打印一个节点; 结构无法还原时整体经 `any[schema: {...}]` 写出. 外层节点超过 MAX_NODE_DEPTH 时抛出 TooDeep, 不再往下递归. */
  node(schema: JsonSchema, pointer: JsonPointer, pos: Position): Printed {
    if (this.depth > MAX_NODE_DEPTH) throw new TooDeep(pointer);
    this.depth++;
    const printed = this.nodeAt(schema, pointer, pos);
    this.depth--;
    return printed;
  }

  private nodeAt(schema: JsonSchema, pointer: JsonPointer, pos: Position): Printed {
    if (typeof schema === "boolean") {
      this.warn("JOTL1033", {}, pointer);
      return { comp: "any", metas: schema ? new Map() : new Map([["schema", { not: {} }]]), leftover: [] };
    }
    const s = schema as Raw;
    const opened = openEnum(s);
    if (opened) return this.nodeAt(opened, pointer, pos);
    const mark = this.mark();
    const type = s.type;
    if (Array.isArray(type) && type.length === 2 && type[1] === "null" && typeof type[0] === "string") {
      const printed = this.plain({ ...s, type: type[0] }, s, pointer, pos, "merge");
      if (printed) return printed;
      this.rollback(mark);
    }
    const anyOf = s.anyOf;
    if (Array.isArray(anyOf) && anyOf.length === 2 && isSchemaObject(anyOf[0]) && deepEqual(anyOf[1], { type: "null" })) {
      const printed = this.wrapped(s, anyOf[0] as Raw, pointer, pos);
      if (printed) return printed;
      this.rollback(mark);
    }
    const printed = this.plain(s, s, pointer, pos, undefined);
    if (printed) return printed;
    this.rollback(mark);
    return this.fallback(s, pointer, pos);
  }

  /** `anyOf: [T, {type: "null"}]`: 外层关键字与内层合并后按可空打印; 内层不能有外层关键字, 归入 schema 的只能来自外层. */
  private wrapped(s: Raw, inner: Raw, pointer: JsonPointer, pos: Position): Printed | undefined {
    if (OUTER_KEYWORDS.some((k) => Object.hasOwn(inner, k))) return undefined;
    if (Object.keys(inner).some((k) => k.startsWith("x-") && !GENERATED_EXTENSION_KEYWORDS.has(k))) return undefined;
    const innerUi = inner["x-ui"];
    const outerUi = s["x-ui"];
    if (innerUi !== undefined && (!isSchemaObject(innerUi) || OUTER_X_UI.some((k) => Object.hasOwn(innerUi, k)))) return undefined;
    if (outerUi !== undefined && (!isSchemaObject(outerUi) || Object.keys(outerUi).some((k) => !OUTER_X_UI.includes(k)))) return undefined;
    const merged: Raw = { ...inner };
    for (const [k, v] of Object.entries(s)) if (k !== "anyOf" && k !== "x-ui") merged[k] = v;
    if (innerUi !== undefined || outerUi !== undefined) merged["x-ui"] = { ...(innerUi as Raw), ...(outerUi as Raw) };
    const printed = this.plain(merged, s, appendPointer(pointer, "anyOf", 0), pos, "wrap");
    if (printed === undefined) return undefined;
    if (printed.leftover.some((k) => !Object.hasOwn(s, k) || k === "x-ui")) return undefined;
    return printed;
  }

  private fallback(s: Raw, pointer: JsonPointer, pos: Position): Printed {
    const rest = new Map(Object.entries(s));
    const out: Printed = { comp: "any", metas: new Map(), leftover: [] };
    if (pos !== "item" && isPrintableLabel(s.title)) {
      out.title = s.title;
      rest.delete("title");
    }
    this.finishLeftover(rest, out, pointer);
    return out;
  }

  private finishLeftover(rest: Map<string, unknown>, out: Printed, pointer: JsonPointer): void {
    for (const keyword of RESERVED_SCHEMA_KEYWORDS) {
      if (!rest.has(keyword)) continue;
      this.warn("JOTL1032", { keyword }, pointer);
      rest.delete(keyword);
    }
    if (rest.size === 0) return;
    for (const [keyword, v] of rest) limitValueDepth(v, appendPointer(pointer, keyword));
    out.leftover = [...rest.keys()];
    out.metas.set("schema", renameRefs(Object.fromEntries(rest), this.renamed));
  }

  /**
   * 按组件还原; 结构无法精确还原时返回 undefined. full 为原节点(校验默认值用);
   * nullable 为 merge / wrap 时要求组件分别可合并 / 不可合并为 `type: [T, "null"]`.
   */
  private plain(s: Raw, full: Raw, pointer: JsonPointer, pos: Position, nullable: NullableMode): Printed | undefined {
    for (const [keyword, v] of Object.entries(s)) {
      if (!SUBSCHEMA_KEYWORDS.has(keyword) && !RESERVED_SCHEMA_KEYWORDS.includes(keyword)) limitValueDepth(v, appendPointer(pointer, keyword));
    }
    const rest = new Map(Object.entries(s));
    const out: Printed = { comp: "any", metas: new Map(), leftover: [] };
    if (pos !== "item" && isPrintableLabel(s.title)) {
      out.title = s.title;
      rest.delete("title");
    }
    if (!this.core(s, rest, out, pointer)) return undefined;
    const target: MetaTarget = out.comp === undefined ? "object" : isComponentName(out.comp) ? out.comp : "ref";
    if (nullable === "merge" && !MERGEABLE.has(target)) return undefined;
    if (nullable === "wrap" && MERGEABLE.has(target)) return undefined;
    if (nullable !== undefined) out.metas.set("nullable", true);
    if (!this.xUi(s, rest, out, target)) {
      // x-ui 整体归入 schema 时, 组件不能再自带 widget.
      if (out.comp === "text") out.comp = "string";
      if (out.comp === "image" || out.comp === "file") out.comp = "url";
    }
    this.common(s, full, rest, out, target);
    this.extension(s, out);
    this.finishLeftover(rest, out, pointer);
    return out;
  }

  // ---- 组件 ----

  private core(s: Raw, rest: Map<string, unknown>, out: Printed, pointer: JsonPointer): boolean {
    if (typeof s.$ref === "string") {
      const target = this.refs.get(s.$ref);
      if (target === undefined) return false;
      out.comp = target.name;
      rest.delete("$ref");
      return true;
    }
    if (s.type === "array" && s.uniqueItems === true && s.items !== undefined && !Object.hasOwn(s, "prefixItems")) {
      if (this.multiple(s, rest, out)) return true;
    }
    const members = this.enumMembers(s);
    if (members) {
      out.comp = "enum";
      out.body = members.entries;
      rest.delete("type");
      rest.delete(members.keyword);
      return true;
    }
    if (Array.isArray(s.oneOf)) {
      const mark = this.mark();
      if (this.discriminated(s, rest, out, pointer)) return true;
      this.rollback(mark);
      return this.unionItem(s, "oneOf", rest, out, pointer);
    }
    if (Array.isArray(s.anyOf)) return this.unionItem(s, "anyOf", rest, out, pointer);
    if (Array.isArray(s.allOf)) {
      const merged = this.mergeAllOf(s);
      if (merged === undefined) return false;
      rest.delete("allOf");
      return this.object(merged, rest, out, pointer);
    }
    switch (s.type) {
      case "string":
        return this.string(s, rest, out, pointer);
      case "number":
      case "integer":
        return this.number(s, rest, out, s.type);
      case "boolean":
        out.comp = "boolean";
        rest.delete("type");
        return true;
      case "object": {
        const special = specialObjectKind(s as never);
        if (special === "money") return this.money(s, rest, out);
        if (special === "bigint") return this.bigint(s, rest, out);
        if (!Object.hasOwn(s, "properties") && isSchemaObject(s.additionalProperties)) return this.map(s, rest, out, pointer);
        return this.object(s, rest, out, pointer);
      }
      case "array":
        return Object.hasOwn(s, "prefixItems") ? this.tuple(s, rest, out, pointer) : this.array(s, rest, out, pointer);
      case undefined:
        return !["const", "enum", "oneOf", "anyOf", "items", "properties", "prefixItems"].some((k) => Object.hasOwn(s, k));
      default:
        return false;
    }
  }

  private multiple(s: Raw, rest: Map<string, unknown>, out: Printed): boolean {
    const items = s.items;
    if (!isSchemaObject(items)) return false;
    const it = items as Raw;
    if (typeof it.$ref === "string" && Object.keys(it).length === 1) {
      const target = this.refs.get(it.$ref);
      if (target === undefined || !isSchemaObject(target.schema) || this.enumMembers(target.schema as Raw) === undefined) return false;
      out.comp = target.name;
    } else {
      const members = this.enumMembers(it);
      if (members === undefined || Object.keys(it).length !== 2) return false;
      out.comp = "enum";
      out.body = members.entries;
    }
    out.metas.set("multiple", true);
    rest.delete("type");
    rest.delete("items");
    rest.delete("uniqueItems");
    this.items(s, rest, out);
    return true;
  }

  /** minItems maxItems. */
  private items(s: Raw, rest: Map<string, unknown>, out: Printed): void {
    const min = s.minItems;
    if (isNonNegInt(min)) {
      out.metas.set("minItems", min);
      rest.delete("minItems");
    }
    if (isNonNegInt(s.maxItems) && (!isNonNegInt(min) || min <= s.maxItems)) {
      out.metas.set("maxItems", s.maxItems);
      rest.delete("maxItems");
    }
  }

  /** 节点为单选枚举时的成员; 与编译器的枚举形态一致. */
  private enumMembers(s: Raw): { entries: Entry[]; keyword: string } | undefined {
    const build = (list: { value: unknown; title?: unknown; description?: unknown }[]): Entry[] | undefined => {
      const out: Entry[] = [];
      for (const m of list) {
        if (!isScalar(m.value) || m.value === null) return undefined;
        const entry = enumMember(m.value, m.title as string | undefined, m.description as string | undefined);
        if (entry === undefined) return undefined;
        out.push(entry);
      }
      const values = list.map((m) => m.value as LiteralScalar);
      return isUnique(values) && typeMatches(s.type, typeOfValues(values)) ? out : undefined;
    };
    const combined = Object.hasOwn(s, "oneOf") || Object.hasOwn(s, "anyOf");
    if (Object.hasOwn(s, "const") && !Object.hasOwn(s, "enum") && !combined) {
      const entries = build([{ value: s.const }]);
      return entries && { entries, keyword: "const" };
    }
    if (Array.isArray(s.enum) && !combined) {
      if (s.enum.length < 2) return undefined;
      const entries = build(s.enum.map((value) => ({ value })));
      return entries && { entries, keyword: "enum" };
    }
    // 成员各不相同, oneOf 与 anyOf 等价.
    const keyword = Object.hasOwn(s, "oneOf") ? "oneOf" : "anyOf";
    const branches = s[keyword];
    if (Array.isArray(branches) && branches.length > 0 && !(Object.hasOwn(s, "oneOf") && Object.hasOwn(s, "anyOf"))) {
      const list: { value: unknown; title?: unknown; description?: unknown }[] = [];
      for (const branch of branches) {
        if (!isSchemaObject(branch) || !Object.hasOwn(branch, "const")) return undefined;
        const b = branch as Raw;
        if (Object.keys(b).some((k) => k !== "const" && k !== "title" && k !== "description")) return undefined;
        if (Object.hasOwn(b, "title") && !isPrintableLabel(b.title)) return undefined;
        if (Object.hasOwn(b, "description") && typeof b.description !== "string") return undefined;
        list.push({ value: b.const, title: b.title, description: b.description });
      }
      const entries = build(list);
      return entries && { entries, keyword };
    }
    return undefined;
  }

  private discriminated(s: Raw, rest: Map<string, unknown>, out: Printed, pointer: JsonPointer): boolean {
    const branches = s.oneOf as unknown[];
    if (branches.length === 0 || !branches.every(isSchemaObject)) return false;
    const first = branches[0] as Raw;
    const disc = Array.isArray(first.required) ? first.required[0] : undefined;
    if (typeof disc !== "string" || disc === "") return false;
    const entries: Entry[] = [];
    const values: LiteralScalar[] = [];
    for (const [i, raw] of branches.entries()) {
      const b = raw as Raw;
      const props = b.properties;
      if (!isSchemaObject(props) || !Array.isArray(b.required) || b.required[0] !== disc) return false;
      const marker = (props as Raw)[disc];
      if (!isSchemaObject(marker) || !isScalar((marker as Raw).const)) return false;
      const value = (marker as Raw).const as LiteralScalar;
      if (!deepEqual(marker, { type: jsonTypeOf(value), const: value })) return false;
      const key = valueKey(value);
      if (key === undefined || values.includes(value)) return false;
      values.push(value);
      const title = isPrintableLabel(b.title) ? b.title : undefined;
      const allOf = b.allOf;
      if (Array.isArray(allOf)) {
        const ref = allOf.length === 1 && isSchemaObject(allOf[0]) ? (allOf[0] as Raw).$ref : undefined;
        const target = typeof ref === "string" ? this.refs.get(ref) : undefined;
        const allowed = ["type", "allOf", "properties", "required", ...(title === undefined ? [] : ["title"])];
        if (
          target === undefined ||
          b.type !== "object" ||
          Object.keys(allOf[0] as Raw).length !== 1 ||
          Object.keys(b).some((k) => !allowed.includes(k)) ||
          Object.keys(props).length !== 1 ||
          b.required.length !== 1 ||
          this.objectFieldsOf(target.schema) === undefined
        ) {
          return false;
        }
        const refBranch: Printed = { comp: target.name, metas: new Map(), leftover: [] };
        if (title !== undefined) refBranch.title = title;
        entries.push(entryOf(key, refBranch, false, false));
        continue;
      }
      if (b.type !== "object") return false;
      const inner: Raw = { ...b };
      const innerProps = Object.fromEntries(Object.entries(props).filter(([k]) => k !== disc));
      if (Object.keys(innerProps).length > 0) inner.properties = innerProps;
      else delete inner.properties;
      const required = (b.required as unknown[]).slice(1);
      if (required.length > 0) inner.required = required;
      else delete inner.required;
      const printed = this.node(inner, appendPointer(pointer, "oneOf", i), "field");
      if (printed.comp !== undefined || printed.metas.has("nullable") || printed.leftover.length > 0) return false;
      entries.push(entryOf(key, printed, false, false));
    }
    out.comp = "union";
    out.metas.set("discriminator", disc);
    out.body = entries;
    rest.delete("oneOf");
    return true;
  }

  /**
   * 按 JSON 类型区分的联合(编译为 anyOf). oneOf 只在各分支 JSON 类型都可判定且互斥时才与 anyOf 等价;
   * 对象分支提升为顶层类型后以名字写入.
   */
  private unionItem(s: Raw, keyword: "anyOf" | "oneOf", rest: Map<string, unknown>, out: Printed, pointer: JsonPointer): boolean {
    const list = s[keyword] as unknown[];
    if (list.length < 2 || !list.every(isSchemaObject)) return false;
    const names: string[] = [];
    const itemMeta: Record<string, unknown> = {};
    const kinds = new Map<string, number>();
    for (const [i, m] of list.entries()) {
      const branchPointer = appendPointer(pointer, keyword, i);
      let kind = this.jsonKind(m as Raw);
      if (keyword === "oneOf" && (kind === "money" || kind === "bigint")) kind = "object";
      if (keyword === "oneOf" && kind === undefined) return false;
      if (kind !== undefined) kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
      const printed = this.node(m as JsonSchema, branchPointer, "item");
      if (printed.comp === undefined && kind === "object" && !printed.metas.has("nullable")) {
        names.push(this.promote(m as Raw, branchPointer, s.title));
        continue;
      }
      if (printed.comp === undefined || printed.comp === "enum" || printed.body !== undefined || names.includes(printed.comp)) return false;
      names.push(printed.comp);
      if (printed.metas.size > 0) itemMeta[printed.comp] = Object.fromEntries(printed.metas);
    }
    if ([...kinds].some(([kind, count]) => count > 1 || kind === "any")) return false;
    if (new Set(names).size !== names.length) return false;
    out.comp = "union";
    out.metas.set("union_item", names.join("|"));
    if (Object.keys(itemMeta).length > 0) out.metas.set("item_meta", itemMeta);
    rest.delete(keyword);
    return true;
  }

  /**
   * `allOf` 全是指向普通对象的 `$ref` 时合并为一个对象: 字段与 required 取并集.
   * 被引用的对象只能有字段, required 与注解; 带 additionalProperties 等约束时合并会改变校验语义, 放弃.
   */
  private mergeAllOf(s: Raw): Raw | undefined {
    if (s.type !== undefined && s.type !== "object") return undefined;
    if (Object.hasOwn(s, "additionalProperties") || Object.hasOwn(s, "patternProperties")) return undefined;
    const parts: Raw[] = [s];
    for (const item of s.allOf as unknown[]) {
      if (!isSchemaObject(item) || Object.keys(item).length !== 1 || typeof (item as Raw).$ref !== "string") return undefined;
      const target = this.refs.get((item as Raw).$ref as string)?.schema;
      if (!isSchemaObject(target)) return undefined;
      const t = target as Raw;
      if (t.type !== "object" || Object.keys(t).some((k) => !MERGE_KEYWORDS.has(k))) return undefined;
      parts.push(t);
    }
    const properties: Raw = {};
    const required = new Set<string>();
    for (const part of parts) {
      if (Object.hasOwn(part, "properties")) {
        if (!isSchemaObject(part.properties)) return undefined;
        for (const [k, v] of Object.entries(part.properties)) {
          if (Object.hasOwn(properties, k)) return undefined;
          properties[k] = v;
        }
      }
      if (Object.hasOwn(part, "required")) {
        if (!Array.isArray(part.required)) return undefined;
        for (const k of part.required) required.add(k as string);
      }
    }
    if ([...required].some((k) => !Object.hasOwn(properties, k))) return undefined;
    const merged: Raw = { ...s, type: "object", properties };
    delete merged.allOf;
    delete merged.required;
    const req = Object.keys(properties).filter((k) => required.has(k));
    if (req.length > 0) merged.required = req;
    return merged;
  }

  /** 沿 `$ref` 找到第一个不是引用的节点; 引用找不到, 成环或目标不是对象时为 undefined. 迭代跟随, 很长的引用链不会耗尽调用栈. */
  private deref(schema: JsonSchema | undefined): Raw | undefined {
    const visiting = new Set<string>();
    let s = schema;
    while (isSchemaObject(s) && typeof (s as Raw).$ref === "string") {
      const ref = (s as Raw).$ref as string;
      if (visiting.has(ref)) return undefined;
      visiting.add(ref);
      s = this.refs.get(ref)?.schema;
    }
    return isSchemaObject(s) ? (s as Raw) : undefined;
  }

  /** 与编译器的按 JSON 类型区分规则一致. */
  private jsonKind(schema: Raw): string | undefined {
    const s = this.deref(schema);
    if (s === undefined) return undefined;
    const special = specialObjectKind(s as never);
    if (special) return special;
    if (Object.keys(s).length === 0) return "any";
    const type = Array.isArray(s.type) ? s.type.find((t) => t !== "null") : s.type;
    if (type === "integer") return "number";
    return typeof type === "string" ? type : undefined;
  }

  private string(s: Raw, rest: Map<string, unknown>, out: Printed, pointer: JsonPointer): boolean {
    rest.delete("type");
    const xUi = isSchemaObject(s["x-ui"]) ? (s["x-ui"] as Raw) : {};
    const widget = xUi.widget;
    if (s.contentMediaType === "application/json") {
      out.comp = "jsontext";
      rest.delete("contentMediaType");
      if (Object.hasOwn(s, "contentSchema")) {
        if (!isSchemaObject(s.contentSchema)) return false;
        const printed = this.node(s.contentSchema, appendPointer(pointer, "contentSchema"), "item");
        if (printed.comp === undefined) {
          out.body = printed.body ?? [];
          if (printed.metas.size > 0) out.metas.set("item_meta", Object.fromEntries(printed.metas));
        } else {
          if (printed.body !== undefined || printed.comp === "enum") return false;
          out.metas.set("json_item", printed.comp);
          if (printed.metas.size > 0) out.metas.set("item_meta", Object.fromEntries(printed.metas));
        }
        rest.delete("contentSchema");
      }
    } else if (s.contentMediaType === "text/html") {
      out.comp = "richtext";
      rest.delete("contentMediaType");
    } else if (typeof s.format === "string" && Object.hasOwn(FORMAT_COMPONENT, s.format)) {
      out.comp = FORMAT_COMPONENT[s.format]!;
      if (s.format === "uri" && (widget === "image" || widget === "file")) out.comp = widget;
      rest.delete("format");
      const vf = s["x-valueFormat"];
      if (s.format === "date-time" && typeof vf === "string" && VALUE_FORMAT_ALIASES.includes(vf)) {
        if (vf !== "iso") out.metas.set("value_format", vf);
        rest.delete("x-valueFormat");
      }
    } else if (this.valueFormat(s, rest, out, "string")) {
      // 按 value_format 还原的日期组件.
    } else {
      out.comp = widget === "textarea" ? "text" : "string";
      if (typeof s.format === "string" && s.format !== "") {
        out.metas.set("format", s.format);
        rest.delete("format");
      }
    }
    const min = s.minLength;
    if (isNonNegInt(min)) {
      out.metas.set("minLength", min);
      rest.delete("minLength");
    }
    if (isNonNegInt(s.maxLength) && (!isNonNegInt(min) || min <= s.maxLength)) {
      out.metas.set("maxLength", s.maxLength);
      rest.delete("maxLength");
    }
    if (isValidPattern(s.pattern)) {
      out.metas.set("pattern", s.pattern);
      rest.delete("pattern");
    }
    return true;
  }

  /** 带 `x-valueFormat` 而无 format 的字符串或整数 → 日期组件(方案 V5); 组件取 `x-ui.widget`, 否则按格式内容推断. */
  private valueFormat(s: Raw, rest: Map<string, unknown>, out: Printed, type: "string" | "integer"): boolean {
    const vf = s["x-valueFormat"];
    if (typeof vf !== "string" || vf === "" || Object.hasOwn(s, "format")) return false;
    const timestamp = TIMESTAMP_VALUE_FORMATS.includes(vf);
    if (timestamp !== (type === "integer")) return false;
    const widget = isSchemaObject(s["x-ui"]) ? (s["x-ui"] as Raw).widget : undefined;
    const comp = widget === "date" || widget === "time" || widget === "datetime" ? widget : valueFormatComponent(vf);
    if (comp === "time" && timestamp) return false;
    out.comp = comp;
    out.ownWidget = comp;
    rest.delete("type");
    rest.delete("x-valueFormat");
    if (timestamp && s.minimum === -MAX_SAFE_INTEGER) rest.delete("minimum");
    if (timestamp && s.maximum === MAX_SAFE_INTEGER) rest.delete("maximum");
    if (vf !== DEFAULT_VALUE_FORMATS[comp]) out.metas.set("value_format", vf);
    return true;
  }

  private number(s: Raw, rest: Map<string, unknown>, out: Printed, type: "number" | "integer"): boolean {
    if (type === "integer" && this.valueFormat(s, rest, out, "integer")) return true;
    out.comp = type;
    if (typeof s.minimum === "number" && typeof s.maximum === "number" && s.minimum > s.maximum) return false;
    rest.delete("type");
    for (const key of ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"]) {
      const v = s[key];
      if (typeof v !== "number") continue;
      rest.delete(key);
      if (type === "integer" && ((key === "minimum" && v === -MAX_SAFE_INTEGER) || (key === "maximum" && v === MAX_SAFE_INTEGER))) continue;
      out.metas.set(key, v);
    }
    if (type === "number" && isNonNegInt(s["x-decimals"])) {
      out.metas.set("decimals", s["x-decimals"]);
      rest.delete("x-decimals");
    }
    return true;
  }

  private decimalRange(s: Raw, rest: Map<string, unknown>, out: Printed): boolean {
    if (!Object.hasOwn(s, "x-decimalRange")) return true;
    const range = s["x-decimalRange"];
    if (!isSchemaObject(range) || Object.keys(range).length === 0) return true;
    const entries = Object.entries(range);
    if (!entries.every(([k, v]) => ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"].includes(k) && typeof v === "string" && EXACT_DECIMAL_RE.test(v))) {
      return true;
    }
    for (const [k, v] of entries) out.metas.set(k, v);
    rest.delete("x-decimalRange");
    return true;
  }

  private takeCore(s: Raw, rest: Map<string, unknown>, expected: Raw): boolean {
    for (const key of Object.keys(expected)) {
      if (!deepEqual(s[key], expected[key])) return false;
    }
    for (const key of Object.keys(expected)) rest.delete(key);
    return true;
  }

  private money(s: Raw, rest: Map<string, unknown>, out: Printed): boolean {
    const props = s.properties as Raw;
    const options: MoneyOptions = {};
    const choice = (v: unknown, fallback: Raw): string | string[] | undefined | false => {
      if (!isSchemaObject(v)) return false;
      if (deepEqual(v, fallback)) return undefined;
      const r = v as Raw;
      if (Object.keys(r).length === 2 && r.type === "string" && typeof r.const === "string") return r.const;
      if (Object.keys(r).length === 2 && r.type === "string" && Array.isArray(r.enum) && r.enum.length > 0 && r.enum.every((x) => typeof x === "string")) {
        return r.enum as string[];
      }
      return false;
    };
    const currency = choice(props.currency, { type: "string", pattern: CURRENCY_PATTERN });
    const unit = choice(props.unit, { type: "string" });
    if (currency === false || unit === false) return false;
    if (currency !== undefined) options.currency = currency;
    if (unit !== undefined) options.unit = unit;
    const value = props.value;
    const pattern = isSchemaObject(value) ? (value as Raw).pattern : undefined;
    if (pattern !== decimalPattern(moneyDigits(options))) {
      const fixed = typeof pattern === "string" ? /^\^-\?\\d\+(?:\\\.\\d\{(\d+)\})?\$$/.exec(pattern) : null;
      if (!fixed) return false;
      options.decimals = fixed[1] === undefined ? 0 : Number(fixed[1]);
    }
    if (!this.takeCore(s, rest, moneySchema(options) as Raw)) return false;
    out.comp = "money";
    if (options.currency !== undefined) out.metas.set("currency", options.currency);
    if (options.unit !== undefined) out.metas.set("unit", options.unit);
    if (options.decimals !== undefined) out.metas.set("decimals", options.decimals);
    return this.decimalRange(s, rest, out);
  }

  private bigint(s: Raw, rest: Map<string, unknown>, out: Printed): boolean {
    if (!this.takeCore(s, rest, bigintSchema() as Raw)) return false;
    out.comp = "bigint";
    return this.decimalRange(s, rest, out);
  }

  /** 对象体: 字段, 必填与 closed; 字段或 required 无法还原时返回 false. */
  private object(s: Raw, rest: Map<string, unknown>, out: Printed, pointer: JsonPointer): boolean {
    const fields: Entry[] = [];
    const props = s.properties;
    let keys: string[] = [];
    if (Object.hasOwn(s, "properties")) {
      if (!isSchemaObject(props)) return false;
      keys = Object.keys(props);
    }
    let required = new Set<string>();
    if (Object.hasOwn(s, "required")) {
      const r = s.required;
      if (!Array.isArray(r) || r.length === 0 || !r.every((k) => typeof k === "string" && keys.includes(k))) return false;
      if (!deepEqual(keys.filter((k) => r.includes(k)), r)) return false;
      required = new Set(r as string[]);
    }
    for (const key of keys) {
      const printed = this.node((props as Raw)[key] as JsonSchema, appendPointer(pointer, "properties", key), "field");
      fields.push(entryOf(fieldKey(key), printed, !required.has(key), true));
    }
    out.comp = undefined;
    out.body = fields;
    rest.delete("type");
    rest.delete("properties");
    rest.delete("required");
    if (s.additionalProperties === false) {
      out.metas.set("closed", true);
      rest.delete("additionalProperties");
    }
    this.propertiesCount(s, rest, out);
    return true;
  }

  private propertiesCount(s: Raw, rest: Map<string, unknown>, out: Printed): void {
    const min = s.minProperties;
    const max = s.maxProperties;
    if (isNonNegInt(min) && (!isNonNegInt(max) || min <= max)) {
      out.metas.set("minProperties", min);
      rest.delete("minProperties");
    }
    if (isNonNegInt(max) && (!isNonNegInt(min) || min <= max)) {
      out.metas.set("maxProperties", max);
      rest.delete("maxProperties");
    }
  }

  /** 内部类型: 对象体(元数据入 item_meta)或类型串名字; 返回 false 表示无法还原. */
  private inner(schema: JsonSchema, pointer: JsonPointer, out: Printed, typeKey: "array_item" | "map_item"): boolean {
    const printed = this.node(schema, pointer, "item");
    if (printed.comp === undefined) {
      if (printed.body !== undefined && printed.body.length > 0) out.body = printed.body;
    } else {
      if (printed.body !== undefined || printed.comp === "enum") return false;
      out.metas.set(typeKey, printed.comp);
    }
    if (printed.metas.size > 0) out.metas.set("item_meta", Object.fromEntries(printed.metas));
    return true;
  }

  private array(s: Raw, rest: Map<string, unknown>, out: Printed, pointer: JsonPointer): boolean {
    if (!isSchemaObject(s.items)) return false;
    out.comp = "array";
    if (!this.inner(s.items, appendPointer(pointer, "items"), out, "array_item")) return false;
    rest.delete("type");
    rest.delete("items");
    this.items(s, rest, out);
    if (typeof s.uniqueItems === "boolean") {
      out.metas.set("uniqueItems", s.uniqueItems);
      rest.delete("uniqueItems");
    }
    return true;
  }

  private tuple(s: Raw, rest: Map<string, unknown>, out: Printed, pointer: JsonPointer): boolean {
    const prefix = s.prefixItems;
    if (!Array.isArray(prefix) || !prefix.every(isSchemaObject)) return false;
    if (s.items !== false && !isSchemaObject(s.items)) return false;
    const min = s.minItems;
    const n = prefix.length;
    let required = 0;
    if (isNonNegInt(min) && min > 0) {
      rest.delete("minItems");
      if (min <= n) required = min;
      else {
        required = n;
        out.metas.set("minItems", min);
      }
    }
    const entries = prefix.map((p, i) =>
      entryOf(fieldKey(String(i)), this.node(p as JsonSchema, appendPointer(pointer, "prefixItems", i), "field"), i >= required, true),
    );
    if (isSchemaObject(s.items)) {
      entries.push(entryOf(fieldKey("*"), this.node(s.items, appendPointer(pointer, "items"), "field"), false, false));
    }
    out.comp = "array";
    out.metas.set("array_item", "tuple");
    out.body = entries;
    rest.delete("type");
    rest.delete("prefixItems");
    rest.delete("items");
    if (isNonNegInt(s.maxItems)) {
      out.metas.set("maxItems", s.maxItems);
      rest.delete("maxItems");
    }
    if (typeof s.uniqueItems === "boolean") {
      out.metas.set("uniqueItems", s.uniqueItems);
      rest.delete("uniqueItems");
    }
    return true;
  }

  private map(s: Raw, rest: Map<string, unknown>, out: Printed, pointer: JsonPointer): boolean {
    out.comp = "map";
    if (!this.inner(s.additionalProperties as JsonSchema, appendPointer(pointer, "additionalProperties"), out, "map_item")) return false;
    rest.delete("type");
    rest.delete("additionalProperties");
    const names = s.propertyNames;
    if (isSchemaObject(names) && (names as Raw).type === "string") {
      const n = names as Raw;
      const keyMeta: Record<string, unknown> = {};
      const ok = Object.keys(n).every((k) => {
        if (k === "type") return true;
        if (((k === "minLength" || k === "maxLength") && isNonNegInt(n[k])) || (k === "pattern" && isValidPattern(n[k]))) {
          keyMeta[k] = n[k];
          return true;
        }
        return false;
      });
      if (ok) {
        out.metas.set("key_meta", keyMeta);
        rest.delete("propertyNames");
      }
    }
    this.propertiesCount(s, rest, out);
    return true;
  }

  // ---- x-ui 与通用元数据 ----

  /** 对象(或指向对象的引用)的字段名. */
  private objectFieldsOf(schema: JsonSchema | undefined): string[] | undefined {
    const s = this.deref(schema);
    if (s === undefined) return undefined;
    if (s.type !== "object" || specialObjectKind(s as never)) return undefined;
    if (!Object.hasOwn(s, "properties") && isSchemaObject(s.additionalProperties)) return undefined;
    return isSchemaObject(s.properties) ? Object.keys(s.properties) : [];
  }

  /** summary 适用的字段名: 对象本身, 对象元素的数组, 对象值的 map, 或引用. */
  private summaryFields(s: Raw, target: MetaTarget): string[] | undefined {
    if (target === "array") return this.objectFieldsOf(s.items as JsonSchema);
    if (target === "map") return this.objectFieldsOf(s.additionalProperties as JsonSchema);
    return this.objectFieldsOf(s as JsonSchema);
  }

  /** x-ui 能全部用元数据写出时写入并返回 true; 否则整个 x-ui 留给 schema. */
  private xUi(s: Raw, rest: Map<string, unknown>, out: Printed, target: MetaTarget): boolean {
    if (!Object.hasOwn(s, "x-ui")) return true;
    const x = s["x-ui"];
    if (!isSchemaObject(x)) return false;
    const metas = new Map<string, unknown>();
    const xr = x as Raw;
    const fields = target === "object" || target === "ref" ? this.objectFieldsOf(s as JsonSchema) : undefined;
    // 形态按编译出的核心判断: any 编译为 {}.
    const shape = (target === "any" ? {} : s) as never;
    for (const [key, v] of Object.entries(xr)) {
      switch (key) {
        case "widget": {
          if (typeof v !== "string" || v === "") return false;
          if (target === "ref") {
            metas.set("widget", v);
            break;
          }
          const own = isComponentName(target) ? COMPONENT_WIDGETS[target] : undefined;
          if (v === own || v === out.ownWidget) break;
          if (v === defaultWidget(shape, this.resolve)) return false;
          if (BUILTIN_WIDGETS.has(v) && !acceptsWidget(shape, v, this.resolve)) return false;
          metas.set("widget", v);
          break;
        }
        case "props":
          if (!isSchemaObject(v)) return false;
          metas.set("props", v);
          break;
        case "decorator":
          if (v !== false && (typeof v !== "string" || v === "")) return false;
          metas.set("decorator", v);
          break;
        case "hidden":
          if (typeof v !== "boolean") return false;
          metas.set("hidden", v);
          break;
        case "order":
          if (!metaAppliesTo("order", target) || orderIssue(v, fields)) return false;
          metas.set("order", v);
          break;
        case "groups":
          if (!metaAppliesTo("groups", target) || groupsIssue(v, fields)) return false;
          metas.set("groups", v);
          break;
        case "layout":
          if (!metaAppliesTo("layout", target) || layoutIssue(v)) return false;
          metas.set("layout", v);
          break;
        case "columns":
          if (!metaAppliesTo("columns", target) || columnsIssue(v) || xr.layout !== "grid") return false;
          metas.set("columns", v);
          break;
        case "summary": {
          if (!metaAppliesTo("summary", target) || typeof v !== "string" || v === "") return false;
          const known = this.summaryFields(s, target);
          if (known !== undefined && !known.includes(v)) return false;
          if (target === "ref" && out.metas.has("multiple")) return false;
          metas.set("summary", v);
          break;
        }
        case "thousands":
          if (!metaAppliesTo("thousands", target) || typeof v !== "boolean" || v === THOUSANDS_DEFAULTS[target as ComponentName]) return false;
          metas.set("thousands", v);
          break;
        case "visibleIf": {
          const printed = printCondition(v);
          if (printed === undefined) return false;
          metas.set(printed.key, printed.value);
          break;
        }
        case "variants": {
          if (!isSchemaObject(v) || Object.keys(v).length === 0) return false;
          const outV: Record<string, unknown> = {};
          for (const [scene, value] of Object.entries(v)) {
            const printed = printVariant(scene, value, fields);
            if (printed === undefined) return false;
            outV[scene] = printed;
          }
          metas.set("variants", outV);
          break;
        }
        default:
          return false;
      }
    }
    for (const [k, v] of metas) out.metas.set(k, v);
    rest.delete("x-ui");
    return true;
  }

  private common(s: Raw, full: Raw, rest: Map<string, unknown>, out: Printed, target: MetaTarget): void {
    const allowed = (key: string) => metaAppliesTo(key, target);
    if (typeof s.description === "string") {
      out.metas.set("description", s.description);
      rest.delete("description");
    }
    if (Object.hasOwn(s, "default") && checkDefaultValue(full as JsonSchema, s.default, this.defs, this.root) === undefined) {
      out.metas.set("default", s.default);
      rest.delete("default");
    }
    if (Array.isArray(s.examples) && allowed("examples")) {
      out.metas.set("examples", s.examples);
      rest.delete("examples");
    }
    if (s.deprecated === true) {
      const reason = s["x-deprecatedReason"];
      rest.delete("deprecated");
      if (typeof reason === "string" && reason !== "") {
        out.metas.set("deprecated", reason);
        rest.delete("x-deprecatedReason");
      } else {
        out.metas.set("deprecated", true);
      }
    }
    for (const key of ["readOnly", "writeOnly"]) {
      if (typeof s[key] !== "boolean" || !allowed(key)) continue;
      out.metas.set(key, s[key]);
      rest.delete(key);
    }
    if (typeof s.$comment === "string" && allowed("comment")) {
      out.metas.set("comment", s.$comment);
      rest.delete("$comment");
    }
    if (Object.hasOwn(s, "errorMessage") && allowed("errorMessage") && errorMessageIssue(s.errorMessage) === undefined) {
      out.metas.set("errorMessage", s.errorMessage);
      rest.delete("errorMessage");
    }
    for (const key of [...rest.keys()]) {
      if (GENERATED_EXTENSION_KEYWORDS.has(key)) continue;
      const meta = customMetaKey(key);
      if (meta === undefined) continue;
      out.metas.set(meta, rest.get(key));
      rest.delete(key);
    }
  }

  /**
   * 底层为 `{type: integer}` 的扩展组件编译时不补安全整数上下界, 写成 `integer[widget: ...]` 却会补上;
   * 缺少上界或下界时改写为该扩展组件, 输入中的上下界原样写出.
   */
  private extension(s: Raw, out: Printed): void {
    const widget = out.metas.get("widget");
    if (out.comp !== "integer" || typeof widget !== "string") return;
    const base = this.extensions.get(widget);
    if (base === undefined || !deepEqual(base, { type: "integer" })) return;
    if (typeof s.minimum === "number" && typeof s.maximum === "number") return;
    const allowed = extensionConstraintKeys(base);
    if ([...out.metas.keys()].some((k) => k !== "widget" && !metaAppliesTo(k, "ext") && !allowed.includes(k))) return;
    out.comp = widget;
    out.metas.delete("widget");
    for (const key of ["minimum", "maximum"]) if (typeof s[key] === "number") out.metas.set(key, s[key]);
  }

  /** 顶层类型条目. */
  declaration(name: string, schema: JsonSchema, pointer: JsonPointer, extra: Map<string, unknown>, markers: Marker[]): Entry {
    this.owner = name;
    const printed = this.node(schema, pointer, "def");
    for (const [k, v] of extra) printed.metas.set(k, v);
    return entryOf({ kind: "Key", form: "identifier", name, value: name, raw: name, span: NO_SPAN }, printed, false, false, markers);
  }
}

/** 不合法的类型名改为大驼峰: 去掉非字母数字, 各段首字母大写, 数字开头时加 `T`. */
function sanitizeTypeName(name: string, used: ReadonlySet<string>): string {
  const parts = name.split(/[^A-Za-z0-9]+/).filter((p) => p !== "");
  let base = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  if (!/^[A-Z]/.test(base)) base = `T${base}`;
  return uniqueName(base, used);
}

function uniqueName(base: string, used: ReadonlySet<string>): string {
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

/**
 * 根 `x-ui.widgets` 能写回根元数据 `widgets` 时为 true: 每项为编译器认可的模块声明 `{ base?, module, export? }`;
 * 写回后大驼峰名登记为扩展组件, 所以不能与类型名重名.
 */
function widgetModulesValid(widgets: unknown, defs: Readonly<Record<string, JsonSchema>>): boolean {
  if (!isSchemaObject(widgets)) return false;
  return Object.entries(widgets).every(
    ([name, v]) =>
      name !== "" && !Object.hasOwn(defs, name) && isSchemaObject(v) && Object.hasOwn(v, "module") && !("issue" in readWidgetDeclaration(name, v)),
  );
}

function failWith(code: SyntaxDiagnosticCode, params: Record<string, string>, pointer: JsonPointer = ""): Result<string> {
  return { value: undefined, diagnostics: [syntaxDiagnostic(code, params, { location: { kind: "pointer", pointer } })] };
}

/**
 * 把 JSON Schema 2020-12 打印为 Jotl v1 源码; 输出再经 `compile` 得到与输入深度相等的 schema(输入为编译器的规范形时).
 * 根为指向 `$defs` 条目的 `$ref` 时该条目为根(不是第一条时标 `<root/>`); 根为内联 schema 时生成名为 rootName 的第一条类型.
 * options.defaultExport 与根不同时写 `<default/>` 并给根条目补 `<root/>`, 使编译结果的 defaultExport 与之一致.
 * 根 `$id`, `x-ui.rules` 与 `x-ui.widgets` 写为根条目的 `id` `rules` `widgets`; 无法表达且无法经 `schema` 保留的内容报 warning.
 */
export function print(schema: JsonSchema, options: PrintOptions = {}): Result<string> {
  const invalid = findNonJson(schema);
  if (invalid) return failWith("JOTL1031", { path: formatPointer(invalid) }, formatPointer(invalid));
  if (typeof schema !== "boolean" && !isSchemaObject(schema)) return failWith("JOTL1030", {});
  const rootName = options.rootName ?? DEFAULT_ROOT_NAME;
  if (!isTypeName(rootName)) return failWith("JOTL1035", { name: rootName });
  // 打印与排版按节点递归: 节点层数与数据值的层数一旦注定超过嵌套上限就中止, 免得极深的输入耗尽调用栈.
  try {
    return printDocument(schema, rootName, options);
  } catch (e) {
    if (e instanceof TooDeep) return failWith("JOTL1029", { max: String(MAX_NESTING) }, e.pointer);
    throw e;
  }
}

function printDocument(schema: JsonSchema, rootName: string, options: PrintOptions): Result<string> {
  const root: Raw = typeof schema === "boolean" ? {} : (schema as Raw);
  const rawDefs = root.$defs;
  const defs: Record<string, JsonSchema> = isSchemaObject(rawDefs) ? (rawDefs as Record<string, JsonSchema>) : {};
  const printer = new SchemaPrinter(defs, schema);
  if (Object.hasOwn(root, "$defs") && !isSchemaObject(rawDefs)) printer.warn("JOTL1032", { keyword: "$defs" }, "");
  if (Object.hasOwn(root, "$schema") && root.$schema !== JSON_SCHEMA_DIALECT) printer.warn("JOTL1032", { keyword: "$schema" }, "");

  const rootMetas = new Map<string, unknown>();
  if (Object.hasOwn(root, "$id")) {
    if (fileIdIssue(root.$id) === undefined) rootMetas.set("id", root.$id);
    else printer.warn("JOTL1032", { keyword: "$id" }, "");
  }
  if (Object.hasOwn(root, "x-ui")) {
    const xUi = root["x-ui"];
    const ok = isSchemaObject(xUi) && Object.keys(xUi).every((k) => ROOT_X_UI_KEYS.includes(k)) && (xUi as Raw).version === 1;
    if (ok && Object.hasOwn(xUi, "rules")) {
      const rules = (xUi as Raw).rules;
      if (rulesIssue(rules) === undefined) {
        limitValueDepth(rules, "/x-ui/rules");
        rootMetas.set("rules", printRules(rules));
      } else {
        printer.warn("JOTL1032", { keyword: "x-ui" }, "");
      }
    }
    if (ok && Object.hasOwn(xUi, "widgets")) {
      const widgets = (xUi as Raw).widgets;
      limitValueDepth(widgets, "/x-ui/widgets");
      if (widgetModulesValid(widgets, defs)) {
        rootMetas.set("widgets", widgets);
        for (const [name, v] of Object.entries(widgets as Raw)) {
          const r = readWidgetDeclaration(name, v);
          if (isTypeName(name) && "declaration" in r) printer.extensions.set(name, r.declaration.schema);
        }
      } else {
        printer.warn("JOTL1032", { keyword: "x-ui" }, "");
      }
    }
    if (!ok) {
      printer.warn("JOTL1032", { keyword: "x-ui" }, "");
    }
  }

  const used = printer.used;
  for (const name of Object.keys(defs)) if (isTypeName(name)) used.add(name);
  const defNames = new Map<string, string>();
  for (const name of Object.keys(defs)) {
    let printed = name;
    if (!isTypeName(name)) {
      printed = sanitizeTypeName(name, used);
      used.add(printed);
      printer.warn("JOTL1034", { name, newName: printed }, appendPointer("/$defs", name));
      printer.renamed.set(`#${appendPointer("/$defs", name)}`, `${DEFS_PREFIX}${printed}`);
    }
    defNames.set(name, printed);
    printer.refs.set(`#${appendPointer("/$defs", name)}`, { name: printed, schema: defs[name]! });
  }

  const others = Object.keys(root).filter((k) => !["$schema", "$defs", "$id", "x-ui"].includes(k));
  const refForm =
    typeof schema !== "boolean" &&
    others.every((k) => k === "$ref") &&
    (!Object.hasOwn(root, "$ref") || (typeof root.$ref === "string" && printer.refs.has(root.$ref)));

  const entries: Entry[] = [];
  if (!refForm) {
    const name = uniqueName(rootName, used);
    used.add(name);
    // 根被放进 `$defs/<name>`, 指向根内部的引用随之改指.
    for (const k of others) printer.renamed.set(`#${appendPointer("", k)}`, `${DEFS_PREFIX}${name}${appendPointer("", k)}`);
    const body: JsonSchema = typeof schema === "boolean" ? schema : Object.fromEntries(others.map((k) => [k, root[k]]));
    entries.push(printer.declaration(name, body, "", rootMetas, []));
  }
  const defList = [...defNames];
  defList.forEach(([name, printed], i) => {
    const isRoot = refForm && root.$ref === `${DEFS_PREFIX}${name}`;
    const markers: Marker[] = isRoot && i > 0 ? [{ kind: "Marker", name: "root", span: NO_SPAN }] : [];
    const extra = isRoot ? rootMetas : new Map<string, unknown>();
    entries.push(printer.declaration(printed, defs[name]!, appendPointer("/$defs", name), extra, markers));
  });
  // 只写一个标识时另一个会跟随它, 所以默认导出与根不同时两个都写.
  const defaultPrinted = options.defaultExport === undefined ? undefined : defNames.get(options.defaultExport);
  if (options.defaultExport !== undefined && defaultPrinted === undefined) printer.warn("JOTL1051", { name: options.defaultExport }, "");
  const rootEntry = entries.find((e) => e.markers.length > 0) ?? entries[0];
  if (defaultPrinted !== undefined && rootEntry !== undefined && rootEntry.key.name !== defaultPrinted) {
    if (rootEntry.markers.length === 0) rootEntry.markers.push({ kind: "Marker", name: "root", span: NO_SPAN });
    entries.find((e) => e.key.name === defaultPrinted)?.markers.push({ kind: "Marker", name: "default", span: NO_SPAN });
  }
  // 打印提升出的类型时可能再提升, 按队列逐个处理.
  for (let i = 0; i < printer.promoted.length; i++) {
    const p = printer.promoted[i]!;
    const schema = p.title === undefined ? p.schema : { title: p.title, ...(p.schema as Raw) };
    entries.push(printer.declaration(p.name, schema, p.pointer, new Map(), []));
  }

  const file: JotlFile = { kind: "File", file: "", entries, comments: [], span: NO_SPAN };
  const text = renderFile(file);
  const tooDeep = parseSource(text, "").diagnostics.find((d) => d.code === "JOTL1029");
  if (tooDeep) {
    return { value: undefined, diagnostics: [...printer.diagnostics, { ...tooDeep, location: { kind: "pointer", pointer: "" } }] };
  }
  return { value: text, diagnostics: printer.diagnostics };
}
