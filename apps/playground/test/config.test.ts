// jotl.config.json 编辑内容的解析: 空白, JSON 错误, 不合法项与登记的组件模块.
import { setLocale } from "@jotl/core";
import { afterEach, describe, expect, it } from "vitest";
import { compileSource } from "../src/compile.js";
import { DEFAULT_CONFIG, readConfig } from "../src/config.js";

afterEach(() => setLocale("zh-CN"));

describe("readConfig", () => {
	it("空白内容视为没有配置", () => {
		expect(readConfig("  \n")).toMatchObject({
			config: { widgets: {}, modules: {} },
			compileOptions: {},
			diagnostics: [],
		});
	});

	it("默认配置登记 Stars 模块, 换算出的编译选项让源码可以使用它", () => {
		const report = readConfig(DEFAULT_CONFIG);
		expect(report.diagnostics).toEqual([]);
		expect(report.config.modules).toEqual({ Stars: { module: "./widgets/rating.js" } });
		const compiled = compileSource("A: { s: Stars }", report.compileOptions);
		expect(compiled.diagnostics).toEqual([]);
		expect(compiled.output?.schema.$defs?.["A"]).toMatchObject({
			properties: { s: { type: "integer", "x-ui": { widget: "Stars" } } },
		});
	});

	it("JSON 不合法时整份忽略并报一条配置错误, 带第一个语法错误的行列, 按当前语言出文案", () => {
		const at = { line: 1, column: 2 };
		expect(readConfig("{").diagnostics).toEqual([
			{
				stage: "config",
				severity: "error",
				message: expect.stringContaining("不是合法的 JSON"),
				start: at,
				end: at,
			},
		]);
		expect(readConfig('{\n  "widgets": {,}\n}').diagnostics[0]?.start).toEqual({
			line: 2,
			column: 15,
		});
		setLocale("en");
		expect(readConfig("{").diagnostics[0]?.message).toContain("is not valid JSON");
	});

	it("不合法的项跳过并逐条报警告, 带 JSON Pointer; 合法项照常生效", () => {
		const report = readConfig('{ "widgets": { "Ok": "string", "bad": 3 }, "extra": 1 }');
		expect(report.config.widgets).toEqual({ Ok: { type: "string" } });
		expect(report.diagnostics.map(d => [d.severity, d.message.split(":")[0]])).toEqual([
			["warning", "/extra"],
			["warning", "/widgets/bad"],
		]);
	});

	it("配置问题定位到对应键名的行列", () => {
		const text = '{\n  "widgets": {\n    "Ok": "string",\n    "bad": 3\n  },\n  "extra": 1\n}';
		expect(readConfig(text).diagnostics.map(d => d.start)).toEqual([
			{ line: 6, column: 3 },
			{ line: 4, column: 5 },
		]);
	});
});
