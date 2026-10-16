// 元数据取值的校验与转换(根 `id`, 错误文案, 布局, 条件, 场景覆盖, 规则表); 编译器与打印器共用, 保证打印出的元数据能编译回原值.
import {
  type Condition,
  type JsonPointer,
  type JsonSchema,
  appendPointer,
  isPointer,
  isSchemaObject,
  l10n,
  tryParsePointer,
  xUiMetaSchema,
} from "../schema/index.js";
import { CONDITION_OPS, ERROR_MESSAGE_KEYWORDS, LAYOUTS } from "./builtins.js";
import type { SyntaxReason } from "./diagnostics.js";
import { checkDefaultValue } from "./value-check.js";

export interface ValueIssue {
  reason: SyntaxReason;
  params: Record<string, string | number>;
}

const META_DEFS = (xUiMetaSchema.$defs ?? {}) as Readonly<Record<string, JsonSchema>>;
const VARIANT_REF: JsonSchema = { $ref: "#/$defs/Variant" };
const RULES_SCHEMA: JsonSchema = { type: "array", items: { $ref: "#/$defs/Rule" } };
/** 场景覆盖中只对对象节点有意义的字段. */
const OBJECT_ONLY_VARIANT_KEYS = ["order", "groups", "layout", "columns"];

const issue = (reason: SyntaxReason, params: Record<string, string | number> = {}): ValueIssue => ({ reason, params });

export function fileIdIssue(value: unknown): ValueIssue | undefined {
  if (typeof value !== "string" || value === "" || /[#\s\p{Cc}]/u.test(value)) return issue("invalidFileId");
  return undefined;
}

export function errorMessageIssue(value: unknown): ValueIssue | undefined {
  if (typeof value === "string") return value === "" ? issue("emptyErrorMessage") : undefined;
  if (!isSchemaObject(value)) return issue("expectStringOrObject");
  const entries = Object.entries(value);
  if (entries.length === 0) return issue("emptyErrorMessageMap");
  for (const [name, message] of entries) {
    if (!ERROR_MESSAGE_KEYWORDS.has(name)) return issue("unknownErrorKeyword", { name });
    if (typeof message !== "string" || message === "") return issue("errorMessageValue", { name });
  }
  return undefined;
}

export function layoutIssue(layout: unknown): ValueIssue | undefined {
  return typeof layout === "string" && LAYOUTS.includes(layout) ? undefined : issue("invalidLayout");
}

export function columnsIssue(columns: unknown): ValueIssue | undefined {
  return typeof columns === "number" && Number.isInteger(columns) && columns >= 1 ? undefined : issue("invalidColumns");
}

export function groupsIssue(groups: unknown, fields: readonly string[] | undefined): ValueIssue | undefined {
  if (!Array.isArray(groups)) return issue("invalidGroups");
  const seen = new Set<string>();
  for (const g of groups) {
    if (!isSchemaObject(g) || Object.keys(g).length !== 2) return issue("invalidGroups");
    const { title, fields: members } = g as Record<string, unknown>;
    if (typeof title !== "string" || !Array.isArray(members) || !members.every((m) => typeof m === "string")) {
      return issue("invalidGroups");
    }
    const bad = fields === undefined ? undefined : (members as string[]).find((name) => !fields.includes(name));
    if (bad !== undefined) return issue("unknownGroupField", { group: title, name: bad });
    const dup = (members as string[]).find((name) => seen.has(name) || !seen.add(name));
    if (dup !== undefined) return issue("duplicateGroupField", { name: dup });
  }
  return undefined;
}

export function orderIssue(order: unknown, fields: readonly string[] | undefined): ValueIssue | undefined {
  if (!Array.isArray(order) || !order.every((o) => typeof o === "string")) return issue("expectStringArray", { name: "order" });
  const seen = new Set<string>();
  for (const name of order as string[]) {
    if (fields !== undefined && !fields.includes(name)) return issue("unknownOrderField", { name });
    if (seen.has(name)) return issue("duplicateOrderField", { name });
    seen.add(name);
  }
  return undefined;
}

// ---- 路径与 JSON Pointer ----

/** lodash `get` 路径(`a.b[0]` `a['x-y']` `list[*].on`) → 片段; 不合法时返回 undefined. */
export function parsePath(path: string): string[] | undefined {
  const tokens: string[] = [];
  let i = 0;
  let expectName = true;
  while (i < path.length) {
    const ch = path[i]!;
    if (ch === "[") {
      const close = path[i + 1];
      if (close === "'" || close === '"') {
        let j = i + 2;
        let name = "";
        while (j < path.length && path[j] !== close) {
          if (path[j] === "\\" && j + 1 < path.length) j++;
          name += path[j];
          j++;
        }
        if (path[j] !== close || path[j + 1] !== "]") return undefined;
        tokens.push(name);
        i = j + 2;
      } else {
        const end = path.indexOf("]", i);
        if (end < 0) return undefined;
        const inner = path.slice(i + 1, end);
        if (inner !== "*" && !/^(0|[1-9]\d*)$/.test(inner)) return undefined;
        tokens.push(inner);
        i = end + 1;
      }
      expectName = false;
      continue;
    }
    if (ch === ".") {
      if (expectName) return undefined;
      i++;
      expectName = true;
      if (i >= path.length) return undefined;
      continue;
    }
    if (!expectName) return undefined;
    let j = i;
    while (j < path.length && path[j] !== "." && path[j] !== "[") {
      if (path[j] === "]") return undefined;
      j++;
    }
    tokens.push(path.slice(i, j));
    i = j;
    expectName = false;
  }
  return tokens.length > 0 && !expectName ? tokens : undefined;
}

function pathToPointer(path: string, root: boolean): JsonPointer | undefined {
  const body = root && path.startsWith("$.") ? path.slice(2) : path;
  const tokens = parsePath(body);
  return tokens === undefined ? undefined : appendPointer("", ...tokens);
}

const PLAIN_SEGMENT = /^[^.[\]'"\\\s]+$/;

/** 指针 → lodash 路径; 空指针返回 undefined. */
export function pointerToPath(pointer: JsonPointer): string | undefined {
  if (!isPointer(pointer) || pointer === "") return undefined;
  let out = "";
  for (const token of tryParsePointer(pointer) ?? []) {
    if (token === "*" || /^(0|[1-9]\d*)$/.test(token)) out += `[${token}]`;
    else if (PLAIN_SEGMENT.test(token) && !/^\d/.test(token)) out += out === "" ? token : `.${token}`;
    else out += `['${token.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}']`;
  }
  return out;
}

// ---- 条件 ----

const LEAF_KEYS = new Set(["left", "op", "right"]);
const OP_KEYWORDS: Readonly<Record<string, string>> = { eq: "eq", ne: "ne", in: "in", not_in: "notIn", gt: "gt", gte: "gte", lt: "lt", lte: "lte" };

type ConditionResult = { condition: Condition } | { issue: ValueIssue };

const invalid = (detail: string): { issue: ValueIssue } => ({ issue: issue("invalidCondition", { detail }) });

/** `root_if` / `node_if` 的取值(定稿 §12) → `x-ui.visibleIf`(契约 C4). */
export function compileCondition(value: unknown, base: "root" | "node"): ConditionResult {
  if (typeof value === "string") return leaf(value, "truthy", undefined, false, base);
  if (!isSchemaObject(value)) return invalid(l10n("应为路径字符串或条件对象", "must be a path string or a condition object"));
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v);
  for (const group of ["and", "or"] as const) {
    if (!Object.hasOwn(v, group)) continue;
    if (keys.length !== 1 || !Array.isArray(v[group]) || (v[group] as unknown[]).length === 0) {
      return invalid(l10n(`\`${group}\` 应为非空的条件数组, 且不能与其他键并列`, `\`${group}\` must be a non-empty array of conditions and cannot be combined with other keys`));
    }
    const items: Condition[] = [];
    for (const item of v[group] as unknown[]) {
      const r = compileCondition(item, base);
      if ("issue" in r) return r;
      items.push(r.condition);
    }
    return { condition: group === "and" ? { all: items } : { any: items } };
  }
  if (Object.hasOwn(v, "not")) {
    if (keys.length !== 1) return invalid(l10n("`not` 不能与其他键并列", "`not` cannot be combined with other keys"));
    const r = compileCondition(v.not, base);
    return "issue" in r ? r : { condition: { not: r.condition } };
  }
  const extra = keys.find((k) => !LEAF_KEYS.has(k));
  if (extra !== undefined) return invalid(l10n(`未知的键 \`${extra}\``, `unknown key \`${extra}\``));
  if (typeof v.left !== "string") return invalid(l10n("`left` 应为路径字符串", "`left` must be a path string"));
  if (typeof v.op !== "string" || !CONDITION_OPS.includes(v.op)) return invalid(l10n(`\`op\` 应为 ${CONDITION_OPS.join(" ")} 之一`, `\`op\` must be one of ${CONDITION_OPS.join(" ")}`));
  return leaf(v.left, v.op, v.right, Object.hasOwn(v, "right"), base);
}

function leaf(path: string, op: string, right: unknown, hasRight: boolean, base: "root" | "node"): ConditionResult {
  if (base === "node" && path.startsWith("$.")) return { issue: issue("nodePathRootPrefix") };
  const field = pathToPointer(path, base === "root");
  if (field === undefined) return { issue: issue("invalidPath", { path }) };
  const head = base === "node" ? { field, base: "node" as const } : { field };
  if (op === "truthy" || op === "falsy") {
    if (hasRight) return invalid(l10n(`\`${op}\` 不写 \`right\``, `\`${op}\` takes no \`right\``));
    return { condition: { ...head, truthy: op === "truthy" } };
  }
  if (!hasRight) return invalid(l10n(`\`${op}\` 需要 \`right\``, `\`${op}\` needs \`right\``));
  if ((op === "in" || op === "not_in") && !Array.isArray(right)) return invalid(l10n(`\`${op}\` 的 \`right\` 应为数组`, `\`right\` of \`${op}\` must be an array`));
  if (["gt", "gte", "lt", "lte"].includes(op) && typeof right !== "number") return invalid(l10n(`\`${op}\` 的 \`right\` 应为数字`, `\`right\` of \`${op}\` must be a number`));
  return { condition: { ...head, [OP_KEYWORDS[op]!]: right } as Condition };
}

/** `x-ui.visibleIf` → `root_if` / `node_if` 的取值; 叶子基准不一致或不合法时返回 undefined. */
export function printCondition(condition: unknown): { key: "root_if" | "node_if"; value: unknown } | undefined {
  const bases = new Set<string>();
  const value = printConditionValue(condition, bases);
  if (value === undefined || bases.size !== 1) return undefined;
  const key = bases.has("node") ? "node_if" : "root_if";
  const back = compileCondition(value, key === "node_if" ? "node" : "root");
  return "condition" in back && JSON.stringify(sortDeep(back.condition)) === JSON.stringify(sortDeep(condition)) ? { key, value } : undefined;
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (isSchemaObject(value)) return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortDeep((value as Record<string, unknown>)[k])]));
  return value;
}

function printConditionValue(condition: unknown, bases: Set<string>): unknown {
  if (!isSchemaObject(condition)) return undefined;
  const c = condition as Record<string, unknown>;
  for (const [group, out] of [["all", "and"], ["any", "or"]] as const) {
    if (!Object.hasOwn(c, group)) continue;
    if (!Array.isArray(c[group]) || (c[group] as unknown[]).length === 0) return undefined;
    const items = (c[group] as unknown[]).map((i) => printConditionValue(i, bases));
    return items.some((i) => i === undefined) ? undefined : { [out]: items };
  }
  if (Object.hasOwn(c, "not")) {
    const inner = printConditionValue(c.not, bases);
    return inner === undefined ? undefined : { not: inner };
  }
  if (typeof c.field !== "string") return undefined;
  const path = pointerToPath(c.field);
  if (path === undefined) return undefined;
  bases.add(c.base === "node" ? "node" : "root");
  if (c.truthy === true) return path;
  if (c.truthy === false) return { left: path, op: "falsy" };
  for (const [op, keyword] of Object.entries(OP_KEYWORDS)) {
    if (Object.hasOwn(c, keyword)) return { left: path, op, right: c[keyword] };
  }
  return undefined;
}

// ---- 场景覆盖与规则 ----

/**
 * 场景覆盖对象: 先把 `root_if` / `node_if` 转为 `visibleIf`, 再按 meta-schema 的 Variant 校验;
 * `order` `groups` `layout` `columns` 只能用于对象节点, 引用的字段必须存在; fields 为节点的字段名, 非对象节点为 undefined.
 */
export function compileVariant(
  scene: string,
  value: unknown,
  fields: readonly string[] | undefined,
): { variant: Record<string, unknown> } | { issue: ValueIssue } {
  if (scene === "") return { issue: issue("emptyScene") };
  if (!isSchemaObject(value)) return { issue: issue("invalidVariant", { scene, detail: l10n("应为对象", "must be an object") }) };
  const lifted = liftConditions(value as Record<string, unknown>);
  if ("issue" in lifted) return lifted;
  const out = lifted.value;
  const detail = checkDefaultValue(VARIANT_REF, out, META_DEFS);
  if (detail !== undefined) return { issue: issue("invalidVariant", { scene, detail }) };
  const objectKey = OBJECT_ONLY_VARIANT_KEYS.find((key) => Object.hasOwn(out, key));
  if (objectKey !== undefined) {
    if (fields === undefined) return { issue: issue("variantObjectOnly", { scene, key: objectKey }) };
    if (Array.isArray(out.order)) {
      const order = out.order as string[];
      const bad = order.find((name, i) => !fields.includes(name) || order.indexOf(name) !== i);
      if (bad !== undefined) return { issue: issue("unknownVariantOrderField", { scene, name: bad }) };
    }
    if (Array.isArray(out.groups)) {
      for (const group of out.groups as { title: string; fields: string[] }[]) {
        const bad = group.fields.find((name) => !fields.includes(name));
        if (bad !== undefined) return { issue: issue("unknownVariantGroupField", { scene, group: group.title, name: bad }) };
      }
    }
  }
  return { variant: out };
}

/** 覆盖对象中的 `root_if` / `node_if` 转为 `visibleIf`; 两者都写时取 `all`. */
function liftConditions(value: Readonly<Record<string, unknown>>): { value: Record<string, unknown> } | { issue: ValueIssue } {
  const out: Record<string, unknown> = {};
  const conditions: Condition[] = [];
  for (const [key, v] of Object.entries(value)) {
    if (key === "root_if" || key === "node_if") {
      const r = compileCondition(v, key === "node_if" ? "node" : "root");
      if ("issue" in r) return r;
      conditions.push(r.condition);
    } else {
      out[key] = v;
    }
  }
  if (conditions.length > 0) out.visibleIf = conditions.length === 1 ? conditions[0] : { all: conditions };
  return { value: out };
}

/** 编译结果中的场景覆盖 → 元数据写法(`visibleIf` 还原为 `root_if` / `node_if`); 无法还原时返回 undefined. */
export function printVariant(scene: string, value: unknown, fields: readonly string[] | undefined): Record<string, unknown> | undefined {
  if (!isSchemaObject(value)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (key === "root_if" || key === "node_if") return undefined;
    if (key === "visibleIf") {
      const printed = printCondition(v);
      if (printed === undefined) return undefined;
      out[printed.key] = printed.value;
    } else {
      out[key] = v;
    }
  }
  const back = compileVariant(scene, out, fields);
  return "variant" in back && JSON.stringify(sortDeep(back.variant)) === JSON.stringify(sortDeep(value)) ? out : undefined;
}

export function rulesIssue(value: unknown): ValueIssue | undefined {
  const detail = checkDefaultValue(RULES_SCHEMA, value, META_DEFS);
  return detail === undefined ? undefined : issue("invalidRules", { detail });
}

/** 根 `rules`: 各规则 `ui` 中的 `root_if` / `node_if` 转为 `visibleIf`(同场景覆盖), 再按 meta-schema 校验. */
export function compileRules(value: unknown): { rules: unknown } | { issue: ValueIssue } {
  let rules = value;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const rule of value) {
      if (!isSchemaObject(rule) || !isSchemaObject((rule as Record<string, unknown>).ui)) {
        out.push(rule);
        continue;
      }
      const lifted = liftConditions((rule as Record<string, unknown>).ui as Record<string, unknown>);
      if ("issue" in lifted) return lifted;
      out.push({ ...rule, ui: lifted.value });
    }
    rules = out;
  }
  const found = rulesIssue(rules);
  return found === undefined ? { rules } : { issue: found };
}

/** 编译结果中的 `x-ui.rules` → 元数据写法: 能还原的 `visibleIf` 写回 `root_if` / `node_if`; 整体无法编译回原值时原样返回. */
export function printRules(rules: unknown): unknown {
  if (!Array.isArray(rules)) return rules;
  const printed = rules.map((rule) => {
    if (!isSchemaObject(rule)) return rule;
    const ui = (rule as Record<string, unknown>).ui;
    if (!isSchemaObject(ui) || !Object.hasOwn(ui, "visibleIf")) return rule;
    const condition = printCondition((ui as Record<string, unknown>).visibleIf);
    if (condition === undefined) return rule;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(ui)) {
      if (key === "visibleIf") out[condition.key] = condition.value;
      else out[key] = v;
    }
    return { ...rule, ui: out };
  });
  const back = compileRules(printed);
  return "rules" in back && JSON.stringify(sortDeep(back.rules)) === JSON.stringify(sortDeep(rules)) ? printed : rules;
}
