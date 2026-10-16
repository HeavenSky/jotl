// 钻取渲染(每层一页)的判定与导航: 组件种类, 哪些节点显示为入口行, 当前页路径的收敛, 错误所在页, 面包屑与摘要文字.
import { escapePointerToken, formatPointer, isSchemaObject, lastPointerToken, tryParsePointer, type JsonPointer, type Locale } from "@jotl/core";
import { BUILTIN_WIDGETS, isBuiltinWidget, resolvePlanNode, type RenderPlanNode, type WidgetLevel, type WidgetRegistration } from "../core/index.js";
import { contentTarget, effectiveNode, nodeId, propertyNames, resolveChild, type NodeTarget } from "./child-resolver.js";
import type { FormContextValue } from "./context.js";
import { copyOf } from "./diagnostics.js";
import type { HostKind } from "./hosts.js";
import { DEGRADE_TARGETS, type ReactWidgetComponent } from "./types.js";

type Registration = WidgetRegistration<ReactWidgetComponent>;

const STRUCTURE_KINDS: Readonly<Record<string, HostKind>> = {
  page: "object",
  inline: "object",
  list: "array",
  tuple: "tuple",
  union: "union",
  nullable: "nullable",
  kv: "map",
  tree: "tree",
};

export function levelOf(name: string, registration: Registration | undefined): WidgetLevel {
  if (registration !== undefined) return registration.level;
  return isBuiltinWidget(name) ? BUILTIN_WIDGETS[name].level : "field";
}

export function hostKindOf(name: string, registration: Registration | undefined): HostKind {
  if (name === DEGRADE_TARGETS.minimalJson) return "field";
  const level = levelOf(name, registration);
  if (level === "view") return "view";
  if (level === "layout" || level === "composite") return STRUCTURE_KINDS[name] ?? "custom";
  return "field";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 组件种类为 kind 的节点不在当前页根上时是否显示为入口行: 对象(inline 除外), 数组, 字典, 树, 以及有对象分支的联合;
 * 可空与自定义组件照常渲染(可空的内容节点再各自判定).
 */
export function isDrillKind(ctx: FormContextValue, kind: HostKind, widget: string, node: RenderPlanNode): boolean {
  switch (kind) {
    case "object":
      return widget !== "inline";
    case "array":
    case "map":
    case "tree":
      return true;
    case "union":
      return node.children.some((child) => {
        const c = effectiveNode(ctx, child);
        return hostKindOf(c.widget, ctx.registry.get(c.widget)) === "object" && c.widget !== "inline";
      });
    default:
      return false;
  }
}

/** 按渲染计划(不看渲染期降级)判定目标是否为一层页面; 可空节点看它的内容. */
export function isDrillTarget(ctx: FormContextValue, target: NodeTarget): boolean {
  const node = effectiveNode(ctx, target.node);
  const kind = hostKindOf(node.widget, ctx.registry.get(node.widget));
  if (kind === "nullable") {
    const content = contentTarget(ctx, { ...target, node }, 0);
    return content !== undefined && isDrillTarget(ctx, content);
  }
  return isDrillKind(ctx, kind, node.widget, node);
}

const INDEX = /^(0|[1-9]\d*)$/;

/**
 * 当前页路径中途经的数组下标越界(元素被删除)时退回到该数组所在的层; 途经的字典键不存在(被删除或改名)时退回到该字典所在的层;
 * 路径不合法时回到根. isMapValue 判定某个缺失键的路径是否为字典值, 对象中未填的字段照常进入.
 */
export function clampPath(value: unknown, path: JsonPointer, isMapValue?: (path: JsonPointer) => boolean): JsonPointer {
  const tokens = tryParsePointer(path);
  if (tokens === undefined) return "";
  let current = value;
  for (const [i, token] of tokens.entries()) {
    if (Array.isArray(current)) {
      if (!INDEX.test(token) || Number(token) >= current.length) return formatPointer(tokens.slice(0, i));
      current = current[Number(token)];
    } else if (isPlainObject(current) && Object.hasOwn(current, token)) {
      current = current[token];
    } else {
      if (isPlainObject(current) && isMapValue?.(formatPointer(tokens.slice(0, i + 1))) === true) return formatPointer(tokens.slice(0, i));
      current = undefined;
    }
  }
  return path;
}

/** 错误所在的页: 从根沿错误路径走, 取路径上(不含错误节点自身)最深的一层页面; 遇到字段层组件就停, 其下的错误由它显示. */
export function pageOfPointer(ctx: FormContextValue, root: NodeTarget, pointer: JsonPointer): JsonPointer {
  const tokens = tryParsePointer(pointer) ?? [];
  let target = root;
  let page = root.path;
  for (const [i, token] of tokens.entries()) {
    const node = effectiveNode(ctx, target.node);
    if (levelOf(node.widget, ctx.registry.get(node.widget)) === "field") break;
    target = resolveChild(ctx, target, escapePointerToken(token));
    if (i < tokens.length - 1 && isDrillTarget(ctx, target)) page = target.path;
  }
  return page;
}

function display(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** 摘要: summary 指定的字段, 否则第一个非空字符串字段(先按 schema 的属性顺序, 再按数据的键顺序); 值不是对象时没有. */
export function summaryText(target: NodeTarget, value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined;
  const field = target.node.summary ?? target.itemSummary;
  if (field !== undefined) return Object.hasOwn(value, field) ? display(value[field]) : undefined;
  for (const key of [...propertyNames(target.info.effective), ...Object.keys(value)]) {
    const v = Object.hasOwn(value, key) ? value[key] : undefined;
    if (typeof v === "string" && v !== "") return v;
  }
  return undefined;
}

/** 入口行没有摘要时的概况: 未填写, 数组的项数, 对象与字典已填的键数. */
export function contentCount(value: unknown, locale: Locale): string {
  const COPY = copyOf(locale);
  if (Array.isArray(value)) return value.length === 0 ? COPY.empty : COPY.itemCount(value.length);
  if (isPlainObject(value)) {
    const n = Object.values(value).filter((v) => v !== undefined).length;
    return n === 0 ? COPY.empty : COPY.filledCount(n);
  }
  return value === undefined || value === null ? COPY.empty : COPY.enter;
}

/** 数组元素的序号文字; 不是数组元素时为 undefined. */
export function itemLabel(target: NodeTarget, locale: Locale): string | undefined {
  if (!target.element || target.labelKey !== undefined) return undefined;
  const token = lastPointerToken(target.path);
  return token !== undefined && INDEX.test(token) ? copyOf(locale).item(Number(token)) : undefined;
}

/** 面包屑中一层的文字: 数组元素取摘要或序号, 字典值取键名, 字段取 title 或键名, 根取 title 或 "数据". */
export function crumbLabel(target: NodeTarget, value: unknown, locale: Locale): string {
  const item = itemLabel(target, locale);
  if (item !== undefined) return summaryText(target, value) ?? item;
  if (target.element && target.labelKey !== undefined) return target.labelKey;
  const title = isSchemaObject(target.info.effective) && typeof target.info.effective.title === "string" ? target.info.effective.title : undefined;
  if (title !== undefined && title !== "") return title;
  return target.labelKey ?? copyOf(locale).rootLabel;
}

/** path 是否为字典值(字典的元素). */
export function isMapValuePath(ctx: FormContextValue, root: NodeTarget, path: JsonPointer): boolean {
  const target = crumbTargets(ctx, root, path).at(-1)!;
  return target.element && target.labelKey !== undefined;
}

/** 根到 path 的各层目标, 首项为根. */
export function crumbTargets(ctx: FormContextValue, root: NodeTarget, path: JsonPointer): NodeTarget[] {
  const out = [root];
  let target = root;
  for (const token of tryParsePointer(path) ?? []) {
    target = resolveChild(ctx, target, escapePointerToken(token));
    out.push(target);
  }
  return out;
}

/** 视图节点下的数据根目标; 视图节点没有子节点时为 undefined. */
export function dataRootTarget(ctx: FormContextValue, view: NodeTarget): NodeTarget | undefined {
  const child = view.node.children[0];
  if (child === undefined) return undefined;
  return {
    node: child,
    path: "",
    id: nodeId(ctx.formId, ""),
    info: resolvePlanNode(child, ctx.document),
    required: false,
    labelKey: undefined,
    depth: view.depth + 1,
    page: true,
    element: false,
    itemSummary: undefined,
  };
}
