// 解析(定稿 §3 §4 §7): 条目的各部分, 标识, 枚举成员, 元数据值, 缺冒号与错误恢复.
import { describe, expect, it } from "vitest";
import { parse } from "../../src/syntax/index.js";
import { FILE, located, parseCodes, parseOk } from "./helpers.js";

describe("条目", () => {
	it("键, 标签, `?`, `:`, 组件, 元数据与体; 各段之间可有任意空白与换行", () => {
		const ast = parseOk(
			"A ( 甲 )\n:\n  object [ closed : true , ]\n  {\n    x ( 叉 ) ? : string\n  }"
		);
		const a = ast.entries[0]!;
		expect(a.key).toMatchObject({ form: "identifier", name: "A" });
		expect(a.label?.text).toBe("甲");
		expect(a.colon).toBeDefined();
		expect(a.component?.name).toBe("object");
		expect(a.meta?.members.map(m => m.key.value)).toEqual(["closed"]);
		const x = a.body!.entries[0]!;
		expect(x).toMatchObject({
			key: { name: "x" },
			label: { text: "叉" },
			component: { name: "string" },
		});
		expect(x.question).toBeDefined();
	});

	it("键的写法: 标识符, 引号字符串, 非负整数, `*`; 分隔符 `,` `;` 与换行都可省", () => {
		const ast = parseOk("A: { a 'x.y'; \"z w\", 0 12 * }");
		expect(ast.entries[0]!.body!.entries.map(e => [e.key.form, e.key.name])).toEqual([
			["identifier", "a"],
			["string", "x.y"],
			["string", "z w"],
			["number", "0"],
			["number", "12"],
			["star", "*"],
		]);
	});

	it("光秃的键没有冒号与内容", () => {
		const x = parseOk("A: { note(备注) other }").entries[0]!.body!.entries[0]!;
		expect(x.colon).toBeUndefined();
		expect(x.component).toBeUndefined();
	});

	it("省略组件: 只有元数据, 只有体, 或元数据加体", () => {
		const [a, b, c] = parseOk("A: { a: [maxLength: 1]  b: {}  c: [closed: true] {} }")
			.entries[0]!.body!.entries;
		expect([a!.component, a!.meta !== undefined, a!.body]).toEqual([
			undefined,
			true,
			undefined,
		]);
		expect([b!.component, b!.meta, b!.body !== undefined]).toEqual([
			undefined,
			undefined,
			true,
		]);
		expect([c!.meta !== undefined, c!.body !== undefined]).toEqual([true, true]);
	});

	it("枚举成员: 标识符, 数字, 布尔, 引号字符串, 可带只含 description 的元数据", () => {
		const members = parseOk("A: enum{ a(甲)[description: '说明'] 1 -2.5 true 'x y' }")
			.entries[0]!.body!.entries;
		expect(members.map(m => m.key.value)).toEqual(["a", 1, -2.5, true, "x y"]);
		expect(members[0]!.meta!.members[0]!.key.value).toBe("description");
	});

	it("元数据值是 JSON5: 未加引号的键, 单引号, 末尾逗号, 嵌套", () => {
		const meta = parseOk("A: string[props: {a: [1, 'b', null, {c: true,},], 'd-e': -1,}]")
			.entries[0]!.meta!;
		const value = meta.members[0]!.value;
		expect(value.kind).toBe("ObjectValue");
	});

	it("标识写在顶层条目之前, 同一条可带两个", () => {
		const ast = parseOk("A: string\n<root/> <default/>\nB: string");
		expect(ast.entries[1]!.markers.map(m => m.name)).toEqual(["root", "default"]);
	});
});

describe("语法错误", () => {
	it("冒号后有内容却省略冒号", () => {
		expect(
			located(parse("A: {\n  a string\n  b [maxLength: 1]\n  c {}\n}", FILE).diagnostics)
		).toEqual([
			{ code: "JOTL1040", line: 2, column: 5 },
			{ code: "JOTL1040", line: 3, column: 5 },
			{ code: "JOTL1040", line: 4, column: 5 },
		]);
	});

	it("不是组件名的同行标识符是下一个光秃的键", () => {
		expect(parseOk("A: { a b c }").entries[0]!.body!.entries.map(e => e.key.name)).toEqual([
			"a",
			"b",
			"c",
		]);
	});

	it("`:` 后缺少内容", () => {
		expect(parseCodes("A: {\n  a:\n}")).toEqual(["JOTL1002"]);
	});

	it("标识写在体内或文件末尾", () => {
		expect(
			located(parse("A: {\n  <root/> a: string\n}\n<default/>", FILE).diagnostics)
		).toEqual([
			{ code: "JOTL1038", line: 2, column: 3 },
			{ code: "JOTL1038", line: 4, column: 1 },
		]);
	});

	it("元数据缺 `,` 或 `:`; 值不合法; 括号未闭合", () => {
		expect(parseCodes("A: string[a: 1 b: 2]")).toEqual(["JOTL1002"]);
		expect(parseCodes("A: string[a 1]")).toEqual(["JOTL1002"]);
		expect(parseCodes("A: string[a: foo]")).toEqual(["JOTL1002"]);
		expect(parseCodes("A: {\n  a: string")).toEqual(["JOTL1003"]);
		expect(parseCodes("A: string[a: [1, 2")).toContain("JOTL1003");
	});

	it("出错后在下一个键处恢复, 一次报出多个错误", () => {
		const result = parse(
			"A: {\n  a: string[x: ]\n  b: string\n  c: string %\n  d: string\n}",
			FILE
		);
		expect(located(result.diagnostics)).toEqual([
			{ code: "JOTL1002", line: 2, column: 16 },
			{ code: "JOTL1001", line: 4, column: 13 },
		]);
		expect(result.value!.entries[0]!.body!.entries.map(e => e.key.name)).toEqual([
			"a",
			"b",
			"c",
			"d",
		]);
	});

	it("嵌套超过上限时报错而不是栈溢出", () => {
		const deep = `A: ${"{ a: ".repeat(300)}string${" }".repeat(300)}`;
		expect(parseCodes(deep)).toContain("JOTL1029");
		const deepValue = `A: string[props: ${"[".repeat(300)}${"]".repeat(300)}]`;
		expect(parseCodes(deepValue)).toContain("JOTL1029");
	});
});

describe("位置", () => {
	it("条目 span 从键到内容末尾, keyRange 为键", () => {
		const text = "A: {\n  'k y'(标签)?: string[maxLength: 1],\n}";
		const entry = parseOk(text).entries[0]!.body!.entries[0]!;
		const slice = (r: { start: { offset: number }; end: { offset: number } }) =>
			text.slice(r.start.offset, r.end.offset);
		expect(slice(entry.span.range)).toBe("'k y'(标签)?: string[maxLength: 1]");
		expect(slice(entry.span.keyRange!)).toBe("'k y'");
	});

	it("U+2028 不计行", () => {
		expect(located(parse("A: {  x: string %\n}", FILE).diagnostics)).toEqual([
			{ code: "JOTL1001", line: 1, column: 17 },
		]);
	});
});
