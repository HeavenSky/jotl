// 选项 at: 对文档内的子 schema 求默认值与校验, 引用仍在整个文档内解析.
import { describe, expect, it } from "vitest";
import type { JsonSchema, JsonSchemaObject } from "@jotl/core";
import { getDefaults, validate } from "../src/index.js";

const schema: JsonSchemaObject = {
	$defs: {
		Name: { type: "string", minLength: 2, default: "无名" },
		Tag: { $anchor: "tag", type: "string", enum: ["a", "b"] },
	},
	type: "object",
	properties: {
		user: {
			type: "object",
			properties: {
				name: { $ref: "#/$defs/Name" },
				tag: { $ref: "#tag" },
				age: { type: "integer", minimum: 0 },
			},
			required: ["name", "tag", "age"],
		},
	},
	required: ["user"],
};

describe("getDefaults 的 at", () => {
	it("指针处的子 schema 按文档解析 #/... 与 $anchor 引用", () => {
		expect(getDefaults(schema, { at: "/properties/user" }).value).toEqual({ name: "无名" });
		expect(getDefaults(schema, { at: "/properties/user", strategy: "required" }).value).toEqual(
			{ name: "无名", tag: "a", age: 0 }
		);
	});

	it("schema 值原样使用, 其中的引用按文档解析", () => {
		const synthesized: JsonSchema = {
			type: "array",
			minItems: 1,
			items: { $ref: "#/$defs/Name" },
		};
		expect(getDefaults(schema, { at: synthesized, strategy: "required" }).value).toEqual([
			"无名",
		]);
	});

	it("指针不存在或不指向 schema 时报 JOTL4018", () => {
		for (const at of ["/properties/none", "/required", "bad"]) {
			const result = getDefaults(schema, { at });
			expect(result.value).toBeUndefined();
			expect(result.diagnostics.map(d => d.code)).toEqual(["JOTL4018"]);
		}
	});
});

describe("validate 的 at", () => {
	const schema: JsonSchemaObject = {
		$defs: {
			Name: { type: "string", minLength: 2 },
			Tag: { type: "string", enum: ["a", "b"] },
		},
		type: "object",
		properties: {
			user: {
				type: "object",
				properties: {
					name: { $ref: "#/$defs/Name" },
					tag: { $ref: "#/$defs/Tag" },
					age: { type: "integer", minimum: 0 },
				},
				required: ["name", "tag", "age"],
			},
		},
	};

	it("数据根落在子 schema 上, 错误指针与标签相对子 schema", () => {
		expect(
			validate(schema, { name: "张三", tag: "a", age: 1 }, { at: "/properties/user" }).value
		).toEqual({ valid: true });
		const result = validate(
			schema,
			{ name: "张", tag: "c", age: 1 },
			{ at: "/properties/user" }
		);
		expect(result.value).toEqual({ valid: false });
		expect(
			result.diagnostics.map(d => [
				d.code,
				d.location?.kind === "pointer" ? d.location.pointer : undefined,
				d.message,
			])
		).toEqual([
			["JOTL4004", "/name", "name 的长度应不少于 2"],
			["JOTL4006", "/tag", "tag 不在可选值中"],
		]);
	});

	it("合成的 schema 值与带 $id 的文档", () => {
		const withId: JsonSchemaObject = { ...schema, $id: "https://example.com/page.json" };
		const synthesized: JsonSchema = {
			type: "array",
			items: { $ref: "https://example.com/page.json#/$defs/Tag" },
		};
		expect(validate(withId, ["a", "b"], { at: synthesized }).value).toEqual({ valid: true });
		expect(validate(withId, ["x"], { at: synthesized }).diagnostics.map(d => d.code)).toEqual([
			"JOTL4006",
		]);
		expect(
			validate(withId, { name: "张三", tag: "b", age: 3 }, { at: "/properties/user" }).value
		).toEqual({ valid: true });
		// 同一文档整体校验不受子 schema 编译影响.
		expect(validate(withId, { user: { name: "张三", tag: "b", age: 3 } }).value).toEqual({
			valid: true,
		});
	});

	it("同一子 schema 换新对象后重新编译, 不复用旧结果", () => {
		expect(validate(schema, "abc", { at: { type: "string", maxLength: 2 } }).value).toEqual({
			valid: false,
		});
		expect(validate(schema, "abc", { at: { type: "string", maxLength: 5 } }).value).toEqual({
			valid: true,
		});
	});

	it("子 schema 自带 $id 时仍可编译", () => {
		const doc: JsonSchemaObject = {
			$defs: { Item: { $id: "item", type: "integer" } },
			type: "array",
			items: { $ref: "item" },
		};
		expect(validate(doc, 1, { at: "/$defs/Item" }).value).toEqual({ valid: true });
		expect(validate(doc, "x", { at: "/$defs/Item" }).value).toEqual({ valid: false });
	});

	it("子 schema 中的 $anchor 引用按文档解析", () => {
		const anchored: JsonSchemaObject = {
			$defs: { Tag: { $anchor: "tag", type: "string", enum: ["a", "b"] } },
			type: "object",
			properties: { user: { type: "object", properties: { tag: { $ref: "#tag" } } } },
		};
		expect(validate(anchored, { tag: "a" }, { at: "/properties/user" }).value).toEqual({
			valid: true,
		});
		expect(
			validate(anchored, { tag: "c" }, { at: "/properties/user" }).diagnostics.map(
				d => d.code
			)
		).toEqual(["JOTL4006"]);
	});

	it("指针无效时报 JOTL4018", () => {
		expect(validate(schema, {}, { at: "/nope" }).diagnostics.map(d => d.code)).toEqual([
			"JOTL4018",
		]);
	});

	it("带 $id 的子资源内, 引用按该资源而非文档根解析", () => {
		const nested: JsonSchemaObject = {
			$id: "https://example.com/root",
			$defs: {
				X: { type: "string" },
				Child: {
					$id: "child",
					$defs: { X: { type: "integer" } },
					type: "object",
					properties: { x: { $ref: "#/$defs/X" } },
				},
			},
		};
		// #/$defs/X 在子资源内指子资源自己的 X(integer), 不是文档根的 string.
		expect(validate(nested, { x: 1 }, { at: "/$defs/Child" }).value).toEqual({ valid: true });
		const result = validate(nested, { x: "s" }, { at: "/$defs/Child" });
		expect(result.value).toEqual({ valid: false });
		expect(result.diagnostics.map(d => d.code)).toEqual(["JOTL4001"]);
		// 目标位于资源后代时同样按所属资源解析.
		expect(validate(nested, 1, { at: "/$defs/Child/properties/x" }).value).toEqual({
			valid: true,
		});
		expect(validate(nested, "s", { at: "/$defs/Child/properties/x" }).value).toEqual({
			valid: false,
		});
		// 与整份文档经 $ref 进入该资源的校验结论一致.
		const whole: JsonSchemaObject = { ...nested, $ref: "child" };
		expect(validate(whole, { x: 1 }).value).toEqual({ valid: true });
		expect(validate(whole, { x: "s" }).value).toEqual({ valid: false });
	});

	it("多层嵌套 $id 资源各按自己的作用域解析", () => {
		const nested: JsonSchemaObject = {
			$defs: {
				Outer: {
					$id: "https://example.com/outer",
					$defs: {
						V: { type: "number" },
						Inner: {
							$id: "inner",
							$defs: { V: { type: "string" } },
							type: "object",
							properties: { v: { $ref: "#/$defs/V" } },
						},
					},
				},
			},
		};
		expect(validate(nested, { v: "s" }, { at: "/$defs/Outer/$defs/Inner" }).value).toEqual({
			valid: true,
		});
		expect(validate(nested, { v: 1 }, { at: "/$defs/Outer/$defs/Inner" }).value).toEqual({
			valid: false,
		});
	});
});
