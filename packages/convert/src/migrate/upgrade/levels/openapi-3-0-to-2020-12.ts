// OpenAPI 3.0 Schema Object → 2020-12: nullable, example, 布尔 exclusive 边界, byte/binary 格式, $ref 旁的关键字.
import type { Level, MutableSchema, RuleContext } from "../rule-context.js";
import { resolveRefSiblings, rewriteExclusiveBounds } from "./shared-rules.js";

function rewriteNullable(node: MutableSchema, ctx: RuleContext): void {
	if (!Object.hasOwn(node, "nullable")) return;
	const nullable = node.nullable;
	delete node.nullable;
	if (nullable !== true) {
		ctx.report("JOTL3127", {}, ["nullable"]);
		return;
	}
	const type = node.type;
	if (typeof type !== "string" && !Array.isArray(type)) {
		ctx.report("JOTL3126", {}, ["nullable"]);
		return;
	}
	ctx.report("JOTL3124", {}, ["nullable"]);
	const types: unknown[] = Array.isArray(type) ? [...type] : [type];
	if (!types.includes("null")) types.push("null");
	node.type = types;
	if (Array.isArray(node.enum) && !node.enum.includes(null)) {
		ctx.report("JOTL3125", {}, ["enum"]);
		node.enum = [...node.enum, null];
	}
}

function rewriteExample(node: MutableSchema, ctx: RuleContext): void {
	if (!Object.hasOwn(node, "example")) return;
	ctx.report("JOTL3128", {}, ["example"]);
	const existing = Array.isArray(node.examples) ? node.examples : [];
	node.examples = [node.example, ...existing];
	delete node.example;
}

function rewriteBinaryFormats(node: MutableSchema, ctx: RuleContext): void {
	if (node.format === "byte" && node.contentEncoding === undefined) {
		ctx.report("JOTL3129", {}, ["format"]);
		node.contentEncoding = "base64";
		delete node.format;
	} else if (node.format === "binary" && node.contentMediaType === undefined) {
		ctx.report("JOTL3130", {}, ["format"]);
		node.contentMediaType = "application/octet-stream";
		delete node.format;
	}
}

export const OPENAPI_3_0_TO_2020_12: Level = {
	from: "openapi-3.0",
	to: "2020-12",
	rules: [
		resolveRefSiblings,
		rewriteNullable,
		rewriteExample,
		(node, ctx) => rewriteExclusiveBounds(node, ctx, false),
		rewriteBinaryFormats,
	],
};
