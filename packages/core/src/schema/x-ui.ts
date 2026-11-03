// x-ui 关键字(CT4)的类型.
import type { JsonSchemaObject } from "./json-schema.js";

/** 对象节点的布局(D42); tabs 时每个 groups 项一个标签页, 未分组字段放第一个标签页. */
export type XUiLayout = "stack" | "tabs" | "grid";

export interface XUiGroup {
	title: string;
	fields: string[];
}

/**
 * 叶子条件的基准: 缺省为数据根; "node" 为当前节点所在的对象.
 */
export type ConditionBase = "root" | "node";

/** 叶子条件的比较算子; `right` 的类型按 `op` 约束(见 ConditionLeaf). */
export type ConditionOp = "eq" | "ne" | "in" | "notIn" | "truthy" | "gt" | "gte" | "lt" | "lte";

/**
 * 叶子条件(D43): `left` 为从基准起算的 lodash `get` 路径, 其中的 "*" 取当前节点所在数组的对应下标;
 * eq ne 按 JSON 值深度相等比较, in notIn 的 right 为候选数组, truthy 的 right 为布尔,
 * gt gte lt lte 只比较数值.
 */
export type ConditionLeaf = { base?: ConditionBase; left: string } & (
	| { op: "eq" | "ne"; right: unknown }
	| { op: "in" | "notIn"; right: unknown[] }
	| { op: "truthy"; right: boolean }
	| { op: "gt" | "gte" | "lt" | "lte"; right: number }
);

/**
 * 显示条件(D43): 叶子, 与(`{op: "and", conditions}`), 或(`{op: "or", conditions}`)或非(`{op: "not", condition}`).
 */
export type Condition =
	| ConditionLeaf
	| { op: "and" | "or"; conditions: Condition[] }
	| { op: "not"; condition: Condition };

const PLAIN_SEGMENT = /^[^.[\]'"\\\s]+$/;
const LodashIndex = /^(?:0|[1-9]\d*)$/;

/** lodash `get` 路径(`a.b[0]` `a['x-y']` `list[*].on`) → 片段; 不合法时返回 undefined. */
export function parseLodashPath(path: string): string[] | undefined {
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
				if (inner !== "*" && !LodashIndex.test(inner)) return undefined;
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

/** 片段 → lodash `get` 路径; 空片段数组返回 undefined. */
export function formatLodashPath(tokens: readonly string[]): string | undefined {
	if (tokens.length === 0) return undefined;
	let out = "";
	for (const token of tokens) {
		if (token === "*" || LodashIndex.test(token)) out += `[${token}]`;
		else if (PLAIN_SEGMENT.test(token) && !/^\d/.test(token))
			out += out === "" ? token : `.${token}`;
		else out += `['${token.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}']`;
	}
	return out;
}

export type XUiVariant = Omit<XUi, "variants" | "rules" | "version" | "widgets">;

/** 组件登记级别, 渲染器的组件注册与 x-ui 模块声明共用. */
export const WIDGET_LEVELS = ["view", "layout", "composite", "field", "decorator"] as const;
export type WidgetLevel = (typeof WIDGET_LEVELS)[number];

/** 扩展组件模块: ES 模块地址与导出名, 导出名缺省为 `default`. */
export interface XUiWidgetModule {
	/** 底层类型: 类型名或 schema 对象; 缺省为 object. */
	base?: string | JsonSchemaObject;
	module: string;
	export?: string;
	/** 登记级别; 缺省为 field, 组件接管整个值. */
	level?: WidgetLevel;
}

export interface XUi {
	/** widget 名, 内置名见 `@jotl/form/core` 的 BUILTIN_WIDGETS. */
	widget?: string;
	/** 透传给组件的参数, 必须可 JSON 序列化. */
	props?: Record<string, unknown>;
	/** 字段外壳 widget 名; false 表示不要外壳. */
	decorator?: string | false;
	/** 对象节点: 子字段顺序, 未列出的按原顺序排在后面. */
	order?: string[];
	/** 对象节点: 分组, 未分组的字段排在最前. */
	groups?: XUiGroup[];
	layout?: XUiLayout;
	/** layout 为 grid 时的列数, 默认 2. */
	columns?: number;
	hidden?: boolean;
	visibleIf?: Condition;
	/** 对象, 对象元素的数组与 map: 入口行与面包屑显示的字段名. */
	summary?: string;
	/** 数值类: 失焦与只读时按千分位显示. */
	thousands?: boolean;
	/** 场景覆盖(D44), 场景名默认 "default". */
	variants?: Record<string, XUiVariant>;
	/** 只在根节点生效. */
	rules?: UiRule[];
	/** 只在根节点出现. */
	version?: 1;
	/** 只在根节点出现: widget 名 → 实现它的组件模块. */
	widgets?: Record<string, XUiWidgetModule>;
}

export interface UiRuleMatch {
	/** 匹配 schema 文档内的指针, 支持 "*" 匹配单个片段. */
	pointer?: string;
	type?: string;
	format?: string;
	/** true 匹配枚举节点. */
	enum?: boolean;
	/** 匹配该节点当前已选中的 widget 名. */
	widget?: string;
}

export interface UiRule {
	match: UiRuleMatch;
	ui: XUiVariant;
}

export const DEFAULT_SCENE = "default";
export const DEFAULT_GRID_COLUMNS = 2;
