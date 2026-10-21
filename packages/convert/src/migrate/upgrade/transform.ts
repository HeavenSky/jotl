// 单个文档的升级遍历: 逐节点运行宽松模式与级别规则, 产出新树, 并记录指针映射, 资源与 $ref 位置供改写引用.
import {
	type Diagnostic,
	type DiagnosticLocation,
	type JsonPointer,
	JSON_SCHEMA_DIALECT,
	SUBSCHEMA_KEYWORDS,
	appendPointer,
	formatPointer,
	isSchemaObject,
	lastPointerToken,
	lookupPointer,
	parentPointer,
} from "@jotl/core";
import { type UpgradeDiagnosticCode, upgradeDiagnostic, upgradeMessage } from "./diagnostics.js";
import { applyLenientMode } from "./lenient.js";
import { levelChain } from "./levels/registry.js";
import type {
	ConflictChoice,
	DiagnosticParams,
	MutableSchema,
	RuleContext,
} from "./rule-context.js";
import { resolveUri, splitFragment } from "./uri.js";
import { type SchemaVersion, matchDialect } from "./versions.js";

export type ConflictPolicy = "error" | "preferDeclared" | "preferLatest";

export interface TransformOptions {
	acceptNewerKeywords: boolean;
	onConflict: ConflictPolicy;
	/** 文档 URI, 也是解析相对 `$id` 与 `$ref` 的基准. */
	uri: string | undefined;
}

/** 没有文档 URI 时用于内部解析的占位基准; 只参与比较, 不写入输出. */
export const PLACEHOLDER_BASE = "jotl-upgrade:/document.json";

export interface Resource {
	oldPointer: JsonPointer;
	newPointer: JsonPointer;
}

export interface RefSite {
	node: MutableSchema;
	keyword: "$ref" | "$dynamicRef";
	/** 解析该引用所用的基准 URI(按 2020-12 语义, 含同一节点上的 `$id`). */
	base: string;
	declared: SchemaVersion;
	oldPointer: JsonPointer;
}

export interface DocumentState {
	uri: string | undefined;
	version: SchemaVersion;
	input: unknown;
	options: TransformOptions;
	root: unknown;
	/** 输入文档中每个 schema 节点与子 schema 容器的指针 → 输出中的指针. */
	pointerMap: Map<JsonPointer, JsonPointer>;
	/** 资源的绝对 URI(不含片段) → 资源根在输入与输出中的指针. */
	resources: Map<string, Resource>;
	refSites: RefSite[];
	diagnostics: Diagnostic[];
}

interface Scope {
	declared: SchemaVersion;
	base: string;
	resourceHasRecursiveAnchor: boolean;
}

interface Move {
	from: readonly string[];
	to: readonly string[];
}

function startsWith(path: readonly string[], prefix: readonly string[]): boolean {
	return prefix.length <= path.length && prefix.every((t, i) => path[i] === t);
}

class NodeContext implements RuleContext {
	readonly moves: Move[] = [];
	readonly aliases: Move[] = [];

	constructor(
		private readonly state: DocumentState,
		private readonly options: TransformOptions,
		private readonly oldPointer: JsonPointer,
		readonly declared: SchemaVersion,
		readonly isResourceRoot: boolean,
		readonly resourceHasRecursiveAnchor: boolean
	) {}

	get acceptNewerKeywords(): boolean {
		return this.options.acceptNewerKeywords;
	}

	originalPath(path: readonly string[]): string[] {
		let current = [...path];
		for (let i = this.moves.length - 1; i >= 0; i--) {
			const move = this.moves[i]!;
			if (startsWith(current, move.to))
				current = [...move.from, ...current.slice(move.to.length)];
		}
		return current;
	}

	location(path: readonly string[]): DiagnosticLocation {
		return locate(this.oldPointer + formatPointer(this.originalPath(path)), this.options.uri);
	}

	report(code: UpgradeDiagnosticCode, params: DiagnosticParams, path: readonly string[]): void {
		this.state.diagnostics.push(
			upgradeDiagnostic(code, params, { location: this.location(path) })
		);
	}

	conflict(
		code: UpgradeDiagnosticCode,
		params: DiagnosticParams,
		path: readonly string[]
	): ConflictChoice {
		const location = this.location(path);
		const policy = this.options.onConflict;
		if (policy === "error") {
			this.state.diagnostics.push(upgradeDiagnostic(code, params, { location }));
			return "declared";
		}
		const choice: ConflictChoice = policy === "preferDeclared" ? "declared" : "latest";
		const resolution =
			choice === "declared"
				? upgradeMessage("JOTL3351", { declared: this.declared })
				: upgradeMessage("JOTL3352");
		this.state.diagnostics.push(
			upgradeDiagnostic(code, params, {
				location,
				severity: "warning",
				related: [{ message: resolution, location }],
			})
		);
		return choice;
	}

	move(from: readonly string[], to: readonly string[]): void {
		this.moves.push({ from, to });
	}

	alias(from: readonly string[], to: readonly string[]): void {
		this.aliases.push({ from: this.originalPath(from), to });
	}
}

export function locate(pointer: JsonPointer, uri: string | undefined): DiagnosticLocation {
	return uri === undefined
		? { kind: "pointer", pointer }
		: { kind: "pointer", pointer, document: uri };
}

function cloneJson(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(cloneJson);
	if (isSchemaObject(value))
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cloneJson(v)]));
	return value;
}

const SINGLE: readonly string[] = SUBSCHEMA_KEYWORDS.single;
const ARRAY: readonly string[] = SUBSCHEMA_KEYWORDS.array;
const MAP: readonly string[] = SUBSCHEMA_KEYWORDS.map;

/** 嵌套的 `$schema` 切换其子树的声明版本. */
function nestedVersion(
	raw: MutableSchema,
	scope: Scope,
	state: DocumentState,
	pointer: JsonPointer,
	uri: string | undefined
): SchemaVersion {
	const declared = raw.$schema;
	if (typeof declared !== "string") return scope.declared;
	const match = matchDialect(declared);
	const location = locate(appendPointer(pointer, "$schema"), uri);
	if (match.kind === "version") return match.version;
	if (match.kind === "draft-03") {
		state.diagnostics.push(
			upgradeDiagnostic("JOTL3002", { evidence: "$schema" }, { location })
		);
	} else {
		state.diagnostics.push(
			upgradeDiagnostic("JOTL3008", { uri: declared, version: scope.declared }, { location })
		);
	}
	return scope.declared;
}

function walk(
	raw: unknown,
	oldPointer: JsonPointer,
	newPointer: JsonPointer,
	scope: Scope,
	state: DocumentState,
	options: TransformOptions
): unknown {
	state.pointerMap.set(oldPointer, newPointer);
	if (!isSchemaObject(raw)) return cloneJson(raw);

	const isRoot = oldPointer === "";
	const declared = isRoot
		? scope.declared
		: nestedVersion(raw, scope, state, oldPointer, options.uri);
	const hasOwnId =
		typeof raw.$id === "string" || (typeof raw.id === "string" && declared === "draft-04");
	const isResourceRoot = isRoot || hasOwnId;
	const resourceHasRecursiveAnchor = isResourceRoot
		? raw.$recursiveAnchor === true
		: scope.resourceHasRecursiveAnchor;

	const node: MutableSchema = { ...raw };
	const ctx = new NodeContext(
		state,
		options,
		oldPointer,
		declared,
		isResourceRoot,
		resourceHasRecursiveAnchor
	);
	applyLenientMode(node, ctx);
	for (const level of levelChain(declared)) for (const rule of level.rules) rule(node, ctx);

	if (!isRoot && typeof node.$schema === "string" && node.$schema !== JSON_SCHEMA_DIALECT) {
		ctx.report("JOTL3119", { dialect: JSON_SCHEMA_DIALECT }, ["$schema"]);
		node.$schema = JSON_SCHEMA_DIALECT;
	}

	let base = scope.base;
	if (typeof node.$id === "string") {
		base = splitFragment(resolveUri(scope.base, node.$id)).base;
		state.resources.set(base, { oldPointer, newPointer });
	}
	const childScope: Scope = { declared, base, resourceHasRecursiveAnchor };
	const child = (path: string[], value: unknown): unknown =>
		walk(
			value,
			oldPointer + formatPointer(ctx.originalPath(path)),
			newPointer + formatPointer(path),
			childScope,
			state,
			options
		);
	const container = (keyword: string): void => {
		state.pointerMap.set(
			oldPointer + formatPointer(ctx.originalPath([keyword])),
			appendPointer(newPointer, keyword)
		);
	};

	for (const [keyword, value] of Object.entries(node)) {
		if (SINGLE.includes(keyword)) {
			node[keyword] = child([keyword], value);
		} else if (ARRAY.includes(keyword) && Array.isArray(value)) {
			container(keyword);
			node[keyword] = value.map((item, i) => child([keyword, String(i)], item));
		} else if (MAP.includes(keyword) && isSchemaObject(value)) {
			container(keyword);
			node[keyword] = Object.fromEntries(
				Object.entries(value).map(([name, item]) => [name, child([keyword, name], item)])
			);
		} else {
			node[keyword] = cloneJson(value);
		}
	}

	for (const { from, to } of ctx.aliases) {
		const old = oldPointer + formatPointer(from);
		if (!state.pointerMap.has(old)) state.pointerMap.set(old, newPointer + formatPointer(to));
	}

	for (const keyword of ["$ref", "$dynamicRef"] as const) {
		if (typeof node[keyword] === "string") {
			state.refSites.push({ node, keyword, base, declared, oldPointer });
		}
	}
	return node;
}

/** 升级单个文档的全部节点; `$ref` 的改写与根上的 `$schema` 由调用方在之后完成. */
export function transformDocument(
	schema: unknown,
	version: SchemaVersion,
	options: TransformOptions
): DocumentState {
	const state: DocumentState = {
		uri: options.uri,
		version,
		input: schema,
		options,
		root: undefined,
		pointerMap: new Map(),
		resources: new Map(),
		refSites: [],
		diagnostics: [],
	};
	const base = splitFragment(options.uri ?? PLACEHOLDER_BASE).base;
	state.resources.set(base, { oldPointer: "", newPointer: "" });
	const scope: Scope = { declared: version, base, resourceHasRecursiveAnchor: false };
	state.root = walk(schema, "", "", scope, state, options);
	return state;
}

/**
 * 按 schema 升级只被 $ref 指向, 遍历时未经过的节点(如未知关键字下的子 schema), 替换输出中 newPointer 处的原样副本.
 * 返回是否升级了该节点.
 */
export function walkReferenced(
	state: DocumentState,
	oldPointer: JsonPointer,
	newPointer: JsonPointer,
	base: string
): boolean {
	if (state.pointerMap.has(oldPointer)) return false;
	const raw = lookupPointer(state.input, oldPointer);
	if (!raw.found || (!isSchemaObject(raw.value) && typeof raw.value !== "boolean")) return false;
	const parent = parentPointer(newPointer);
	const key = lastPointerToken(newPointer);
	if (parent === undefined || key === undefined) return false;
	const container = lookupPointer(state.root, parent).value;
	if (!isSchemaObject(container) && !Array.isArray(container)) return false;
	if (!Object.hasOwn(container, key)) return false;
	const scope: Scope = { declared: state.version, base, resourceHasRecursiveAnchor: false };
	(container as Record<string, unknown>)[key] = walk(
		raw.value,
		oldPointer,
		newPointer,
		scope,
		state,
		state.options
	);
	return true;
}
