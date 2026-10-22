// 组件契约(CT5): 注册, 解析上下文, 渲染计划与各层组件 props; 与 UI 框架无关.
import type {
	Condition,
	Diagnostic,
	JsonPointer,
	JsonSchema,
	JsonSchemaObject,
	Locale,
	Result,
	WidgetLevel,
	XUiGroup,
} from "@jotl/core";

export type { WidgetLevel };

export type RenderMode = "edit" | "view" | "disabled";

export interface ResolveContext {
	scene: string;
	mode: RenderMode;
	schemaPointer: JsonPointer;
	/** 数组下标用 "*" 占位. */
	dataPath: JsonPointer;
	parentWidget?: string;
	depth: number;
}

export interface WidgetRegistration<C = unknown> {
	name: string;
	level: WidgetLevel;
	component: C;
	/** 能否处理该数据形态. */
	accepts?: (schema: JsonSchemaObject) => boolean;
	/** >0 参与竞选, 分值高者胜. */
	match?: (schema: JsonSchemaObject, ctx: ResolveContext) => number;
	/** 复合组件接管的子数据路径(相对). */
	claims?: (schema: JsonSchemaObject) => JsonPointer[] | "all";
	/** 懒加载(D35); 有 load 时 component 为加载前的占位, 加载失败按 F9 处理; ctx.locale 为首个触发加载的表单的语言. */
	load?: (ctx?: { locale: Locale }) => Promise<C>;
}

export interface Registry<C> {
	register(r: WidgetRegistration<C>): void;
	get(name: string): WidgetRegistration<C> | undefined;
	/** 实例级注册表, 未找到时回落到父注册表. */
	extend(): Registry<C>;
	/** 本级与各级父注册表中的全部登记, 本级覆盖父级同名项. */
	list(): WidgetRegistration<C>[];
}

/** node: 节点自身或引用处的 x-ui; ref: 被引用类型的 x-ui; rule: 根规则表. */
export type ResolveSource = "node" | "ref" | "rule" | "matcher" | "builtin" | "fallback";

export type PlanDegradeReason = "F1" | "F2" | "F3" | "F7";

export interface RenderPlanNode {
	schemaPointer: JsonPointer;
	/** 模板路径, 数组下标为 "*". */
	dataPath: JsonPointer;
	widget: string;
	level: WidgetLevel;
	source: ResolveSource;
	/** 当前组件之后的备选组件名, 渲染期降级(F4)按序使用, 末尾总是 "json". */
	fallbackChain: string[];
	decorator: string | false;
	props: Record<string, unknown>;
	hidden: boolean;
	degraded: { reason: PlanDegradeReason; from?: string }[];
	/** 对象: 每个未被接管的属性, 有 schema 形式的 additionalProperties 时末尾另有其余键的值模板(数据片段 "*"); 数组: 一个元素模板; 元组: 每个位置一个, items 允许剩余元素(true 或 schema)时末尾另有剩余元素模板(数据片段 "*"); union: 每个分支一个. */
	children: RenderPlanNode[];
	/** 递归引用超过 maxDepth 时不展开, 渲染期调用 expand(). */
	lazy?: true;
	/** 对象节点, 取自合并后的 x-ui(D42). */
	layout?: "stack" | "tabs" | "grid";
	columns?: number;
	/** 对象节点, 取自合并后的 x-ui; 无分组时为空数组. */
	groups?: XUiGroup[];
	/** 渲染器用 evaluateCondition(cond, data, dataPath) 求值(D43). */
	visibleIf?: Condition;
	/** 可区分联合的区分字段名(D39), 渲染器据此按数据选分支. */
	discriminator?: string;
	/** 对象, 数组与 map 节点: 入口行与面包屑显示的字段名(数组与 map 指元素对象的字段), 取自合并后的 x-ui. */
	summary?: string;
	/** number money bigint 节点: 失焦与只读时是否按千分位显示; money 缺省为 true, 其余缺省为 false. */
	thousands?: boolean;
}

export interface PlanOptions extends Partial<ResolveContext> {
	maxDepth?: number;
}

export type PlanFunction = (
	schema: JsonSchema,
	registry: Registry<unknown>,
	ctx?: PlanOptions
) => Result<RenderPlanNode>;
/** ctx 中给出的场景, 模式与 maxDepth 优先于节点生成时记录的值. */
export type ExpandFunction = (
	node: RenderPlanNode,
	schema: JsonSchema,
	registry: Registry<unknown>,
	ctx?: PlanOptions
) => Result<RenderPlanNode>;
/** dataPath 为实际路径. */
export type EvaluateCondition = (cond: Condition, data: unknown, dataPath: JsonPointer) => boolean;

/** 浏览器 Blob / File 的结构子集; core/ 不依赖 DOM 类型, 组件包传入的 File 可直接赋值. */
export interface BlobLike {
	readonly size: number;
	readonly type: string;
	readonly name?: string;
}

/** upload 的调用方: 发起上传的字段. */
export interface UploadContext {
	/** 实际路径, 数组下标为具体数字. */
	dataPath: JsonPointer;
	schema: JsonSchemaObject;
}

/** N 为框架的节点类型, React 下为 React.ReactNode. */
export interface Adapters<N> {
	/** 返回 URL. */
	upload?: (file: BlobLike, ctx: UploadContext) => Promise<string>;
	loadOptions?: (source: string) => Promise<{ value: unknown; label: string }[]>;
	richText?: (props: FieldProps<string, N>) => N;
}

export interface BaseProps<N> {
	/** 稳定 id, 用于 label 的 for 与 aria-describedby. */
	id: string;
	schema: JsonSchemaObject;
	/** 实际路径, 数组下标为具体数字. */
	dataPath: JsonPointer;
	mode: RenderMode;
	props: Record<string, unknown>;
	adapters: Adapters<N>;
	/** 相对数据路径, 如 "img", "0", "0/img"; 被渲染的子节点自身的 x-ui 照常生效. */
	renderChild(relativePath: string): N;
}

export interface FieldProps<V = unknown, N = unknown> extends BaseProps<N> {
	/** 是否为父对象的必填字段; 根节点与数组元素为 false. */
	required: boolean;
	value: V | undefined;
	onChange(value: V | undefined): void;
	onBlur(): void;
	errors: Diagnostic[];
	/** number money bigint: 失焦与只读时是否按千分位显示, 取自渲染计划节点的 thousands; 缺省时组件按 money 开, 其余关处理. */
	thousands?: boolean;
}

export interface DecoratorProps<N> {
	id: string;
	label?: string;
	description?: string;
	required: boolean;
	errors: Diagnostic[];
	hidden: boolean;
	children: N;
}

export interface LayoutField {
	key: string;
	required: boolean;
	hidden: boolean;
	/** 该字段及其子路径上当前显示的错误数; 渲染器不提供时缺省. */
	errorCount?: number;
}

/** object. */
export interface LayoutProps<N> extends BaseProps<N> {
	/** 已按 order 排序; hidden 已计入 visibleIf 求值结果. */
	fields: LayoutField[];
	groups: { title: string; fields: string[] }[];
	layout: "stack" | "tabs" | "grid";
	columns: number;
	/** 对象另有 schema 形式的 additionalProperties 时提供: 编辑不在 properties 中的键, 值用 renderChild(escapePointerToken(name)) 渲染. */
	additional?: EntryEditing;
}

export interface ArrayProps<N> extends BaseProps<N> {
	/** key 为稳定的元素 key, 不随排序改变. */
	items: { key: string; dataPath: JsonPointer }[];
	/** 由 minItems / maxItems 与 mode 计算. */
	canAdd: boolean;
	canRemove: boolean;
	add(index?: number): void;
	remove(index: number): void;
	move(from: number, to: number): void;
	/** 把第 index 项深拷贝后插入其后; 受 canAdd 约束. 渲染器不提供时 widget 不显示复制. */
	duplicate?(index: number): void;
	/** 数组层自身的错误(如数量越界). */
	errors: Diagnostic[];
}

/** P1. */
export interface UnionProps<N> extends BaseProps<N> {
	branches: { title: string }[];
	activeBranch: number;
	selectBranch(index: number): void;
	/** 渲染当前分支的内容, 数据路径与本节点相同. */
	renderContent(): N;
	errors: Diagnostic[];
}

/** P1: 可空值. */
export interface NullableProps<N> extends BaseProps<N> {
	isNull: boolean;
	setNull(isNull: boolean): void;
	/** 非空时渲染非空分支的内容, 数据路径与本节点相同. */
	renderContent(): N;
	errors: Diagnostic[];
}

/** 键值条目的编辑: 字典的全部键, 或对象中不属于 properties 的键. */
export interface EntryEditing {
	/** key 为条目的稳定 key, name 为字典键名. */
	entries: { key: string; name: string; dataPath: JsonPointer }[];
	canAdd: boolean;
	canRemove: boolean;
	addEntry(name: string): void;
	removeEntry(name: string): void;
	renameEntry(from: string, to: string): void;
}

/** P1: Map<string, T>, 值用 renderChild(escapePointerToken(name)) 渲染. */
export interface MapProps<N> extends BaseProps<N>, EntryEditing {
	errors: Diagnostic[];
}

/** 元组中 prefixItems 之后的剩余元素; index 均为数据中的实际下标(从 prefixItems 的长度起), 元素用 renderChild(String(index)) 渲染. */
export interface TupleRest {
	/** key 为稳定的元素 key, 不随增删排序改变. */
	items: { key: string; index: number; dataPath: JsonPointer }[];
	/** 由 minItems / maxItems 与 mode 计算; prefixItems 各位置未填满时不能新增. */
	canAdd: boolean;
	canRemove: boolean;
	/** 在末尾新增一个剩余元素. */
	add(): void;
	/** 删除下标为 index 的剩余元素; index 小于 prefixItems 的长度时不做任何事. */
	remove(index: number): void;
	/** 在剩余元素之间移动, from / to 为实际下标; 任一小于 prefixItems 的长度时不做任何事. 渲染器不提供时 widget 不显示上移下移. */
	move?(from: number, to: number): void;
	/** 把下标为 index 的剩余元素深拷贝后插入其后; 受 canAdd 约束. 渲染器不提供时 widget 不显示复制. */
	duplicate?(index: number): void;
}

/** P2: 元组, 按位置渲染 prefixItems 各项, 第 i 项用 renderChild(String(i)) 渲染; 位置不增删. */
export interface TupleProps<N> extends BaseProps<N> {
	/** prefixItems 各位置的实际路径, 按位置排列. */
	items: { dataPath: JsonPointer }[];
	/** items 允许剩余元素(true 或 schema)时提供; false 或缺省时不提供, 剩余元素不显示. */
	rest?: TupleRest;
	/** 元组自身的错误(如长度不符). */
	errors: Diagnostic[];
}

/** P1: 递归引用, 折叠时不渲染内容. */
export interface TreeProps<N> extends BaseProps<N> {
	expanded: boolean;
	setExpanded(expanded: boolean): void;
	/** 展开后的内容, 由渲染器按需 expand() 后渲染. */
	renderContent(): N;
	errors: Diagnostic[];
}

export interface ViewProps<N> extends BaseProps<N> {
	submit(): void;
	reset(): void;
	children: N;
	/** 不属于任何可见字段的错误(如被 visibleIf 隐藏的字段, 钻取时不在当前页的字段). */
	errors: Diagnostic[];
	/** 定位 errors 中的一条: 钻取时先切到错误所在的页, 再滚动到并聚焦对应字段(字段不可见时取最近的可见祖先). 渲染器不提供时 widget 把错误显示为纯文本. */
	goToError?(error: Diagnostic): void;
}
