// core/ 测试共用: 登记全部内置组件名的注册表, 按数据路径查找计划节点.
import { expect } from "vitest";
import type { JsonSchema } from "@jotl/core";
import {
  BUILTIN_WIDGETS,
  createRegistry,
  plan,
  type PlanOptions,
  type Registry,
  type RenderPlanNode,
  type WidgetLevel,
  type WidgetRegistration,
} from "../../src/core/index.js";

/** 每个内置名一个占位组件; extra 中的同名项覆盖内置项. */
export function builtinRegistry(extra: WidgetRegistration<unknown>[] = []): Registry<unknown> {
  const registry = createRegistry<unknown>(
    Object.entries(BUILTIN_WIDGETS).map(([name, w]) => ({ name, level: w.level as WidgetLevel, component: name })),
  );
  for (const r of extra) registry.register(r);
  return registry;
}

export function widget(name: string, level: WidgetLevel = "field", rest: Partial<WidgetRegistration<unknown>> = {}): WidgetRegistration<unknown> {
  return { name, level, component: name, ...rest };
}

/** plan 成功(无 error)并返回根节点. */
export function planOk(schema: JsonSchema, registry: Registry<unknown> = builtinRegistry(), options?: PlanOptions): RenderPlanNode {
  const result = plan(schema, registry, options);
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.value).toBeDefined();
  return result.value!;
}

/** 深度优先取第一个 dataPath 相等的节点(同一路径上取最外层). */
export function findNode(root: RenderPlanNode, dataPath: string): RenderPlanNode {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.shift()!;
    if (node.dataPath === dataPath && node.level !== "view") return node;
    stack.push(...node.children);
  }
  throw new Error(`计划中没有数据路径 ${dataPath}`);
}

/** 数据根节点(视图节点的唯一子节点). */
export function dataRoot(root: RenderPlanNode): RenderPlanNode {
  expect(root.widget).toBe("form");
  expect(root.children).toHaveLength(1);
  return root.children[0]!;
}

export function walk(root: RenderPlanNode, visit: (node: RenderPlanNode) => void): void {
  visit(root);
  for (const child of root.children) walk(child, visit);
}
