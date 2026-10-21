// umo JSON → JSON Schema 2020-12(映射见 docs/fengdie-migration.md 与方案 20261012_232718); 没有对应写法的信息写入 `x-fengdie` 并报警告.
import {
  type Diagnostic,
  type DiagnosticLocation,
  JSON_SCHEMA_DIALECT,
  type JsonSchema,
  type JsonSchemaObject,
  type Result,
  type XUiGroup,
  appendPointer,
  l10n,
} from "@jotl/core";
import { isTypeName } from "@jotl/core";
import { type IfPathType, parseIfExpression } from "./if-expression.js";
import { metaReason, type MigrateDiagnosticCode, migrateDiagnostic } from "./diagnostics.js";
import type { UmoOrigins } from "./umo-json.js";
import {
  UMO_CUSTOM_META_RE,
  umoGroupTitle,
  UMO_SUPPORTED_TYPES,
  type UmoEnumItem,
  type UmoJson,
  type UmoMetaValue,
  type UmoNode,
  umoMetaKeys,
} from "./umo-types.js";

const ROOT_TYPE_NAME = "Root";

/** 凤蝶编辑器单选枚举用单选按钮组的选项数上限, 超过时用下拉. */
const FENGDIE_RADIO_MAX = 5;

/** 必须与 `@jotl/core` 编译对应内置组件的结果一致, 否则迁移结果与再次编译的结果不相等. */
const LEAF_SCHEMAS: Readonly<Record<string, JsonSchemaObject>> = {
  string: { type: "string" },
  text: { type: "string", "x-ui": { widget: "textarea" } },
  richtext: { type: "string", contentMediaType: "text/html" },
  url: { type: "string", format: "uri" },
  image: { type: "string", format: "uri", "x-ui": { widget: "image" } },
  color: { type: "string", format: "color" },
  file: { type: "string", format: "uri", "x-ui": { widget: "file" } },
  number: { type: "number" },
  boolean: { type: "boolean" },
  // 凤蝶编辑器是日期时间选择器, 数据是毫秒时间戳: `datetime[value_format: 'x']`.
  date: { type: "integer", minimum: -Number.MAX_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER, "x-valueFormat": "x", "x-ui": { widget: "datetime" } },
  // 组件实例 id.
  component: { type: "string" },
};

const STR: JsonSchemaObject = { type: "string" };
const NUM: JsonSchemaObject = { type: "number" };

/** 按 umo-edit-sdk `build/mock` 的数据形态生成的对象; 不封闭, 旧数据可带更多字段. */
const FIXED_SHAPES: Readonly<Record<string, Record<string, JsonSchemaObject>>> = {
  box: { left: NUM, top: NUM, width: NUM, height: NUM },
  resource: { bizId: STR, data: {} },
  plugin: { id: STR, pluginId: STR, originId: STR, data: {} },
  animation: { type: STR, src: STR, width: NUM, height: NUM, downgradeUrl: STR, size: STR },
  video: {
    assetId: STR,
    assetUrl: STR,
    format: STR,
    type: STR,
    assetType: STR,
    materialSource: STR,
    fileSize: NUM,
    size: STR,
    url: STR,
    downgradeUrl: STR,
  },
};

/** 原类型名需要记入 `x-fengdie.type` 的类型(转换后从形态上认不出来). */
const TRACED_TYPES: ReadonlySet<string> = new Set([
  "component", "box", "resource", "plugin", "animation", "video", "action", "openaction", "module", "modulearray", "spm",
]);


/** x-fengdie 中结构信息占用的键; 同名元数据改记为 `meta` + 首字母大写. */
const RESERVED_TRACE_KEYS: ReadonlySet<string> = new Set(["type", "lottery", "public", "regExpFlags"]);

const STRING_LEAVES: ReadonlySet<string> = new Set(["string", "text", "richtext", "url", "image", "color", "file", "component"]);

const IMAGE_PROPS: ReadonlySet<string> = new Set(["width", "height", "maxWidth", "maxHeight", "aspectRatio", "maxSize", "setDefaultColorTo"]);

const NAMESPACE_RE = /^[a-zA-Z_]\w*\.\w+(\[(?:array|object)\])?$/i;

type Kind =
  | { kind: "leaf"; type: string }
  | { kind: "enum" }
  | { kind: "scalarArray"; element: "string" | "number" }
  | { kind: "object" }
  | { kind: "array" }
  | { kind: "fixed"; type: string };

/** 按 umo 类型名分类; 未知类型返回 undefined. */
function classify(type: string): Kind | undefined {
  const t = type.toLowerCase();
  if (Object.hasOwn(LEAF_SCHEMAS, t)) return { kind: "leaf", type: t };
  if (t === "enum") return { kind: "enum" };
  if (t === "arraystring") return { kind: "scalarArray", element: "string" };
  if (t === "arraynumber") return { kind: "scalarArray", element: "number" };
  if (t === "object" || t === "action" || t === "openaction" || t === "module" || t === "spm") return { kind: "object" };
  if (t === "array" || t === "modulearray") return { kind: "array" };
  if (Object.hasOwn(FIXED_SHAPES, t)) return { kind: "fixed", type: t };
  const ns = NAMESPACE_RE.exec(type);
  if (ns !== null) return ns[1]?.toLowerCase() === "[array]" ? { kind: "array" } : { kind: "object" };
  return undefined;
}

/** 对象与数组的 JS 原型成员名; 指针取值取不到它们. */
const PROTOTYPE_NAMES: ReadonlySet<string> = new Set(["length", ...Object.getOwnPropertyNames(Object.prototype), ...Object.getOwnPropertyNames(Array.prototype)]);

/**
 * 凤蝶 `if` 中 `$` 后路径的数据类型; root 为数据根(多类型文档时为 undefined, 一律按未知).
 * 未声明的对象成员按未知继续, 但原型成员名在未知或未声明时拒绝; 经过标量或数组的非下标成员时为 invalid.
 */
function ifPathType(root: UmoNode | undefined, tokens: readonly string[]): IfPathType {
  type Cursor = { node: UmoNode; item: boolean } | { scalar: IfPathType } | undefined;
  let cursor: Cursor = root === undefined ? undefined : { node: root, item: false };
  for (const token of tokens) {
    if (cursor === undefined) {
      if (PROTOTYPE_NAMES.has(token)) return "invalid";
      continue;
    }
    if ("scalar" in cursor) {
      if (cursor.scalar !== "unknown") return "invalid";
      cursor = undefined;
      if (PROTOTYPE_NAMES.has(token)) return "invalid";
      continue;
    }
    const kind = classify(cursor.node.type);
    const isIndex = /^(?:0|[1-9]\d*)$/.test(token);
    const multiple = kind?.kind === "enum" && cursor.node.meta?.multiple === true;
    if (!cursor.item && (kind?.kind === "array" || kind?.kind === "scalarArray" || multiple)) {
      if (!isIndex) return "invalid";
      if (kind.kind === "array") cursor = { node: cursor.node, item: true };
      else cursor = { scalar: kind.kind === "scalarArray" && kind.element === "number" ? "number" : "string" };
      continue;
    }
    if (kind?.kind === "object" || kind?.kind === "array") {
      const props: unknown = cursor.node.properties;
      const child: unknown = isRecord(props) && Object.hasOwn(props, token) ? props[token] : undefined;
      if (isRecord(child) && typeof child.type === "string") cursor = { node: child as unknown as UmoNode, item: false };
      else if (PROTOTYPE_NAMES.has(token)) return "invalid";
      else cursor = undefined;
      continue;
    }
    if (kind?.kind === "fixed") {
      const shape = FIXED_SHAPES[kind.type]!;
      const child = Object.hasOwn(shape, token) ? shape[token]! : undefined;
      if (child !== undefined && (child.type === "string" || child.type === "number")) cursor = { scalar: child.type };
      else if (PROTOTYPE_NAMES.has(token)) return "invalid";
      else cursor = undefined;
      continue;
    }
    // 叶子, 单选枚举或未知类型: 再取成员时 JS 读的是原型属性或包装对象.
    return kind === undefined ? (PROTOTYPE_NAMES.has(token) ? "invalid" : "unknown") : "invalid";
  }
  if (cursor === undefined) return "unknown";
  if ("scalar" in cursor) return cursor.scalar;
  const kind = classify(cursor.node.type);
  if (kind === undefined) return "unknown";
  if (cursor.item) return "composite";
  switch (kind.kind) {
    case "leaf":
      if (kind.type === "number" || kind.type === "date") return "number";
      if (kind.type === "boolean") return "boolean";
      return STRING_LEAVES.has(kind.type) ? "string" : "unknown";
    case "enum":
      return cursor.node.meta?.multiple === true ? "composite" : "string";
    default:
      return "composite";
  }
}

const NUMERIC_RE = /^-?\d+(?:\.\d+)?$/;


function toNumber(value: UmoMetaValue): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && NUMERIC_RE.test(value)) return Number(value);
  return undefined;
}

function compilePattern(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern, "u");
  } catch {
    return undefined;
  }
}

/** 字母的大小写两种写法(先小写); 无大小写时为 undefined, 大小写不能一一对应(如 `ß` `ς`)时为 null. */
function caseVariants(char: string): [string, string] | undefined | null {
  const lower = char.toLowerCase();
  const upper = char.toUpperCase();
  if (lower === upper) return undefined;
  if ([...lower].length !== 1 || [...upper].length !== 1 || upper.toLowerCase() !== lower || lower.toUpperCase() !== upper) return null;
  return char === lower || char === upper ? [lower, upper] : null;
}

/**
 * `u` 标志下按 Unicode simple/common 折叠互相匹配, 但不能由 `toLowerCase` / `toUpperCase` 一一对应出的字母组(如 `k` `K` 与开尔文 `K`).
 * 由 `/x/iu` 穷举 Unicode 得出, 测试里同样穷举校验.
 */
const UNICODE_FOLDS = "kKK sſS µμΜ åÅÅ ǆǄǅ ǉǇǈ ǌǊǋ ǳǱǲ ͅιιΙ βϐΒ εϵΕ θϑΘϴ κϰΚ πϖΠ ρϱΡ ςσΣ φϕΦ ωΩΩ вᲀВ дᲁД оᲂО сᲃС тᲄᲅТ ъᲆЪ ѣᲇѢ ᲈꙋꙊ ṡẛṠ ßẞ ᾀᾈ ᾁᾉ ᾂᾊ ᾃᾋ ᾄᾌ ᾅᾍ ᾆᾎ ᾇᾏ ᾐᾘ ᾑᾙ ᾒᾚ ᾓᾛ ᾔᾜ ᾕᾝ ᾖᾞ ᾗᾟ ᾠᾨ ᾡᾩ ᾢᾪ ᾣᾫ ᾤᾬ ᾥᾭ ᾦᾮ ᾧᾯ ᾳᾼ ῃῌ ῳῼ".split(" ");

/** 字母在 `i` 标志下互相匹配的全部写法; 含义同 {@link caseVariants}. */
function foldVariants(char: string, unicode: boolean): string[] | undefined | null {
  const group = unicode ? UNICODE_FOLDS.find((g) => [...g].includes(char)) : undefined;
  return group === undefined ? caseVariants(char) : [...group];
}

const CODE_ESCAPE = /^(?:x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]+\}|c[A-Za-z])/;

interface Atom {
  text: string;
  /** 原子代表的单个字符; `\d` `\w` 等字符集转义没有. */
  char?: string;
}

/**
 * 把 `i` 标志改写进 pattern: 字母改为 `[aA]`, 字符类内补上另一种大小写; `unicode` 时按 {@link UNICODE_FOLDS} 补上特殊折叠(`[kKK]`).
 * 遇到属性类 `\p{...}`, 反向引用, 内联修饰符, 非 ASCII 区间与大小写不能一一对应的字母时返回 undefined.
 */
function foldCase(source: string, unicode: boolean): string | undefined {
  const chars = [...source];
  let i = 0;
  const readAtom = (): Atom | undefined => {
    const c = chars[i]!;
    if (c !== "\\") {
      i += 1;
      return { text: c, char: c };
    }
    const code = CODE_ESCAPE.exec(chars.slice(i + 1, i + 12).join(""));
    if (code !== null) {
      i += 1 + code[0].length;
      const char = code[0].startsWith("c")
        ? String.fromCharCode(code[0].charCodeAt(1) % 32)
        : String.fromCodePoint(parseInt(code[0].slice(1).replace(/[{}]/g, ""), 16));
      return { text: `\\${code[0]}`, char };
    }
    const next = chars[i + 1];
    if (next === undefined || /[pPk1-9]/.test(next)) return undefined;
    i += 2;
    return /[A-Za-z0-9]/.test(next) ? { text: `\\${next}` } : { text: `\\${next}`, char: next };
  };
  const foldAtom = (atom: Atom): string | undefined => {
    if (atom.char === undefined) return atom.text;
    const variants = foldVariants(atom.char, unicode);
    if (variants === null) return undefined;
    if (variants === undefined) return atom.text;
    return atom.text === atom.char ? `[${variants.join("")}]` : `[${atom.text}${variants.filter((v) => v !== atom.char).join("")}]`;
  };
  const foldClass = (): string | undefined => {
    i += 1;
    const negated = chars[i] === "^";
    if (negated) i += 1;
    let body = "";
    let extra = "";
    while (i < chars.length && chars[i] !== "]") {
      const start = readAtom();
      if (start === undefined) return undefined;
      if (chars[i] === "-" && chars[i + 1] !== undefined && chars[i + 1] !== "]") {
        i += 1;
        const end = readAtom();
        if (end?.char === undefined || start.char === undefined) return undefined;
        if (/[^\x00-\x7f]/.test(start.char + end.char)) return undefined;
        body += `${start.text}-${end.text}`;
        for (const [lo, hi] of [["a", "z"], ["A", "Z"]] as const) {
          const from = start.char > lo ? start.char : lo;
          const to = end.char < hi ? end.char : hi;
          if (from > to) continue;
          extra += from === to ? swapCase(from) : `${swapCase(from)}-${swapCase(to)}`;
        }
        // 区间只允许 ASCII, 补上区间内字母的非 ASCII 折叠(`k` → `K`, `s` → `ſ`).
        if (unicode) {
          for (const group of UNICODE_FOLDS) {
            if ([...group].some((g) => g >= start.char! && g <= end.char!)) extra += [...group].filter((g) => g > "\x7f").join("");
          }
        }
        continue;
      }
      body += start.text === "-" ? "\\-" : start.text;
      if (start.char === undefined) continue;
      const variants = foldVariants(start.char, unicode);
      if (variants === null) return undefined;
      if (variants !== undefined) extra += variants.filter((v) => v !== start.char).join("");
    }
    if (i >= chars.length) return undefined;
    i += 1;
    return `[${negated ? "^" : ""}${body}${extra}]`;
  };

  let out = "";
  while (i < chars.length) {
    let piece: string | undefined;
    if (chars[i] === "[") {
      piece = foldClass();
    } else if (chars[i] === "(" && chars[i + 1] === "?") {
      const group = /^\(\?(?:<[A-Za-z_$][\w$]*>|<=|<!|[:=!])/.exec(chars.slice(i, i + 64).join(""));
      piece = group?.[0];
      if (group !== null) i += [...group[0]].length;
    } else {
      const atom = readAtom();
      piece = atom === undefined ? undefined : foldAtom(atom);
    }
    if (piece === undefined) return undefined;
    out += piece;
  }
  return compilePattern(out) === undefined ? undefined : out;
}

function swapCase(char: string): string {
  return char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase();
}

/** `"/^https:/gi"` 这种带定界符与标志的 JS 正则字面量拆成源码与标志; 其他写法原样返回. */
function splitRegExp(value: string): { source: string; flags?: string } {
  const m = /^\/(.+)\/([a-z]*)$/s.exec(value);
  if (m === null) return { source: value };
  return m[2] === "" ? { source: m[1]! } : { source: m[1]!, flags: m[2]! };
}

// 改名规则必须与 `@jotl/core` 打印器一致(大驼峰, 去掉非字母数字, 数字开头加 `T`, 重名加序号), 否则打印器会再改一次名, 迁移出的 Jotl 与 schema 不再对应.
function sanitizeTypeName(name: string, used: ReadonlySet<string>): string {
  const parts = name.split(/[^A-Za-z0-9]+/).filter((p) => p !== "");
  let base = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  if (!/^[A-Z]/.test(base)) base = `T${base}`;
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setUi(node: JsonSchemaObject, key: string, value: unknown): void {
  node["x-ui"] = { ...node["x-ui"], [key]: value };
}

function setUiProp(node: JsonSchemaObject, key: string, value: UmoMetaValue): void {
  const ui = node["x-ui"] ?? {};
  node["x-ui"] = { ...ui, props: { ...ui.props, [key]: value } };
}

/** 字段转换结果: 父对象据此写 `required` 与分组. */
interface Field {
  schema: JsonSchemaObject;
  required: boolean;
  group?: string;
}

/** 单个节点转换期间的累积状态. */
interface NodeState {
  node: UmoNode;
  pointer: string;
  schema: JsonSchemaObject;
  trace: Record<string, unknown>;
  required: boolean;
  group?: string;
  firstLevel: boolean;
  defaultKey?: string;
}

export interface UmoToSchemaOptions {
  /** 源码位置表(由 `fengdieToUmoJson` 给出); 缺省时诊断位置为 umo JSON 中的指针. */
  origins?: UmoOrigins;
  /** 指针诊断所属的文档名. */
  file?: string;
}

class Converter {
  readonly diagnostics: Diagnostic[] = [];
  private failed = false;
  /** 凤蝶 `if` 中 `$` 指向的数据根; 只有单一根类型的文档才确定. */
  private dataRoot: UmoNode | undefined;

  constructor(private readonly options: UmoToSchemaOptions) {}

  document(umo: unknown): JsonSchemaObject | undefined {
    if (!isRecord(umo)) return this.invalid("", metaReason("notObject"));
    if (typeof umo.type === "string") {
      this.dataRoot = umo as unknown as UmoNode;
      const root = this.root(umo as unknown as UmoNode, "");
      if (this.failed) return undefined;
      return { $schema: JSON_SCHEMA_DIALECT, $ref: `#/$defs/${ROOT_TYPE_NAME}`, "x-ui": { version: 1 }, $defs: { [ROOT_TYPE_NAME]: root } };
    }
    const names = Object.keys(umo);
    const used = new Set(names.filter(isTypeName));
    const defs: [string, JsonSchema][] = [];
    for (const name of names) {
      const pointer = appendPointer("", name);
      const value = umo[name];
      if (!isRecord(value) || typeof value.type !== "string") return this.invalid(pointer, metaReason("noType"));
      let printed = name;
      if (!isTypeName(name)) {
        printed = sanitizeTypeName(name, used);
        used.add(printed);
        this.warn("JOTL8117", { name, newName: printed }, this.locate(value, pointer));
      }
      defs.push([printed, this.root(value as unknown as UmoNode, pointer)]);
    }
    if (this.failed) return undefined;
    const head: JsonSchemaObject = defs.length > 0 ? { $ref: `#/$defs/${defs[0]![0]}`, "x-ui": { version: 1 } } : {};
    return { $schema: JSON_SCHEMA_DIALECT, ...head, $defs: Object.fromEntries(defs) };
  }

  private root(node: UmoNode, pointer: string): JsonSchemaObject {
    const state = this.state(node, pointer, false);
    // 无损保留在 `x-fengdie` 的信息不报警告; 警告只用于真正丢失的信息.
    if (node.lottery === true) state.trace.lottery = true;
    if (node.public === true) state.trace.public = true;
    return this.convert(state, true).schema;
  }

  private state(node: UmoNode, pointer: string, firstLevel: boolean): NodeState {
    return { node, pointer, schema: {}, trace: {}, required: false, firstLevel };
  }

  /** isRoot 时 node 为根: 其子字段是第一层字段, 可分组. */
  private convert(state: NodeState, isRoot: boolean): Field {
    const { node } = state;
    let kind = classify(node.type);
    if (kind === undefined) {
      this.warn("JOTL8111", { type: node.type }, this.locate(node, state.pointer));
      kind = { kind: "leaf", type: "string" };
    }
    const label = typeof node.description === "string" ? node.description.trim() : "";
    if (label !== "") state.schema.title = label;
    if (TRACED_TYPES.has(node.type.toLowerCase()) || NAMESPACE_RE.test(node.type)) state.trace.type = node.type;

    switch (kind.kind) {
      case "leaf":
        Object.assign(state.schema, clone(LEAF_SCHEMAS[kind.type]!));
        break;
      case "enum":
        break;
      case "scalarArray":
        Object.assign(state.schema, { type: "array", items: clone(LEAF_SCHEMAS[kind.element]!) });
        break;
      case "object":
        Object.assign(state.schema, this.object(node, state.pointer, isRoot));
        break;
      case "array":
        Object.assign(state.schema, { type: "array", items: this.object(node, state.pointer, isRoot) });
        break;
      case "fixed":
        Object.assign(state.schema, { type: "object", properties: clone(FIXED_SHAPES[kind.type]!) });
        break;
    }
    const enumInfo = kind.kind === "enum" ? this.enumBase(state) : undefined;
    this.applyMeta(state, kind, enumInfo);
    if (enumInfo !== undefined) this.enumWidget(state.schema, enumInfo.multiple, enumInfo.count);
    if (Object.keys(state.trace).length > 0) state.schema["x-fengdie"] = state.trace;
    const field: Field = { schema: state.schema, required: state.required };
    if (state.group !== undefined) field.group = state.group;
    return field;
  }

  /** properties → `{type: object, properties, required?, x-ui.groups?}`. */
  private object(node: UmoNode, pointer: string, isRoot: boolean): JsonSchemaObject {
    const props = node.properties;
    const out: JsonSchemaObject = { type: "object", properties: {} };
    if (props === undefined) {
      delete out.properties;
      return out;
    }
    if (!isRecord(props)) {
      this.invalid(appendPointer(pointer, "properties"), metaReason("notObject"));
      return out;
    }
    const required: string[] = [];
    const groups: XUiGroup[] = [];
    for (const [key, child] of Object.entries(props)) {
      const childPointer = appendPointer(appendPointer(pointer, "properties"), key);
      if (!isRecord(child) || typeof child.type !== "string") {
        this.invalid(childPointer, metaReason("noType"));
        continue;
      }
      const field = this.convert(this.state(child as unknown as UmoNode, childPointer, isRoot), false);
      out.properties![key] = field.schema;
      if (field.required) required.push(key);
      if (field.group !== undefined) {
        const title = umoGroupTitle(field.group);
        const group = groups.find((g) => g.title === title);
        if (group === undefined) groups.push({ title, fields: [key] });
        else group.fields.push(key);
      }
    }
    // Jotl 编译空对象体 `{}` 时不写 properties.
    if (Object.keys(out.properties!).length === 0) delete out.properties;
    if (required.length > 0) out.required = required;
    // 决策 D2: 第一层 `group` 渲染为根对象的分组.
    if (groups.length > 0) setUi(out, "groups", groups);
    return out;
  }

  private enumBase(state: NodeState): { members: { value: string; title?: string }[]; multiple: boolean; count: number } {
    const items = Array.isArray(state.node.items) ? state.node.items : [];
    const members: { value: string; title?: string }[] = [];
    items.forEach((item: UmoEnumItem, i) => {
      const value = String(item.value);
      if (members.some((m) => m.value === value)) {
        this.warn("JOTL8113", { value }, this.locate(item, appendPointer(appendPointer(state.pointer, "items"), String(i))));
        return;
      }
      const title = typeof item.label === "string" ? item.label.trim() : "";
      members.push(title === "" ? { value } : { value, title });
    });
    const multipleValue = state.node.meta?.multiple;
    const multiple = multipleValue === true;
    let element: JsonSchemaObject;
    if (members.length === 0) {
      this.warn("JOTL8114", {}, this.locate(state.node, state.pointer));
      element = { ...LEAF_SCHEMAS.string };
    } else if (members.some((m) => m.title !== undefined)) {
      element = { type: "string", oneOf: members.map((m) => (m.title === undefined ? { const: m.value } : { const: m.value, title: m.title })) };
    } else if (members.length === 1) {
      element = { type: "string", const: members[0]!.value };
    } else {
      element = { type: "string", enum: members.map((m) => m.value) };
    }
    Object.assign(state.schema, multiple ? { type: "array", items: element, uniqueItems: true } : element);
    return { members, multiple, count: members.length };
  }

  /** 保持凤蝶的观感: 多选为复选框组, 选项不多的单选为单选按钮组; Jotl 的默认都是下拉. */
  private enumWidget(schema: JsonSchemaObject, multiple: boolean, count: number): void {
    if (multiple && count > 0) setUi(schema, "widget", "checkbox");
    else if (!multiple && count >= 2 && count <= FENGDIE_RADIO_MAX) setUi(schema, "widget", "radio");
  }

  private applyMeta(state: NodeState, kind: Kind, enumInfo: { members: { value: string }[]; multiple: boolean } | undefined): void {
    const meta = state.node.meta;
    if (meta === undefined) return;
    if (!isRecord(meta)) {
      this.invalid(appendPointer(state.pointer, "meta"), metaReason("notObject"));
      return;
    }
    const allowed = umoMetaKeys(state.node.type);
    const schema = state.schema;
    const isArray = schema.type === "array" && kind.kind !== "enum";
    const isString = kind.kind === "leaf" && STRING_LEAVES.has(kind.type);
    let defaultKey: string | undefined;
    for (const [key, value] of Object.entries(meta) as [string, UmoMetaValue][]) {
      const at = this.locate(state.node, state.pointer, key);
      if (!(allowed?.includes(key) || UMO_CUSTOM_META_RE.test(key))) {
        if (allowed === undefined) this.warn("JOTL8118", { type: state.node.type, key }, at);
        else this.warn("JOTL8105", { key, type: state.node.type }, at);
        continue;
      }
      switch (key) {
        case "description":
          this.applyString(schema, key, value, "description", at);
          continue;
        case "default":
        case "defaultValue":
          if (defaultKey === undefined || key === "default") {
            if (defaultKey !== undefined) this.warn("JOTL8115", {}, at);
            defaultKey = key;
          } else this.warn("JOTL8115", {}, at);
          continue;
        case "required":
          if (typeof value === "boolean") state.required = value;
          else this.invalidMeta(key, metaReason("boolean"), at);
          continue;
        case "if": {
          const root = this.dataRoot;
          const condition = typeof value === "string" ? parseIfExpression(value, (tokens) => ifPathType(root, tokens)) : undefined;
          if (condition !== undefined) {
            setUi(schema, "visibleIf", condition);
            continue;
          }
          break;
        }
        case "group":
          if (state.firstLevel && typeof value === "string" && value !== "") {
            state.group = value;
            continue;
          }
          break;
        case "multiple":
          if (kind.kind === "enum") {
            if (typeof value !== "boolean") this.invalidMeta(key, metaReason("boolean"), at);
            continue;
          }
          break;
        case "minLength":
        case "maxLength":
          if (isString || isArray) {
            const keyword = isArray ? (key === "minLength" ? "minItems" : "maxItems") : key;
            this.applyLength(schema, key, value, keyword, at);
            continue;
          }
          break;
        case "min":
        case "max":
          if (kind.kind === "leaf" && kind.type === "number") {
            const n = toNumber(value);
            if (n === undefined) this.invalidMeta(key, metaReason("number"), at);
            else schema[key === "min" ? "minimum" : "maximum"] = n;
            continue;
          }
          break;
        case "step":
          if (kind.kind === "leaf" && kind.type === "number") {
            setUiProp(schema, key, value);
            continue;
          }
          break;
        case "regExp":
          if (isString) {
            this.applyPattern(state, value, at);
            continue;
          }
          break;
        case "errorMsg":
          if (isString) {
            this.applyString(schema, key, value, "errorMessage", at);
            continue;
          }
          break;
        case "placeholder":
          if (isString) {
            setUiProp(schema, key, value);
            continue;
          }
          break;
        case "showKey":
          if (isArray) {
            const items = schema.items as JsonSchemaObject;
            if (typeof value === "string" && items.properties !== undefined && Object.hasOwn(items.properties, value)) {
              setUi(schema, "summary", value);
            } else {
              this.invalidMeta(key, metaReason("notAField"), at);
            }
            continue;
          }
          break;
      }
      if (kind.kind === "leaf" && kind.type === "image" && IMAGE_PROPS.has(key)) {
        setUiProp(schema, key, value);
        continue;
      }
      // 决策 D3: 其余元数据原样进入 `x-fengdie`, 无损保留, 不报警告.
      state.trace[RESERVED_TRACE_KEYS.has(key) ? `meta${key.charAt(0).toUpperCase()}${key.slice(1)}` : key] = value;
    }
    if (defaultKey !== undefined) {
      const at = this.locate(state.node, state.pointer, defaultKey);
      if (enumInfo !== undefined) this.applyEnumDefault(schema, meta[defaultKey]!, enumInfo.members, enumInfo.multiple, at);
      else this.applyDefault(schema, kind, meta[defaultKey]!, at);
    }
  }

  private applyLength(schema: JsonSchemaObject, key: string, value: UmoMetaValue, keyword: "minLength" | "maxLength" | "minItems" | "maxItems", at: DiagnosticLocation | undefined): void {
    const n = toNumber(value);
    if (n === undefined || !Number.isInteger(n) || n < 0) this.invalidMeta(key, metaReason("nonNegativeInteger"), at);
    // 下限 0 等于不限, 与不写等价; 不写出, 迁移出的 Jotl 也不带多余的 `minLength: 0`.
    else if (n === 0 && (keyword === "minLength" || keyword === "minItems")) delete schema[keyword];
    else schema[keyword] = n;
  }

  private applyPattern(state: NodeState, value: UmoMetaValue, at: DiagnosticLocation | undefined): void {
    if (typeof value !== "string" || value === "") return this.invalidMeta("regExp", metaReason("nonEmptyString"), at);
    const { source, flags } = splitRegExp(value);
    if (compilePattern(source) === undefined) return this.invalidMeta("regExp", metaReason("invalidPattern"), at);
    let pattern = source;
    let kept = "";
    for (const flag of flags ?? "") {
      if (flag === "g") continue;
      const folded = flag === "i" ? foldCase(source, flags?.includes("u") === true) : undefined;
      if (folded !== undefined) pattern = folded;
      else {
        this.warn(flag === "i" ? "JOTL8119" : "JOTL8120", { flag }, at);
        kept += flag;
      }
    }
    state.schema.pattern = pattern;
    if (kept !== "") state.trace.regExpFlags = kept;
  }

  private applyString(schema: JsonSchemaObject, key: string, value: UmoMetaValue, keyword: "description" | "errorMessage", at: DiagnosticLocation | undefined): void {
    if (typeof value !== "string" || value.trim() === "") this.invalidMeta(key, metaReason("nonEmptyString"), at);
    else schema[keyword] = value;
  }

  private applyDefault(schema: JsonSchemaObject, kind: Kind, value: UmoMetaValue, at: DiagnosticLocation | undefined): void {
    const typeName = kind.kind === "leaf" ? kind.type : String(schema.type);
    let converted: unknown;
    if (kind.kind === "leaf" && STRING_LEAVES.has(kind.type)) converted = String(value);
    else if (kind.kind === "leaf" && (kind.type === "number" || kind.type === "date")) converted = toNumber(value);
    else if (kind.kind === "leaf" && kind.type === "boolean") {
      converted = typeof value === "boolean" ? value : value === "true" ? true : value === "false" ? false : undefined;
    } else if (typeof value === "string") {
      // 对象与数组类的默认值只能写成 JSON 字符串.
      try {
        converted = JSON.parse(value);
      } catch {
        converted = undefined;
      }
    }
    if (converted === undefined || !this.satisfies(schema, converted)) {
      this.warn("JOTL8108", { value: json(value), type: typeName }, at);
      return;
    }
    if (converted !== value) this.warn("JOTL8107", { value: json(value), type: typeName, converted: json(converted) }, at);
    schema.default = converted as JsonSchemaObject["default"];
  }

  private applyEnumDefault(schema: JsonSchemaObject, value: UmoMetaValue, members: readonly { value: string }[], multiple: boolean, at: DiagnosticLocation | undefined): void {
    const typeName = multiple ? "enum[multiple: true]" : "enum";
    const scalar = String(value);
    if (members.length > 0 && !members.some((m) => m.value === scalar)) {
      this.warn("JOTL8108", { value: json(value), type: typeName }, at);
      return;
    }
    const converted = multiple ? [scalar] : scalar;
    if (converted !== value) this.warn("JOTL8107", { value: json(value), type: typeName, converted: json(converted) }, at);
    schema.default = converted;
  }

  /** 与 Jotl 编译期默认值检查同口径: 字符串长度按码点计. */
  private satisfies(schema: JsonSchemaObject, value: unknown): boolean {
    const type = schema.type;
    if (type === "string" && typeof value !== "string") return false;
    if ((type === "number" || type === "integer") && typeof value !== "number") return false;
    if (type === "integer" && !Number.isInteger(value)) return false;
    if (type === "object" && !isRecord(value)) return false;
    if (type === "array" && !Array.isArray(value)) return false;
    if (typeof value === "string") {
      const length = [...value].length;
      if (schema.minLength !== undefined && length < schema.minLength) return false;
      if (schema.maxLength !== undefined && length > schema.maxLength) return false;
      if (schema.pattern !== undefined && !compilePattern(schema.pattern)!.test(value)) return false;
    }
    if (typeof value === "number") {
      if (schema.minimum !== undefined && value < schema.minimum) return false;
      if (schema.maximum !== undefined && value > schema.maximum) return false;
    }
    return true;
  }

  private invalidMeta(key: string, reason: string, at: DiagnosticLocation | undefined): void {
    this.warn("JOTL8106", { key, reason }, at);
  }

  private invalid(pointer: string, reason: string): undefined {
    this.failed = true;
    this.diagnostics.push(migrateDiagnostic("JOTL8007", { reason: `${pointer === "" ? l10n("根", "root") : pointer}: ${reason}` }, { location: this.pointerAt(pointer) }));
    return undefined;
  }

  private pointerAt(pointer: string): DiagnosticLocation {
    return this.options.file === undefined ? { kind: "pointer", pointer } : { kind: "pointer", pointer, document: this.options.file };
  }

  /** 有源码位置表时取源码位置, 否则取 umo JSON 中的指针. */
  private locate(node: object, pointer: string, metaKey?: string): DiagnosticLocation | undefined {
    const origins = this.options.origins;
    if (origins !== undefined) {
      const origin = origins.get(node);
      if (origin === undefined) return undefined;
      const range = metaKey === undefined ? origin.range : (origin.meta?.get(metaKey) ?? origin.range);
      return { kind: "source", range };
    }
    return this.pointerAt(metaKey === undefined ? pointer : appendPointer(appendPointer(pointer, "meta"), metaKey));
  }

  private warn(code: MigrateDiagnosticCode, params: Record<string, string>, location: DiagnosticLocation | undefined): void {
    this.diagnostics.push(migrateDiagnostic(code, params, location === undefined ? {} : { location }));
  }
}

/** 把 umo JSON 转为 JSON Schema 2020-12 文档; 关键字尚未按规范化顺序排列. 结构不合法(JOTL8007)时 value 为 undefined. */
export function umoJsonToSchema(umo: UmoJson | unknown, options: UmoToSchemaOptions = {}): Result<JsonSchemaObject> {
  const converter = new Converter(options);
  const schema = converter.document(umo);
  return { value: schema, diagnostics: converter.diagnostics };
}

/** umo 类型名是否被识别(含 `命名空间.组件` 写法); 供输入类型判定使用. */
export function isKnownUmoType(type: string): boolean {
  return classify(type) !== undefined || UMO_SUPPORTED_TYPES.has(type.toLowerCase());
}
