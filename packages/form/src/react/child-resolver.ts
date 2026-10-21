// 按模板树定位实际数据路径上的节点: 节点 id, lazy 节点展开, 联合当前分支, 同路径内容节点, renderChild 的相对路径解析与按需规划.
import {
	appendPointer,
	isSchemaObject,
	tryParsePointer,
	type JsonPointer,
	type JsonSchemaObject,
} from "@jotl/core";
import { validate } from "@jotl/data";
import {
	expand,
	jsonEqual,
	plan,
	requiredKeys,
	resolvePlanNode,
	type RenderPlanNode,
} from "../core/index.js";
import type { FormContextValue } from "./context.js";
import { copyOf } from "./diagnostics.js";
import {
	acceptsType,
	childSite,
	containerKind,
	literalOf,
	type SchemaInfo,
} from "./schema-access.js";

/** 一个待渲染的节点: 模板节点加上实际数据路径与界面上下文. */
export interface NodeTarget {
	node: RenderPlanNode;
	path: JsonPointer;
	id: string;
	info: SchemaInfo;
	/** 是否为父对象的必填字段; 根与数组元素为 false, 同路径内容节点沿用父节点. */
	required: boolean;
	/** 外壳标签的后备文字(字段键名, 字典键名或元组位置 "第 n 项"); 数组元素没有. */
	labelKey: string | undefined;
	depth: number;
	/** 钻取渲染: 是当前页的根(或与它同路径的内容节点); 不是时组合字段显示为入口行. */
	page: boolean;
	/** 是数组元素或字典值(模板片段为 "*"). */
	element: boolean;
	/** 数组或字典节点的 summary, 作用于它的元素. */
	itemSummary: string | undefined;
}

/** 节点 id: 表单 id 加数据路径; 各片段经 encodeURIComponent 编码, 保证不含空白(aria-describedby 以空白分隔 id). */
export function nodeId(formId: string, dataPath: JsonPointer): string {
	const tokens = tryParsePointer(dataPath) ?? [];
	return `${formId}:${tokens.map(t => `/${encodeURIComponent(t)}`).join("")}`;
}

/** 与父节点数据路径相同的内容节点(联合分支, 可空内容, 树内容)的 id 后缀. */
const CONTENT_ID_SUFFIX = "+";

/** 没有对应 schema 或规划失败时用的兜底节点. */
export function syntheticJsonNode(
	schemaPointer: JsonPointer,
	dataPath: JsonPointer,
	decorator: string | false
): RenderPlanNode {
	return {
		schemaPointer,
		dataPath,
		widget: "json",
		level: "field",
		source: "fallback",
		fallbackChain: [],
		decorator,
		props: {},
		hidden: false,
		degraded: [],
		children: [],
	};
}

const expandedCache = new WeakMap<RenderPlanNode, RenderPlanNode>();

/** lazy 节点渲染时用 expand() 展开; 展开失败时该节点改用 json. */
export function effectiveNode(ctx: FormContextValue, node: RenderPlanNode): RenderPlanNode {
	if (node.lazy !== true) return node;
	const cached = expandedCache.get(node);
	if (cached !== undefined) return cached;
	const options =
		ctx.maxDepth === undefined
			? { scene: ctx.scene, mode: ctx.mode }
			: { scene: ctx.scene, mode: ctx.mode, maxDepth: ctx.maxDepth };
	const result = expand(node, ctx.document, ctx.registry, options);
	const expanded =
		result.value ?? syntheticJsonNode(node.schemaPointer, node.dataPath, node.decorator);
	expandedCache.set(node, expanded);
	return expanded;
}

/** 子节点都与本节点数据路径相同(联合, 可空, 树): 渲染时只取其中一个作为内容. */
export function isContentContainer(node: RenderPlanNode): boolean {
	return (
		node.level !== "view" &&
		node.children.length > 0 &&
		node.children.every(c => c.dataPath === node.dataPath)
	);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const branchMatchCache = new WeakMap<RenderPlanNode, WeakMap<object, number>>();

/** 按数据推断分支: 区分字段的字面量, 否则第一个通过校验的分支, 否则第一个类型相符的分支, 否则第一个. */
function inferBranch(ctx: FormContextValue, node: RenderPlanNode, value: unknown): number {
	const branches = node.children.map(child => resolvePlanNode(child, ctx.document));
	if (
		node.discriminator !== undefined &&
		isPlainObject(value) &&
		Object.hasOwn(value, node.discriminator)
	) {
		const actual = value[node.discriminator];
		const index = branches.findIndex(branch => {
			const literal = literalOf(ctx.document, branch, node.discriminator!);
			return literal !== undefined && jsonEqual(literal.value, actual);
		});
		if (index !== -1) return index;
	}
	if (value !== undefined) {
		const passing = branches.findIndex(
			branch => validate(ctx.document, value, { at: branch.effective }).value?.valid === true
		);
		if (passing !== -1) return passing;
	}
	const typed = branches.findIndex(branch => acceptsType(branch.effective, value));
	return typed === -1 ? 0 : typed;
}

/** 联合节点的当前分支: 表单内选过的分支优先, 否则按数据推断. */
export function activeBranch(
	ctx: FormContextValue,
	target: Pick<NodeTarget, "node" | "path" | "info">,
	value: unknown
): number {
	const { node } = target;
	if (node.children.length <= 1) return 0;
	const selected = ctx.store.selection(target.path);
	if (selected !== undefined && selected < node.children.length) return selected;
	if (typeof value !== "object" || value === null) return inferBranch(ctx, node, value);
	let cache = branchMatchCache.get(node);
	if (cache === undefined) {
		cache = new WeakMap();
		branchMatchCache.set(node, cache);
	}
	const cached = cache.get(value);
	if (cached !== undefined) return cached;
	const index = inferBranch(ctx, node, value);
	cache.set(value, index);
	return index;
}

/** 同路径内容节点的目标; branch 缺省时取当前分支. */
export function contentTarget(
	ctx: FormContextValue,
	target: NodeTarget,
	branch?: number
): NodeTarget | undefined {
	const node = effectiveNode(ctx, target.node);
	if (!isContentContainer(node)) return undefined;
	const index = branch ?? activeBranch(ctx, { ...target, node }, ctx.store.getAt(target.path));
	const child = node.children[index];
	if (child === undefined) return undefined;
	return {
		node: child,
		path: target.path,
		id: `${target.id}${CONTENT_ID_SUFFIX}`,
		info: resolvePlanNode(child, ctx.document),
		required: target.required,
		labelKey: target.labelKey,
		depth: target.depth + 1,
		page: target.page,
		element: target.element,
		itemSummary: target.itemSummary,
	};
}

const onDemandCache = new WeakMap<RenderPlanNode, Map<JsonPointer, RenderPlanNode>>();

/** 被接管(claims)的子路径不在模板树中; 复合组件经 renderChild 交还时按需规划该子节点. */
function onDemandNode(
	ctx: FormContextValue,
	parent: RenderPlanNode,
	pointer: JsonPointer | undefined,
	template: JsonPointer
): RenderPlanNode {
	let cache = onDemandCache.get(parent);
	if (cache === undefined) {
		cache = new Map();
		onDemandCache.set(parent, cache);
	}
	const cached = cache.get(template);
	if (cached !== undefined) return cached;
	let node: RenderPlanNode | undefined;
	if (pointer !== undefined) {
		const options = {
			schemaPointer: pointer,
			dataPath: template,
			scene: ctx.scene,
			mode: ctx.mode,
			parentWidget: parent.widget,
			...(ctx.maxDepth === undefined ? {} : { maxDepth: ctx.maxDepth }),
		};
		node = plan(ctx.document, ctx.registry, options).value;
	}
	node ??= syntheticJsonNode(pointer ?? parent.schemaPointer, template, "field");
	cache.set(template, node);
	return node;
}

/** 从 from 出发走一个数据片段; 先穿过同路径的内容节点. */
function step(ctx: FormContextValue, from: NodeTarget, token: string): NodeTarget {
	let current = { ...from, node: effectiveNode(ctx, from.node) };
	for (let guard = 0; guard < 16 && isContentContainer(current.node); guard++) {
		const content = contentTarget(ctx, current);
		if (content === undefined) break;
		current = { ...content, node: effectiveNode(ctx, content.node) };
	}
	const { node, info } = current;
	const site = childSite(ctx.document, info, node.schemaPointer, token);
	const template = appendPointer(node.dataPath, site?.templateToken ?? token);
	const planned = node.children.find(c => c.dataPath === template);
	const childNode = planned ?? onDemandNode(ctx, node, site?.pointer, template);
	const childInfo =
		planned !== undefined
			? resolvePlanNode(planned, ctx.document)
			: (site?.info ?? { effective: {}, origin: new Map() });
	const objectParent =
		containerKind(info.effective) === "object" || isPlainObject(ctx.store.getAt(current.path));
	const path = appendPointer(current.path, token);
	const tuplePosition =
		site !== undefined &&
		site.templateToken !== "*" &&
		Array.isArray(info.effective.prefixItems);
	return {
		node: childNode,
		path,
		id: nodeId(ctx.formId, path),
		info: childInfo,
		required:
			objectParent && site?.templateToken !== "*" && requiredKeys(info.effective).has(token),
		labelKey: objectParent
			? token
			: tuplePosition
				? copyOf(ctx.locale).item(Number(token))
				: undefined,
		depth: current.depth + 1,
		page: false,
		element: site?.templateToken === "*",
		itemSummary: site?.templateToken === "*" ? node.summary : undefined,
	};
}

/** renderChild 的相对路径(已转义的片段, 如 "img" "0/img")解析为目标节点; 空路径为节点自身. */
export function resolveChild(
	ctx: FormContextValue,
	from: NodeTarget,
	relativePath: string
): NodeTarget {
	const relative = relativePath.replace(/^\//, "");
	if (relative === "") return from;
	const tokens = tryParsePointer(`/${relative}`) ?? [relative];
	let target = from;
	for (const token of tokens) target = step(ctx, target, token);
	return target;
}

export function propertyNames(schema: JsonSchemaObject): string[] {
	return isSchemaObject(schema.properties) ? Object.keys(schema.properties) : [];
}
