// migrate: 删除字段, 类型变化, 枚举收窄各一例, 以及保留能保留的值与返回改动指针.
import { describe, expect, it } from "vitest";
import type { JsonSchema, JsonSchemaObject } from "@jotl/core";
import { migrate, validate } from "../src/index.js";

const v2: JsonSchema = {
	$ref: "#/$defs/Home",
	$defs: {
		Home: {
			type: "object",
			properties: {
				title: { type: "string" },
				count: { type: "integer" },
				mode: {
					type: "string",
					oneOf: [{ const: "light" }, { const: "dark" }],
					default: "light",
				},
				size: { type: "string", enum: ["s", "m"] },
				tags: { type: "array", items: { type: "string" } },
				banner: { $ref: "#/$defs/Banner" },
				labels: { type: "object", additionalProperties: { type: "string" } },
				theme: { type: "string", default: "#1677ff" },
			},
			required: ["title", "count", "mode"],
		},
		Banner: { type: "object", properties: { img: { type: "string" } }, required: ["img"] },
	},
};

describe("migrate", () => {
	it("删除字段: 新 schema 已移除的字段被删掉, 其余值保留", () => {
		const result = migrate(v2, {
			title: "t",
			count: 1,
			mode: "dark",
			subtitle: "旧字段",
			banner: { img: "a", alt: "旧" },
			theme: "#000",
		});
		expect(result.value).toEqual({
			data: { title: "t", count: 1, mode: "dark", banner: { img: "a" }, theme: "#000" },
			changed: ["/subtitle", "/banner/alt"],
		});
	});

	it("类型变化: 能转换的值转换后保留, 不能转换的删除或取零值", () => {
		const result = migrate(v2, {
			title: 12,
			count: "3",
			mode: "light",
			tags: "单个",
			size: 1,
			theme: "#000",
		});
		expect(result.value).toEqual({
			data: { title: "12", count: 3, mode: "light", tags: ["单个"], theme: "#000" },
			changed: ["/title", "/count", "/tags", "/size"],
		});
	});

	it("类型变化: 必填字段无法转换时取零值", () => {
		const result = migrate(v2, { title: "t", count: { n: 1 }, mode: "light", theme: "#000" });
		expect(result.value).toEqual({
			data: { title: "t", count: 0, mode: "light", theme: "#000" },
			changed: ["/count"],
		});
	});

	it("枚举收窄: 不在可选值中的值有默认值时取默认值, 可选字段无默认值时删除", () => {
		const result = migrate(v2, {
			title: "t",
			count: 1,
			mode: "auto",
			size: "l",
			theme: "#000",
		});
		expect(result.value).toEqual({
			data: { title: "t", count: 1, mode: "light", theme: "#000" },
			changed: ["/mode", "/size"],
		});
	});

	it("补上带默认值的新字段", () => {
		const result = migrate(v2, { title: "t", count: 1, mode: "dark" });
		expect(result.value).toEqual({
			data: { title: "t", count: 1, mode: "dark", theme: "#1677ff" },
			changed: ["/theme"],
		});
	});

	it("映射的值逐项迁移, 无法保留的项删除", () => {
		const result = migrate(v2, {
			title: "t",
			count: 1,
			mode: "dark",
			theme: "#000",
			labels: { a: 1, b: { x: 1 } },
		});
		expect(result.value).toEqual({
			data: { title: "t", count: 1, mode: "dark", theme: "#000", labels: { a: "1" } },
			changed: ["/labels/a", "/labels/b"],
		});
	});

	it("数组元素无法保留时删除该元素", () => {
		const result = migrate(v2, {
			title: "t",
			count: 1,
			mode: "dark",
			theme: "#000",
			tags: ["a", { x: 1 }, 2],
		});
		expect(result.value).toEqual({
			data: { title: "t", count: 1, mode: "dark", theme: "#000", tags: ["a", "2"] },
			changed: ["/tags/1", "/tags/2"],
		});
	});

	it("uniqueItems: 迁移后深度相等的元素只保留第一个; 有 prefixItems 或 contains 时不去重", () => {
		const unique: JsonSchema = { type: "array", items: { type: "string" }, uniqueItems: true };
		expect(migrate(unique, ["a", 1, "1", "a"]).value).toEqual({
			data: ["a", "1"],
			changed: ["/1", "/2", "/3"],
		});
		const objects: JsonSchema = {
			type: "array",
			items: { type: "object", properties: { n: { type: "number" } } },
			uniqueItems: true,
		};
		expect(migrate(objects, [{ n: 1 }, { n: 1.0 }, { n: 2 }]).value).toEqual({
			data: [{ n: 1 }, { n: 2 }],
			changed: ["/1"],
		});
		// 去重后低于 minItems 不补, 交给 validate 报告.
		const min: JsonSchema = { ...unique, minItems: 2 };
		const migrated = (migrate(min, ["a", "a"]).value as { data: unknown }).data;
		expect(migrated).toEqual(["a"]);
		expect(validate(min, migrated).value).toEqual({ valid: false });
		const extras: JsonSchemaObject[] = [
			{ prefixItems: [{ type: "string" }] },
			{ contains: { const: "a" } },
		];
		for (const extra of extras) {
			expect(migrate({ ...unique, ...extra }, ["a", "a"]).value).toEqual({
				data: ["a", "a"],
				changed: [],
			});
		}
	});

	it("已经符合的数据不改动, 结果通过校验", () => {
		const data = { title: "t", count: 1, mode: "dark", theme: "#000", banner: { img: "a" } };
		const result = migrate(v2, data);
		expect(result.value).toEqual({ data, changed: [] });
		expect(validate(v2, data).value).toEqual({ valid: true });
	});

	it("不修改传入的数据", () => {
		const data = { title: 1, count: 1, mode: "x" };
		migrate(v2, data);
		expect(data).toEqual({ title: 1, count: 1, mode: "x" });
	});

	it("迁移后的数据通过校验", () => {
		const result = migrate(v2, {
			title: 12,
			count: "3.7",
			mode: "auto",
			size: "l",
			tags: [1, null],
			extra: true,
		});
		const migrated = (result.value as { data: unknown }).data;
		expect(validate(v2, migrated).value).toEqual({ valid: true });
	});
});

describe("migrate 联合分支", () => {
	const choice: JsonSchema = {
		$defs: {
			Choice: {
				type: "object",
				oneOf: [
					{
						type: "object",
						properties: { kind: { const: "a" }, a: { type: "string" } },
						required: ["kind"],
					},
					{
						type: "object",
						properties: { kind: { const: "b" }, b: { type: "string" } },
						required: ["kind"],
					},
				],
			},
		},
		$ref: "#/$defs/Choice",
	};

	it("discriminator 字段的值决定分支, 相同 schema 下不改动数据", () => {
		const result = migrate(choice, { kind: "b" });
		expect(result.value).toEqual({ data: { kind: "b" }, changed: [] });
		expect(validate(choice, { kind: "b" }).value).toEqual({ valid: true });
	});

	it("联合节点同级的公共字段参与迁移, 不被删除", () => {
		const withCommon: JsonSchema = {
			...choice,
			$defs: {
				...choice.$defs,
				Choice: {
					...((choice.$defs as Record<string, JsonSchemaObject>)
						.Choice as JsonSchemaObject),
					properties: { common: { type: "string" } },
				},
			},
		};
		const data = { common: "keep", kind: "a", a: "x" };
		expect(validate(withCommon, data).value).toEqual({ valid: true });
		const result = migrate(withCommon, data);
		expect(result.value).toEqual({ data, changed: [] });
	});

	it("anyOf 分支同样保留公共字段, 公共字段缺失时补默认值", () => {
		const anyOf: JsonSchema = {
			type: "object",
			properties: {
				common: { type: "string", default: "c0" },
				payload: {
					anyOf: [
						{
							type: "object",
							properties: { kind: { const: "x" }, x: { type: "number" } },
						},
						{
							type: "object",
							properties: { kind: { const: "y" }, y: { type: "string" } },
						},
					],
				},
			},
			required: ["payload"],
		};
		const result = migrate(anyOf, { payload: { kind: "y", y: "s" } });
		expect(result.value).toEqual({
			data: { common: "c0", payload: { kind: "y", y: "s" } },
			changed: ["/common"],
		});
	});
});

describe("migrate 组合与不可满足 schema", () => {
	it("同一字段受多个 allOf 子 schema 约束时组合处理, 枚举外的值被默认值替换", () => {
		const schema: JsonSchema = {
			type: "object",
			allOf: [
				{ properties: { x: { type: "string" } } },
				{ properties: { x: { enum: ["ok"], default: "ok" } } },
			],
		};
		const result = migrate(schema, { x: "bad" });
		expect(result.value).toEqual({ data: { x: "ok" }, changed: ["/x"] });
	});

	it("经 $ref 或 allOf 引入的 false schema 同样删除可选字段", () => {
		const byRef: JsonSchema = {
			type: "object",
			$defs: { Never: false },
			properties: { x: { $ref: "#/$defs/Never" } },
		};
		expect(migrate(byRef, { x: "bad" }).value).toEqual({ data: {}, changed: ["/x"] });
		const byAllOf: JsonSchema = {
			type: "object",
			properties: { x: { allOf: [{ $ref: "#/$defs/Never" }] } },
			$defs: { Never: false },
		};
		expect(migrate(byAllOf, { x: "bad" }).value).toEqual({ data: {}, changed: ["/x"] });
		const inline: JsonSchema = {
			type: "object",
			$defs: { Never: false },
			properties: { x: false },
		};
		expect(migrate(inline, { x: "bad" }).value).toEqual({ data: {}, changed: ["/x"] });
	});
});
