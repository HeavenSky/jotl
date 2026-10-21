// 中英双语: 诊断代码表与参数文案表都有英文且占位符一致; 切到英文后编译诊断, 修复标题与配置问题输出英文.
import { afterEach, describe, expect, it } from "vitest";
import {
	DEFAULT_LOCALE,
	SCHEMA_DIAGNOSTICS,
	getLocale,
	resolveLocale,
	setLocale,
	type DiagnosticTable,
} from "../../src/schema/index.js";
import {
	SYNTAX_DIAGNOSTICS,
	SYNTAX_EXPECTED,
	SYNTAX_EXPECTED_EN,
	SYNTAX_FIX_TITLES,
	SYNTAX_FIX_TITLES_EN,
	SYNTAX_REASONS,
	SYNTAX_REASONS_EN,
} from "../../src/syntax/diagnostics.js";
import {
	compile,
	createJotlConfigJsonSchema,
	print,
	readJotlConfig,
} from "../../src/syntax/index.js";
import { FILE } from "./helpers.js";

function placeholders(template: string): string[] {
	return [...template.matchAll(/\{(\w+)\}/g)].map(m => m[1]!).sort();
}

const HAN = /[一-鿿]/;

afterEach(() => setLocale("zh-CN"));

describe("诊断代码表", () => {
	const tables: [string, DiagnosticTable][] = [
		["SCHEMA_DIAGNOSTICS", SCHEMA_DIAGNOSTICS],
		["SYNTAX_DIAGNOSTICS", SYNTAX_DIAGNOSTICS],
	];
	it.each(tables)("%s 每项有英文模板, 占位符与中文一致, 英文不含汉字", (_name, table) => {
		for (const [code, def] of Object.entries(table)) {
			expect(def.en, code).toBeTypeOf("string");
			expect(placeholders(def.en!), code).toEqual(placeholders(def.message));
			expect(HAN.test(def.en!), code).toBe(false);
		}
	});

	it.each([
		["SYNTAX_REASONS", SYNTAX_REASONS, SYNTAX_REASONS_EN],
		["SYNTAX_EXPECTED", SYNTAX_EXPECTED, SYNTAX_EXPECTED_EN],
		["SYNTAX_FIX_TITLES", SYNTAX_FIX_TITLES, SYNTAX_FIX_TITLES_EN],
	] as [string, Record<string, string>, Record<string, string>][])(
		"%s 的英文表键相同, 占位符一致",
		(_name, zh, en) => {
			expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
			for (const [key, text] of Object.entries(zh)) {
				expect(placeholders(en[key]!), key).toEqual(placeholders(text));
				expect(HAN.test(en[key]!), key).toBe(false);
			}
		}
	);
});

describe("英文环境", () => {
	it("库默认语言为 en; 测试初始化设为 zh-CN 后诊断为中文", () => {
		expect(DEFAULT_LOCALE).toBe("en");
		expect(resolveLocale(undefined)).toBe("en");
		expect(getLocale()).toBe("zh-CN");
		expect(compile("A: { a: Nope }", FILE).diagnostics[0]!.message).toBe(
			"`Nope` 既不是本文件声明的类型, 也不是已登记的扩展组件"
		);
	});

	it("编译诊断, 参数文案与修复标题为英文", () => {
		setLocale("en");
		const messages = (text: string) => compile(text, FILE).diagnostics.map(d => d.message);
		expect(messages("A: { a: Nope }")).toEqual([
			"`Nope` is neither a type declared in this file nor a registered extension component",
		]);
		expect(messages("A: { a: string[minLength: -1] }")).toEqual([
			"Invalid metadata value: `minLength` must be a non-negative integer",
		]);
		expect(messages("A: { a: string[root_if: {left: 'x', op: 'gt'}] }")).toEqual([
			"Invalid x-ui: invalid condition: `gt` needs `right`",
		]);
		expect(messages("A: { a: number[default: 'x'] }")).toEqual([
			"Default value violates constraints: type must be number",
		]);
		expect(messages("A: {\n  a: union[union_item: 'any | string']\n}")).toEqual([
			"Union distinguished by JSON type has multiple any-type branches; use a discriminated union `union[discriminator: ...]` instead",
		]);
		expect(messages("A: {\n  a: string[x:]\n}")).toEqual(["Expected a value here, found `]`"]);
		expect(messages("A: { a: [")).toEqual([
			"Missing closing bracket `}`",
			"Missing closing bracket `]`",
		]);
		const wrap = compile("a: string", FILE).diagnostics[0]!;
		expect(wrap.fixes![0]!.title).toBe("Wrap in `Root: {...}` and mark `<root/>`");
		expect(wrap.fixes![0]!.edits[0]!.newText).toBe("<root/>\nRoot: {\n");
	});

	it("打印诊断, 配置问题与配置 schema 的说明为英文", () => {
		setLocale("en");
		expect(print([] as never).diagnostics[0]!.message).toBe(
			"Input to print is not a JSON Schema: expected an object or a boolean"
		);
		expect(
			readJotlConfig({ widgets: { A: "enum" }, extra: 1 }).issues.map(i => i.message)
		).toEqual([
			"Unknown configuration key `extra`",
			"base type `enum` of `A` is not a JSON Schema primitive type name or a body-less Jotl built-in component name",
		]);
		expect(HAN.test(JSON.stringify(createJotlConfigJsonSchema()))).toBe(false);
	});
});
