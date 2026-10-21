import { JSON_SCHEMA_DIALECT, orderKeywords } from "@jotl/core";
import { describe, expect, it } from "vitest";
import { RECURSIVE_ANCHOR_NAME, upgradeSchema } from "../../../src/migrate/upgrade/index.js";
import { codes, deepFreeze, find, pointerOf } from "./helpers.js";

const D4 = "http://json-schema.org/draft-04/schema#";
const D6 = "http://json-schema.org/draft-06/schema#";
const D7 = "http://json-schema.org/draft-07/schema#";
const D2019 = "https://json-schema.org/draft/2019-09/schema";

describe("draft-04 → 06", () => {
	it("id 改为 $id, 布尔 exclusive 边界改为数值, 输入不被修改", () => {
		const input = deepFreeze({
			$schema: D4,
			id: "http://x.test/a.json",
			type: "object",
			properties: {
				id: {
					type: "integer",
					minimum: 0,
					exclusiveMinimum: true,
					maximum: 9,
					exclusiveMaximum: false,
				},
				lone: { exclusiveMaximum: true },
			},
		});
		const result = upgradeSchema(input);
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			$id: "http://x.test/a.json",
			type: "object",
			properties: { id: { type: "integer", exclusiveMinimum: 0, maximum: 9 }, lone: {} },
		});
		expect(pointerOf(find(result.diagnostics, "JOTL3101"))).toBe("/id");
		expect(pointerOf(find(result.diagnostics, "JOTL3102"))).toBe(
			"/properties/id/exclusiveMinimum"
		);
		expect(pointerOf(find(result.diagnostics, "JOTL3103"))).toBe(
			"/properties/id/exclusiveMaximum"
		);
		expect(pointerOf(find(result.diagnostics, "JOTL3104"))).toBe(
			"/properties/lone/exclusiveMaximum"
		);
	});

	it("properties 中名为 id 的属性不当作关键字", () => {
		const result = upgradeSchema({ $schema: D4, properties: { id: { type: "string" } } });
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			properties: { id: { type: "string" } },
		});
	});
});

describe("draft-07 → 2019-09", () => {
	it("definitions 改为 $defs, 并同步改写 $ref 的指针(含转义与百分号编码)", () => {
		const result = upgradeSchema({
			$schema: D7,
			properties: {
				a: { $ref: "#/definitions/a~1b" },
				b: { $ref: "#/definitions/q%22uote" },
				c: { $ref: "#/definitions/list/items" },
			},
			definitions: {
				"a/b": { type: "string" },
				'q"uote': { type: "number" },
				list: { items: { type: "integer" } },
			},
		});
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			properties: {
				a: { $ref: "#/$defs/a~1b" },
				b: { $ref: "#/$defs/q%22uote" },
				c: { $ref: "#/$defs/list/items" },
			},
			$defs: {
				"a/b": { type: "string" },
				'q"uote': { type: "number" },
				list: { items: { type: "integer" } },
			},
		});
		expect(codes(result.diagnostics).filter(c => c === "JOTL3120")).toHaveLength(3);
	});

	it("dependencies 拆分为 dependentRequired 与 dependentSchemas", () => {
		const result = upgradeSchema({
			$schema: D7,
			dependencies: { a: ["b"], c: { required: ["d"] }, e: false },
		});
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			dependentRequired: { a: ["b"] },
			dependentSchemas: { c: { required: ["d"] }, e: false },
		});
	});

	it("片段形式的 $id 改为 $anchor", () => {
		const result = upgradeSchema({
			$schema: D6,
			$id: "http://x.test/root.json#",
			definitions: {
				a: { $id: "#foo", type: "integer" },
				b: { $id: "other.json#bar", type: "string" },
			},
		});
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			$id: "http://x.test/root.json",
			$defs: {
				a: { $anchor: "foo", type: "integer" },
				b: { $id: "other.json", $anchor: "bar", type: "string" },
			},
		});
		expect(codes(result.diagnostics)).toEqual(
			expect.arrayContaining(["JOTL3109", "JOTL3110", "JOTL3111"])
		);
	});

	it("嵌入资源内的指针按资源根换算", () => {
		const result = upgradeSchema({
			$schema: D7,
			$id: "http://x.test/root.json",
			definitions: { inner: { $id: "inner.json", definitions: { n: { type: "number" } } } },
			properties: { n: { $ref: "inner.json#/definitions/n" } },
		});
		expect(result.value?.schema).toMatchObject({
			properties: { n: { $ref: "inner.json#/$defs/n" } },
			$defs: { inner: { $id: "inner.json", $defs: { n: { type: "number" } } } },
		});
	});
});

describe("2019-09 → 2020-12", () => {
	it("数组形式的 items 改为 prefixItems, additionalItems 改为 items, 指向元组成员的 $ref 同步改写", () => {
		const result = upgradeSchema({
			$schema: D2019,
			$defs: {
				tuple: { items: [{ type: "string" }, { type: "number" }], additionalItems: false },
			},
			properties: { first: { $ref: "#/$defs/tuple/items/0" } },
		});
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			properties: { first: { $ref: "#/$defs/tuple/prefixItems/0" } },
			$defs: {
				tuple: { prefixItems: [{ type: "string" }, { type: "number" }], items: false },
			},
		});
	});

	it("items 不是数组时移除 additionalItems", () => {
		const result = upgradeSchema({
			$schema: D2019,
			items: { type: "string" },
			additionalItems: false,
		});
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			items: { type: "string" },
		});
		expect(codes(result.diagnostics)).toContain("JOTL3114");
	});

	it("$recursiveAnchor / $recursiveRef 改为 $dynamicAnchor / $dynamicRef; 目标无锚点时改为 $ref", () => {
		const result = upgradeSchema({
			$schema: D2019,
			$id: "http://x.test/tree.json",
			$recursiveAnchor: true,
			properties: { children: { items: { $recursiveRef: "#" } } },
			$defs: { plain: { $id: "plain.json", properties: { self: { $recursiveRef: "#" } } } },
		});
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			$id: "http://x.test/tree.json",
			properties: { children: { items: { $dynamicRef: `#${RECURSIVE_ANCHOR_NAME}` } } },
			$dynamicAnchor: RECURSIVE_ANCHOR_NAME,
			$defs: { plain: { $id: "plain.json", properties: { self: { $ref: "#" } } } },
		});
		expect(codes(result.diagnostics)).toEqual(
			expect.arrayContaining(["JOTL3115", "JOTL3117", "JOTL3118"])
		);
	});
});

describe("跨级与输出约束", () => {
	it("draft-04 一路升级到 2020-12, 输出满足关键字顺序规范", () => {
		const result = upgradeSchema({
			definitions: {
				pair: {
					type: "array",
					items: [{ $ref: "#/definitions/name" }, { type: "integer" }],
					additionalItems: false,
				},
			},
			$schema: D4,
			properties: { pair: { $ref: "#/definitions/pair" } },
			type: "object",
		});
		const schema = result.value?.schema;
		expect(schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			type: "object",
			properties: { pair: { $ref: "#/$defs/pair" } },
			$defs: {
				pair: {
					type: "array",
					prefixItems: [{ $ref: "#/$defs/name" }, { type: "integer" }],
					items: false,
				},
			},
		});
		expect(JSON.stringify(schema)).toBe(JSON.stringify(orderKeywords(schema!)));
		expect(Object.keys(schema as object)[0]).toBe("$schema");
	});

	it("嵌套的 $schema 按子树自己的版本升级", () => {
		const result = upgradeSchema({
			$schema: D2019,
			$defs: {
				legacy: {
					$schema: D4,
					id: "legacy.json",
					definitions: { x: { type: "string" } },
					items: { $ref: "#/definitions/x" },
				},
			},
		});
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			$defs: {
				legacy: {
					$schema: JSON_SCHEMA_DIALECT,
					$id: "legacy.json",
					items: { $ref: "#/$defs/x" },
					$defs: { x: { type: "string" } },
				},
			},
		});
	});

	it("2020-12 输入原样读取, 只调整关键字顺序", () => {
		const input = deepFreeze({
			type: "string",
			$schema: JSON_SCHEMA_DIALECT,
			"x-ui": { widget: "text" },
			minLength: 1,
		});
		const result = upgradeSchema(input);
		expect(result.diagnostics).toEqual([]);
		expect(JSON.stringify(result.value?.schema)).toBe(
			JSON.stringify({
				$schema: JSON_SCHEMA_DIALECT,
				type: "string",
				minLength: 1,
				"x-ui": { widget: "text" },
			})
		);
	});

	it("未知关键字原样透传且与输入不共享对象", () => {
		const input = {
			$schema: D7,
			"x-ui": { widget: "card", props: { a: [1] } },
			enum: [{ a: 1 }],
		};
		const result = upgradeSchema(input);
		const schema = result.value?.schema as Record<string, unknown>;
		expect(schema["x-ui"]).toEqual(input["x-ui"]);
		expect(schema["x-ui"]).not.toBe(input["x-ui"]);
		expect(schema.enum).not.toBe(input.enum);
	});

	it("v1 方言改写为 2020-12 的 $schema, 内容原样读取", () => {
		const result = upgradeSchema({
			$schema: "https://json-schema.org/v1",
			type: "string",
			minLength: 1,
		});
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			type: "string",
			minLength: 1,
		});
		expect(codes(result.diagnostics)).toEqual(["JOTL3119"]);
	});

	it("只被 $ref 指向的未知关键字下的子 schema 按 schema 升级", () => {
		const input = deepFreeze({
			$schema: D4,
			properties: { a: { $ref: "#/x-lib/num" }, b: { $ref: "#/definitions/c/x-inner" } },
			"x-lib": {
				num: {
					type: "number",
					minimum: 0,
					exclusiveMinimum: true,
					items: [{ $ref: "#/definitions/c" }],
				},
			},
			definitions: { c: { "x-inner": { id: "#inner", type: "string" } } },
			"x-other": { keep: { minimum: 0, exclusiveMinimum: true } },
		});
		const result = upgradeSchema(input);
		const schema = result.value?.schema as Record<string, unknown>;
		expect(schema["x-lib"]).toEqual({
			num: { type: "number", exclusiveMinimum: 0, prefixItems: [{ $ref: "#/$defs/c" }] },
		});
		expect(schema.properties).toEqual({
			a: { $ref: "#/x-lib/num" },
			b: { $ref: "#/$defs/c/x-inner" },
		});
		expect(schema.$defs).toEqual({ c: { "x-inner": { $anchor: "inner", type: "string" } } });
		expect(schema["x-other"]).toEqual(input["x-other"]);
		expect(pointerOf(find(result.diagnostics, "JOTL3102"))).toBe("/x-lib/num/exclusiveMinimum");
		expect(pointerOf(find(result.diagnostics, "JOTL3112"))).toBe("/x-lib/num/items");
	});

	it("$ref 指向 default/examples/const/enum 等数据位置时不按 schema 升级", () => {
		const data = { minimum: 0, exclusiveMinimum: true, id: "#d" };
		const input = deepFreeze({
			$schema: D4,
			default: { a: data },
			examples: [data],
			"x-lib": { const: data, enum: [data] },
			properties: {
				a: { $ref: "#/default/a" },
				b: { $ref: "#/examples/0" },
				c: { $ref: "#/x-lib/const" },
				d: { $ref: "#/x-lib/enum/0" },
			},
		});
		const result = upgradeSchema(input);
		const schema = result.value?.schema as Record<string, unknown>;
		expect(schema.default).toEqual({ a: data });
		expect(schema.examples).toEqual([data]);
		expect(schema["x-lib"]).toEqual({ const: data, enum: [data] });
		expect(codes(result.diagnostics)).not.toContain("JOTL3102");
	});

	it("布尔 schema 根保持布尔值", () => {
		expect(upgradeSchema(true, { version: "draft-07" }).value?.schema).toBe(true);
	});

	it("嵌套 $schema 为 draft-03 时报错", () => {
		const result = upgradeSchema({
			$schema: D7,
			properties: { a: { $schema: "http://json-schema.org/draft-03/schema#" } },
		});
		expect(result.value).toBeUndefined();
		expect(pointerOf(find(result.diagnostics, "JOTL3002"))).toBe("/properties/a/$schema");
	});
});
