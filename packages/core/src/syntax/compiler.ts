// 编译器: AST → 规范化 JSON Schema 2020-12 与源码映射(定稿 §3-§12, 契约 C1 C4), 同时做语义检查.
import {
  type Condition,
  DEFAULT_VALUE_FORMATS,
  type Diagnostic,
  type DiagnosticFix,
  JSON_SCHEMA_DIALECT,
  type JsonPointer,
  type JsonSchemaObject,
  type JsonSchemaType,
  type JsonValue,
  type SourceSpan,
  type XUi,
  type XUiWidgetModule,
  appendPointer,
  hasErrors,
  isSchemaObject,
  isTimestampValueFormat,
  l10n,
  orderKeywords,
  xUiMetaSchema,
} from "../schema/index.js";
import type { Body, Entry, JotlFile, LiteralScalar, Meta, ObjectValueMember, StringLiteral, ValueNode } from "./ast.js";
import {
  COMPONENT_WIDGETS,
  type ComponentName,
  COMPONENT_NAMES,
  CUSTOM_META_KEY_RE,
  EXACT_DECIMAL_RE,
  FORMAT_COMPONENTS,
  GENERATED_EXTENSION_KEYWORDS,
  KEY_META_KEYS,
  MAX_SAFE_INTEGER,
  META_KEYS,
  type MetaTarget,
  RESERVED_COMPONENT_WORDS,
  ROOT_X_UI_KEYS,
  STRING_COMPONENTS,
  THOUSANDS_DEFAULTS,
  customMetaKeyword,
  isComponentName,
  isTypeName,
  metaAppliesTo,
  valueFormatSchema,
} from "./builtins.js";
import { type SyntaxDiagnosticCode, type SyntaxReason, syntaxDiagnostic, syntaxFixTitle, syntaxReason } from "./diagnostics.js";
import {
  type ValueIssue,
  columnsIssue,
  compileCondition,
  compileRules,
  compileVariant,
  errorMessageIssue,
  fileIdIssue,
  groupsIssue,
  layoutIssue,
  orderIssue,
} from "./meta-values.js";
import { parseSource } from "./parser.js";
import { BUILTIN_WIDGETS, type RefResolver, acceptsWidget, bigintSchema, defaultWidget, extensionBase, extensionConstraintKeys, moneySchema } from "./shapes.js";
import { checkDefaultValue, compareDecimal } from "./value-check.js";

/** 写成字符串的底层类型中按 `{ type }` 处理的 JSON Schema 基本类型; 与 Jotl 组件同名时以此为准. */
const JSON_TYPES = ["string", "number", "integer", "boolean", "array", "object"] as const;
const MODULE_DECLARATION_KEYS = ["base", "module", "export"];

function componentSchema(name: string): JsonSchemaObject | undefined {
  const compiled = compileFile(parseSource(`W: ${name}`, "").ast);
  if (hasErrors(compiled.diagnostics)) return undefined;
  const { $schema: _dialect, $defs, ...root } = compiled.schema;
  const { "x-ui": _xUi, ...schema } = ($defs?.["W"] as JsonSchemaObject | undefined) ?? root;
  return schema;
}

let typeSchemas: ReadonlyMap<string, JsonSchemaObject> | undefined;

/** 字符串写法的底层类型名 → schema; 首次使用时编译各组件. */
export function baseTypeSchemas(): ReadonlyMap<string, JsonSchemaObject> {
  typeSchemas ??= new Map([
    ...COMPONENT_NAMES.flatMap((name) => {
      const schema = componentSchema(name);
      return schema === undefined ? [] : [[name, schema] as const];
    }),
    ...JSON_TYPES.map((type) => [type, { type }] as const),
  ]);
  return typeSchemas;
}

export interface WidgetDeclaration {
  /** 底层 schema; 每次返回新对象. */
  schema: JsonSchemaObject;
  /** 写成模块声明时的组件模块; 声明了非缺省 base 时带 `base`(写 `'object'` 视同缺省, 不带). */
  module?: XUiWidgetModule;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 扩展组件声明(`jotl.config.json` 与根元数据 `widgets` 共用): 底层类型名, schema 对象,
 * 或带 `module` 键的模块声明 `{ base?, module, export? }`(base 缺省为 object).
 */
export function readWidgetDeclaration(name: string, value: unknown): { declaration: WidgetDeclaration } | { issue: ValueIssue } {
  const bad = (reason: SyntaxReason, params: Record<string, string> = {}) => ({ issue: { reason, params: { name, ...params } } });
  const baseOf = (type: string) => baseTypeSchemas().get(type);
  if (typeof value === "string") {
    const schema = baseOf(value);
    return schema === undefined ? bad("widgetUnknownType", { type: value }) : { declaration: { schema: cloneJson(schema) } };
  }
  if (!isSchemaObject(value)) return bad("widgetBadType");
  const v = value as Record<string, unknown>;
  if (!Object.hasOwn(v, "module")) return { declaration: { schema: cloneJson(v) as JsonSchemaObject } };
  const extra = Object.keys(v).find((k) => !MODULE_DECLARATION_KEYS.includes(k));
  if (extra !== undefined) return bad("widgetModuleKey", { key: extra });
  if (typeof v.module !== "string" || v.module === "") return bad("widgetModule");
  if (Object.hasOwn(v, "export") && (typeof v.export !== "string" || v.export === "")) return bad("widgetExport");
  let schema: JsonSchemaObject = { type: "object" };
  let base: XUiWidgetModule["base"];
  if (typeof v.base === "string") {
    const found = baseOf(v.base);
    if (found === undefined) return bad("widgetUnknownType", { type: v.base });
    schema = cloneJson(found);
    if (v.base !== "object") base = v.base;
  } else if (isSchemaObject(v.base)) {
    schema = cloneJson(v.base) as JsonSchemaObject;
    base = cloneJson(v.base) as JsonSchemaObject;
  } else if (Object.hasOwn(v, "base")) {
    return bad("widgetBase");
  }
  const module: XUiWidgetModule = base === undefined ? { module: v.module } : { base, module: v.module };
  if (typeof v.export === "string") module.export = v.export;
  return { declaration: { schema, module } };
}

export interface CompileOptions {
  /** 已登记的扩展组件: 组件名 → 底层 schema(定稿 §4); 由调用方传入. */
  widgets?: Readonly<Record<string, JsonSchemaObject>>;
}

export interface CompileFileOutput {
  schema: JsonSchemaObject;
  sourceMap: Map<JsonPointer, SourceSpan>;
  diagnostics: Diagnostic[];
  /** 默认导出的类型名; 不写进 schema, 供 TS 输出的 `export default`. */
  defaultExport: string | undefined;
}

const DEFS_POINTER = "/$defs";
const X_UI_META_DEFS = (xUiMetaSchema.$defs ?? {}) as Readonly<Record<string, JsonSchemaObject>>;
const RESERVED_SCHEMA_KEYWORDS = new Set(["$schema", "$defs"]);
/** 编译为 `type: [T, "null"]` 的组件; 其余组件可空时为 `anyOf: [T, {type: "null"}]`(沿用 v0 规则). */
const MERGEABLE: ReadonlySet<string> = new Set([...STRING_COMPONENTS, "number", "integer", "boolean"]);
/** 可空包成 anyOf 时留在外层的关键字与 x-ui 字段; 其余留在内层. */
const OUTER_KEYWORDS = ["title", "description", "default", "examples", "deprecated", "x-deprecatedReason", "readOnly", "writeOnly", "$comment"];
const OUTER_X_UI = ["hidden", "decorator", "visibleIf", "variants"] as const;
const RANGE_KEYS = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"] as const;
// 必须与 stringConstraints 读取的键一致, 漏掉的键在时间戳形态下会被静默丢弃.
const STRING_CONSTRAINT_KEYS = ["minLength", "maxLength", "pattern", "format"] as const;

interface PendingDefault {
  schema: JsonSchemaObject;
  value: JsonValue;
  node: ValueNode;
}

interface MetaItem {
  key: string;
  keyNode: StringLiteral;
  value: ValueNode;
}

/** 一组元数据; 只暴露通过了键名与适用性检查的项. */
class Metas {
  readonly items = new Map<string, MetaItem>();
  private readonly usable = new Set<string>();

  constructor(
    members: readonly ObjectValueMember[],
    readonly span: SourceSpan | undefined,
    onDuplicate: (key: StringLiteral) => void,
  ) {
    for (const member of members) {
      const key = member.key.value;
      if (this.items.has(key)) {
        onDuplicate(member.key);
        continue;
      }
      this.items.set(key, { key, keyNode: member.key, value: member.value });
    }
  }

  allow(key: string): void {
    this.usable.add(key);
  }

  get(key: string): MetaItem | undefined {
    return this.usable.has(key) ? this.items.get(key) : undefined;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}

interface TypeInput {
  comp: string;
  /** 组件名, 元数据或体的位置, 用于报错. */
  compSpan: SourceSpan;
  metas: Metas;
  body: Body | undefined;
  title: string | undefined;
  root: boolean;
  host: SourceSpan;
}

type Kind = MetaTarget | "unknown";

function jsonTypeOf(value: LiteralScalar): JsonSchemaType {
  if (value === null) return "null";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value === "string" ? "string" : "boolean";
}

/** 规范化规则 4: 成员 JSON 类型唯一时为字符串, 否则为按首次出现排列的类型数组. */
function typeOfValues(values: readonly LiteralScalar[]): JsonSchemaType | JsonSchemaType[] {
  const types = [...new Set(values.map(jsonTypeOf))];
  return types.length === 1 ? types[0]! : types;
}

function defineKey(target: Record<string, unknown>, key: string, value: unknown): void {
  // 键可能是 "__proto__", 用 defineProperty 避免改写原型.
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

function compOf(entry: Entry): string {
  return entry.component?.name ?? (entry.body ? "object" : "string");
}

class Compiler {
  readonly diagnostics: Diagnostic[] = [];
  private sourceMap = new Map<JsonPointer, SourceSpan>();
  private readonly decls = new Map<string, Entry>();
  private readonly defs: Record<string, JsonSchemaObject> = {};
  private readonly pending: PendingDefault[] = [];
  private readonly widgets: Record<string, JsonSchemaObject>;
  /** 根元数据 `widgets` 声明的扩展组件名(不含配置传入的). */
  private readonly fileWidgets = new Set<string>();
  /** 根元数据 `widgets` 中的模块声明, 写入根 `x-ui.widgets`. */
  private readonly modules: Record<string, XUiWidgetModule> = {};
  /** 必须写 `x-ui.widget` 的节点(按 value_format 编译的日期组件). */
  private readonly forcedWidget = new WeakSet<JsonSchemaObject>();
  private errorCount = 0;
  private rootExtras: { rules?: JsonValue; id?: string } = {};
  private readonly resolve: RefResolver = (ref) => {
    const name = ref.startsWith("#/$defs/") ? ref.slice("#/$defs/".length) : undefined;
    return name !== undefined && this.isEnumDecl(name, new Set()) ? { enum: [] } : {};
  };

  constructor(
    private readonly ast: JotlFile,
    options: CompileOptions,
  ) {
    this.widgets = { ...options.widgets };
  }

  private report(diagnostic: Diagnostic): void {
    if (diagnostic.severity === "error") this.errorCount++;
    this.diagnostics.push(diagnostic);
  }

  private error(code: SyntaxDiagnosticCode, params: Record<string, string | number>, span: SourceSpan, fixes?: DiagnosticFix[]): void {
    const location = { kind: "source" as const, range: span.range };
    this.report(syntaxDiagnostic(code, params, fixes ? { location, fixes } : { location }));
  }

  private invalidValue(reason: SyntaxReason, params: Record<string, string | number>, span: SourceSpan): undefined {
    this.error("JOTL1020", { reason: syntaxReason(reason, params) }, span);
    return undefined;
  }

  private xUiIssue(found: ValueIssue, span: SourceSpan): void {
    this.error("JOTL1017", { reason: syntaxReason(found.reason, found.params) }, span);
  }

  private register(pointer: JsonPointer, span: SourceSpan): void {
    if (!this.sourceMap.has(pointer)) this.sourceMap.set(pointer, span);
  }

  private hasExtension(name: string): boolean {
    return Object.hasOwn(this.widgets, name);
  }

  run(): CompileFileOutput {
    const root: JsonSchemaObject = { $schema: JSON_SCHEMA_DIALECT };
    const unique: Entry[] = [];
    const rejected: Entry[] = [];
    const entries = this.ast.entries;
    entries.forEach((entry, i) => {
      if (entry.key.form !== "identifier" || !isTypeName(entry.key.name)) {
        this.error("JOTL1036", {}, entry.key.span, [this.wrapInRootFix(i)]);
        rejected.push(entry);
        return;
      }
      if (entry.question) this.error("JOTL1037", {}, { range: entry.question });
      const name = entry.key.name;
      if (this.hasExtension(name)) this.error("JOTL1028", { name }, entry.key.span);
      if (this.decls.has(name)) {
        this.error("JOTL1015", { name }, entry.key.span);
        rejected.push(entry);
        return;
      }
      this.decls.set(name, entry);
      unique.push(entry);
    });
    const { root: rootEntry, defaultExport } = this.findRoot(unique);
    if (rootEntry) this.declareWidgets(rootEntry);
    for (const entry of unique) {
      if (this.fileWidgets.has(entry.key.name)) this.error("JOTL1028", { name: entry.key.name }, entry.key.span);
    }

    for (const entry of unique) {
      const pointer = appendPointer(DEFS_POINTER, entry.key.name);
      this.register(pointer, entry.span);
      this.defs[entry.key.name] = this.compileEntry(entry, pointer, entry === rootEntry);
    }
    const kept = this.sourceMap;
    for (const entry of rejected) {
      this.sourceMap = new Map();
      this.compileEntry(entry, appendPointer(DEFS_POINTER, entry.key.name), false);
    }
    this.sourceMap = kept;

    const doc: JsonSchemaObject = { $defs: this.defs };
    if (rootEntry) doc.$ref = `#${appendPointer(DEFS_POINTER, rootEntry.key.name)}`;
    for (const { schema, value, node } of this.pending) {
      const reason = checkDefaultValue(schema, value, this.defs, doc);
      if (reason !== undefined) this.error("JOTL1008", { reason }, node.span);
    }

    if (this.rootExtras.id !== undefined) root.$id = this.rootExtras.id;
    if (rootEntry) {
      root.$ref = `#${appendPointer(DEFS_POINTER, rootEntry.key.name)}`;
      const xUi: XUi = { version: 1 };
      if (this.rootExtras.rules !== undefined) xUi.rules = this.rootExtras.rules as unknown as NonNullable<XUi["rules"]>;
      if (Object.keys(this.modules).length > 0) xUi.widgets = this.modules;
      root["x-ui"] = xUi;
    }
    if (unique.length > 0) root.$defs = this.defs;
    this.sourceMap.set("", rootEntry ? { range: rootEntry.span.range } : this.ast.span);
    return {
      schema: orderKeywords(root) as JsonSchemaObject,
      sourceMap: this.sourceMap,
      diagnostics: this.diagnostics,
      defaultExport: defaultExport?.key.name,
    };
  }

  /** 根取标 `<root/>` 的条目, 默认导出取标 `<default/>` 的条目; 只标一个时另一个跟随它, 都不标时都取第一条(定稿 §3). */
  private findRoot(unique: readonly Entry[]): { root: Entry | undefined; defaultExport: Entry | undefined } {
    const marked: Partial<Record<"root" | "default", Entry>> = {};
    for (const entry of this.ast.entries) {
      for (const marker of entry.markers) {
        if (marked[marker.name] !== undefined) {
          this.error("JOTL1039", { marker: `<${marker.name}/>` }, marker.span);
          continue;
        }
        marked[marker.name] = entry;
      }
    }
    const valid = (entry: Entry | undefined) => (entry !== undefined && unique.includes(entry) ? entry : undefined);
    const root = marked.root ?? marked.default;
    const defaultExport = marked.default ?? marked.root;
    if (root === undefined) return { root: unique[0], defaultExport: unique[0] };
    return { root: valid(root), defaultExport: valid(defaultExport) };
  }

  /** 根元数据 `widgets`: 大驼峰名登记为扩展组件, 覆盖配置传入的同名项; 模块声明记入根 `x-ui.widgets`; 要在编译各条目前完成. */
  private declareWidgets(rootEntry: Entry): void {
    const member = rootEntry.meta?.members.find((m) => m.key.value === "widgets");
    if (member === undefined) return;
    if (member.value.kind !== "ObjectValue") {
      this.invalidValue("widgetsNotObject", {}, member.value.span);
      return;
    }
    const seen = new Set<string>();
    for (const item of member.value.members) {
      const name = item.key.value;
      if (seen.has(name)) continue;
      seen.add(name);
      if (name === "") {
        this.invalidValue("emptyWidget", {}, item.key.span);
        continue;
      }
      const r = readWidgetDeclaration(name, this.toJson(item.value));
      if ("issue" in r) {
        this.invalidValue(r.issue.reason, r.issue.params, item.value.span);
        continue;
      }
      if (r.declaration.module !== undefined) defineKey(this.modules, name, r.declaration.module);
      if (!isTypeName(name)) continue;
      if (!this.hasExtension(name)) this.fileWidgets.add(name);
      defineKey(this.widgets, name, r.declaration.schema);
    }
  }

  /** 把与第 index 条相邻的一串非类型名顶层条目包进 `Root(根): {...}` 并标 `<root/>`. */
  private wrapInRootFix(index: number): DiagnosticFix {
    const entries = this.ast.entries;
    const bad = (e: Entry) => e.key.form !== "identifier" || !isTypeName(e.key.name);
    let first = index;
    while (first > 0 && bad(entries[first - 1]!)) first--;
    let last = index;
    while (last + 1 < entries.length && bad(entries[last + 1]!)) last++;
    const start = entries[first]!.span.range.start;
    const end = entries[last]!.span.range.end;
    const file = entries[index]!.span.range.file;
    return {
      title: syntaxFixTitle("wrapInRoot"),
      edits: [
        { range: { file, start, end: start }, newText: l10n("<root/>\nRoot(根): {\n", "<root/>\nRoot: {\n") },
        { range: { file, start: end, end }, newText: "\n}" },
      ],
    };
  }

  private metasOf(members: readonly ObjectValueMember[], span: SourceSpan | undefined): Metas {
    return new Metas(members, span, (key) => this.error("JOTL1005", { name: key.value }, key.span));
  }

  private metasOfMeta(meta: Meta | undefined): Metas {
    return this.metasOf(meta?.members ?? [], meta?.span);
  }

  toJson(node: ValueNode): JsonValue {
    switch (node.kind) {
      case "LiteralValue":
        return node.value;
      case "ArrayValue":
        return node.items.map((item) => this.toJson(item));
      case "ObjectValue": {
        const out: Record<string, JsonValue> = {};
        for (const member of node.members) {
          if (Object.hasOwn(out, member.key.value)) {
            this.error("JOTL1005", { name: member.key.value }, member.key.span);
            continue;
          }
          defineKey(out, member.key.value, this.toJson(member.value));
        }
        return out;
      }
    }
  }

  /** 条目的内容: 光秃的键为 string, 省略组件时有体为 object, 否则为 string. */
  private compileEntry(entry: Entry, pointer: JsonPointer, root: boolean): JsonSchemaObject {
    return this.compileType(
      {
        comp: compOf(entry),
        compSpan: entry.component?.span ?? entry.meta?.span ?? entry.body?.span ?? entry.key.span,
        metas: this.metasOfMeta(entry.meta),
        body: entry.body,
        title: entry.label && entry.label.text !== "" ? entry.label.text : undefined,
        root,
        host: { range: entry.span.range },
      },
      pointer,
    );
  }

  private kindOf(input: TypeInput): Kind {
    const name = input.comp;
    if (isComponentName(name)) return name;
    if (RESERVED_COMPONENT_WORDS.has(name)) {
      this.error("JOTL1014", { name }, input.compSpan);
      return "unknown";
    }
    if (isTypeName(name)) {
      if (this.decls.has(name)) return "ref";
      if (this.hasExtension(name)) return "ext";
      this.error("JOTL1006", { name }, input.compSpan);
      return "unknown";
    }
    this.error("JOTL1004", { name }, input.compSpan);
    return "unknown";
  }

  /** 检查元数据键: 未知键, 不适用于该组件, 只能用于根; 通过的键才可读取. */
  private checkMetaKeys(input: TypeInput, kind: Kind): void {
    for (const item of input.metas.items.values()) {
      const key = item.key;
      if (CUSTOM_META_KEY_RE.test(key)) {
        if (GENERATED_EXTENSION_KEYWORDS.has(customMetaKeyword(key))) {
          this.error("JOTL1012", { name: key, reason: syntaxReason("reservedCustomKey", { name: key }) }, item.keyNode.span);
        } else {
          input.metas.allow(key);
        }
        continue;
      }
      const rule = Object.hasOwn(META_KEYS, key) ? META_KEYS[key] : undefined;
      if (rule === undefined) {
        this.error("JOTL1011", { name: key }, item.keyNode.span);
        continue;
      }
      if (kind !== "unknown" && !metaAppliesTo(key, kind) && !(kind === "ext" && extensionConstraintKeys(this.widgets[input.comp]!).includes(key))) {
        this.error("JOTL1007", { key, component: input.comp }, item.keyNode.span);
        continue;
      }
      if (rule.rootOnly && !input.root) {
        this.error("JOTL1012", { name: key, reason: syntaxReason("rootOnly") }, item.keyNode.span);
        continue;
      }
      input.metas.allow(key);
    }
  }

  private compileType(input: TypeInput, pointer: JsonPointer): JsonSchemaObject {
    this.register(pointer, input.host);
    const errorsBefore = this.errorCount;
    const kind = this.kindOf(input);
    this.checkMetaKeys(input, kind);
    const m = input.metas;
    if (kind === "unknown") {
      const schema: JsonSchemaObject = {};
      if (input.title !== undefined) schema.title = input.title;
      return schema;
    }
    const nullable = this.bool(m, "nullable") === true;
    const extType = kind === "ext" ? this.widgets[input.comp]!.type : undefined;
    const mergeable = MERGEABLE.has(kind) || (typeof extType === "string" && ["string", "number", "integer", "boolean"].includes(extType));
    const wrap = nullable && !mergeable;
    const corePointer = wrap ? appendPointer(pointer, "anyOf", 0) : pointer;
    if (wrap) this.register(corePointer, input.host);

    const core = this.core(kind, input, corePointer);
    this.applyWidget(core, kind, input);
    this.applyCommon(core, kind, input);
    if (input.title !== undefined) core.title = input.title;

    let outer = core;
    if (nullable) {
      if (!wrap) {
        if (typeof core.type === "string") core.type = [core.type, "null"];
      } else {
        outer = this.wrapNullable(core);
      }
    }
    this.applyCustom(outer, m);
    if (input.root) this.collectRoot(m);
    const def = m.get("default");
    if (def !== undefined && this.errorCount === errorsBefore) {
      this.pending.push({ schema: outer, value: outer.default as JsonValue, node: def.value });
    }
    return outer;
  }

  private wrapNullable(inner: JsonSchemaObject): JsonSchemaObject {
    const outer: JsonSchemaObject = {};
    for (const key of OUTER_KEYWORDS) {
      if (!Object.hasOwn(inner, key)) continue;
      outer[key] = inner[key];
      delete inner[key];
    }
    const xUi = inner["x-ui"];
    if (xUi) {
      const moved: XUi = {};
      for (const key of OUTER_X_UI) {
        if (!Object.hasOwn(xUi, key)) continue;
        (moved as Record<string, unknown>)[key] = xUi[key];
        delete xUi[key];
      }
      if (Object.keys(moved).length > 0) outer["x-ui"] = moved;
      if (Object.keys(xUi).length === 0) delete inner["x-ui"];
    }
    outer.anyOf = [inner, { type: "null" }];
    return outer;
  }

  private xUi(schema: JsonSchemaObject): XUi {
    schema["x-ui"] ??= {};
    return schema["x-ui"];
  }

  // ---- 取值读取 ----

  private json(item: MetaItem): JsonValue {
    return this.toJson(item.value);
  }

  private bool(m: Metas, key: string): boolean | undefined {
    const item = m.get(key);
    if (!item) return undefined;
    const v = this.json(item);
    return typeof v === "boolean" ? v : this.invalidValue("boolean", { name: key }, item.value.span);
  }

  private nonNegInt(m: Metas, key: string): number | undefined {
    const item = m.get(key);
    if (!item) return undefined;
    const v = this.json(item);
    return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : this.invalidValue("nonNegativeInteger", { name: key }, item.value.span);
  }

  private num(m: Metas, key: string): number | undefined {
    const item = m.get(key);
    if (!item) return undefined;
    const v = this.json(item);
    return typeof v === "number" ? v : this.invalidValue("number", { name: key }, item.value.span);
  }

  private str(m: Metas, key: string, nonEmpty = false): string | undefined {
    const item = m.get(key);
    if (!item) return undefined;
    const v = this.json(item);
    if (typeof v === "string" && (!nonEmpty || v !== "")) return v;
    return this.invalidValue(nonEmpty ? "expectNonEmptyString" : "expectString", { name: key }, item.value.span);
  }

  private objectMeta(m: Metas, key: string): { item: MetaItem; members: ObjectValueMember[] } | undefined {
    const item = m.get(key);
    if (!item) return undefined;
    if (item.value.kind !== "ObjectValue") return this.invalidValue("expectObject", { name: key }, item.value.span);
    return { item, members: item.value.members };
  }

  // ---- 各组件 ----

  private noBody(input: TypeInput, kind: Kind): void {
    if (input.body === undefined) return;
    if (kind === "ref") this.error("JOTL1044", { name: input.comp }, input.body.span);
    else this.error("JOTL1041", { component: input.comp }, input.body.span);
  }

  private core(kind: MetaTarget, input: TypeInput, pointer: JsonPointer): JsonSchemaObject {
    const m = input.metas;
    switch (kind) {
      case "date":
      case "time":
      case "datetime": {
        this.noBody(input, kind);
        const schema = this.valueFormat(kind, m);
        if (schema.type === "string") this.stringConstraints(schema, m);
        else for (const key of STRING_CONSTRAINT_KEYS) if (m.has(key)) this.error("JOTL1007", { key, component: input.comp }, m.get(key)!.keyNode.span);
        return schema;
      }
      case "string":
      case "text":
      case "richtext":
      case "url":
      case "email":
      case "color":
      case "image":
      case "file": {
        this.noBody(input, kind);
        const schema: JsonSchemaObject = { type: "string" };
        if (kind === "richtext") schema.contentMediaType = "text/html";
        const format = FORMAT_COMPONENTS[kind];
        if (format) schema.format = format;
        this.stringConstraints(schema, m);
        return schema;
      }
      case "number":
      case "integer": {
        this.noBody(input, kind);
        const schema: JsonSchemaObject = { type: kind };
        this.numberConstraints(schema, m, kind === "integer");
        const decimals = this.nonNegInt(m, "decimals");
        if (decimals !== undefined) schema["x-decimals"] = decimals;
        return schema;
      }
      case "money":
      case "bigint": {
        this.noBody(input, kind);
        const schema = kind === "money" ? this.money(m) : bigintSchema();
        const range = this.decimalRange(m);
        if (range) schema["x-decimalRange"] = range;
        return schema;
      }
      case "boolean":
        this.noBody(input, kind);
        return { type: "boolean" };
      case "any":
        this.noBody(input, kind);
        return {};
      case "enum":
        return this.enumType(input, pointer);
      case "object": {
        const schema = this.objectBody(input.body, pointer);
        this.objectMetas(schema, m);
        return schema;
      }
      case "array":
        return this.array(input, pointer);
      case "map":
        return this.map(input, pointer);
      case "union":
        return this.union(input, pointer);
      case "jsontext":
        return this.jsontext(input, pointer);
      case "ref":
        return this.ref(input, pointer);
      case "ext": {
        this.noBody(input, kind);
        const schema = JSON.parse(JSON.stringify(this.widgets[input.comp]!)) as JsonSchemaObject;
        this.extensionConstraints(schema, m);
        const xUi = this.xUi(schema);
        xUi.widget ??= input.comp;
        return schema;
      }
    }
  }

  /** 扩展组件的约束元数据按底层类型合并进底层 schema; 同名关键字以元数据为准, `format` 不同时与内置组件一样报 JOTL1048. */
  private extensionConstraints(schema: JsonSchemaObject, m: Metas): void {
    const base = extensionBase(schema);
    switch (base) {
      case "string":
        this.stringConstraints(schema, m);
        break;
      case "number":
      case "integer": {
        this.numberConstraints(schema, m, false);
        const decimals = this.nonNegInt(m, "decimals");
        if (decimals !== undefined) schema["x-decimals"] = decimals;
        break;
      }
      case "money":
      case "bigint": {
        const range = this.decimalRange(m);
        if (range) schema["x-decimalRange"] = { ...(schema["x-decimalRange"] as Record<string, string> | undefined), ...range };
        break;
      }
      case "array":
        this.itemsConstraints(schema, m);
        break;
      case "object":
        this.propertiesConstraints(schema, m);
        break;
      case undefined:
        return;
    }
    this.mergedRangeConflict(schema, m, base);
  }

  /** 一端来自元数据, 另一端来自底层 schema 的上下界冲突; 两端都来自元数据的已由各约束读取报过. */
  private mergedRangeConflict(schema: JsonSchemaObject, m: Metas, base: string): void {
    const pairs: [string, string][] =
      base === "money" || base === "bigint" ? [] : [["minLength", "maxLength"], ["minimum", "maximum"], ["minItems", "maxItems"], ["minProperties", "maxProperties"]];
    const range = schema["x-decimalRange"] as Record<string, string> | undefined;
    for (const [min, max] of pairs) {
      if (m.has(min) === m.has(max)) continue;
      const lo = schema[min];
      const hi = schema[max];
      if (typeof lo === "number" && typeof hi === "number" && lo > hi) {
        this.invalidValue("rangeConflict", { min, max }, m.get(m.has(min) ? min : max)!.value.span);
      }
    }
    if (range && m.has("minimum") !== m.has("maximum") && range.minimum !== undefined && range.maximum !== undefined && compareDecimal(range.minimum, range.maximum) > 0) {
      this.invalidValue("rangeConflict", { min: "minimum", max: "maximum" }, m.get(m.has("minimum") ? "minimum" : "maximum")!.value.span);
    }
  }

  /** `value_format` → 数据形态(方案 V5); `time` 不能用时间戳. */
  private valueFormat(kind: "date" | "time" | "datetime", m: Metas): JsonSchemaObject {
    let valueFormat = this.str(m, "value_format", true);
    if (valueFormat !== undefined && kind === "time" && isTimestampValueFormat(valueFormat)) {
      this.invalidValue("timeTimestamp", {}, m.get("value_format")!.value.span);
      valueFormat = undefined;
    }
    const { schema, widget } = valueFormatSchema(kind, valueFormat ?? DEFAULT_VALUE_FORMATS[kind]);
    if (widget) this.forcedWidget.add(schema);
    return schema as JsonSchemaObject;
  }

  private stringConstraints(schema: JsonSchemaObject, m: Metas): void {
    const minLength = this.nonNegInt(m, "minLength");
    const maxLength = this.nonNegInt(m, "maxLength");
    if (minLength !== undefined) schema.minLength = minLength;
    if (maxLength !== undefined) schema.maxLength = maxLength;
    if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
      this.invalidValue("rangeConflict", { min: "minLength", max: "maxLength" }, m.get("maxLength")!.value.span);
    }
    const pattern = this.str(m, "pattern");
    if (pattern !== undefined) {
      try {
        new RegExp(pattern, "u");
        schema.pattern = pattern;
      } catch {
        this.invalidValue("invalidPattern", {}, m.get("pattern")!.value.span);
      }
    }
    const format = this.str(m, "format", true);
    if (format === undefined) return;
    if (schema.format !== undefined && schema.format !== format) {
      this.report(syntaxDiagnostic("JOTL1048", { format: String(schema.format) }, { location: { kind: "source", range: m.get("format")!.value.span.range } }));
    }
    schema.format = format;
  }

  private numberConstraints(schema: JsonSchemaObject, m: Metas, integer: boolean): void {
    for (const key of RANGE_KEYS) {
      const v = this.num(m, key);
      if (v !== undefined) schema[key] = v;
    }
    if (integer) {
      schema.minimum ??= -MAX_SAFE_INTEGER;
      schema.maximum ??= MAX_SAFE_INTEGER;
    }
    if (m.has("minimum") && m.has("maximum") && (schema.minimum as number) > (schema.maximum as number)) {
      this.invalidValue("rangeConflict", { min: "minimum", max: "maximum" }, m.get("maximum")!.value.span);
    }
  }

  private money(m: Metas): JsonSchemaObject {
    const currency = this.choiceMeta(m, "currency", (v) => /^[A-Z]{3}$/.test(v), "currency");
    const unit = this.choiceMeta(m, "unit", (v) => v !== "", "unit");
    const decimals = this.nonNegInt(m, "decimals");
    const options: Parameters<typeof moneySchema>[0] = {};
    if (currency !== undefined) options.currency = currency;
    if (unit !== undefined) options.unit = unit;
    if (decimals !== undefined) options.decimals = decimals;
    return moneySchema(options);
  }

  /** 固定值(字符串)或可选值(非空且不重复的字符串数组). */
  private choiceMeta(m: Metas, key: string, valid: (v: string) => boolean, reason: SyntaxReason): string | string[] | undefined {
    const item = m.get(key);
    if (!item) return undefined;
    const v = this.json(item);
    if (typeof v === "string" && valid(v)) return v;
    if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && valid(x)) && new Set(v).size === v.length) {
      return v as string[];
    }
    return this.invalidValue(reason, {}, item.value.span);
  }

  private decimalRange(m: Metas): Record<string, string> | undefined {
    const range: Record<string, string> = {};
    for (const key of RANGE_KEYS) {
      const item = m.get(key);
      if (!item) continue;
      const v = this.json(item);
      if (typeof v !== "string" || !EXACT_DECIMAL_RE.test(v)) {
        this.invalidValue("decimalString", { name: key }, item.value.span);
        continue;
      }
      range[key] = v;
    }
    if (range.minimum !== undefined && range.maximum !== undefined && compareDecimal(range.minimum, range.maximum) > 0) {
      this.invalidValue("rangeConflict", { min: "minimum", max: "maximum" }, m.get("maximum")!.value.span);
    }
    return Object.keys(range).length > 0 ? range : undefined;
  }

  /** tupleMin: 元组的必填位置数; 未写 minItems 时补它, 写了 0 时不覆盖. 非元组数组不补默认值. */
  private itemsConstraints(schema: JsonSchemaObject, m: Metas, tupleMin?: number): void {
    const minItems = this.nonNegInt(m, "minItems");
    const maxItems = this.nonNegInt(m, "maxItems");
    if (minItems !== undefined) {
      if (minItems > 0 || tupleMin === undefined) schema.minItems = minItems;
    } else if (tupleMin !== undefined && tupleMin > 0) {
      schema.minItems = tupleMin;
    }
    if (maxItems !== undefined) schema.maxItems = maxItems;
    if (minItems !== undefined && maxItems !== undefined && minItems > maxItems) {
      this.invalidValue("rangeConflict", { min: "minItems", max: "maxItems" }, m.get("maxItems")!.value.span);
    }
    const unique = this.bool(m, "uniqueItems");
    if (unique !== undefined) schema.uniqueItems = unique;
  }

  /** 枚举成员与多选(定稿 §7). */
  private enumType(input: TypeInput, pointer: JsonPointer): JsonSchemaObject {
    const m = input.metas;
    const multiple = this.bool(m, "multiple") === true;
    if (!multiple) this.requireMultiple(m);
    const members = this.enumMembers(input, multiple ? appendPointer(pointer, "items") : pointer);
    if (!multiple) return members;
    const schema: JsonSchemaObject = { type: "array", items: members };
    this.itemsConstraints(schema, m);
    schema.uniqueItems = true;
    return schema;
  }

  private requireMultiple(m: Metas): void {
    for (const key of ["minItems", "maxItems", "uniqueItems"]) {
      const item = m.get(key);
      if (item) this.error("JOTL1012", { name: key, reason: syntaxReason("needsMultiple") }, item.keyNode.span);
    }
  }

  private enumMembers(input: TypeInput, pointer: JsonPointer): JsonSchemaObject {
    const entries = input.body?.entries ?? [];
    if (entries.length === 0) {
      this.error("JOTL1025", {}, input.body?.span ?? input.compSpan);
      return {};
    }
    const values: LiteralScalar[] = [];
    const kept: { entry: Entry; description: string | undefined }[] = [];
    for (const entry of entries) {
      if (entry.question || entry.colon || entry.component || entry.body) {
        this.error("JOTL1046", { reason: syntaxReason("enumMemberForm") }, entry.key.span);
      }
      let description: string | undefined;
      for (const member of entry.meta?.members ?? []) {
        if (member.key.value !== "description") {
          this.error("JOTL1046", { reason: syntaxReason("enumMemberMeta") }, member.key.span);
          continue;
        }
        const v = this.toJson(member.value);
        if (typeof v === "string") description = v;
        else this.invalidValue("expectString", { name: "description" }, member.value.span);
      }
      if (entry.key.form === "identifier" && entry.key.name === "null") {
        this.error("JOTL1046", { reason: syntaxReason("enumNullMember") }, entry.key.span);
        continue;
      }
      const value = entry.key.value;
      if (values.some((v) => v === value)) {
        this.error("JOTL1024", { value: JSON.stringify(value) }, entry.key.span);
        continue;
      }
      values.push(value);
      kept.push({ entry, description });
    }
    const type = typeOfValues(values);
    const labeled = kept.some(({ entry, description }) => (entry.label && entry.label.text !== "") || description !== undefined);
    if (labeled) {
      return {
        type,
        oneOf: kept.map(({ entry, description }, i) => {
          this.register(appendPointer(pointer, "oneOf", i), entry.span);
          const branch: JsonSchemaObject = { const: values[i] };
          if (entry.label && entry.label.text !== "") branch.title = entry.label.text;
          if (description !== undefined) branch.description = description;
          return branch;
        }),
      };
    }
    return values.length === 1 ? { type, const: values[0] } : { type, enum: values };
  }

  /** 对象体: 字段与必填. */
  private objectBody(body: Body | undefined, pointer: JsonPointer): JsonSchemaObject {
    const properties: Record<string, JsonSchemaObject> = {};
    const required: string[] = [];
    for (const entry of body?.entries ?? []) {
      const key = entry.key.name;
      if (entry.key.form === "number" && !/^(0|[1-9]\d*)$/.test(entry.key.raw)) {
        this.error("JOTL1046", { reason: syntaxReason("numberKey") }, entry.key.span);
      }
      const fieldPointer = appendPointer(pointer, "properties", key);
      if (Object.hasOwn(properties, key)) {
        this.error("JOTL1005", { name: key }, entry.key.span);
        const kept = this.sourceMap;
        this.sourceMap = new Map();
        this.compileEntry(entry, fieldPointer, false);
        this.sourceMap = kept;
        continue;
      }
      this.register(fieldPointer, entry.span);
      defineKey(properties, key, this.compileEntry(entry, fieldPointer, false));
      if (entry.colon && !entry.question) required.push(key);
    }
    const schema: JsonSchemaObject = { type: "object" };
    if (Object.keys(properties).length > 0) schema.properties = properties;
    if (required.length > 0) schema.required = required;
    return schema;
  }

  private objectMetas(schema: JsonSchemaObject, m: Metas): void {
    const closed = this.bool(m, "closed");
    if (closed === true) schema.additionalProperties = false;
    this.propertiesConstraints(schema, m);
    const fields = Object.keys(schema.properties ?? {});
    const order = m.get("order");
    if (order) {
      const v = this.json(order);
      const found = orderIssue(v, fields);
      if (found) this.xUiIssue(found, order.value.span);
      else this.xUi(schema).order = v as string[];
    }
    const groups = m.get("groups");
    if (groups) {
      const v = this.json(groups);
      const found = groupsIssue(v, fields);
      if (found) this.xUiIssue(found, groups.value.span);
      else this.xUi(schema).groups = v as unknown as NonNullable<XUi["groups"]>;
    }
    const layout = m.get("layout");
    let layoutValue: unknown;
    if (layout) {
      layoutValue = this.json(layout);
      const found = layoutIssue(layoutValue);
      if (found) this.xUiIssue(found, layout.value.span);
      else this.xUi(schema).layout = layoutValue as NonNullable<XUi["layout"]>;
    }
    const columns = m.get("columns");
    if (columns) {
      const v = this.json(columns);
      const found = columnsIssue(v) ?? (layoutValue === "grid" ? undefined : { reason: "columnsNeedGrid" as const, params: {} });
      if (found) this.xUiIssue(found, columns.value.span);
      else this.xUi(schema).columns = v as number;
    }
    this.summary(schema, m, fields);
  }

  private propertiesConstraints(schema: JsonSchemaObject, m: Metas): void {
    const min = this.nonNegInt(m, "minProperties");
    const max = this.nonNegInt(m, "maxProperties");
    if (min !== undefined) schema.minProperties = min;
    if (max !== undefined) schema.maxProperties = max;
    if (min !== undefined && max !== undefined && min > max) {
      this.invalidValue("rangeConflict", { min: "minProperties", max: "maxProperties" }, m.get("maxProperties")!.value.span);
    }
  }

  /** `summary`: 字段名; 已知字段时检查存在. */
  private summary(schema: JsonSchemaObject, m: Metas, fields: readonly string[] | undefined): void {
    const item = m.get("summary");
    if (!item) return;
    const v = this.json(item);
    if (typeof v !== "string" || v === "") {
      this.invalidValue("expectNonEmptyString", { name: "summary" }, item.value.span);
      return;
    }
    if (fields !== undefined && !fields.includes(v)) {
      this.xUiIssue({ reason: "unknownSummaryField", params: { name: v } }, item.value.span);
      return;
    }
    this.xUi(schema).summary = v;
  }

  /** item_meta 的元数据; 类型串多个名字时按名字分键. */
  private itemMetas(m: Metas): Metas {
    const found = this.objectMeta(m, "item_meta");
    return this.metasOf(found?.members ?? [], found?.item.value.span);
  }

  private array(input: TypeInput, pointer: JsonPointer): JsonSchemaObject {
    const m = input.metas;
    const arrayItem = m.get("array_item");
    const itemValue = arrayItem ? this.json(arrayItem) : undefined;
    if (itemValue === "tuple") return this.tuple(input, pointer);
    const schema: JsonSchemaObject = { type: "array" };
    let elementFields: string[] | undefined;
    if (arrayItem) {
      if (input.body) this.error("JOTL1041", { component: input.comp }, input.body.span);
      schema.items = this.typeString(arrayItem, m.get("item_meta"), appendPointer(pointer, "items"), "array");
      elementFields = this.typeStringFields(itemValue);
      this.checkSummaryElement(m, itemValue);
    } else {
      const items = this.compileType(
        {
          comp: "object",
          compSpan: input.compSpan,
          metas: this.itemMetas(m),
          body: input.body,
          title: undefined,
          root: false,
          host: input.body ? { range: input.body.span.range } : input.host,
        },
        appendPointer(pointer, "items"),
      );
      schema.items = items;
      elementFields = Object.keys(items.properties ?? {});
    }
    this.itemsConstraints(schema, m);
    this.summary(schema, m, elementFields);
    return schema;
  }

  /** 类型串的元素确定不是对象(字符串, 数值, 布尔, 数组)时, `summary` 不生效, 报 warning. */
  private checkSummaryElement(m: Metas, typeString: unknown): void {
    const item = m.get("summary");
    if (item === undefined || typeof typeString !== "string") return;
    const names = typeString.split("|").map((n) => n.trim());
    if (names.length !== 1) return;
    const kind = this.jsonKindOf(names[0]!, new Set());
    if (kind === "string" || kind === "number" || kind === "boolean" || kind === "array") {
      this.report(syntaxDiagnostic("JOTL1049", {}, { location: { kind: "source", range: item.keyNode.span.range } }));
    }
  }

  /** 类型串为单个对象类型名时的字段名. */
  private typeStringFields(value: unknown): string[] | undefined {
    if (typeof value !== "string") return undefined;
    const name = value.trim();
    return isTypeName(name) ? this.declFields(name, new Set()) : undefined;
  }

  private tuple(input: TypeInput, pointer: JsonPointer): JsonSchemaObject {
    const m = input.metas;
    if (m.get("item_meta")) this.error("JOTL1012", { name: "item_meta", reason: syntaxReason("itemMetaNeedsType") }, m.get("item_meta")!.keyNode.span);
    if (m.get("summary")) this.error("JOTL1007", { key: "summary", component: "tuple" }, m.get("summary")!.keyNode.span);
    if (!input.body) this.error("JOTL1046", { reason: syntaxReason("tupleNoBody") }, input.compSpan);
    const prefixItems: JsonSchemaObject[] = [];
    let rest: JsonSchemaObject | undefined;
    let required = 0;
    let optionalSeen = false;
    for (const entry of input.body?.entries ?? []) {
      if (entry.key.form === "star") {
        if (rest !== undefined || entry.question) {
          this.error("JOTL1046", { reason: syntaxReason("tupleStar") }, entry.key.span);
          if (rest !== undefined) continue;
        }
        const restPointer = appendPointer(pointer, "items");
        this.register(restPointer, entry.span);
        rest = this.compileEntry(entry, restPointer, false);
        continue;
      }
      if (entry.key.form !== "number" || entry.key.raw !== String(prefixItems.length)) {
        this.error("JOTL1046", { reason: syntaxReason("tuplePosition", { key: entry.key.raw }) }, entry.key.span);
        continue;
      }
      const optional = !entry.colon || entry.question !== undefined;
      if (optional) optionalSeen = true;
      else if (optionalSeen) this.error("JOTL1046", { reason: syntaxReason("tupleOptional") }, entry.key.span);
      else required++;
      const itemPointer = appendPointer(pointer, "prefixItems", prefixItems.length);
      this.register(itemPointer, entry.span);
      prefixItems.push(this.compileEntry(entry, itemPointer, false));
    }
    const schema: JsonSchemaObject = { type: "array", prefixItems, items: rest ?? false };
    this.itemsConstraints(schema, m, required);
    return schema;
  }

  private map(input: TypeInput, pointer: JsonPointer): JsonSchemaObject {
    const m = input.metas;
    const mapItem = m.get("map_item");
    const schema: JsonSchemaObject = { type: "object" };
    let valueFields: string[] | undefined;
    const valuePointer = appendPointer(pointer, "additionalProperties");
    if (mapItem) {
      if (input.body) this.error("JOTL1041", { component: input.comp }, input.body.span);
      schema.additionalProperties = this.typeString(mapItem, m.get("item_meta"), valuePointer, "map");
      valueFields = this.typeStringFields(this.json(mapItem));
      this.checkSummaryElement(m, this.json(mapItem));
    } else {
      const value = this.compileType(
        { comp: "object", compSpan: input.compSpan, metas: this.itemMetas(m), body: input.body, title: undefined, root: false, host: input.body ? { range: input.body.span.range } : input.host },
        valuePointer,
      );
      schema.additionalProperties = value;
      valueFields = Object.keys(value.properties ?? {});
    }
    const keyMeta = this.objectMeta(m, "key_meta");
    if (keyMeta) {
      const names: JsonSchemaObject = { type: "string" };
      const km = this.metasOf(keyMeta.members, keyMeta.item.value.span);
      for (const item of km.items.values()) {
        if (KEY_META_KEYS.includes(item.key)) km.allow(item.key);
        else this.error("JOTL1020", { reason: syntaxReason("keyMetaKey") }, item.keyNode.span);
      }
      this.stringConstraints(names, km);
      schema.propertyNames = names;
    }
    this.propertiesConstraints(schema, m);
    this.summary(schema, m, valueFields);
    return schema;
  }

  private union(input: TypeInput, pointer: JsonPointer): JsonSchemaObject {
    const m = input.metas;
    const disc = m.get("discriminator");
    const unionItem = m.get("union_item");
    if (disc && unionItem) {
      this.error("JOTL1047", { component: "union", reason: syntaxReason("unionBothModes") }, unionItem.keyNode.span);
    } else if (!disc && !unionItem) {
      this.error("JOTL1047", { component: "union", reason: syntaxReason("unionMode") }, input.compSpan);
      return {};
    }
    if (unionItem) {
      if (input.body) this.error("JOTL1041", { component: input.comp }, input.body.span);
      return this.typeString(unionItem, m.get("item_meta"), pointer, "union");
    }
    const item = m.get("item_meta");
    if (item) this.error("JOTL1012", { name: "item_meta", reason: syntaxReason("itemMetaNeedsType") }, item.keyNode.span);
    const name = this.str(m, "discriminator", true);
    if (name === undefined) return {};
    if (!input.body?.entries.length) {
      this.error("JOTL1047", { component: "union", reason: syntaxReason("unionNoBranch") }, input.body?.span ?? input.compSpan);
      return {};
    }
    return { oneOf: this.branches(input, name, pointer) };
  }

  private branches(input: TypeInput, disc: string, pointer: JsonPointer): JsonSchemaObject[] {
    const out: JsonSchemaObject[] = [];
    const values: LiteralScalar[] = [];
    for (const entry of input.body?.entries ?? []) {
      if (entry.question || !entry.colon) this.error("JOTL1046", { reason: syntaxReason("branchForm") }, entry.key.span);
      const value = entry.key.value;
      if (values.some((v) => v === value)) {
        this.error("JOTL1046", { reason: syntaxReason("duplicateBranch", { value: JSON.stringify(value) }) }, entry.key.span);
        continue;
      }
      values.push(value);
      const branchPointer = appendPointer(pointer, "oneOf", out.length);
      this.register(branchPointer, entry.span);
      const comp = compOf(entry);
      const title = entry.label && entry.label.text !== "" ? entry.label.text : undefined;
      const marker: JsonSchemaObject = { type: jsonTypeOf(value), const: value };
      if (comp === "object") {
        const own = entry.body?.entries.find((e) => e.key.name === disc);
        if (own) this.error("JOTL1046", { reason: syntaxReason("branchDiscriminator", { name: disc }) }, own.key.span);
        const branch = this.compileEntry(entry, branchPointer, false);
        const properties: Record<string, unknown> = {};
        defineKey(properties, disc, marker);
        for (const [k, v] of Object.entries(branch.properties ?? {})) if (k !== disc) defineKey(properties, k, v);
        branch.properties = properties as Record<string, JsonSchemaObject>;
        branch.required = [disc, ...(branch.required ?? []).filter((k) => k !== disc)];
        out.push(branch);
        continue;
      }
      if (isTypeName(comp) && this.decls.has(comp) && this.declFields(comp, new Set()) !== undefined) {
        if (entry.body) this.error("JOTL1044", { name: comp }, entry.body.span);
        for (const member of entry.meta?.members ?? []) this.error("JOTL1007", { key: member.key.value, component: comp }, member.key.span);
        const branch: JsonSchemaObject = { type: "object", allOf: [{ $ref: `#${appendPointer(DEFS_POINTER, comp)}` }], properties: {}, required: [disc] };
        defineKey(branch.properties!, disc, marker);
        if (title !== undefined) branch.title = title;
        out.push(branch);
        continue;
      }
      this.error("JOTL1046", { reason: syntaxReason("branchNotObject", { name: entry.key.raw }) }, entry.component?.span ?? entry.key.span);
    }
    return out;
  }

  private jsontext(input: TypeInput, pointer: JsonPointer): JsonSchemaObject {
    const m = input.metas;
    const schema: JsonSchemaObject = { type: "string", contentMediaType: "application/json" };
    this.stringConstraints(schema, m);
    const jsonItem = m.get("json_item");
    const contentPointer = appendPointer(pointer, "contentSchema");
    if (jsonItem) {
      if (input.body) this.error("JOTL1041", { component: input.comp }, input.body.span);
      schema.contentSchema = this.typeString(jsonItem, m.get("item_meta"), contentPointer, "json");
    } else if (input.body) {
      schema.contentSchema = this.compileType(
        { comp: "object", compSpan: input.compSpan, metas: this.itemMetas(m), body: input.body, title: undefined, root: false, host: { range: input.body.span.range } },
        contentPointer,
      );
    } else if (m.get("item_meta")) {
      this.error("JOTL1012", { name: "item_meta", reason: syntaxReason("itemMetaNeedsType") }, m.get("item_meta")!.keyNode.span);
    }
    return schema;
  }

  private ref(input: TypeInput, pointer: JsonPointer): JsonSchemaObject {
    this.noBody(input, "ref");
    const m = input.metas;
    const target: JsonSchemaObject = { $ref: `#${appendPointer(DEFS_POINTER, input.comp)}` };
    const multipleItem = m.get("multiple");
    const multiple = this.bool(m, "multiple") === true;
    if (multiple && !this.isEnumDecl(input.comp, new Set())) {
      this.error("JOTL1012", { name: "multiple", reason: syntaxReason("multipleNeedsEnum") }, multipleItem!.keyNode.span);
    }
    if (!multiple) {
      this.requireMultiple(m);
      this.summary(target, m, this.declFields(input.comp, new Set()));
      return target;
    }
    this.register(appendPointer(pointer, "items"), input.host);
    const schema: JsonSchemaObject = { type: "array", items: target };
    this.itemsConstraints(schema, m);
    schema.uniqueItems = true;
    if (m.get("summary")) this.error("JOTL1007", { key: "summary", component: input.comp }, m.get("summary")!.keyNode.span);
    return schema;
  }

  /** 顶层类型的字段名; 不是对象时返回 undefined. */
  private declFields(name: string, visiting: Set<string>): string[] | undefined {
    const entry = this.decls.get(name);
    if (entry === undefined || visiting.has(name)) return undefined;
    visiting.add(name);
    const comp = compOf(entry);
    if (comp === "object") return entry.body?.entries.map((e) => e.key.name) ?? [];
    if (isTypeName(comp) && !entry.meta?.members.some((mm) => mm.key.value === "multiple")) return this.declFields(comp, visiting);
    return undefined;
  }

  private isEnumDecl(name: string, visiting: Set<string>): boolean {
    const entry = this.decls.get(name);
    if (entry === undefined || visiting.has(name)) return false;
    visiting.add(name);
    const comp = compOf(entry);
    const multiple = entry.meta?.members.some((mm) => mm.key.value === "multiple" && mm.value.kind === "LiteralValue" && mm.value.value === true);
    if (multiple) return false;
    if (comp === "enum") return true;
    return isTypeName(comp) && this.isEnumDecl(comp, visiting);
  }

  // ---- 类型串 ----

  /** 类型串(定稿 §6): 单个名字编译为该类型, 多个名字编译为按 JSON 类型区分的 anyOf. */
  private typeString(item: MetaItem, metaItem: MetaItem | undefined, pointer: JsonPointer, mode: "array" | "map" | "union" | "json"): JsonSchemaObject {
    const value = this.json(item);
    const span = item.value.span;
    if (typeof value !== "string") return this.invalidValue("expectString", { name: item.key }, span) ?? {};
    const names = value.split("|").map((n) => n.trim());
    const fail = (reason: SyntaxReason, params: Record<string, string | number> = {}): JsonSchemaObject => {
      this.error("JOTL1042", { text: value, reason: syntaxReason(reason, params) }, span);
      return {};
    };
    const seen = new Set<string>();
    for (const name of names) {
      if (name === "") return fail("emptyTypeString");
      if (name === "null") return fail("nullInTypeString");
      if (name === "enum") return fail("enumInTypeString");
      if (name === "tuple") return fail("tupleInTypeString");
      if (seen.has(name)) return fail("duplicateTypeName", { name });
      seen.add(name);
    }
    if (mode === "union" && names.length < 2) return fail("unionNeedsTwo");
    const metaValue = metaItem?.value;
    if (metaValue !== undefined && metaValue.kind !== "ObjectValue") {
      return this.invalidValue("expectObject", { name: "item_meta" }, metaValue.span) ?? {};
    }
    const members = metaValue?.members ?? [];
    const input = (name: string, metas: Metas): TypeInput => ({
      comp: name,
      compSpan: span,
      metas,
      body: undefined,
      title: undefined,
      root: false,
      host: { range: span.range },
    });
    if (names.length === 1) return this.compileType(input(names[0]!, this.metasOf(members, metaValue?.span)), pointer);

    const byName = new Map<string, Metas>();
    for (const member of members) {
      if (!names.includes(member.key.value)) {
        this.error("JOTL1020", { reason: syntaxReason("itemMetaKey", { name: member.key.value }) }, member.key.span);
        continue;
      }
      if (member.value.kind !== "ObjectValue") {
        this.error("JOTL1020", { reason: syntaxReason("itemMetaShape") }, member.value.span);
        continue;
      }
      byName.set(member.key.value, this.metasOf(member.value.members, member.value.span));
    }
    this.checkJsonKinds(names, value, span);
    return {
      anyOf: names.map((name, i) =>
        this.compileType(input(name, byName.get(name) ?? this.metasOf([], undefined)), appendPointer(pointer, "anyOf", i)),
      ),
    };
  }

  private checkJsonKinds(names: readonly string[], text: string, span: SourceSpan): void {
    const counts = new Map<string, number>();
    for (const name of names) {
      const kind = this.jsonKindOf(name, new Set());
      if (kind === undefined) continue;
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    for (const [kind, count] of counts) {
      if (count > 1 || (kind === "any" && names.length > 1)) {
        this.error("JOTL1043", { type: kind === "any" ? l10n("任意类型", "any-type") : kind, text }, span);
        return;
      }
    }
  }

  /** 名字编译出的 JSON 类型; money bigint 各自独立, 联合等无法判定的返回 undefined. */
  private jsonKindOf(name: string, visiting: Set<string>): string | undefined {
    if (isComponentName(name)) {
      if (STRING_COMPONENTS.has(name)) return "string";
      const map: Partial<Record<ComponentName, string>> = {
        number: "number", integer: "number", boolean: "boolean", array: "array", object: "object", map: "object",
        money: "money", bigint: "bigint", any: "any",
      };
      return map[name];
    }
    if (this.hasExtension(name) && !this.decls.has(name)) {
      const type = this.widgets[name]!.type;
      return type === "integer" ? "number" : typeof type === "string" ? type : undefined;
    }
    const entry = this.decls.get(name);
    if (entry === undefined || visiting.has(name)) return undefined;
    visiting.add(name);
    if (entry.meta?.members.some((mm) => mm.key.value === "multiple")) return "array";
    const comp = compOf(entry);
    if (comp === "enum") {
      const types = new Set((entry.body?.entries ?? []).map((e) => jsonTypeOf(e.key.value)).map((t) => (t === "integer" ? "number" : t)));
      return types.size === 1 ? [...types][0] : undefined;
    }
    return this.jsonKindOf(comp, visiting);
  }

  // ---- 组件选择, 通用元数据, 自定义键 ----

  private applyWidget(schema: JsonSchemaObject, kind: MetaTarget, input: TypeInput): void {
    const m = input.metas;
    const item = m.get("widget");
    let widget = this.str(m, "widget");
    if (widget === "") {
      this.xUiIssue({ reason: "emptyWidget", params: {} }, item!.value.span);
      widget = undefined;
    }
    const thousands = this.bool(m, "thousands");
    if (thousands !== undefined && thousands !== THOUSANDS_DEFAULTS[kind as ComponentName]) this.xUi(schema).thousands = thousands;
    if (kind === "ref" || kind === "ext") {
      if (widget !== undefined) this.xUi(schema).widget = widget;
      return;
    }
    if (widget !== undefined && BUILTIN_WIDGETS.has(widget) && !acceptsWidget(schema, widget, this.resolve)) {
      this.report(syntaxDiagnostic("JOTL1045", { widget }, { location: { kind: "source", range: item!.value.span.range } }));
      widget = undefined;
    }
    // 按 value_format 编译出的形态认不出 widget, 组件名作为 widget 名总要写入.
    const forced = this.forcedWidget.has(schema);
    const chosen = widget ?? COMPONENT_WIDGETS[kind] ?? (forced ? kind : undefined);
    if (chosen !== undefined && (forced || chosen !== defaultWidget(schema, this.resolve))) this.xUi(schema).widget = chosen;
  }

  /** 字段名, 供场景覆盖检查; 非对象为 undefined. */
  private fieldsOf(schema: JsonSchemaObject, kind: MetaTarget, input: TypeInput): string[] | undefined {
    if (kind === "object") return Object.keys(schema.properties ?? {});
    if (kind === "ref" && schema.$ref !== undefined) return this.declFields(input.comp, new Set());
    return undefined;
  }

  private applyCommon(schema: JsonSchemaObject, kind: MetaTarget, input: TypeInput): void {
    const m = input.metas;
    const description = this.str(m, "description");
    if (description !== undefined) schema.description = description;
    const def = m.get("default");
    if (def) schema.default = this.json(def);
    const examples = m.get("examples");
    if (examples) {
      const v = this.json(examples);
      if (Array.isArray(v)) schema.examples = v;
      else this.invalidValue("expectArray", { name: "examples" }, examples.value.span);
    }
    const deprecated = m.get("deprecated");
    if (deprecated) {
      const v = this.json(deprecated);
      if (v === true) schema.deprecated = true;
      else if (typeof v === "string" && v !== "") {
        schema.deprecated = true;
        schema["x-deprecatedReason"] = v;
      } else if (v !== false) this.invalidValue("expectTrueOrString", { name: "deprecated" }, deprecated.value.span);
    }
    for (const key of ["readOnly", "writeOnly"] as const) {
      const v = this.bool(m, key);
      if (v !== undefined) schema[key] = v;
    }
    const errorMessage = m.get("errorMessage");
    if (errorMessage) {
      const v = this.json(errorMessage);
      const found = errorMessageIssue(v);
      if (found) this.invalidValue(found.reason, found.params, errorMessage.value.span);
      else schema.errorMessage = v as string | Record<string, string>;
    }
    const comment = this.str(m, "comment");
    if (comment !== undefined) schema.$comment = comment;
    const props = this.objectMeta(m, "props");
    if (props) this.xUi(schema).props = this.json(props.item) as Record<string, unknown>;
    const decorator = m.get("decorator");
    if (decorator) {
      const v = this.json(decorator);
      if (v === "") this.xUiIssue({ reason: "emptyDecorator", params: {} }, decorator.value.span);
      else if (typeof v === "string" || v === false) this.xUi(schema).decorator = v;
      else this.invalidValue("expectStringOrFalse", { name: "decorator" }, decorator.value.span);
    }
    const hidden = this.bool(m, "hidden");
    if (hidden !== undefined) this.xUi(schema).hidden = hidden;
    const conditions: Condition[] = [];
    for (const key of ["root_if", "node_if"] as const) {
      const item = m.get(key);
      if (!item) continue;
      const r = compileCondition(this.json(item), key === "node_if" ? "node" : "root");
      if ("issue" in r) this.xUiIssue(r.issue, item.value.span);
      else conditions.push(r.condition);
    }
    if (conditions.length > 0) this.xUi(schema).visibleIf = conditions.length === 1 ? conditions[0]! : { all: conditions };
    const variants = this.objectMeta(m, "variants");
    if (variants) {
      const fields = this.fieldsOf(schema, kind, input);
      const out: Record<string, unknown> = {};
      for (const member of variants.members) {
        const r = compileVariant(member.key.value, this.toJson(member.value), fields);
        if ("issue" in r) {
          this.xUiIssue(r.issue, r.issue.reason === "emptyScene" ? member.key.span : member.value.span);
          continue;
        }
        defineKey(out, member.key.value, r.variant);
      }
      if (Object.keys(out).length > 0) this.xUi(schema).variants = out as NonNullable<XUi["variants"]>;
    }
  }

  /** `x_*` 自定义键与 `schema` 原样合并, 都写在最外层节点上; `schema` 在最后合并, 覆盖已生成的关键字时报 warning. */
  private applyCustom(schema: JsonSchemaObject, m: Metas): void {
    for (const item of m.items.values()) {
      if (!CUSTOM_META_KEY_RE.test(item.key) || !m.has(item.key)) continue;
      schema[customMetaKeyword(item.key)] = this.json(item);
    }
    const raw = this.objectMeta(m, "schema");
    if (!raw) return;
    const value = this.json(raw.item) as Record<string, JsonValue>;
    for (const [keyword, keywordValue] of Object.entries(value)) {
      if (RESERVED_SCHEMA_KEYWORDS.has(keyword)) {
        this.error("JOTL1012", { name: "schema", reason: syntaxReason("reservedSchemaKeyword", { keyword }) }, raw.item.value.span);
        continue;
      }
      if (Object.hasOwn(schema, keyword)) {
        this.report(syntaxDiagnostic("JOTL1016", { keyword }, { location: { kind: "source", range: raw.item.value.span.range } }));
      }
      if (keyword === "x-ui") {
        const range = raw.item.value.span.range;
        // `schema` 写入的节点总在 `$defs` 下, 整份 meta-schema 会放过根专属字段.
        if (typeof keywordValue === "object" && keywordValue !== null && !Array.isArray(keywordValue)) {
          for (const key of ROOT_X_UI_KEYS.filter((k) => Object.hasOwn(keywordValue, k))) {
            const reason = syntaxReason("atPath", { path: appendPointer("", key), detail: syntaxReason("rootOnly") });
            this.report(syntaxDiagnostic("JOTL1050", { reason }, { location: { kind: "source", range } }));
          }
        }
        const reason = checkDefaultValue(xUiMetaSchema, keywordValue, X_UI_META_DEFS, xUiMetaSchema);
        if (reason !== undefined) this.report(syntaxDiagnostic("JOTL1050", { reason }, { location: { kind: "source", range } }));
      }
      defineKey(schema, keyword, keywordValue);
    }
  }

  private collectRoot(m: Metas): void {
    const id = m.get("id");
    if (id) {
      const v = this.json(id);
      const found = fileIdIssue(v);
      if (found) this.invalidValue(found.reason, found.params, id.value.span);
      else this.rootExtras.id = v as string;
    }
    const rules = m.get("rules");
    if (rules) {
      const r = compileRules(this.json(rules));
      if ("issue" in r) this.xUiIssue(r.issue, rules.value.span);
      else this.rootExtras.rules = r.rules as JsonValue;
    }
  }
}

/** 编译已解析的文件; 输出的 schema 已按规范化规则排列关键字. */
export function compileFile(ast: JotlFile, options: CompileOptions = {}): CompileFileOutput {
  return new Compiler(ast, options).run();
}
