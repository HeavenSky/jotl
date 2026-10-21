// schema 节点的引用解析与有效 schema: 沿 $ref 链取目标, 与引用处的同级关键字合并.
import {
	isSchemaObject,
	lookupPointer,
	tryParsePointer,
	type JsonPointer,
	type JsonSchema,
	type JsonSchemaObject,
} from "@jotl/core";

/** plan 中的一个 schema 位置; virtual 表示由上层节点拆分合成, pointer 与被拆分的节点相同. */
export interface SchemaSite {
	pointer: JsonPointer;
	schema: JsonSchema;
	virtual?: true;
	/** 拆分出的节点沿用被拆分节点的关键字来源, 子节点位置据此落在关键字实际所在处. */
	origin?: ReadonlyMap<string, JsonPointer>;
}

export interface RefTarget {
	pointer: JsonPointer;
	schema: JsonSchemaObject;
}

export interface ResolvedNode {
	site: SchemaSite;
	/** 引用链上的目标, 由近及远. */
	targets: RefTarget[];
	/** 目标由远及近, 最后是引用处, 依次浅合并, 去掉 $ref. */
	effective: JsonSchemaObject;
	/** 有效 schema 中每个关键字来自哪个 schema 位置. */
	origin: ReadonlyMap<string, JsonPointer>;
	/** 无法解析的引用; 有值时 effective 只含引用处自身的关键字. */
	unresolvedRef?: string;
}

/** 只解析文档内引用("#" 与 "#/..."); 其余形式与指向不存在的位置都返回 undefined. */
export function resolveRefPointer(document: JsonSchema, ref: string): RefTarget | undefined {
	if (!ref.startsWith("#")) return undefined;
	let pointer: string;
	try {
		pointer = decodeURIComponent(ref.slice(1));
	} catch {
		return undefined;
	}
	if (tryParsePointer(pointer) === undefined) return undefined;
	const { found, value } = lookupPointer(document, pointer);
	if (!found) return undefined;
	if (value === true) return { pointer, schema: {} };
	return isSchemaObject(value) ? { pointer, schema: value } : undefined;
}

export function resolveNode(document: JsonSchema, site: SchemaSite, depth = 0): ResolvedNode {
	const own: JsonSchemaObject = isSchemaObject(site.schema) ? site.schema : {};
	const targets: RefTarget[] = [];
	let unresolvedRef: string | undefined;
	let current = own;
	const seen = new Set<string>();
	while (typeof current.$ref === "string") {
		const ref = current.$ref;
		const target = seen.has(ref) ? undefined : resolveRefPointer(document, ref);
		if (target === undefined) {
			unresolvedRef = ref;
			break;
		}
		seen.add(ref);
		targets.push(target);
		current = target.schema;
	}
	const layers: RefTarget[] = unresolvedRef === undefined ? [...targets].reverse() : [];
	layers.push({ pointer: site.pointer, schema: own });
	const effective: JsonSchemaObject = {};
	const origin = new Map<string, JsonPointer>();
	for (const layer of layers) {
		for (const [key, value] of Object.entries(layer.schema)) {
			if (key === "$ref") continue;
			effective[key] = value;
			origin.set(
				key,
				(layer.schema === own ? site.origin?.get(key) : undefined) ?? layer.pointer
			);
		}
	}
	if (Array.isArray(effective.allOf) && depth < MAX_ALL_OF_DEPTH)
		mergeAllOf(document, site.pointer, effective, depth);
	const resolved: ResolvedNode = { site, targets, effective, origin };
	if (unresolvedRef !== undefined) resolved.unresolvedRef = unresolvedRef;
	return resolved;
}

const MAX_ALL_OF_DEPTH = 8;

/** 文档中一个 schema 的有效 schema; pointer 为它在文档中的位置, 作为其自身关键字的来源. */
export function resolveSchema(
	document: JsonSchema,
	schema: JsonSchema,
	pointer: JsonPointer = ""
): ResolvedNode {
	return resolveNode(document, { pointer, schema });
}

const atCache = new WeakMap<object, Map<JsonPointer, ResolvedNode>>();

/** 文档中指针处的有效 schema, 按文档与指针缓存; 指针不存在或指向的不是 schema 时为空 schema. */
export function resolveSchemaAt(document: JsonSchema, pointer: JsonPointer): ResolvedNode {
	let cache: Map<JsonPointer, ResolvedNode> | undefined;
	if (typeof document === "object") {
		cache = atCache.get(document) ?? new Map();
		atCache.set(document, cache);
		const cached = cache.get(pointer);
		if (cached !== undefined) return cached;
	}
	const { found, value } = lookupPointer(document, pointer);
	const schema: JsonSchema =
		found && (typeof value === "boolean" || isSchemaObject(value)) ? (value as JsonSchema) : {};
	const resolved = resolveNode(document, { pointer, schema });
	cache?.set(pointer, resolved);
	return resolved;
}

/** 可区分联合的引用分支 `{allOf: [{$ref}], properties, required}`: 各成员与本节点合并, properties 按键合并, required 取并集. */
function mergeAllOf(
	document: JsonSchema,
	pointer: JsonPointer,
	effective: JsonSchemaObject,
	depth: number
): void {
	const members = effective.allOf as JsonSchema[];
	if (!members.every(isSchemaObject)) return;
	const own: JsonSchemaObject = { ...effective };
	delete own.allOf;
	for (const key of Object.keys(effective)) delete effective[key];
	const parts = members.map(
		m => resolveNode(document, { pointer, schema: m }, depth + 1).effective
	);
	for (const part of [...parts, own]) {
		for (const [key, value] of Object.entries(part)) {
			if (key === "properties" && isSchemaObject(value))
				effective.properties = {
					...effective.properties,
					...(value as Record<string, JsonSchema>),
				};
			else if (key === "required" && Array.isArray(value))
				effective.required = [...new Set([...(effective.required ?? []), ...value])];
			else effective[key] = value;
		}
	}
}

/** 递归检测用的类型身份: 引用链最远处的目标; 不是引用时为 undefined. */
export function refIdentity(node: ResolvedNode): JsonPointer | undefined {
	return node.targets[node.targets.length - 1]?.pointer;
}
