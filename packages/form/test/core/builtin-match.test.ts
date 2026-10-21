import { describe, expect, it } from "vitest";
import type { JsonSchemaObject } from "@jotl/core";
import {
	BUILTIN_WIDGETS,
	builtinAccepts,
	decimalKind,
	matchBuiltinWidget,
	plan,
} from "../../src/core/index.js";
import { builtinRegistry, dataRoot, findNode, planOk } from "./helpers.js";

const options = (n: number) => Array.from({ length: n }, (_, i) => ({ const: `o${i}` }));

const money: JsonSchemaObject = {
	type: "object",
	properties: {
		type: { const: "money" },
		value: { type: "string", pattern: "^-?\\d+\\.\\d{2}$" },
		currency: { const: "CNY" },
	},
	required: ["type", "value", "currency"],
	additionalProperties: false,
};
const bigint: JsonSchemaObject = {
	type: "object",
	properties: { type: { const: "bigint" }, value: { type: "string", pattern: "^-?\\d+$" } },
	required: ["type", "value"],
	additionalProperties: false,
};

// 契约 C2 "作为默认的形态" 列中各数据形态的代表 schema(无 x-ui 时的内置结果), 以及 x-ui.widget 选中的非默认组件.
const SHAPES: Record<string, JsonSchemaObject> = {
	input: { type: "string" },
	textarea: { type: "string", "x-ui": { widget: "textarea" } },
	password: { type: "string", "x-ui": { widget: "password" } },
	url: { type: "string", format: "uri" },
	email: { type: "string", format: "email" },
	date: { type: "string", format: "date" },
	time: { type: "string", format: "time" },
	datetime: { type: "string", format: "date-time" },
	color: { type: "string", format: "color" },
	image: { type: "string", format: "uri", "x-ui": { widget: "image" } },
	file: { type: "string", format: "uri", "x-ui": { widget: "file" } },
	richtext: { type: "string", contentMediaType: "text/html" },
	jsontext: { type: "string", contentMediaType: "application/json" },
	number: { type: "number" },
	integer: { type: "integer" },
	range: { type: "integer", minimum: 0, maximum: 10, "x-ui": { widget: "range" } },
	money,
	bigint,
	switch: { type: "boolean" },
	checkbox: { type: "boolean", "x-ui": { widget: "checkbox" } },
	select: { type: "string", oneOf: options(2) },
	selectEnum: { type: "integer", enum: [1, 2, 3, 4, 5, 6] },
	radio: { type: "string", enum: ["a", "b"], "x-ui": { widget: "radio" } },
	enumArray: { type: "array", items: { type: "string", enum: ["a", "b"] }, uniqueItems: true },
	enumArrayRef: { type: "array", items: { $ref: "#/$defs/Color" } },
	enumArrayCheckbox: {
		type: "array",
		items: { $ref: "#/$defs/Color" },
		"x-ui": { widget: "checkbox" },
	},
	output: { type: "string", const: "fixed" },
	singleEnum: { enum: ["only"] },
	nullConst: { type: "null" },
	list: { type: "array", items: { type: "string" } },
	nullableType: { type: ["string", "null"] },
	nullableAnyOf: { anyOf: [{ $ref: "#/$defs/Link" }, { type: "null" }] },
	unionAnyOf: { anyOf: [{ type: "string" }, { type: "number" }] },
	unionOneOf: { oneOf: [{ $ref: "#/$defs/Link" }, { type: "string" }] },
	unionTypes: { type: ["string", "number"] },
	kv: { type: "object", additionalProperties: { type: "number" } },
	page: { type: "object", properties: { a: { type: "string" } } },
	inline: { type: "object", properties: { a: { type: "string" } }, "x-ui": { widget: "inline" } },
	tuple: { type: "array", prefixItems: [{ type: "string" }, { type: "number" }], items: false },
	json: {},
	jsonNoType: { minLength: 1 },
};

const EXPECTED: Record<string, string> = {
	jsontext: "json",
	integer: "number",
	selectEnum: "select",
	enumArray: "select",
	enumArrayRef: "select",
	enumArrayCheckbox: "checkbox",
	singleEnum: "output",
	nullConst: "output",
	nullableType: "nullable",
	nullableAnyOf: "nullable",
	unionAnyOf: "union",
	unionOneOf: "union",
	unionTypes: "union",
	jsonNoType: "json",
};

const document: JsonSchemaObject = {
	type: "object",
	properties: SHAPES,
	$defs: {
		Color: { type: "string", enum: ["red", "green"] },
		Link: { type: "object", properties: { href: { type: "string" } } },
		Tree: {
			type: "object",
			properties: { children: { type: "array", items: { $ref: "#/$defs/Tree" } } },
		},
	},
};

describe("内置匹配规则", () => {
	const root = planOk({ ...document, properties: { ...SHAPES, tree: { $ref: "#/$defs/Tree" } } });
	const data = dataRoot(root);

	it("根为 form, 数据根为 page, 外壳默认 field", () => {
		expect(root).toMatchObject({
			widget: "form",
			level: "view",
			source: "builtin",
			decorator: false,
		});
		expect(data).toMatchObject({
			widget: "page",
			level: "layout",
			source: "builtin",
			decorator: false,
		});
		expect(findNode(root, "/input").decorator).toBe("field");
	});

	for (const key of Object.keys(SHAPES)) {
		const expected = EXPECTED[key] ?? key;
		it(`${key} → ${expected}`, () => {
			const node = findNode(root, `/${key}`);
			expect(node.widget).toBe(expected);
			expect(node.level).toBe(
				BUILTIN_WIDGETS[expected as keyof typeof BUILTIN_WIDGETS].level
			);
			expect(node.degraded).toEqual([]);
			const viaXUi = SHAPES[key]!["x-ui"]?.widget !== undefined;
			expect(node.source).toBe(
				viaXUi ? "node" : expected === "json" ? "fallback" : "builtin"
			);
		});
	}

	it("递归引用 → tree", () => {
		const tree = findNode(root, "/tree/children/*");
		expect(tree).toMatchObject({ widget: "tree", level: "composite", source: "builtin" });
	});

	it("名表中每个名字都被至少一种形态命中", () => {
		const hit = new Set<string>();
		const visit = (n: typeof root): void => {
			hit.add(n.widget);
			if (n.decorator !== false) hit.add(n.decorator);
			n.children.forEach(visit);
		};
		visit(root);
		expect(Object.keys(BUILTIN_WIDGETS).filter(name => !hit.has(name))).toEqual([]);
	});

	it("matchBuiltinWidget 与 plan 的内置结果一致", () => {
		for (const [key, schema] of Object.entries(SHAPES)) {
			if (schema["x-ui"] !== undefined) continue;
			expect(matchBuiltinWidget(schema, { ...document, ...schema })).toBe(
				EXPECTED[key] ?? key
			);
		}
		expect(matchBuiltinWidget(true)).toBe("json");
		expect(matchBuiltinWidget({ type: "string", format: "unknown" })).toBe("input");
	});

	it("thousands: money 缺省开, number bigint 缺省关, x-ui 可覆盖; 非数值节点不带", () => {
		expect(findNode(root, "/money").thousands).toBe(true);
		expect(findNode(root, "/bigint").thousands).toBe(false);
		expect(findNode(root, "/number").thousands).toBe(false);
		expect(findNode(root, "/input").thousands).toBeUndefined();
		const custom = planOk({
			type: "object",
			properties: {
				n: { type: "number", "x-ui": { thousands: true } },
				m: { ...money, "x-ui": { thousands: false } },
			},
		});
		expect(findNode(custom, "/n").thousands).toBe(true);
		expect(findNode(custom, "/m").thousands).toBe(false);
	});

	it("summary 带到对象, 数组与 map 节点", () => {
		const schema: JsonSchemaObject = {
			type: "object",
			"x-ui": { summary: "name" },
			properties: {
				list: {
					type: "array",
					items: { type: "object", properties: { name: { type: "string" } } },
					"x-ui": { summary: "name" },
				},
				dict: {
					type: "object",
					additionalProperties: { type: "object" },
					"x-ui": { summary: "title" },
				},
				text: { type: "string", "x-ui": { summary: "x" } },
			},
		};
		const planned = planOk(schema);
		expect(dataRoot(planned).summary).toBe("name");
		expect(findNode(planned, "/list").summary).toBe("name");
		expect(findNode(planned, "/dict").summary).toBe("title");
		expect(findNode(planned, "/text").summary).toBeUndefined();
	});
});

describe("非法 widget 按 F2 降级到该形态的默认组件", () => {
	const CASES: [string, JsonSchemaObject, string][] = [
		[
			"多选枚举 + radio → select",
			{
				type: "array",
				items: { enum: ["a", "b"] },
				uniqueItems: true,
				"x-ui": { widget: "radio" },
			},
			"select",
		],
		["boolean + select → switch", { type: "boolean", "x-ui": { widget: "select" } }, "switch"],
		["string + number → input", { type: "string", "x-ui": { widget: "number" } }, "input"],
		[
			"number 无范围 + range → number",
			{ type: "number", "x-ui": { widget: "range" } },
			"number",
		],
		[
			"object + list → page",
			{ type: "object", properties: { a: { type: "string" } }, "x-ui": { widget: "list" } },
			"page",
		],
		[
			"array + page → list",
			{ type: "array", items: { type: "string" }, "x-ui": { widget: "page" } },
			"list",
		],
		[
			"string 无 format + image → input",
			{ type: "string", "x-ui": { widget: "image" } },
			"input",
		],
		["money + input → money", { ...money, "x-ui": { widget: "input" } }, "money"],
		[
			"map + inline → kv",
			{
				type: "object",
				additionalProperties: { type: "string" },
				"x-ui": { widget: "inline" },
			},
			"kv",
		],
	];
	for (const [title, schema, expected] of CASES) {
		it(title, () => {
			const result = plan({ type: "object", properties: { a: schema } }, builtinRegistry());
			const node = findNode(result.value!, "/a");
			const from = (schema["x-ui"] as { widget: string }).widget;
			expect(node).toMatchObject({
				widget: expected,
				source: "builtin",
				degraded: [{ reason: "F2", from }],
			});
			expect(result.diagnostics.map(d => d.code)).toEqual(["JOTL5002"]);
		});
	}

	it("json 与 output 接受任意形态", () => {
		const root = planOk({
			type: "object",
			properties: {
				a: { type: "object", properties: {}, "x-ui": { widget: "json" } },
				b: { type: "number", "x-ui": { widget: "output" } },
			},
		});
		expect(findNode(root, "/a").widget).toBe("json");
		expect(findNode(root, "/b").widget).toBe("output");
	});

	it("可空节点上的字段组件名作用于内容节点, 可空节点自身不降级", () => {
		const result = plan(
			{
				type: "object",
				properties: {
					a: {
						type: ["string", "null"],
						"x-ui": { widget: "textarea", thousands: true },
					},
				},
			},
			builtinRegistry()
		);
		const node = findNode(result.value!, "/a");
		expect(node).toMatchObject({ widget: "nullable", degraded: [] });
		expect(node.children[0]).toMatchObject({
			widget: "textarea",
			source: "node",
			degraded: [],
		});
		expect(result.diagnostics).toEqual([]);
	});

	it("builtinAccepts 只按 schema 判断, 非内置名为 undefined", () => {
		expect(
			builtinAccepts(
				"checkbox",
				{ type: "array", items: { $ref: "#/$defs/Color" } },
				{ ...document, type: "array", items: { $ref: "#/$defs/Color" } }
			)
		).toBe(true);
		expect(builtinAccepts("checkbox", { type: "string" })).toBe(false);
		expect(builtinAccepts("range", { type: "number", minimum: 0, maximum: 1 })).toBe(true);
		expect(builtinAccepts("headline", { type: "string" })).toBeUndefined();
	});

	it("nullable 经 $ref 解析确认其中一支为 null; 两支都不是 null 时不接受", () => {
		const doc: JsonSchemaObject = {
			$defs: { Nothing: { type: "null" }, Name: { type: "string" } },
		};
		const viaRef: JsonSchemaObject = {
			anyOf: [{ $ref: "#/$defs/Name" }, { $ref: "#/$defs/Nothing" }],
		};
		expect(matchBuiltinWidget(viaRef, { ...doc, ...viaRef })).toBe("nullable");
		expect(builtinAccepts("nullable", viaRef, { ...doc, ...viaRef })).toBe(true);
		const twoValues: JsonSchemaObject = {
			oneOf: [{ $ref: "#/$defs/Name" }, { type: "number" }],
		};
		expect(builtinAccepts("nullable", twoValues, { ...doc, ...twoValues })).toBe(false);
		const result = plan(
			{ ...doc, ...twoValues, "x-ui": { widget: "nullable" } },
			builtinRegistry()
		);
		expect(dataRoot(result.value!).degraded).toEqual([{ reason: "F2", from: "nullable" }]);
	});

	it("decimalKind 识别 money 与 bigint 对象", () => {
		expect(decimalKind(money)).toBe("money");
		expect(decimalKind(bigint)).toBe("bigint");
		expect(
			decimalKind({ type: "object", properties: { type: { type: "string" } } })
		).toBeUndefined();
		expect(decimalKind({ type: "string" })).toBeUndefined();
	});
});

describe("x-valueFormat: 日期组件的存储格式", () => {
	it("无 x-ui 时按格式内容推断默认组件; 有标准 format 时按 format", () => {
		expect(matchBuiltinWidget({ type: "string", "x-valueFormat": "YYYYMMDD" })).toBe("date");
		expect(matchBuiltinWidget({ type: "string", "x-valueFormat": "HH:mm" })).toBe("time");
		expect(matchBuiltinWidget({ type: "string", "x-valueFormat": "YYYY-MM-DD HH:mm:ss" })).toBe(
			"datetime"
		);
		expect(matchBuiltinWidget({ type: "string", "x-valueFormat": "[Day] YYYY" })).toBe("date");
		expect(matchBuiltinWidget({ type: "integer", "x-valueFormat": "x" })).toBe("datetime");
		expect(matchBuiltinWidget({ type: "integer", "x-valueFormat": "YYYY" })).toBe("number");
		expect(
			matchBuiltinWidget({ type: "string", format: "date-time", "x-valueFormat": "utc" })
		).toBe("datetime");
	});

	it("date time datetime 接受这些形态; time 不接受时间戳; integer 仍接受 number", () => {
		const stamp: JsonSchemaObject = { type: "integer", "x-valueFormat": "x" };
		const text: JsonSchemaObject = { type: "string", "x-valueFormat": "HH:mm" };
		expect(builtinAccepts("date", stamp)).toBe(true);
		expect(builtinAccepts("datetime", stamp)).toBe(true);
		expect(builtinAccepts("time", stamp)).toBe(false);
		expect(builtinAccepts("number", stamp)).toBe(true);
		for (const name of ["date", "time", "datetime", "input"])
			expect(builtinAccepts(name, text), name).toBe(true);
		expect(builtinAccepts("date", { type: "string" })).toBe(false);
	});

	it("x-ui.widget 选中的日期组件不降级", () => {
		const root = planOk({
			type: "object",
			properties: {
				a: { type: "integer", "x-valueFormat": "x", "x-ui": { widget: "date" } },
			},
		});
		expect(findNode(root, "/a")).toMatchObject({ widget: "date", degraded: [] });
	});
});
