// migrate: 删除字段, 类型变化, 枚举收窄各一例, 以及保留能保留的值与返回改动指针.
import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@jotl/core";
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
