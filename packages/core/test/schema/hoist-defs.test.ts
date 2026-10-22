// 嵌套 $defs 提升: 条目移到根 $defs, 引用改指, 内嵌资源与动态引用不动, 诊断位置可换回原位置.
import { describe, expect, it } from "vitest";
import type { JsonSchemaObject } from "../../src/schema/index.js";
import { embeddedResources, hoistDefs, restorePointer } from "../../src/schema/hoist-defs.js";

describe("hoistDefs", () => {
	it("条目移到根 $defs, 指向条目及其内部的引用改指; 输入不被修改", () => {
		const input: JsonSchemaObject = {
			$defs: { X: { type: "number" } },
			type: "object",
			properties: {
				n: { $ref: "#/$defs/X" },
				a: {
					properties: {
						b: { $ref: "#/properties/a/$defs/X" },
						c: { $ref: "#/properties/a/$defs/X/properties/c" },
					},
					$defs: { X: { type: "object", properties: { c: { type: "string" } } } },
				},
			},
		};
		const snapshot = structuredClone(input);
		const { schema, moved } = hoistDefs(input);
		expect(input).toEqual(snapshot);
		expect(schema).toEqual({
			$defs: {
				X: { type: "number" },
				X2: { type: "object", properties: { c: { type: "string" } } },
			},
			type: "object",
			properties: {
				n: { $ref: "#/$defs/X" },
				a: {
					properties: {
						b: { $ref: "#/$defs/X2" },
						c: { $ref: "#/$defs/X2/properties/c" },
					},
				},
			},
		});
		expect([...moved]).toEqual([["/$defs/X2", "/properties/a/$defs/X"]]);
		expect(restorePointer(moved, "/$defs/X2/properties/c")).toBe(
			"/properties/a/$defs/X/properties/c"
		);
		expect(restorePointer(moved, "/$defs/X")).toBe("/$defs/X");
	});

	it("嵌套中的嵌套逐层提出; 新名字避开根 x-ui.widgets 的键; 引用中未改动的部分保留原写法", () => {
		const { schema, moved } = hoistDefs({
			"x-ui": { version: 1, widgets: { Y: { module: "./y.js" } } },
			properties: {
				y: { $ref: "#/properties/p/$defs/X/$defs/Y" },
				z: { $ref: "#/properties/p/$defs/X/properties/a%20b" },
				p: {
					$defs: { X: { properties: { "a b": {} }, $defs: { Y: { type: "boolean" } } } },
				},
			},
		});
		expect(schema).toEqual({
			"x-ui": { version: 1, widgets: { Y: { module: "./y.js" } } },
			properties: {
				y: { $ref: "#/$defs/Y2" },
				z: { $ref: "#/$defs/X/properties/a%20b" },
				p: {},
			},
			$defs: { X: { properties: { "a b": {} } }, Y2: { type: "boolean" } },
		});
		expect([...moved]).toEqual([
			["/$defs/X", "/properties/p/$defs/X"],
			["/$defs/Y2", "/properties/p/$defs/X/$defs/Y"],
		]);
	});

	it("键中在 URI 片段里需要编码的字符在新名字中换为 _", () => {
		const { schema } = hoistDefs({
			properties: {
				a: { $ref: "#/properties/p/$defs/a%25%20b" },
				p: { $defs: { "a% b": {} } },
			},
		});
		expect(schema).toEqual({
			properties: { a: { $ref: "#/$defs/a__b" }, p: {} },
			$defs: { a__b: {} },
		});
	});

	it("数据位置(const default examples 与未知关键字)中的 $defs 与 $ref 不动", () => {
		const input: JsonSchemaObject = {
			properties: {
				a: {
					const: { $ref: "#/properties/b/$defs/X" },
					default: { $defs: { Q: {} } },
					"x-foo": { $defs: { R: {} } },
				},
				b: { $defs: { X: { type: "string" } } },
			},
		};
		const { schema } = hoistDefs(input);
		expect((schema as JsonSchemaObject).properties!.a).toBe(input.properties!.a);
		expect((schema as JsonSchemaObject).$defs).toEqual({ X: { type: "string" } });
	});

	it("内嵌资源(带 $id 的子 schema)中的 $defs 与引用不动; 内嵌资源可随所在条目整体移动", () => {
		const sub: JsonSchemaObject = {
			$id: "https://example.com/sub",
			properties: { b: { $ref: "#/$defs/X" } },
			$defs: { X: { type: "string" } },
		};
		expect(hoistDefs({ properties: { a: sub } }).moved.size).toBe(0);
		const { schema } = hoistDefs({
			properties: { a: { $ref: "#/properties/p/$defs/S" }, p: { $defs: { S: sub } } },
		});
		expect(schema).toEqual({
			properties: { a: { $ref: "#/$defs/S" }, p: {} },
			$defs: { S: sub },
		});
		expect(embeddedResources(schema)).toEqual(["/$defs/S"]);
		expect(
			embeddedResources({ $id: "https://example.com/root", properties: { a: sub } })
		).toEqual(["/properties/a"]);
	});

	it("动态引用, 根带 $id 时的非片段引用, 根 $defs 不是对象, 共享节点时不提升; 空的嵌套 $defs 不动", () => {
		const nested = { properties: { a: { $defs: { X: {} } } } };
		const blocked: JsonSchemaObject[] = [
			{ ...nested, $dynamicAnchor: "meta" },
			{ ...nested, properties: { ...nested.properties, r: { $dynamicRef: "#meta" } } },
			{ ...nested, $id: "https://example.com/a", allOf: [{ $ref: "other.json" }] },
			{ ...nested, $defs: [] as never },
			{ properties: { a: nested.properties.a, b: nested.properties.a } },
			{ properties: { a: { $defs: {} } } },
		];
		for (const input of blocked) {
			const result = hoistDefs(input);
			expect(result.schema).toBe(input);
			expect(result.moved.size).toBe(0);
		}
		// 根没有 $id 时的非片段引用指向别的文档, 不影响提升.
		expect(hoistDefs({ ...nested, allOf: [{ $ref: "other.json" }] }).moved.size).toBe(1);
	});

	it("极深的输入不耗尽调用栈", () => {
		let node: JsonSchemaObject = { $defs: { X: { type: "string" } } };
		for (let i = 0; i < 20000; i++) node = { not: node };
		const { moved } = hoistDefs({ not: node });
		expect([...moved.keys()]).toEqual(["/$defs/X"]);
	});
});
