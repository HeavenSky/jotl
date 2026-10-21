// 单个节点的渲染: 按 fallbackChain 选组件, 处理渲染期降级(F4 F5 F8 F9), 外壳, 显示条件, 钻取入口行, 折叠面板, 错误归属登记与降级上报.
import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { labelId, styles as htmlStyles } from "../html/index.js";
import { tryParsePointer, type Diagnostic } from "@jotl/core";
import {
	DECORATOR_WIDGET,
	FALLBACK_WIDGET,
	evaluateCondition,
	type RenderPlanNode,
	type WidgetRegistration,
} from "../core/index.js";
import { Boundary } from "./boundary.js";
import { effectiveNode, resolveChild, type NodeTarget } from "./child-resolver.js";
import { useFormContext, useStoreValue, type FormContextValue } from "./context.js";
import { copyOf, localizedDiagnostic } from "./diagnostics.js";
import { useLocale } from "../locale-context.js";
import { contentCount, hostKindOf, isDrillKind, itemLabel, summaryText } from "./drill.js";
import { HOSTS, canSplit, type HostKind } from "./hosts.js";
import { MinimalJson } from "./minimal-json.js";
import { acceptsType, widgetSchema } from "./schema-access.js";
import { DEGRADE_TARGETS, type DegradeEvent, type ReactWidgetComponent } from "./types.js";
import { useLoadedComponent } from "./widget-loader.js";
import { styles } from "./styles.js";

type Registration = WidgetRegistration<ReactWidgetComponent>;

/** 组件自带错误显示的种类: 外壳不再重复显示这些节点自身的错误. */
const OWN_ERROR_KINDS: ReadonlySet<HostKind> = new Set([
	"array",
	"tuple",
	"union",
	"nullable",
	"map",
	"tree",
	"custom",
]);

/** 报错时拆开为逐个子节点渲染(F5)的种类. */
const COMPOSITE_KINDS: ReadonlySet<HostKind> = new Set([
	"array",
	"tuple",
	"union",
	"nullable",
	"map",
	"tree",
	"custom",
]);

const NO_ERRORS: Diagnostic[] = [];

let ownerCount = 0;

/** 错误归属登记的键, 每个节点实例一个(不用 React 18 的 useId). */
function nextOwnerId(): string {
	ownerCount += 1;
	return `owner-${ownerCount}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** F8: 已有的值与该组件要求的数据形态不符. */
function mismatches(kind: HostKind, widget: string, target: NodeTarget, value: unknown): boolean {
	if (value === undefined || widget === FALLBACK_WIDGET || kind === "view") return false;
	switch (kind) {
		case "object":
		case "map":
			return !isPlainObject(value);
		case "array":
			return !Array.isArray(value);
		default:
			return !acceptsType(target.info.effective, value);
	}
}

interface FailureState {
	node: RenderPlanNode;
	/** 渲染报错而不再使用的组件名. */
	failed: string[];
	split: "no" | "active" | "failed";
	decoratorFailed: boolean;
}

function initialFailure(node: RenderPlanNode): FailureState {
	return { node, failed: [], split: "no", decoratorFailed: false };
}

interface Choice {
	name: string;
	registration: Registration | undefined;
}

/** 按候选顺序取第一个未失败且已注册的组件; 都不可用时用内置最小兜底. */
function choose(
	ctx: FormContextValue,
	names: readonly string[],
	skip: ReadonlySet<string>,
	skipLazy: boolean
): Choice {
	for (const name of names) {
		if (skip.has(name)) continue;
		const registration = ctx.registry.get(name);
		if (registration === undefined || (skipLazy && registration.load !== undefined)) continue;
		return { name, registration };
	}
	return { name: DEGRADE_TARGETS.minimalJson, registration: undefined };
}

function degradeKey(e: DegradeEvent): string {
	return `${e.code}|${e.from ?? ""}|${e.to}`;
}

export function LoadingPlaceholder() {
	const COPY = copyOf(useLocale());
	return (
		<span className="jotl-loading" role="status">
			{COPY.loading}
		</span>
	);
}

/** 不按 id 设 key: id 随数组下标变化, 用它做 key 会在排序后重建元素, 丢失焦点与草稿. */
function renderTarget(target: NodeTarget): ReactNode {
	return <NodeView {...target} />;
}

function NodeViewImpl(props: NodeTarget) {
	const ctx = useFormContext();
	const { store, registry } = ctx;
	const COPY = copyOf(ctx.locale);
	const node = effectiveNode(ctx, props.node);
	const target = useMemo<NodeTarget>(
		() => ({
			node,
			path: props.path,
			id: props.id,
			info: props.info,
			required: props.required,
			labelKey: props.labelKey,
			depth: props.depth,
			page: props.page,
			element: props.element,
			itemSummary: props.itemSummary,
		}),
		[
			node,
			props.path,
			props.id,
			props.info,
			props.required,
			props.labelKey,
			props.depth,
			props.page,
			props.element,
			props.itemSummary,
		]
	);
	const { path, info } = target;
	const isView = node.level === "view";

	const visible = useStoreValue(
		store,
		() => node.visibleIf === undefined || evaluateCondition(node.visibleIf, store.value, path)
	);
	const hidden = !isView && (node.hidden || !visible);

	const [failureState, setFailure] = useState<FailureState>(() => initialFailure(node));
	const failure = failureState.node === node ? failureState : initialFailure(node);
	const chain = useMemo(() => [node.widget, ...node.fallbackChain, FALLBACK_WIDGET], [node]);
	const failed = useMemo(() => new Set(failure.failed), [failure.failed]);

	const first = choose(ctx, chain, failed, false);
	const loaded = useLoadedComponent(first.registration);
	const loadFailed = loaded.state.status === "failed";
	let choice = loadFailed ? choose(ctx, chain, new Set([...failed, first.name]), true) : first;
	let kind = hostKindOf(choice.name, choice.registration);

	const mismatched = useStoreValue(store, () =>
		mismatches(kind, choice.name, target, store.getAt(path))
	);
	const originalChoice = choice;
	if (mismatched) {
		choice = choose(ctx, [FALLBACK_WIDGET], failed, true);
		kind = "field";
	}
	const splitting = failure.split === "active" && !mismatched;
	if (splitting) kind = "split";

	let component: ReactWidgetComponent | null;
	if (choice.name === DEGRADE_TARGETS.minimalJson)
		component = failed.has(DEGRADE_TARGETS.minimalJson) ? null : MinimalJson;
	else if (choice === first && loaded.state.status === "loaded")
		component = loaded.state.component;
	else if (choice === first && loaded.state.status === "loading")
		component =
			(first.registration?.component as ReactWidgetComponent | undefined) ??
			LoadingPlaceholder;
	else component = (choice.registration?.component as ReactWidgetComponent | undefined) ?? null;

	// 钻取: 不在当前页根上的组合字段显示为入口行(标签 + 摘要 + 其下错误数), 其下的错误都归入口行计数.
	const asEntry =
		ctx.drill &&
		!isView &&
		!target.page &&
		!splitting &&
		!mismatched &&
		isDrillKind(ctx, kind, choice.name, node);
	// 当前页的根由面包屑表明位置, 不再包外壳; 数据根本来就没有外壳.
	const pageRoot = ctx.drill && target.page && path !== "" && path === ctx.path;
	// 折叠面板: 不钻取时组合字段包在面板中, 标签移到面板标题行; 同路径的内容节点(id 以 "+" 结尾)不再套一层, 树自带展开收起.
	const asPanel =
		ctx.collapsible &&
		!isView &&
		path !== "" &&
		!target.id.endsWith("+") &&
		!splitting &&
		!mismatched &&
		kind !== "tree" &&
		isDrillKind(ctx, kind, choice.name, node);
	const decoratorName =
		isView || pageRoot || node.decorator === false || failure.decoratorFailed
			? undefined
			: node.decorator;
	const decoratorRegistration =
		decoratorName === undefined
			? undefined
			: (registry.get(decoratorName) ?? registry.get(DECORATOR_WIDGET));
	const Decorator = decoratorRegistration?.component as ReactWidgetComponent | undefined;

	const usesMinimal = choice.name === DEGRADE_TARGETS.minimalJson;
	const ownDisplay = OWN_ERROR_KINDS.has(kind) || usesMinimal || asEntry;
	const displays = Decorator !== undefined || ownDisplay;
	// 字段层组件(含 json 与多选框)显示整个值, 子路径上没有节点时子路径的错误也归它.
	const takeover =
		asEntry ||
		kind === "field" ||
		kind === "custom" ||
		kind === "tree" ||
		choice.registration?.claims !== undefined;

	const [ownerId] = useState(nextOwnerId);
	const refine = useRef<((diagnostic: Diagnostic) => Diagnostic[] | undefined) | undefined>(
		undefined
	);
	useLayoutEffect(() => {
		if (hidden || isView) return undefined;
		store.registerOwner(ownerId, { path, depth: target.depth, displays, takeover, refine });
		return () => store.unregisterOwner(ownerId);
	}, [displays, hidden, isView, ownerId, path, store, takeover, target.depth]);

	const ownerErrors = useStoreValue(store, () => store.errorsOf(ownerId));
	const label =
		typeof info.effective.title === "string" && info.effective.title !== ""
			? info.effective.title
			: target.labelKey;
	const errors = useMemo(() => {
		if (!mismatched) return ownerErrors;
		const f8 = localizedDiagnostic(
			ctx.locale,
			"JOTL6001",
			{ label: label ?? itemLabel(target, ctx.locale) ?? COPY.rootLabel },
			{ location: { kind: "pointer", pointer: path } }
		);
		return [f8, ...ownerErrors];
	}, [COPY, ctx.locale, label, mismatched, ownerErrors, path, target]);

	const events: DegradeEvent[] = [];
	const event = (e: Omit<DegradeEvent, "dataPath" | "schemaPointer">): void => {
		events.push({ ...e, dataPath: path, schemaPointer: node.schemaPointer });
	};
	for (const d of node.degraded)
		event(
			d.from === undefined
				? { code: d.reason, to: node.widget }
				: { code: d.reason, from: d.from, to: node.widget }
		);
	if (loadFailed)
		event({
			code: "F9",
			from: first.name,
			to: originalChoice.name,
			error: (loaded.state as { error: unknown }).error,
		});
	if (mismatched) event({ code: "F8", from: originalChoice.name, to: choice.name });
	if (
		usesMinimal &&
		!failed.has(FALLBACK_WIDGET) &&
		registry.get(FALLBACK_WIDGET) === undefined
	) {
		event({ code: "F1", from: FALLBACK_WIDGET, to: DEGRADE_TARGETS.minimalJson });
	}
	if (decoratorName !== undefined && registry.get(decoratorName) === undefined) {
		event({
			code: "F1",
			from: decoratorName,
			to: decoratorRegistration === undefined ? DEGRADE_TARGETS.none : DECORATOR_WIDGET,
		});
	}
	// 去重键不含数据路径: 数组元素移动后同一实例换了路径, 已报过的事件不再按新路径重报.
	const eventKey = events.map(degradeKey).join("\n");
	const reported = useRef(new Set<string>());
	const pending = useRef(events);
	pending.current = events;
	useEffect(() => {
		for (const e of pending.current) {
			const key = degradeKey(e);
			if (reported.current.has(key)) continue;
			reported.current.add(key);
			ctx.report(e);
		}
	}, [ctx, eventKey]);

	const nextAfter = (name: string, extraSkip: string[] = []): string =>
		choose(ctx, chain, new Set([...failed, name, ...extraSkip]), true).name;
	const onHostError = (error: unknown): void => {
		if (!splitting && COMPOSITE_KINDS.has(kind) && failure.split === "no" && canSplit(target)) {
			ctx.report({
				code: "F5",
				dataPath: path,
				schemaPointer: node.schemaPointer,
				from: choice.name,
				to: DEGRADE_TARGETS.split,
				error,
			});
			setFailure({ ...failure, split: "active", failed: [...failure.failed, choice.name] });
			return;
		}
		const failedName = choice.name;
		const to =
			failedName === DEGRADE_TARGETS.minimalJson
				? DEGRADE_TARGETS.none
				: nextAfter(failedName);
		ctx.report({
			code: "F4",
			dataPath: path,
			schemaPointer: node.schemaPointer,
			from: splitting ? DEGRADE_TARGETS.split : failedName,
			to,
			error,
		});
		setFailure({
			...failure,
			split: splitting ? "failed" : failure.split,
			failed: [...failure.failed, failedName],
		});
	};
	const onDecoratorError = (error: unknown): void => {
		ctx.report({
			code: "F4",
			dataPath: path,
			schemaPointer: node.schemaPointer,
			from: decoratorName ?? DECORATOR_WIDGET,
			to: DEGRADE_TARGETS.none,
			error,
		});
		setFailure({ ...failure, decoratorFailed: true });
	};

	const renderChild = useCallback(
		(relativePath: string) => renderTarget(resolveChild(ctx, target, relativePath)),
		[ctx, target]
	);
	const base = useMemo(
		() => ({
			id: target.id,
			schema: widgetSchema(ctx.document, info),
			dataPath: path,
			mode: ctx.mode,
			props: node.props,
			adapters: ctx.adapters,
			renderChild,
		}),
		[ctx.adapters, ctx.document, ctx.mode, info, node.props, path, renderChild, target.id]
	);

	if (hidden && Decorator === undefined) return null;

	const Host = HOSTS[kind];
	let content: ReactNode = asEntry ? (
		<EntryRow target={target} errors={errors} />
	) : component === null ? null : (
		<Boundary key={`${choice.name}|${kind}|${failure.failed.length}`} onError={onHostError}>
			<Host
				component={component}
				target={target}
				base={base}
				errors={errors}
				refine={refine}
				renderTarget={renderTarget}
			/>
		</Boundary>
	);
	if (loadFailed) {
		content = (
			<div className="jotl-lazy-failed">
				<span className="jotl-lazy-failed-message" role="alert">
					{COPY.loadFailed}
				</span>
				<button
					type="button"
					className={`jotl-button jotl-lazy-retry ${htmlStyles.button()}`}
					onClick={loaded.retry}
				>
					{COPY.retry}
				</button>
				{content}
			</div>
		);
	}
	const panel = (children: ReactNode): ReactNode =>
		asPanel ? (
			<Panel target={target} label={label} hidden={hidden}>
				{children}
			</Panel>
		) : (
			children
		);
	if (Decorator === undefined) return panel(content);
	const description =
		typeof info.effective.description === "string" ? info.effective.description : undefined;
	return panel(
		<Boundary key="decorator" onError={onDecoratorError}>
			<Decorator
				id={target.id}
				{...(label === undefined || asPanel ? {} : { label })}
				{...(description === undefined ? {} : { description })}
				required={target.required}
				errors={ownDisplay ? NO_ERRORS : errors}
				hidden={hidden}
			>
				{content}
			</Decorator>
		</Boundary>
	);
}

/** 节点的全部输入都是稳定引用, 父节点重渲染时未变化的子节点跳过渲染. */
export const NodeView = memo(NodeViewImpl);

/** 入口行: 摘要(没有时为填写概况; 数组元素的序号由列表显示) + 其下错误数; 点击进入该层. */
function EntryRow({ target, errors }: { target: NodeTarget; errors: readonly Diagnostic[] }) {
	const ctx = useFormContext();
	const COPY = copyOf(ctx.locale);
	const text = useStoreValue(
		ctx.store,
		() =>
			summaryText(target, ctx.store.getAt(target.path)) ??
			contentCount(ctx.store.getAt(target.path), ctx.locale)
	);
	return (
		<button
			type="button"
			id={target.id}
			className={`jotl-entry ${styles.entry}`}
			aria-invalid={errors.length > 0 ? true : undefined}
			onClick={() => ctx.navigate(target.path)}
		>
			<span className={`jotl-entry-summary ${styles.entrySummary}`}>{text}</span>
			{errors.length > 0 && (
				<span className={`jotl-entry-errors ${styles.entryErrors}`}>
					{COPY.errorCount(errors.length)}
				</span>
			)}
			<span className={`jotl-entry-arrow ${styles.entryArrow}`} aria-hidden={true}>
				{COPY.enterMark}
			</span>
		</button>
	);
}

/**
 * 折叠面板: 标题行为标题 + 摘要(没有时为填写概况) + 其下错误数; 数组元素的序号由列表显示, 标题改为摘要.
 * 第一层默认展开, 展开状态只是展示状态; 提交校验失败时展开其下有错误的面板.
 */
function Panel({
	target,
	label,
	hidden,
	children,
}: {
	target: NodeTarget;
	label: string | undefined;
	hidden: boolean;
	children: ReactNode;
}) {
	const ctx = useFormContext();
	const COPY = copyOf(ctx.locale);
	const text = useStoreValue(
		ctx.store,
		() =>
			summaryText(target, ctx.store.getAt(target.path)) ??
			contentCount(ctx.store.getAt(target.path), ctx.locale)
	);
	const errorCount = useStoreValue(ctx.store, () => ctx.store.errorCountUnder(target.path));
	const [open] = useState(() => (tryParsePointer(target.path)?.length ?? 0) <= 1);
	const details = useRef<HTMLDetailsElement>(null);
	const { onSubmitFailed, store } = ctx;
	useEffect(
		// 直接改 DOM 的 open: open 属性只作初始值, 之后由用户点击切换, React 不会再写回.
		() =>
			onSubmitFailed(() => {
				if (details.current !== null && store.errorCountUnder(target.path) > 0)
					details.current.open = true;
			}),
		[onSubmitFailed, store, target.path]
	);
	const isItem = itemLabel(target, ctx.locale) !== undefined;
	return (
		<details ref={details} className={`jotl-panel ${styles.panel}`} open={open} hidden={hidden}>
			<summary className={`jotl-panel-header ${styles.panelHeader}`}>
				{/* 面板标题接替外壳标签, 组件根元素的 aria-labelledby 仍能找到它. */}
				<span id={labelId(target.id)} className={`jotl-panel-title ${styles.panelTitle}`}>
					{isItem ? text : (label ?? COPY.rootLabel)}
					{target.required && (
						<span className={`jotl-required ${htmlStyles.required}`} aria-hidden={true}>
							*
						</span>
					)}
				</span>
				{!isItem && (
					<span className={`jotl-panel-summary ${styles.panelSummary}`}>{text}</span>
				)}
				{errorCount > 0 && (
					<span className={`jotl-panel-errors ${styles.entryErrors}`}>
						{COPY.errorCount(errorCount)}
					</span>
				)}
			</summary>
			<div className={`jotl-panel-body ${styles.panelBody}`}>{children}</div>
		</details>
	);
}
