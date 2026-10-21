// 多个级别与宽松模式共用的改写: 布尔形式的 exclusive 边界, $ref 旁的关键字, definitions 与 dependencies.
import { isSchemaObject } from "@jotl/core";
import type { MutableSchema, RuleContext } from "../rule-context.js";
import { isKnownKeyword } from "../versions.js";

const EXCLUSIVE_BOUNDS = [
	["exclusiveMaximum", "maximum"],
	["exclusiveMinimum", "minimum"],
] as const;

/**
 * 布尔形式的 exclusiveMaximum/Minimum 改为数值形式.
 * oldForm 为 true 表示出现在更高的声明版本中, 以宽松模式的警告记录.
 */
export function rewriteExclusiveBounds(
	node: MutableSchema,
	ctx: RuleContext,
	oldForm: boolean
): void {
	for (const [keyword, bound] of EXCLUSIVE_BOUNDS) {
		const value = node[keyword];
		if (typeof value !== "boolean") continue;
		if (oldForm)
			ctx.report("JOTL3203", { declared: ctx.declared, keyword, value: String(value) }, [
				keyword,
			]);
		if (value && typeof node[bound] === "number") {
			if (!oldForm) ctx.report("JOTL3102", { keyword, bound }, [keyword]);
			node[keyword] = node[bound];
			delete node[bound];
		} else {
			if (!oldForm)
				ctx.report(value ? "JOTL3104" : "JOTL3103", { keyword, bound }, [keyword]);
			delete node[keyword];
		}
	}
}

/** 与 $ref 并列时不影响校验结果的关键字; 未知关键字在 2020-12 中只是注解, 也不影响. */
const REF_HARMLESS_SIBLINGS = new Set([
	"$ref",
	"$schema",
	"$comment",
	"title",
	"description",
	"default",
	"examples",
	"readOnly",
	"writeOnly",
	"deprecated",
	"definitions",
	"$defs",
	"contentMediaType",
	"contentEncoding",
	"contentSchema",
]);

/** 旧版本忽略 $ref 旁的关键字, 2020-12 会生效: 有影响校验的关键字时按冲突处理. */
export function resolveRefSiblings(node: MutableSchema, ctx: RuleContext): void {
	if (typeof node.$ref !== "string") return;
	const offending = Object.keys(node).filter(
		k => !REF_HARMLESS_SIBLINGS.has(k) && isKnownKeyword(k)
	);
	if (offending.length === 0) return;
	const choice = ctx.conflict(
		"JOTL3303",
		{ declared: ctx.declared, keywords: offending.join(", ") },
		["$ref"]
	);
	if (choice === "declared") for (const k of offending) delete node[k];
}

/**
 * definitions 并入 $defs; 同名时按冲突处理.
 * oldForm 为 true 表示声明版本已用 $defs(2019-09), 此时声明版本以 $defs 为准.
 */
export function mergeDefinitions(node: MutableSchema, ctx: RuleContext, oldForm: boolean): void {
	const definitions = node.definitions;
	if (!isSchemaObject(definitions)) return;
	if (node.$defs !== undefined && !isSchemaObject(node.$defs)) return;
	if (oldForm)
		ctx.report(
			"JOTL3204",
			{ declared: ctx.declared, keyword: "definitions", replacement: "$defs" },
			["definitions"]
		);
	if (node.$defs === undefined) {
		if (!oldForm) ctx.report("JOTL3105", {}, ["definitions"]);
		node.$defs = definitions;
		delete node.definitions;
		ctx.move(["definitions"], ["$defs"]);
		return;
	}
	const merged: MutableSchema = { ...(node.$defs as MutableSchema) };
	for (const [name, sub] of Object.entries(definitions)) {
		if (Object.hasOwn(merged, name)) {
			const choice = ctx.conflict("JOTL3301", { name }, ["definitions", name]);
			if (oldForm || choice === "latest") {
				ctx.alias(["definitions", name], ["$defs", name]);
				continue;
			}
		} else if (!oldForm) {
			ctx.report("JOTL3106", { name }, ["definitions", name]);
		}
		merged[name] = sub;
		ctx.move(["definitions", name], ["$defs", name]);
	}
	node.$defs = merged;
	delete node.definitions;
}

/**
 * dependencies 拆分为 dependentRequired(数组值)与 dependentSchemas(schema 值); 拆分后同名时按冲突处理.
 * oldForm 的含义同 mergeDefinitions.
 */
export function splitDependencies(node: MutableSchema, ctx: RuleContext, oldForm: boolean): void {
	const dependencies = node.dependencies;
	if (!isSchemaObject(dependencies)) return;
	const buckets = {
		dependentRequired: node.dependentRequired,
		dependentSchemas: node.dependentSchemas,
	};
	if (Object.values(buckets).some(b => b !== undefined && !isSchemaObject(b))) return;
	if (oldForm) {
		ctx.report(
			"JOTL3204",
			{
				declared: ctx.declared,
				keyword: "dependencies",
				replacement: "dependentRequired / dependentSchemas",
			},
			["dependencies"]
		);
	}
	const required: MutableSchema = { ...(buckets.dependentRequired as MutableSchema | undefined) };
	const schemas: MutableSchema = { ...(buckets.dependentSchemas as MutableSchema | undefined) };
	for (const [name, value] of Object.entries(dependencies)) {
		const isList = Array.isArray(value);
		const keyword = isList ? "dependentRequired" : "dependentSchemas";
		const bucket = isList ? required : schemas;
		if (Object.hasOwn(bucket, name)) {
			const choice = ctx.conflict("JOTL3304", { keyword, name }, ["dependencies", name]);
			if (oldForm || choice === "latest") {
				if (!isList) ctx.alias(["dependencies", name], ["dependentSchemas", name]);
				continue;
			}
		} else if (!oldForm) {
			ctx.report(isList ? "JOTL3107" : "JOTL3108", { name }, ["dependencies", name]);
		}
		bucket[name] = value;
		if (!isList) ctx.move(["dependencies", name], ["dependentSchemas", name]);
	}
	delete node.dependencies;
	if (Object.keys(required).length > 0) node.dependentRequired = required;
	if (Object.keys(schemas).length > 0) node.dependentSchemas = schemas;
}
