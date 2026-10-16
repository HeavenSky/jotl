// x-ui 的分层读取与合并(CT4): 根 rules 命中项 → 被引用类型 → 节点或引用处 → 当前场景变体.
import {
  appendPointer,
  isSchemaObject,
  matchPointer,
  type Condition,
  type JsonPointer,
  type JsonSchema,
  type JsonSchemaObject,
  type UiRule,
  type UiRuleMatch,
  type XUi,
  type XUiGroup,
  type XUiLayout,
  type XUiVariant,
} from "@jotl/core";
import { enumOptions, schemaTypes } from "./builtin-widgets.js";
import type { ResolveSource } from "./contracts.js";
import type { ResolvedNode } from "./schema-node.js";
import { checkXUi, type XUiIssue } from "./x-ui-check.js";

export interface WidgetCandidate {
  name: string;
  source: ResolveSource;
}

/** 合并后的 x-ui; widget 不参与合并, 见 WidgetCandidate. */
export interface MergedUi {
  props: Record<string, unknown>;
  decorator?: string | false;
  order?: string[];
  groups?: XUiGroup[];
  layout?: XUiLayout;
  columns?: number;
  hidden?: boolean;
  visibleIf?: Condition;
  summary?: string;
  thousands?: boolean;
}

/** 不合法的 x-ui: pointer 指向该 x-ui 对象, issue.path 相对它. */
export interface XUiProblem {
  pointer: JsonPointer;
  issue: XUiIssue;
}

interface UiLayer {
  source: ResolveSource;
  ui: XUiVariant;
}

/** 规则命中前的各层; rules 层由调用方按命中结果插入. */
export interface NodeLayers {
  ref?: XUi;
  node?: XUi;
  refVariant?: XUiVariant;
  nodeVariant?: XUiVariant;
  problems: XUiProblem[];
}

/** 读取 schema 对象上的 x-ui; 没有时返回 undefined, 不合法时记入 problems 并按没有处理. */
export function readXUi(schema: JsonSchema, pointer: JsonPointer, problems: XUiProblem[]): XUi | undefined {
  if (!isSchemaObject(schema) || !Object.hasOwn(schema, "x-ui")) return undefined;
  const value: unknown = schema["x-ui"];
  const issue = checkXUi(value);
  if (issue !== undefined) {
    problems.push({ pointer: appendPointer(pointer, "x-ui"), issue });
    return undefined;
  }
  return value as XUi;
}

function shallowMerge(base: XUi | undefined, top: XUi | undefined): XUi | undefined {
  if (base === undefined) return top;
  if (top === undefined) return base;
  const merged: XUi = { ...base, ...top };
  if (base.props !== undefined && top.props !== undefined) merged.props = { ...base.props, ...top.props };
  return merged;
}

export function collectLayers(node: ResolvedNode, scene: string): NodeLayers {
  const problems: XUiProblem[] = [];
  let ref: XUi | undefined;
  for (const target of [...node.targets].reverse()) ref = shallowMerge(ref, readXUi(target.schema, target.pointer, problems));
  const own = readXUi(node.site.schema, node.site.pointer, problems);
  const layers: NodeLayers = { problems };
  if (ref !== undefined) layers.ref = ref;
  if (own !== undefined) layers.node = own;
  const refVariant = ref?.variants?.[scene];
  if (refVariant !== undefined) layers.refVariant = refVariant;
  const nodeVariant = own?.variants?.[scene];
  if (nodeVariant !== undefined) layers.nodeVariant = nodeVariant;
  return layers;
}

export interface RuleSubject {
  pointer: JsonPointer;
  schema: JsonSchemaObject;
  virtual: boolean;
  /** 不计规则层时选中的组件名. */
  widget: string;
}

/** match 各条件为 "且"; type 要求节点恰为该单一类型; 合成节点与被拆分节点共用指针, 带 pointer 的规则不匹配合成节点. */
export function ruleMatches(match: UiRuleMatch, subject: RuleSubject): boolean {
  if (match.pointer !== undefined && (subject.virtual || !matchPointer(match.pointer, subject.pointer))) return false;
  if (match.type !== undefined) {
    const types = schemaTypes(subject.schema);
    if (types.length !== 1 || types[0] !== match.type) return false;
  }
  if (match.format !== undefined && subject.schema.format !== match.format) return false;
  if (match.enum !== undefined && (enumOptions(subject.schema) !== undefined) !== match.enum) return false;
  if (match.widget !== undefined && subject.widget !== match.widget) return false;
  return true;
}

export function rulesUsingWidget(rules: readonly UiRule[]): boolean {
  return rules.some((rule) => rule.match.widget !== undefined);
}

/** 由低到高的层; 规则按数组顺序, 后者优先. */
function orderedLayers(layers: NodeLayers, rules: readonly UiRule[]): UiLayer[] {
  const out: UiLayer[] = [];
  for (const rule of rules) out.push({ source: "rule", ui: rule.ui });
  if (layers.ref !== undefined) out.push({ source: "ref", ui: layers.ref });
  if (layers.node !== undefined) out.push({ source: "node", ui: layers.node });
  if (layers.refVariant !== undefined) out.push({ source: "ref", ui: layers.refVariant });
  if (layers.nodeVariant !== undefined) out.push({ source: "node", ui: layers.nodeVariant });
  return out;
}

const MERGED_KEYS = ["decorator", "order", "groups", "layout", "columns", "hidden", "visibleIf", "summary", "thousands"] as const;

export interface MergeResult {
  ui: MergedUi;
  /** 高优先级在前, 同名只保留优先级最高的一项. */
  candidates: WidgetCandidate[];
}

export function mergeLayers(layers: NodeLayers, rules: readonly UiRule[]): MergeResult {
  const ordered = orderedLayers(layers, rules);
  const ui: MergedUi = { props: {} };
  for (const { ui: layer } of ordered) {
    if (layer.props !== undefined) ui.props = { ...ui.props, ...layer.props };
    for (const key of MERGED_KEYS) {
      if (layer[key] !== undefined) (ui as unknown as Record<string, unknown>)[key] = layer[key];
    }
  }
  const candidates: WidgetCandidate[] = [];
  for (const { source, ui: layer } of [...ordered].reverse()) {
    if (layer.widget !== undefined && !candidates.some((c) => c.name === layer.widget)) candidates.push({ name: layer.widget, source });
  }
  return { ui, candidates };
}
