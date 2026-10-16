// 渲染计划(模板树)的生成与递归节点的按需展开: plan() expand().
import {
  DEFAULT_GRID_COLUMNS,
  appendPointer,
  isSchemaObject,
  lookupPointer,
  tryParsePointer,
  fail,
  ok,
  type Diagnostic,
  type JsonPointer,
  type JsonSchema,
} from "@jotl/core";
import { DECORATOR_WIDGET, FALLBACK_WIDGET, ROOT_WIDGET } from "./builtin-widgets.js";
import type { ExpandFunction, PlanFunction, PlanOptions, RenderPlanNode, ResolveContext, WidgetLevel } from "./contracts.js";
import { uiCoreDiagnostic } from "./diagnostics.js";
import { createEnv, resolveSite, selectWidget, type ResolveEnv } from "./resolve.js";
import { refIdentity, resolveNode, resolveSchemaAt, type ResolvedNode, type SchemaSite } from "./schema-node.js";
import { childSites, type ChildSite } from "./schema-shape.js";

/** 同一类型的递归引用在一条路径上最多展开的层数; 超过时节点标 lazy. */
export const DEFAULT_MAX_DEPTH = 2;

const CONTAINER_LEVELS: ReadonlySet<WidgetLevel> = new Set(["view", "layout", "composite"]);

interface Frame {
  site: SchemaSite;
  dataPath: JsonPointer;
  depth: number;
  parentWidget?: string;
  /** 祖先链上已解析的引用目标. */
  refStack: readonly JsonPointer[];
  /** 祖先复合组件接管的模板数据路径(绝对). */
  claimed: ReadonlySet<JsonPointer>;
  defaultDecorator: string | false;
  /** expand() 的入口节点: 按递归引用解析, 即使超过 maxDepth 也展开一层. */
  forceExpand?: true;
}

interface PlanState {
  env: ResolveEnv;
  maxDepth: number;
}

/** lazy 节点展开时恢复的上下文; 节点被复制或序列化后取不到, expand() 改用默认值. */
interface LazyContext {
  frame: Frame;
  scene: string;
  mode: ResolveEnv["mode"];
  maxDepth: number;
}

const lazyContexts = new WeakMap<RenderPlanNode, LazyContext>();

/** 本进程 plan() expand() 生成的节点对应的 schema 位置, 供 resolvePlanNode 取回拆分合成的虚拟节点. */
const nodeSites = new WeakMap<RenderPlanNode, SchemaSite>();
const nodeSchemas = new WeakMap<RenderPlanNode, ResolvedNode>();

/**
 * 渲染计划节点的有效 schema(沿 $ref 与 allOf 合并), 含按 type 数组拆出的分支与数组无 items 时的元素模板(空 schema).
 * 节点被复制或序列化后取不到生成时的位置, 按 schemaPointer 解析.
 */
export function resolvePlanNode(node: RenderPlanNode, schema: JsonSchema): ResolvedNode {
  const cached = nodeSchemas.get(node);
  if (cached !== undefined) return cached;
  const site = nodeSites.get(node);
  const resolved =
    site === undefined || (site.virtual !== true && lookupPointer(schema, site.pointer).value === site.schema)
      ? resolveSchemaAt(schema, node.schemaPointer)
      : resolveNode(schema, site);
  nodeSchemas.set(node, resolved);
  return resolved;
}

function contextOf(state: PlanState, frame: Frame): ResolveContext {
  const ctx: ResolveContext = {
    scene: state.env.scene,
    mode: state.env.mode,
    schemaPointer: frame.site.pointer,
    dataPath: frame.dataPath,
    depth: frame.depth,
  };
  if (frame.parentWidget !== undefined) ctx.parentWidget = frame.parentWidget;
  return ctx;
}

/** claims 的相对路径可写成 "img" 或 "/img"; 空路径不接管任何子节点. */
function claimedPaths(base: JsonPointer, claims: unknown): JsonPointer[] {
  if (!Array.isArray(claims)) return [];
  return claims
    .filter((p): p is string => typeof p === "string" && p !== "" && p !== "/")
    .map((p) => base + (p.startsWith("/") ? p : `/${p}`));
}

function orderChildren(children: ChildSite[], order: readonly string[] | undefined): ChildSite[] {
  if (order === undefined) return children;
  const rank = (c: ChildSite): number => {
    const i = c.dataToken === undefined ? -1 : order.indexOf(c.dataToken);
    return i === -1 ? order.length : i;
  };
  // 稳定排序: 未列在 order 中的子节点保持原顺序排在后面.
  return [...children].sort((a, b) => rank(a) - rank(b));
}

function count(stack: readonly JsonPointer[], item: JsonPointer): number {
  return stack.filter((p) => p === item).length;
}

function planNode(state: PlanState, frame: Frame): RenderPlanNode {
  const { env } = state;
  const identity = refIdentity(resolveNode(env.document, frame.site));
  const occurrences = identity === undefined ? 0 : count(frame.refStack, identity);
  const recursive = occurrences > 0 || (frame.forceExpand === true && identity !== undefined);
  const resolution = resolveSite(env, frame.site, { ctx: contextOf(state, frame), recursive });
  const { ui, shape, widget, level } = resolution;
  const out: RenderPlanNode = {
    schemaPointer: frame.site.pointer,
    dataPath: frame.dataPath,
    widget,
    level,
    source: resolution.source,
    fallbackChain: resolution.fallbackChain,
    decorator: ui.decorator ?? frame.defaultDecorator,
    props: ui.props,
    hidden: ui.hidden ?? false,
    degraded: resolution.degraded,
    children: [],
  };
  nodeSites.set(out, frame.site);
  if (shape.kind === "object") {
    out.layout = ui.layout ?? "stack";
    out.columns = ui.columns ?? DEFAULT_GRID_COLUMNS;
    out.groups = ui.groups ?? [];
  }
  if (ui.visibleIf !== undefined) out.visibleIf = ui.visibleIf;
  if (shape.kind === "union" && shape.discriminator !== undefined) out.discriminator = shape.discriminator;
  if (ui.summary !== undefined && (shape.kind === "object" || shape.kind === "array" || shape.kind === "map")) out.summary = ui.summary;
  if (shape.kind === "money") out.thousands = ui.thousands ?? true;
  else if (shape.kind === "bigint" || (shape.kind === "scalar" && (shape.type === "number" || shape.type === "integer"))) out.thousands = ui.thousands ?? false;

  if (occurrences > state.maxDepth && frame.forceExpand !== true) {
    out.lazy = true;
    lazyContexts.set(out, { frame, scene: env.scene, mode: env.mode, maxDepth: state.maxDepth });
    return out;
  }
  if (!CONTAINER_LEVELS.has(level) || widget === FALLBACK_WIDGET) return out;

  const claims = resolution.registration?.claims;
  const claimed = claims === undefined ? [] : guardedClaims(() => claims(resolution.node.effective));
  if (claimed === "all") return out;
  const claimedSet = new Set([...frame.claimed, ...claimedPaths(frame.dataPath, claimed)]);

  const refStack = identity === undefined ? frame.refStack : [...frame.refStack, identity];
  let sites: ChildSite[];
  if (recursive && widget === "tree") {
    const target = resolution.node.targets[resolution.node.targets.length - 1]!;
    sites = [{ site: { pointer: target.pointer, schema: target.schema } }];
  } else {
    sites = orderChildren(childSites(env.document, resolution.node, shape), shape.kind === "object" ? ui.order : undefined);
  }
  for (const child of sites) {
    const dataPath = child.dataToken === undefined ? frame.dataPath : appendPointer(frame.dataPath, child.dataToken);
    if (child.dataToken !== undefined && claimedSet.has(dataPath)) continue;
    out.children.push(
      planNode(state, {
        site: child.site,
        dataPath,
        depth: frame.depth + 1,
        parentWidget: widget,
        refStack,
        claimed: claimedSet,
        defaultDecorator: child.dataToken === undefined ? false : DECORATOR_WIDGET,
      }),
    );
  }
  return out;
}

function guardedClaims(call: () => unknown): unknown {
  try {
    return call();
  } catch {
    return [];
  }
}

/** 根视图节点: 内置组件 form, 唯一的子节点是数据根. */
function planView(state: PlanState, frame: Frame): RenderPlanNode {
  const { env } = state;
  const schema = resolveNode(env.document, frame.site).effective;
  const selection = selectWidget(env, [{ name: ROOT_WIDGET, source: "builtin" }], schema, frame.site.pointer);
  const out: RenderPlanNode = {
    schemaPointer: frame.site.pointer,
    dataPath: frame.dataPath,
    widget: selection.widget,
    level: selection.level,
    source: selection.source,
    fallbackChain: selection.fallbackChain,
    decorator: false,
    props: {},
    hidden: false,
    degraded: selection.degraded,
    children: [],
  };
  nodeSites.set(out, frame.site);
  if (!CONTAINER_LEVELS.has(selection.level) || selection.widget === FALLBACK_WIDGET) return out;
  const claims = selection.registration?.claims;
  if (claims !== undefined && guardedClaims(() => claims(schema)) === "all") return out;
  out.children.push(planNode(state, { ...frame, depth: frame.depth + 1, parentWidget: selection.widget }));
  return out;
}

function isSchema(value: unknown): value is JsonSchema {
  return typeof value === "boolean" || isSchemaObject(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function lookupSite(schema: JsonSchema, pointer: JsonPointer): SchemaSite | undefined {
  if (tryParsePointer(pointer) === undefined) return undefined;
  const { found, value } = lookupPointer(schema, pointer);
  return found && isSchema(value) ? { pointer, schema: value } : undefined;
}

/**
 * 由 schema 与注册表算出渲染计划. schemaPointer 为空(默认)时根节点是视图组件 form, 其子节点为数据根;
 * 指向子节点时直接从该节点开始, 用于渲染期按需规划.
 */
export const plan: PlanFunction = (schema, registry, options = {}) => {
  const errors = validateOptions(schema, options);
  if (errors.length > 0) return fail(errors);
  const schemaPointer = options.schemaPointer ?? "";
  const site = lookupSite(schema, schemaPointer);
  if (site === undefined) return fail([uiCoreDiagnostic("JOTL5102", { pointer: schemaPointer })]);
  const state: PlanState = { env: createEnv(schema, registry, options.scene, options.mode), maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH };
  const frame: Frame = {
    site,
    dataPath: options.dataPath ?? "",
    depth: options.depth ?? 0,
    refStack: [],
    claimed: new Set(),
    defaultDecorator: schemaPointer === "" ? false : DECORATOR_WIDGET,
  };
  if (options.parentWidget !== undefined) frame.parentWidget = options.parentWidget;
  const root = schemaPointer === "" ? planView(state, frame) : planNode(state, frame);
  return ok(root, state.env.diagnostics);
};

function validateOptions(schema: unknown, options: PlanOptions): Diagnostic[] {
  const errors: Diagnostic[] = [];
  if (!isSchema(schema)) errors.push(uiCoreDiagnostic("JOTL5101"));
  if (options.dataPath !== undefined && tryParsePointer(options.dataPath) === undefined) {
    errors.push(uiCoreDiagnostic("JOTL5103", { pointer: String(options.dataPath) }));
  }
  if (options.maxDepth !== undefined && !isCount(options.maxDepth)) errors.push(uiCoreDiagnostic("JOTL5104", { value: String(options.maxDepth) }));
  if (options.depth !== undefined && !isCount(options.depth)) errors.push(uiCoreDiagnostic("JOTL5105", { value: String(options.depth) }));
  return errors;
}

/**
 * 展开 lazy 节点: 以该节点为起点重新规划, 节点本身必定展开, 其下的递归引用再展开至多 maxDepth 层.
 * 节点以 schemaPointer 定位; ctx 给出的场景, 模式与 maxDepth 优先, 其次沿用本进程 plan() 生成该节点时的值与接管登记, 否则取默认值.
 */
export const expand: ExpandFunction = (node, schema, registry, ctx = {}) => {
  if (!isSchema(schema)) return fail([uiCoreDiagnostic("JOTL5101")]);
  const saved = lazyContexts.get(node);
  const site = lookupSite(schema, node.schemaPointer);
  if (site === undefined) return fail([uiCoreDiagnostic("JOTL5102", { pointer: node.schemaPointer })]);
  const state: PlanState = {
    env: createEnv(schema, registry, ctx.scene ?? saved?.scene, ctx.mode ?? saved?.mode),
    maxDepth: ctx.maxDepth ?? saved?.maxDepth ?? DEFAULT_MAX_DEPTH,
  };
  const base: Frame = saved?.frame ?? {
    site,
    dataPath: node.dataPath,
    depth: 0,
    claimed: new Set(),
    refStack: [],
    defaultDecorator: node.decorator,
  };
  const frame: Frame = { ...base, site, refStack: [] };
  if (node.lazy === true) frame.forceExpand = true;
  return ok(planNode(state, frame), state.env.diagnostics);
};
