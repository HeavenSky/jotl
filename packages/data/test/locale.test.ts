// 中英双语: 诊断表与文案片段的英文覆盖与占位符一致, 英文输出, locale 选项只作用于本次调用.
import { afterEach, describe, expect, it } from "vitest";
import { getLocale, setLocale, type JsonSchema } from "@jotl/core";
import {
	DATA_DIAGNOSTICS,
	DATA_TEXT,
	DATA_TEXT_EN,
	dataApi,
	fillDefaults,
	getDefaults,
	migrate,
	mock,
	validate,
} from "../src/index.js";
import { withLocale } from "../src/diagnostics.js";

const placeholders = (text: string): string[] => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

/** 两份结构相同的文案表逐叶比对, 返回不一致的路径. */
function mismatches(zh: unknown, en: unknown, path = ""): string[] {
	if (typeof zh === "string")
		return typeof en === "string" && placeholders(zh).join() === placeholders(en).join()
			? []
			: [path];
	const zhRecord = zh as Record<string, unknown>;
	const enRecord = en as Record<string, unknown>;
	const keys = new Set([...Object.keys(zhRecord), ...Object.keys(enRecord)]);
	return [...keys].flatMap(key => mismatches(zhRecord[key], enRecord[key], `${path}/${key}`));
}

afterEach(() => setLocale("zh-CN"));

describe("诊断表英文覆盖", () => {
	it("每项都有 en, 且占位符集合与中文一致", () => {
		for (const [code, def] of Object.entries(DATA_DIAGNOSTICS) as [
			string,
			{ message: string; en?: string },
		][]) {
			expect(def.en, code).toBeTypeOf("string");
			expect(placeholders(def.en!), code).toEqual(placeholders(def.message));
		}
	});

	it("DATA_TEXT_EN 与 DATA_TEXT 键相同, 占位符一致", () => {
		expect(mismatches(DATA_TEXT, DATA_TEXT_EN)).toEqual([]);
	});
});

describe("英文输出", () => {
	const schema: JsonSchema = {
		type: "object",
		required: ["name"],
		properties: {
			name: { type: "string", title: "Name" },
			age: { type: "integer", minimum: 0 },
			tags: { type: "array", items: { type: "string" } },
		},
	};

	it("默认仍为中文", () => {
		expect(validate(schema, {}).diagnostics[0]?.message).toBe("缺少必填字段 Name");
	});

	it("locale 选项覆盖全局语言, 调用后恢复", () => {
		const messages = validate(schema, { age: -1, tags: [1] }, { locale: "en" }).diagnostics.map(
			d => d.message
		);
		expect(messages).toEqual([
			"Missing required field Name",
			"age is out of range: should be at least 0",
			"item 1 of tags should be of type string",
		]);
		expect(getLocale()).toBe("zh-CN");
		expect(validate(schema, {}).diagnostics[0]?.message).toBe("缺少必填字段 Name");
	});

	it("全局语言为 en 时不传选项也输出英文, 选项可改回中文", () => {
		setLocale("en");
		expect(validate(true, 1, { at: "/nope" }).diagnostics[0]?.message).toBe(
			'Invalid value for option at: "/nope"'
		);
		expect(validate(schema, {}, { locale: "zh-CN" }).diagnostics[0]?.message).toBe(
			"缺少必填字段 Name"
		);
		expect(getLocale()).toBe("en");
	});

	it("联合原因与根标签", () => {
		const union: JsonSchema = { oneOf: [{ type: "string" }, { type: "number" }] };
		expect(validate(union, true, { locale: "en" }).diagnostics[0]?.message).toBe(
			"data should be one of string, number"
		);
	});

	it("getDefaults, fillDefaults, migrate, mock 接受 locale 且不把它当作选项校验", () => {
		expect(getDefaults(schema, { locale: "en" }).diagnostics).toEqual([]);
		expect(
			getDefaults(schema, { locale: "en", strategy: "bad" as never }).diagnostics[0]?.message
		).toBe('Invalid value for option strategy: "bad"');
		expect(
			fillDefaults(schema, {}, { locale: "en", maxDepth: -1 }).diagnostics[0]?.message
		).toBe("Invalid value for option maxDepth: -1");
		const ref: JsonSchema = { $ref: "#/$defs/missing" };
		expect(migrate(ref, 1, { locale: "en" }).diagnostics[0]?.message).toBe(
			"Cannot resolve reference #/$defs/missing; the node is treated as having no value"
		);
		expect(mock(true, { seed: Number.NaN, locale: "en" }).diagnostics[0]?.message).toBe(
			"Invalid value for option seed: NaN"
		);
		expect(getLocale()).toBe("zh-CN");
	});

	it("按 DataApi 类型调用时也能传 locale", () => {
		const ref: JsonSchema = { $ref: "#/$defs/missing" };
		expect(
			dataApi.getDefaults(schema, { locale: "en", strategy: "bad" as never }).diagnostics[0]
				?.message
		).toBe('Invalid value for option strategy: "bad"');
		expect(
			dataApi.fillDefaults(schema, {}, { locale: "en", maxDepth: -1 }).diagnostics[0]?.message
		).toBe("Invalid value for option maxDepth: -1");
		expect(dataApi.validate(schema, {}, { locale: "en" }).diagnostics[0]?.message).toBe(
			"Missing required field Name"
		);
		expect(dataApi.migrate(ref, 1, { locale: "en" }).diagnostics[0]?.message).toBe(
			"Cannot resolve reference #/$defs/missing; the node is treated as having no value"
		);
		expect(dataApi.mock(true, { seed: Number.NaN, locale: "en" }).diagnostics[0]?.message).toBe(
			"Invalid value for option seed: NaN"
		);
		expect(getLocale()).toBe("zh-CN");
	});

	it("withLocale 在抛错时也恢复原语言", () => {
		expect(() =>
			withLocale("en", () => {
				throw new Error("boom");
			})
		).toThrow("boom");
		expect(getLocale()).toBe("zh-CN");
	});
});
