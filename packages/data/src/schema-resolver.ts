// 在单个 schema 文档内解析 $ref, 并求出数据路径上适用的子 schema, 供默认数据, 迁移, Mock 与错误文案共用.
import {
	isSchemaObject,
	lookupPointer,
	type JsonPointer,
	type JsonSchema,
	type JsonSchemaObject,
	type JsonSchemaType,
} from "@jotl/core";
import { jsonType } from "./json-value.js";

export interface SchemaResolver {
	/** 数据根对应的 schema; 引用总是在整个文档内解析. */
	readonly root: JsonSchema;
	/** 按引用所在节点 from 所属 schema 资源的 base URI 解析 ref; from 不在文档内(如合成的 schema)时按文档根资源解析; 无法解析时返回 undefined. */
	resolveRef(ref: string, from: unknown): JsonSchema | undefined;
}

/** 文档根没有 $id 时使用的伪 base URI; 须为层级 URI, 相对 $id 与相对引用才能在其上解析. */
const ROOT_BASE = "jotl:/root";

/**
 * 支持文档内的 `#/...` 指针, `#name` 形式的 $anchor, 以及文档内各 schema 资源的 $id(可带指针片段).
 * 嵌套 $id 按所在资源的 base URI 解析为绝对 URI; 指针片段相对目标资源的根求值; $anchor 按资源分作用域.
 * root 为文档内的子 schema 时数据根落在它上面.
 */
export function createResolver(document: JsonSchema, root: JsonSchema = document): SchemaResolver {
	const index: IdentifierIndex = {
		resources: new Map(),
		anchors: new Map(),
		bases: new WeakMap(),
	};
	collectIdentifiers(document, ROOT_BASE, index, new Set());
	const rootBase =
		(isSchemaObject(document) ? index.bases.get(document) : undefined) ?? ROOT_BASE;
	if (!index.resources.has(rootBase)) index.resources.set(rootBase, document);
	return {
		root,
		resolveRef(ref, from) {
			const base =
				(typeof from === "object" && from !== null ? index.bases.get(from) : undefined) ??
				rootBase;
			const target = resolveUri(ref, base);
			if (target === undefined) return undefined;
			const resource = index.resources.get(target.uri);
			if (target.fragment === "") return resource;
			if (target.fragment.startsWith("/")) {
				if (resource === undefined) return undefined;
				const { found, value } = lookupPointer(resource, target.fragment);
				return found && (typeof value === "boolean" || isSchemaObject(value))
					? (value as JsonSchema)
					: undefined;
			}
			return index.anchors.get(`${target.uri}#${target.fragment}`);
		},
	};
}

export interface SubschemaOptions {
	/** 只对文档内的子 schema 求值: JSON 指针, 或其中引用按文档解析的 schema 值(如由文档节点合成的 schema); 数据根落在该子 schema 上. */
	at?: JsonPointer | JsonSchema;
}

/** 选项 at 指定的子 schema: 指针在文档中求值, schema 值原样使用(其中的引用在文档内解析); 未指定时为文档本身, 找不到时为 undefined. */
export function subschemaAt(
	document: JsonSchema,
	at: JsonPointer | JsonSchema | undefined
): JsonSchema | undefined {
	if (at === undefined) return document;
	if (typeof at !== "string")
		return typeof at === "boolean" || isSchemaObject(at) ? at : undefined;
	const { found, value } = lookupPointer(document, at);
	return found && (typeof value === "boolean" || isSchemaObject(value))
		? (value as JsonSchema)
		: undefined;
}

const NON_SCHEMA_KEYWORDS = new Set([
	"const",
	"default",
	"enum",
	"examples",
	"x-ui",
	"errorMessage",
]);

interface IdentifierIndex {
	/** 资源的绝对 URI(不含片段) -> 资源根. */
	resources: Map<string, JsonSchema>;
	/** `资源 URI#锚点名` -> 声明该 $anchor(或 $dynamicAnchor)的节点. */
	anchors: Map<string, JsonSchema>;
	/** 文档内每个对象节点 -> 所属资源的 base URI. */
	bases: WeakMap<object, string>;
}

// 本包 lib 只有 ES2023, 不含 WHATWG URL 的类型; Node 与浏览器运行时都提供全局 URL, 这里只声明用到的部分.
declare const URL: new (url: string, base?: string) => { readonly href: string };

/** 把 ref 按 base 解析为去掉片段的绝对 URI 与解码后的片段; ref 不是合法 URI 引用时返回 undefined. */
function resolveUri(ref: string, base: string): { uri: string; fragment: string } | undefined {
	let href: string;
	try {
		href = new URL(ref, base).href;
	} catch {
		return undefined;
	}
	const hash = href.indexOf("#");
	if (hash === -1) return { uri: href, fragment: "" };
	try {
		return { uri: href.slice(0, hash), fragment: decodeURIComponent(href.slice(hash + 1)) };
	} catch {
		return undefined;
	}
}

function collectIdentifiers(
	node: unknown,
	base: string,
	index: IdentifierIndex,
	seen: Set<object>
): void {
	if (typeof node !== "object" || node === null || seen.has(node)) return;
	seen.add(node);
	if (Array.isArray(node)) {
		for (const item of node) collectIdentifiers(item, base, index, seen);
		return;
	}
	const schema = node as JsonSchemaObject;
	if (typeof schema.$id === "string") {
		const id = resolveUri(schema.$id, base);
		if (id !== undefined) {
			if (id.fragment === "" || id.fragment.startsWith("/")) {
				base = id.uri;
				if (!index.resources.has(base)) index.resources.set(base, schema);
			} else {
				// 旧草案的 `$id: "#name"` 等价于 $anchor.
				const key = `${id.uri}#${id.fragment}`;
				if (!index.anchors.has(key)) index.anchors.set(key, schema);
			}
		}
	}
	index.bases.set(schema, base);
	if (typeof schema.$anchor === "string") index.anchors.set(`${base}#${schema.$anchor}`, schema);
	if (typeof schema.$dynamicAnchor === "string") {
		const key = `${base}#${schema.$dynamicAnchor}`;
		if (!index.anchors.has(key)) index.anchors.set(key, schema);
	}
	for (const [key, value] of Object.entries(schema)) {
		if (!NON_SCHEMA_KEYWORDS.has(key)) collectIdentifiers(value, base, index, seen);
	}
}

export interface Expansion {
	/** 当前节点自身与经 $ref, allOf 展开得到的节点, 按展开顺序. */
	nodes: JsonSchemaObject[];
	/** 无法解析的 $ref. */
	unresolved: string[];
}

/** 展开节点的 $ref 与 allOf(不进入 anyOf/oneOf 分支); 同一对象只出现一次. */
export function expand(resolver: SchemaResolver, schema: JsonSchema | undefined): Expansion {
	const nodes: JsonSchemaObject[] = [];
	const unresolved: string[] = [];
	const visit = (node: JsonSchema | undefined): void => {
		if (!isSchemaObject(node) || nodes.includes(node)) return;
		nodes.push(node);
		if (typeof node.$ref === "string") {
			const target = resolver.resolveRef(node.$ref, node);
			if (target === undefined) unresolved.push(node.$ref);
			else visit(target);
		}
		if (typeof node.$dynamicRef === "string") {
			const target = resolver.resolveRef(node.$dynamicRef, node);
			if (target === undefined) unresolved.push(node.$dynamicRef);
			else visit(target);
		}
		for (const sub of node.allOf ?? []) visit(sub);
	};
	visit(schema);
	return { nodes, unresolved };
}

/** 取展开后第一个出现的关键字值. */
export function pick<K extends keyof JsonSchemaObject>(
	nodes: readonly JsonSchemaObject[],
	key: K
): JsonSchemaObject[K] {
	for (const node of nodes) if (node[key] !== undefined) return node[key];
	return undefined;
}

export function hasOwn(node: JsonSchemaObject, key: string): boolean {
	return Object.hasOwn(node, key);
}

/** 节点声明或可推断出的 JSON 类型; 无法推断时为空数组. */
export function schemaTypes(nodes: readonly JsonSchemaObject[]): JsonSchemaType[] {
	const declared = pick(nodes, "type");
	if (declared !== undefined) return Array.isArray(declared) ? declared : [declared];
	for (const node of nodes) {
		if (hasOwn(node, "const")) return [jsonType(node.const)];
		if (Array.isArray(node.enum) && node.enum.length > 0)
			return [...new Set(node.enum.map(jsonType))];
	}
	const has = (...keys: string[]): boolean => nodes.some(n => keys.some(k => n[k] !== undefined));
	if (
		has(
			"properties",
			"required",
			"additionalProperties",
			"patternProperties",
			"minProperties",
			"maxProperties"
		)
	) {
		return ["object"];
	}
	if (has("items", "prefixItems", "minItems", "maxItems", "uniqueItems", "contains"))
		return ["array"];
	if (has("minLength", "maxLength", "pattern", "format")) return ["string"];
	if (has("minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"))
		return ["number"];
	return [];
}

/** 值的 JSON 类型是否被 types 接受; integer 值也被 number 接受. */
export function acceptsType(types: readonly JsonSchemaType[], value: unknown): boolean {
	if (types.length === 0) return true;
	const actual = jsonType(value);
	return types.includes(actual) || (actual === "integer" && types.includes("number"));
}

/** 对象节点上 key 对应的子 schema: properties, patternProperties, 否则 additionalProperties. */
export function propertySchemas(nodes: readonly JsonSchemaObject[], key: string): JsonSchema[] {
	const out: JsonSchema[] = [];
	for (const node of nodes) {
		const declared = node.properties?.[key];
		if (declared !== undefined) {
			out.push(declared);
			continue;
		}
		let matched = false;
		for (const [pattern, sub] of Object.entries(node.patternProperties ?? {})) {
			if (safeRegExp(pattern)?.test(key)) {
				out.push(sub);
				matched = true;
			}
		}
		if (!matched && node.additionalProperties !== undefined)
			out.push(node.additionalProperties);
	}
	return out;
}

/** 数组节点上下标 index 对应的子 schema. */
export function itemSchemas(nodes: readonly JsonSchemaObject[], index: number): JsonSchema[] {
	const out: JsonSchema[] = [];
	for (const node of nodes) {
		const prefix = node.prefixItems?.[index];
		if (prefix !== undefined) out.push(prefix);
		else if (node.items !== undefined) out.push(node.items);
	}
	return out;
}

export function safeRegExp(pattern: string): RegExp | undefined {
	try {
		return new RegExp(pattern, "u");
	} catch {
		return undefined;
	}
}

/** 节点是否为带标签枚举: oneOf 的每个分支都只靠 const 区分. */
export function isLabeledEnum(node: JsonSchemaObject): boolean {
	return (
		Array.isArray(node.oneOf) &&
		node.oneOf.length > 0 &&
		node.oneOf.every(b => isSchemaObject(b) && hasOwn(b, "const"))
	);
}

/** 节点允许的离散值(const, enum 或带标签枚举); 不是离散值节点时为 undefined. */
export function allowedValues(nodes: readonly JsonSchemaObject[]): unknown[] | undefined {
	for (const node of nodes) {
		if (hasOwn(node, "const")) return [node.const];
		if (Array.isArray(node.enum)) return node.enum;
		if (isLabeledEnum(node)) return node.oneOf!.map(b => (b as JsonSchemaObject).const);
	}
	return undefined;
}
