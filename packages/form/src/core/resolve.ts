// 单个节点的组件解析: 组合 x-ui 候选, 注册表匹配器, 内置规则与兜底, 按注册与 accepts 依次降级(F1 F2 F3 F7).
import {
  isSchemaObject,
  lookupPointer,
  tryParsePointer,
  type Diagnostic,
  type JsonPointer,
  type JsonSchema,
  type JsonSchemaObject,
  type Result,
  type UiRule,
  DEFAULT_SCENE,
  fail,
  ok,
} from "@jotl/core";
import { BUILTIN_WIDGETS, FALLBACK_WIDGET, isBuiltinWidget } from "./builtin-widgets.js";
import type {
  PlanDegradeReason,
  Registry,
  RenderMode,
  ResolveContext,
  ResolveSource,
  WidgetLevel,
  WidgetRegistration,
} from "./contracts.js";
import { uiCoreDiagnostic, xuiIssueReason } from "./diagnostics.js";
import { resolveNode, type ResolvedNode, type SchemaSite } from "./schema-node.js";
import { acceptsShape, builtinWidgetOf, shapeOf, type Shape } from "./schema-shape.js";
import {
  collectLayers,
  mergeLayers,
  readXUi,
  ruleMatches,
  rulesUsingWidget,
  type MergedUi,
  type WidgetCandidate,
  type XUiProblem,
} from "./x-ui-merge.js";

export const DEFAULT_MODE: RenderMode = "edit";

export interface ResolveEnv {
  document: JsonSchema;
  registry: Registry<unknown>;
  rules: readonly UiRule[];
  scene: string;
  mode: RenderMode;
  diagnostics: Diagnostic[];
  /** 已报告的诊断(代码, 消息, 位置), 同一 x-ui 被多处引用时只报一次. */
  reported: Set<string>;
}

export type Degrade = { reason: PlanDegradeReason; from?: string };

export interface Selection {
  widget: string;
  source: ResolveSource;
  level: WidgetLevel;
  registration: WidgetRegistration<unknown> | undefined;
  fallbackChain: string[];
  degraded: Degrade[];
}

export interface NodeResolution extends Selection {
  node: ResolvedNode;
  shape: Shape;
  ui: MergedUi;
  /** x-ui 各层(含命中的规则)给出的组件名, 高优先级在前. */
  uiCandidates: WidgetCandidate[];
  matchedRules: number[];
}

/** 读取根 x-ui 的 rules; 根 x-ui 不合法时没有规则(F3 记在根节点上). */
export function rootRules(document: JsonSchema): UiRule[] {
  return readXUi(document, "", [])?.rules ?? [];
}

export function createEnv(document: JsonSchema, registry: Registry<unknown>, scene = DEFAULT_SCENE, mode = DEFAULT_MODE): ResolveEnv {
  return { document, registry, rules: rootRules(document), scene, mode, diagnostics: [], reported: new Set() };
}

function report(env: ResolveEnv, diagnostic: Diagnostic): void {
  const key = JSON.stringify([diagnostic.code, diagnostic.message, diagnostic.location]);
  if (env.reported.has(key)) return;
  env.reported.add(key);
  env.diagnostics.push(diagnostic);
}

function at(pointer: JsonPointer): { location: { kind: "pointer"; pointer: JsonPointer } } {
  return { location: { kind: "pointer", pointer } };
}

/** 注册项的回调属于外部代码; 抛错时按给定的保守值处理, 不中断 plan(). */
function guarded<T>(call: () => T, onError: T): T {
  try {
    return call();
  } catch {
    return onError;
  }
}

export function levelOf(name: string, registration: WidgetRegistration<unknown> | undefined): WidgetLevel {
  if (registration !== undefined) return registration.level;
  return isBuiltinWidget(name) ? BUILTIN_WIDGETS[name].level : "field";
}

function matcherCandidates(env: ResolveEnv, schema: JsonSchemaObject, ctx: ResolveContext): WidgetCandidate[] {
  const scored: { name: string; score: number }[] = [];
  for (const registration of env.registry.list()) {
    const match = registration.match;
    if (match === undefined) continue;
    const score = guarded(() => match(schema, ctx), 0);
    if (typeof score === "number" && score > 0) scored.push({ name: registration.name, score });
  }
  return scored.sort((a, b) => b.score - a.score).map(({ name }) => ({ name, source: "matcher" }));
}

/**
 * 按候选顺序取第一个可用组件: 未注册记 F1, 内置名不接受该形态(acceptsShape)或注册项的 accepts 拒绝记 F2; 兜底组件 json 总是可用.
 * 选中项之后仍可用的候选组成 fallbackChain, 末尾是 json; 选中 json 时为空.
 */
export function selectWidget(
  env: ResolveEnv,
  candidates: readonly WidgetCandidate[],
  schema: JsonSchemaObject,
  pointer: JsonPointer,
  silent = false,
  shape?: Shape,
): Selection {
  const list: WidgetCandidate[] = [];
  for (const c of [...candidates, { name: FALLBACK_WIDGET, source: "fallback" as const }]) {
    if (!list.some((seen) => seen.name === c.name)) list.push(c);
  }
  const usable = list.map((c) => {
    if (c.name === FALLBACK_WIDGET) return { registration: env.registry.get(c.name), reason: undefined };
    const registration = env.registry.get(c.name);
    if (registration === undefined) return { registration, reason: "F1" as const };
    if (shape !== undefined && acceptsShape(c.name, shape, schema) === false) return { registration, reason: "F2" as const };
    const accepts = registration.accepts;
    if (accepts !== undefined && !guarded(() => accepts(schema), false)) return { registration, reason: "F2" as const };
    return { registration, reason: undefined };
  });
  const index = usable.findIndex((u) => u.reason === undefined);
  const degraded: Degrade[] = [];
  for (let i = 0; i < index; i++) {
    const reason = usable[i]!.reason!;
    const from = list[i]!.name;
    degraded.push({ reason, from });
    if (!silent) report(env, uiCoreDiagnostic(reason === "F1" ? "JOTL5001" : "JOTL5002", { widget: from }, at(pointer)));
  }
  const chosen = list[index]!;
  const registration = usable[index]!.registration;
  const fallbackChain = chosen.name === FALLBACK_WIDGET ? [] : list.slice(index + 1).filter((_, i) => usable[index + 1 + i]!.reason === undefined).map((c) => c.name);
  return { widget: chosen.name, source: chosen.source, level: levelOf(chosen.name, registration), registration, fallbackChain, degraded };
}

function reportProblems(env: ResolveEnv, problems: readonly XUiProblem[], silent: boolean): Degrade[] {
  return problems.map((problem) => {
    if (!silent) {
      const params = { path: `x-ui${problem.issue.path}`, reason: xuiIssueReason(problem.issue.kind) };
      report(env, uiCoreDiagnostic("JOTL5003", params, at(problem.pointer)));
    }
    return { reason: "F3" };
  });
}

/** 可空节点上不接受可空形态的内置组件名是给内容用的(见 splitBranch), 不作为可空节点自身的候选, 也不记 F2. */
function contentAware(shape: Shape, schema: JsonSchemaObject, candidates: readonly WidgetCandidate[]): WidgetCandidate[] {
  if (shape.kind !== "nullable") return [...candidates];
  return candidates.filter((c) => acceptsShape(c.name, shape, schema) !== false);
}

export interface ResolveSiteOptions {
  ctx: ResolveContext;
  /** 该节点是祖先链上已出现过的类型的引用, 内置规则取 tree. */
  recursive: boolean;
  /** 不写诊断(用于 resolveXUi 等只读查询). */
  silent?: boolean;
}

export function resolveSite(env: ResolveEnv, site: SchemaSite, options: ResolveSiteOptions): NodeResolution {
  const { ctx, recursive, silent = false } = options;
  const node = resolveNode(env.document, site);
  const shape = shapeOf(env.document, node);
  const layers = collectLayers(node, env.scene);
  const degradedF3 = reportProblems(env, layers.problems, silent);
  const schema = node.effective;

  if (shape.kind === "unsupported" || shape.kind === "unresolved") {
    if (!silent) {
      const diagnostic = shape.kind === "unsupported"
        ? uiCoreDiagnostic("JOTL5004", { feature: shape.feature }, at(site.pointer))
        : uiCoreDiagnostic("JOTL5005", { ref: shape.ref }, at(site.pointer));
      report(env, diagnostic);
    }
    const { ui, candidates } = mergeLayers(layers, []);
    const registration = env.registry.get(FALLBACK_WIDGET);
    return {
      node, shape, ui, uiCandidates: candidates, matchedRules: [],
      widget: FALLBACK_WIDGET, source: "fallback", level: levelOf(FALLBACK_WIDGET, registration), registration,
      fallbackChain: [], degraded: [...degradedF3, { reason: "F7" }],
    };
  }

  // 内置规则落到 json 时不单列候选, 让它以兜底(fallback)身份出现在列表末尾.
  const builtinName = recursive ? "tree" : builtinWidgetOf(shape);
  const builtin: WidgetCandidate[] = builtinName === FALLBACK_WIDGET ? [] : [{ name: builtinName, source: "builtin" }];
  const matchers = matcherCandidates(env, schema, ctx);
  let preRuleWidget = "";
  if (rulesUsingWidget(env.rules)) {
    const pre = mergeLayers(layers, []);
    preRuleWidget = selectWidget(env, [...contentAware(shape, schema, pre.candidates), ...matchers, ...builtin], schema, site.pointer, true, shape).widget;
  }
  const subject = { pointer: site.pointer, schema, virtual: site.virtual === true, widget: preRuleWidget };
  const matchedRules: number[] = [];
  env.rules.forEach((rule, i) => {
    if (ruleMatches(rule.match, subject)) matchedRules.push(i);
  });
  const merged = mergeLayers(layers, matchedRules.map((i) => env.rules[i]!));
  const selection = selectWidget(env, [...contentAware(shape, schema, merged.candidates), ...matchers, ...builtin], schema, site.pointer, silent, shape);
  return {
    ...selection,
    degraded: [...degradedF3, ...selection.degraded],
    node, shape, ui: merged.ui, uiCandidates: merged.candidates, matchedRules,
  };
}

/** 解析合并后的 x-ui 的结果, 供 LSP 与调试视图. */
export interface ResolvedXUi {
  /** 合并后的 x-ui(不含 widget). */
  ui: MergedUi;
  /** x-ui 各层给出的组件名, 高优先级在前. */
  candidates: WidgetCandidate[];
  /** 命中的根 rules 下标, 按数组顺序. */
  matchedRules: number[];
  /** 选中的组件, 来源与降级; 未传注册表时按 "所有组件均已注册" 计算. */
  widget: string;
  source: ResolveSource;
  fallbackChain: string[];
  degraded: Degrade[];
}

export interface ResolveXUiOptions {
  scene?: string;
  mode?: RenderMode;
  registry?: Registry<unknown>;
}

/** 所有名字都视为已注册且接受任意形态的注册表, 用于未传注册表时的查询. */
const PERMISSIVE_REGISTRY: Registry<unknown> = {
  register() {},
  get: (name) => ({ name, level: levelOf(name, undefined), component: undefined }),
  extend: () => PERMISSIVE_REGISTRY,
  list: () => [],
};

/** 解析 schema 文档中某个位置的有效 x-ui; schemaPointer 指向引用处时, 引用处与被引用类型的 x-ui 都参与合并. */
export function resolveXUi(schema: JsonSchema, schemaPointer: JsonPointer = "", options: ResolveXUiOptions = {}): Result<ResolvedXUi> {
  if (typeof schema !== "boolean" && !isSchemaObject(schema)) return fail([uiCoreDiagnostic("JOTL5101")]);
  const found = tryParsePointer(schemaPointer) === undefined ? undefined : lookupPointer(schema, schemaPointer);
  if (found === undefined || !found.found || (typeof found.value !== "boolean" && !isSchemaObject(found.value))) {
    return fail([uiCoreDiagnostic("JOTL5102", { pointer: schemaPointer })]);
  }
  const env = createEnv(schema, options.registry ?? PERMISSIVE_REGISTRY, options.scene, options.mode);
  const ctx: ResolveContext = { scene: env.scene, mode: env.mode, schemaPointer, dataPath: "", depth: 0 };
  const resolution = resolveSite(env, { pointer: schemaPointer, schema: found.value as JsonSchema }, { ctx, recursive: false });
  return ok(
    {
      ui: resolution.ui,
      candidates: resolution.uiCandidates,
      matchedRules: resolution.matchedRules,
      widget: resolution.widget,
      source: resolution.source,
      fallbackChain: resolution.fallbackChain,
      degraded: resolution.degraded,
    },
    env.diagnostics,
  );
}
