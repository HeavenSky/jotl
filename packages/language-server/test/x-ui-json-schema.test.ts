// x-ui 编辑用 schema(E7): x-ui 部分与 xUiMetaSchema 等价, 递归覆盖全部子 schema 关键字, 引用都可解析, 能到达样例中的每个 x-ui.
import {
	JSON_SCHEMA_DIALECT,
	type JsonSchemaObject,
	lookupPointer,
	SUBSCHEMA_KEYWORDS,
	xUiMetaSchema,
} from "@jotl/core";
import { describe, expect, it } from "vitest";
import { listFixtures, readFixture } from "../../../test-utils/fixtures.js";
import { createXUiJsonSchema, SCHEMA_NODE_DEF, X_UI_DEF } from "../src/index.js";

const generated = createXUiJsonSchema();
const defs = generated.$defs as Record<string, JsonSchemaObject>;
const node = defs[SCHEMA_NODE_DEF]!;
const nodeProperties = node.properties as Record<string, JsonSchemaObject>;
const NODE_REF = { $ref: `#/$defs/${SCHEMA_NODE_DEF}` };

function* refs(value: unknown): Generator<string> {
	if (Array.isArray(value)) for (const item of value) yield* refs(item);
	else if (typeof value === "object" && value !== null) {
		for (const [key, child] of Object.entries(value)) {
			if (key === "$ref" && typeof child === "string") yield child;
			else yield* refs(child);
		}
	}
}

/** 只沿生成 schema 声明的子 schema 关键字下行, 统计能到达的 x-ui. */
function reachableXUi(schema: unknown): number {
	if (typeof schema !== "object" || schema === null || Array.isArray(schema)) return 0;
	let count = "x-ui" in schema ? 1 : 0;
	for (const [key, value] of Object.entries(schema)) {
		if ((SUBSCHEMA_KEYWORDS.single as readonly string[]).includes(key))
			count += reachableXUi(value);
		else if (
			(SUBSCHEMA_KEYWORDS.array as readonly string[]).includes(key) &&
			Array.isArray(value)
		) {
			for (const item of value) count += reachableXUi(item);
		} else if (
			(SUBSCHEMA_KEYWORDS.map as readonly string[]).includes(key) &&
			typeof value === "object" &&
			value !== null
		) {
			for (const item of Object.values(value)) count += reachableXUi(item);
		}
	}
	return count;
}

/** 不看关键字语义, 数出文档中全部 x-ui 键; 不进入 x-ui 的取值内部. */
function allXUi(value: unknown): number {
	if (Array.isArray(value)) return value.reduce((n: number, item) => n + allXUi(item), 0);
	if (typeof value !== "object" || value === null) return 0;
	return Object.entries(value).reduce(
		(n, [key, child]) => n + (key === "x-ui" ? 1 : allXUi(child)),
		0
	);
}

describe("x-ui 编辑用 schema", () => {
	it("根使用 2020-12 方言并指向 schema 节点定义", () => {
		expect(generated.$schema).toBe(JSON_SCHEMA_DIALECT);
		expect(generated.$ref).toBe(NODE_REF.$ref);
		expect(node.type).toEqual(["object", "boolean"]);
	});

	it("x-ui 取值部分与 xUiMetaSchema 等价(去掉方言与 $id, $defs 提升到根)", () => {
		const { $schema: _s, $id: _i, $defs: metaDefs, ...metaBody } = xUiMetaSchema;
		expect(nodeProperties["x-ui"]).toEqual({ $ref: `#/$defs/${X_UI_DEF}` });
		expect(defs[X_UI_DEF]).toEqual(metaBody);
		for (const [name, def] of Object.entries(metaDefs ?? {}))
			expect(defs[name], name).toEqual(def);
		expect(Object.keys(defs).sort()).toEqual(
			[SCHEMA_NODE_DEF, X_UI_DEF, ...Object.keys(metaDefs ?? {})].sort()
		);
	});

	it("每个子 schema 关键字都递归到 schema 节点", () => {
		for (const keyword of SUBSCHEMA_KEYWORDS.single)
			expect(nodeProperties[keyword], keyword).toEqual(NODE_REF);
		for (const keyword of SUBSCHEMA_KEYWORDS.array)
			expect(nodeProperties[keyword], keyword).toEqual({ type: "array", items: NODE_REF });
		for (const keyword of SUBSCHEMA_KEYWORDS.map) {
			expect(nodeProperties[keyword], keyword).toEqual({
				type: "object",
				additionalProperties: NODE_REF,
			});
		}
		const keywords = [
			...SUBSCHEMA_KEYWORDS.single,
			...SUBSCHEMA_KEYWORDS.array,
			...SUBSCHEMA_KEYWORDS.map,
			"x-ui",
		];
		expect(Object.keys(nodeProperties).sort()).toEqual(keywords.sort());
	});

	it("全部 $ref 都是文档内指针且能解析", () => {
		const all = [...refs(generated)];
		expect(all.length).toBeGreaterThan(0);
		for (const ref of all) {
			expect(ref.startsWith("#/"), ref).toBe(true);
			expect(lookupPointer(generated, ref.slice(1)).found, ref).toBe(true);
		}
	});

	it("可序列化为 JSON 且往返不变", () => {
		expect(JSON.parse(JSON.stringify(generated))).toEqual(generated);
	});

	it("共享样例的 schema 中每个 x-ui 都位于可递归到达的 schema 节点上", () => {
		let total = 0;
		for (const name of listFixtures()) {
			const fixture = readFixture(name);
			if (!fixture.hasSchema) continue;
			const expected = allXUi(fixture.schema);
			total += expected;
			expect(reachableXUi(fixture.schema), name).toBe(expected);
		}
		expect(total).toBeGreaterThan(0);
	});
});
