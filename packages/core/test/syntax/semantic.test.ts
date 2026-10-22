// 语义检查(定稿 §15): 顶层名, 标识, 重复, 未知组件与元数据, 适用性, 体, 类型串, 联合, 默认值与 widget 降级.
import type { JsonSchemaObject } from "../../src/schema/index.js";
import { compile } from "../../src/syntax/index.js";
import { describe, expect, it } from "vitest";
import { FILE, compileCodes, fieldCodes, located } from "./helpers.js";

describe("顶层", () => {
	it("顶层名不是大驼峰时报错, 并给出包进 Root 的修复", () => {
		const result = compile("a: string\n'b': number\nC: string", FILE);
		expect(located(result.diagnostics)).toEqual([
			{ code: "JOTL1036", line: 1, column: 1 },
			{ code: "JOTL1036", line: 2, column: 1 },
		]);
		const edits = result.diagnostics[0]!.fixes![0]!.edits;
		expect(edits.map(e => [e.range.start.offset, e.newText])).toEqual([
			[0, "<root/>\nRoot(根): {\n"],
			[21, "\n}"],
		]);
	});

	it("顶层写 `?`, 重复类型名, 标识重复, 类型名与扩展组件重名", () => {
		expect(compileCodes("A?: string")).toEqual(["JOTL1037"]);
		expect(compileCodes("A: string\nA: number")).toEqual(["JOTL1015"]);
		expect(compileCodes("<root/>\nA: string\n<root/>\nB: string")).toEqual(["JOTL1039"]);
		expect(compileCodes("Pick: string", { widgets: { Pick: { type: "string" } } })).toEqual([
			"JOTL1028",
		]);
	});

	it("`root` `default` 是普通名字", () => {
		expect(fieldCodes(": { root: string, default: string }")).toEqual([]);
	});
});

describe("组件与引用", () => {
	it("未知组件, 未声明的类型或未登记的扩展组件, 保留词", () => {
		expect(fieldCodes(": strng")).toEqual(["JOTL1004"]);
		expect(fieldCodes(": Missing")).toEqual(["JOTL1006"]);
		expect(fieldCodes(": import")).toEqual(["JOTL1014"]);
	});

	it("不允许体的组件写了体, 引用类型带体", () => {
		expect(fieldCodes(": string {}")).toEqual(["JOTL1041"]);
		expect(fieldCodes(": array[array_item: 'string'] { a: string }")).toEqual(["JOTL1041"]);
		expect(fieldCodes(": B { a: string }", "B: {}")).toEqual(["JOTL1044"]);
	});

	it("枚举没有成员, 成员值重复, 成员写了 `:` 或其他元数据", () => {
		expect(fieldCodes(": enum{}")).toEqual(["JOTL1025"]);
		expect(fieldCodes(": enum")).toEqual(["JOTL1025"]);
		expect(fieldCodes(": enum{ a 'a' }")).toEqual(["JOTL1024"]);
		expect(fieldCodes(": enum{ 1 1.0 }")).toEqual(["JOTL1024"]);
		expect(fieldCodes(": enum{ a[title: 'x'] }")).toEqual(["JOTL1046"]);
	});

	it("枚举成员写裸 `null` 报错并提示 nullable; 引号 'null' 是字符串成员", () => {
		const result = compile("A: enum{ a null }", FILE);
		expect(result.diagnostics.map(d => [d.code, d.severity])).toEqual([["JOTL1046", "error"]]);
		expect(result.diagnostics[0]?.message).toContain("nullable: true");
		expect(located(result.diagnostics)).toEqual([{ code: "JOTL1046", line: 1, column: 12 }]);
		expect(compile("A: enum{ a 'null' }", FILE).value?.schema.$defs?.A).toEqual({
			type: "string",
			enum: ["a", "null"],
		});
	});

	it("同一体内与同一元数据内的键重复", () => {
		expect(fieldCodes(": { a: string, a: number }")).toEqual(["JOTL1005"]);
		expect(fieldCodes(": string[maxLength: 1, maxLength: 2]")).toEqual(["JOTL1005"]);
		expect(fieldCodes(": string[props: {a: 1, a: 2}]")).toEqual(["JOTL1005"]);
	});

	it("沿很长的别名链取字段名, 判断枚举与 JSON 类型, 不爆栈", () => {
		const text = (n: number) => {
			const chain = (p: string, end: string) =>
				`${Array.from({ length: n }, (_, i) => `${p}${i}: ${p}${i + 1}`).join("\n")}\n${p}${n}: ${end}`;
			return [
				"Root: {\n  a: A0[summary: 'x']\n  b: A0[summary: 'y']\n  e: E0[multiple: true]\n  s: S0[multiple: true]",
				"  u: union[union_item: 'S0|string']\n  d: union[discriminator: 'k'] { 1: A0 }",
				"  c: C0[summary: 'x']\n  f: C0[multiple: true]\n}",
				chain("A", "{ x: string }"),
				chain("E", "enum{ a b }"),
				chain("S", "string"),
				chain("C", "C0"),
			].join("\n");
		};
		const expected = ["JOTL1017", "JOTL1012", "JOTL1043", "JOTL1012"];
		expect(compileCodes(text(3))).toEqual(expected);
		expect(compileCodes(text(20000))).toEqual(expected);
	});
});

describe("元数据", () => {
	it("未知键与不适用于该组件的键", () => {
		expect(fieldCodes(": string[maxLen: 1]")).toEqual(["JOTL1011"]);
		expect(fieldCodes(": number[maxLength: 1]")).toEqual(["JOTL1007"]);
		expect(fieldCodes(": string[closed: true]")).toEqual(["JOTL1007"]);
		expect(fieldCodes(": B[minLength: 1]", "B: string")).toEqual(["JOTL1007"]);
		expect(fieldCodes(": date[value_format: 'x', maxLength: 10, pattern: '^1']")).toEqual([
			"JOTL1007",
			"JOTL1007",
		]);
		expect(
			fieldCodes(": datetime[value_format: 'X', minLength: 1, format: 'date-time']")
		).toEqual(["JOTL1007", "JOTL1007"]);
		expect(fieldCodes(": string[x_ui: 1]")).toEqual(["JOTL1012"]);
	});

	it("只能写在根条目上的 rules 与 id; 只能与 multiple 一起写的项数约束", () => {
		expect(fieldCodes(": string[id: 'https://x']")).toEqual(["JOTL1012"]);
		expect(compileCodes("A: string\nB: [rules: []] {}")).toEqual(["JOTL1012"]);
		expect(fieldCodes(": enum[minItems: 1]{ a }")).toEqual(["JOTL1012"]);
		expect(fieldCodes(": B[multiple: true]", "B: {}")).toEqual(["JOTL1012"]);
	});

	it("取值不合法", () => {
		expect(fieldCodes(": string[maxLength: -1]")).toEqual(["JOTL1020"]);
		expect(fieldCodes(": string[pattern: '(']")).toEqual(["JOTL1020"]);
		expect(fieldCodes(": string[minLength: 3, maxLength: 2]")).toEqual(["JOTL1020"]);
		expect(fieldCodes(": money[currency: 'rmb']")).toEqual(["JOTL1020"]);
		expect(fieldCodes(": money[minimum: 1]")).toEqual(["JOTL1020"]);
		expect(fieldCodes(": bigint[minimum: '2', maximum: '1']")).toEqual(["JOTL1020"]);
		expect(fieldCodes(": string[deprecated: 1]")).toEqual(["JOTL1020"]);
		expect(fieldCodes(": string[errorMessage: {maxLen: 'x'}]")).toEqual(["JOTL1020"]);
		expect(fieldCodes(": map[key_meta: {format: 'email'}]")).toEqual(["JOTL1020"]);
	});

	it("x-ui 内容不合法", () => {
		expect(fieldCodes(": [order: ['b']] { a: string }")).toEqual(["JOTL1017"]);
		expect(fieldCodes(": [groups: [{title: 'g', fields: ['b']}]] { a: string }")).toEqual([
			"JOTL1017",
		]);
		expect(
			fieldCodes(
				": [groups: [{title: 'g', fields: ['a']}, {title: 'h', fields: ['a']}]] { a: string }"
			)
		).toEqual(["JOTL1017"]);
		expect(fieldCodes(": [groups: [{title: 'g', fields: ['a', 'a']}]] { a: string }")).toEqual([
			"JOTL1017",
		]);
		expect(fieldCodes(": [layout: 'flex'] {}")).toEqual(["JOTL1017"]);
		expect(fieldCodes(": [layout: 'tabs', columns: 2] {}")).toEqual(["JOTL1017"]);
		expect(fieldCodes(": [summary: 'b'] { a: string }")).toEqual(["JOTL1017"]);
		expect(fieldCodes(": string[root_if: {left: 'a', op: 'like', right: 1}]")).toEqual([
			"JOTL1017",
		]);
		expect(fieldCodes(": string[root_if: {left: 'a..b', op: 'truthy'}]")).toEqual(["JOTL1017"]);
		expect(fieldCodes(": string[node_if: {left: 'a', op: 'in', right: 1}]")).toEqual([
			"JOTL1017",
		]);
		expect(fieldCodes(": string[node_if: '$.a']")).toEqual(["JOTL1017"]);
		expect(fieldCodes(": string[node_if: {left: '$.a', op: 'eq', right: 1}]")).toEqual([
			"JOTL1017",
		]);
		expect(fieldCodes(": string[variants: {view: {order: []}}]")).toEqual(["JOTL1017"]);
		expect(fieldCodes(": string[variants: {view: {widget: 1}}]")).toEqual(["JOTL1017"]);
		expect(fieldCodes(": string[widget: '']")).toEqual(["JOTL1017"]);
	});

	it("schema 覆盖已生成的关键字报 warning, 不能写入 $schema $defs", () => {
		const result = compile("A: string[minLength: 1, schema: {minLength: 0}]", FILE);
		expect(result.diagnostics.map(d => [d.code, d.severity])).toEqual([
			["JOTL1016", "warning"],
		]);
		expect(result.value?.schema.$defs?.A).toEqual({ type: "string", minLength: 0 });
		expect(compileCodes("A: string[schema: {$defs: {}}]")).toEqual(["JOTL1012"]);
	});

	it("format 覆盖组件自带的格式时报 warning, 以元数据为准", () => {
		const result = compile("A: image[format: 'email']", FILE);
		expect(result.diagnostics.map(d => [d.code, d.severity])).toEqual([
			["JOTL1048", "warning"],
		]);
		expect(result.value?.schema.$defs?.A).toMatchObject({ type: "string", format: "email" });
		expect(fieldCodes(": email[format: 'email']")).toEqual([]);
		expect(fieldCodes(": string[format: 'email']")).toEqual([]);
	});

	it("widget 不接受该数据形态时报 warning 并降级; 扩展组件名不检查", () => {
		const result = compile("A: enum[multiple: true, widget: 'radio']{ a b }", FILE);
		expect(result.diagnostics.map(d => [d.code, d.severity])).toEqual([
			["JOTL1045", "warning"],
		]);
		expect(result.value?.schema.$defs?.A).not.toHaveProperty("x-ui");
		expect(compile("A: text[widget: 'switch']", FILE).value?.schema.$defs?.A).toMatchObject({
			"x-ui": { widget: "textarea" },
		});
		expect(fieldCodes(": string[widget: 'my-editor']")).toEqual([]);
	});

	it("场景覆盖中的 widget 同样检查适用性(JOTL1045 JOTL1052), 诊断落在各场景的 widget 值上; 不适用的内置 widget 与字段上一样丢弃", () => {
		const result = compile(
			"A: {\n  n: integer[variants: {m: {widget: 'textarea'}, p: {hidden: true, widget: 'radio'}}]\n}",
			FILE
		);
		expect(result.diagnostics.map(d => [d.code, d.severity])).toEqual([
			["JOTL1045", "warning"],
			["JOTL1045", "warning"],
		]);
		expect(located(result.diagnostics)).toEqual([
			{ code: "JOTL1045", line: 2, column: 37 },
			{ code: "JOTL1045", line: 2, column: 76 },
		]);
		const nOf = (r: ReturnType<typeof compile>) =>
			(r.value?.schema.$defs?.A as JsonSchemaObject | undefined)?.properties?.n as
				| JsonSchemaObject
				| undefined;
		// 丢弃后 m 场景没有其他覆盖项, 不写入; p 场景保留其余覆盖项.
		expect(nOf(result)).toEqual({
			type: "integer",
			minimum: -Number.MAX_SAFE_INTEGER,
			maximum: Number.MAX_SAFE_INTEGER,
			"x-ui": { variants: { p: { hidden: true } } },
		});
		const only = compile("A: {\n  n: integer[variants: {m: {widget: 'textarea'}}]\n}", FILE);
		expect(nOf(only)?.["x-ui"]).toBeUndefined();
		// JOTL1052 与字段上一样只提醒, widget 照常写入.
		const typed = compile("A: {\n  n: integer[variants: {m: {widget: 'headline'}}]\n}", FILE, {
			widgetTypes: { headline: { type: "string" } },
		});
		expect(typed.diagnostics.map(d => d.code)).toEqual(["JOTL1052"]);
		expect(nOf(typed)?.["x-ui"]).toEqual({ variants: { m: { widget: "headline" } } });
		const widgetTypes = {
			headline: { type: "string" },
			gauge: { type: "number" },
		} satisfies Record<string, JsonSchemaObject>;
		expect(
			fieldCodes(": integer[variants: {m: {widget: 'headline'}}]", "", { widgetTypes })
		).toEqual(["JOTL1052"]);
		expect(
			fieldCodes(": integer[variants: {m: {widget: 'gauge'}}]", "", { widgetTypes })
		).toEqual([]);
		expect(
			fieldCodes(": integer[variants: {m: {widget: 'range'}, p: {widget: 'json'}}]")
		).toEqual([]);
		expect(
			fieldCodes(": enum[multiple: true, variants: {m: {widget: 'checkbox'}}]{ a b }")
		).toEqual([]);
		expect(fieldCodes(": integer[variants: {m: {decorator: 'card'}}]")).toEqual([]);
		expect(fieldCodes(": integer[variants: {m: {widget: 'MyEditor'}}]")).toEqual([]);
		expect(fieldCodes(": B[variants: {m: {widget: 'textarea'}}]", "B: enum{ a b }")).toEqual(
			[]
		);
	});

	it("summary 用在元素确定不是对象的 array / map 上报 warning, 照常写入", () => {
		const result = compile("A: array[array_item: 'string', summary: 'x']", FILE);
		expect(result.diagnostics.map(d => [d.code, d.severity])).toEqual([
			["JOTL1049", "warning"],
		]);
		expect(result.value?.schema.$defs?.A).toMatchObject({ "x-ui": { summary: "x" } });
		expect(fieldCodes(": map[map_item: 'B', summary: 'x']", "B: enum{ a b }")).toEqual([
			"JOTL1049",
		]);
		expect(
			fieldCodes(": array[array_item: 'B', summary: 'x']", "B: array[array_item: 'number']")
		).toEqual(["JOTL1049"]);
		expect(fieldCodes(": array[array_item: 'B', summary: 'x']", "B: { x: string }")).toEqual(
			[]
		);
		expect(fieldCodes(": array[array_item: 'object', summary: 'x']")).toEqual([]);
		expect(
			fieldCodes(": array[array_item: 'string|B', summary: 'x']", "B: { x: string }")
		).toEqual([]);
	});

	it("默认值不满足约束", () => {
		expect(fieldCodes(": string[minLength: 1, default: '']")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": string[default: '']")).toEqual([]);
		expect(fieldCodes(": integer[default: 1.5]")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": number[decimals: 1, default: 1.25]")).toEqual(["JOTL1008"]);
		expect(
			fieldCodes(
				": money[currency: 'CNY', minimum: '0', default: {type: 'money', value: '-1.00', currency: 'CNY'}]"
			)
		).toEqual(["JOTL1008"]);
		expect(fieldCodes(": jsontext[default: '{x']")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": B[default: {}]", "B: { a: string }")).toEqual(["JOTL1008"]);
		expect(
			fieldCodes(": union[discriminator: 'k', default: {k: 'a', x: 1}] { a: { x: number } }")
		).toEqual([]);
	});

	it("默认值按常用 format 与 schema 元数据合并后的约束检查", () => {
		expect(fieldCodes(": email[default: 'abc']")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": email[default: 'a@b.c']")).toEqual([]);
		expect(fieldCodes(": url[default: 'abc']")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": url[default: 'https://x.dev/a']")).toEqual([]);
		expect(fieldCodes(": color[default: 'red']")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": color[default: '#1677ff']")).toEqual([]);
		expect(fieldCodes(": date[default: '2021-02-29']")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": date[default: '2020-02-29']")).toEqual([]);
		expect(fieldCodes(": datetime[default: '2026-10-13 09:30']")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": datetime[default: '2026-01-01T09:00:00']")).toEqual(["JOTL1008"]);
		// 与 @jotl/data 运行期一致: 偏移须为 Z 或 ±HH:mm, 闰秒换算到 UTC 须为 23:59.
		expect(fieldCodes(": datetime[default: '2026-01-01 09:00:00+08']")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": datetime[default: '2026-01-01 09:00:00+08:00']")).toEqual([]);
		expect(fieldCodes(": datetime[default: '1998-12-31T15:59:60-08:00']")).toEqual([]);
		expect(fieldCodes(": datetime[default: '1998-12-31T23:59:60+01:00']")).toEqual([
			"JOTL1008",
		]);
		expect(
			fieldCodes(": string[format: 'time', default: '00:59:59.999999999999999Z']")
		).toEqual([]);
		expect(fieldCodes(": string[format: 'time', default: '09:00:00+0800']")).toEqual([
			"JOTL1008",
		]);
		expect(fieldCodes(": string[format: 'time', default: '09:00:00']")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": string[format: 'time', default: '09:00:00.5Z']")).toEqual([]);
		expect(fieldCodes(": datetime[default: '2026-10-13T09:30:15+08:00']")).toEqual([]);
		expect(fieldCodes(": string[format: 'time', default: '25:00:00']")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": string[format: 'uuid', default: 'abc']")).toEqual(["JOTL1008"]);
		expect(
			fieldCodes(
				": string[format: 'uuid', default: 'urn:uuid:2eb8aa08-aa98-11ea-b4aa-73b441d16380']"
			)
		).toEqual(["JOTL1008"]);
		expect(fieldCodes(": string[format: 'hostname', default: 'example.']")).toEqual([
			"JOTL1008",
		]);
		expect(fieldCodes(": string[format: 'hostname', default: 'example.com']")).toEqual([]);
		expect(fieldCodes(": string[format: 'ipv4', default: '1.2.3.256']")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": string[format: 'ipv6', default: '1::2::3']")).toEqual(["JOTL1008"]);
		expect(fieldCodes(": string[format: 'ipv6', default: '::ffff:1.2.3.4']")).toEqual([]);
		expect(fieldCodes(": string[format: 'my-format', default: 'abc']")).toEqual([]);
		expect(fieldCodes(": string[schema: {format: 'email'}, default: 'abc']")).toEqual([
			"JOTL1008",
		]);
		expect(fieldCodes(": string[schema: {maxLength: 2}, default: 'abcd']")).toEqual([
			"JOTL1008",
		]);
		expect(fieldCodes(": string[schema: {pattern: '^a'}, default: 'b']")).toEqual(["JOTL1008"]);
		expect(
			fieldCodes(": [default: {a: 1}, schema: {properties: {a: {type: 'string'}}}] {}")
		).toEqual(["JOTL1008"]);
	});

	it("默认值检查跟随指向根的 # 引用", () => {
		expect(
			fieldCodes(": [default: {y: {x: 'a'}}, schema: {properties: {y: {$ref: '#'}}}] {}")
		).toEqual(["JOTL1008"]);
		expect(
			fieldCodes(": [default: {y: {x: {}}}, schema: {properties: {y: {$ref: '#'}}}] {}")
		).toEqual([]);
	});

	it("默认值检查跟随很长的别名链", () => {
		for (const n of [1100, 5000, 20000]) {
			const chain = Array.from({ length: n }, (_, i) => `A${i}: A${i + 1}`).join("\n");
			const text = (value: string) =>
				`Root: {\n  a: A0[default: ${value}]\n}\n${chain}\nA${n}: string`;
			expect(compileCodes(text("5"))).toEqual(["JOTL1008"]);
			expect(compileCodes(text("'x'"))).toEqual([]);
		}
	});
});

describe("体与类型串", () => {
	it("类型串含 null 或 enum, 名字重复或为空, 未声明的名字", () => {
		expect(fieldCodes(": array[array_item: 'string|null']")).toEqual(["JOTL1042"]);
		expect(fieldCodes(": array[array_item: 'enum']")).toEqual(["JOTL1042"]);
		expect(fieldCodes(": union[union_item: 'string|string']")).toEqual(["JOTL1042"]);
		expect(fieldCodes(": union[union_item: 'string|']")).toEqual(["JOTL1042"]);
		expect(fieldCodes(": union[union_item: 'string']")).toEqual(["JOTL1042"]);
		expect(fieldCodes(": array[array_item: 'Nope']")).toEqual(["JOTL1006"]);
	});

	it("按 JSON 类型区分的联合有同类分支", () => {
		expect(fieldCodes(": union[union_item: 'email|url']")).toEqual(["JOTL1043"]);
		expect(fieldCodes(": union[union_item: 'number|integer']")).toEqual(["JOTL1043"]);
		expect(fieldCodes(": union[union_item: 'object|map']")).toEqual(["JOTL1043"]);
		expect(fieldCodes(": union[union_item: 'any|string']")).toEqual(["JOTL1043"]);
		expect(fieldCodes(": union[union_item: 'B|string']", "B: enum{ a b }")).toEqual([
			"JOTL1043",
		]);
	});

	it("item_meta 的键不在类型串中", () => {
		expect(
			fieldCodes(": union[union_item: 'number|string', item_meta: {boolean: {}}]")
		).toEqual(["JOTL1020"]);
	});

	it("union 需要 discriminator 或 union_item 之一; 分支写法", () => {
		expect(fieldCodes(": union")).toEqual(["JOTL1047"]);
		expect(fieldCodes(": union[discriminator: 'k', union_item: 'a|b']")).toContain("JOTL1047");
		expect(fieldCodes(": union[discriminator: 'k'] { a?: {} }")).toEqual(["JOTL1046"]);
		expect(fieldCodes(": union[discriminator: 'k'] { a: { k: string } }")).toEqual([
			"JOTL1046",
		]);
		expect(fieldCodes(": union[discriminator: 'k'] { a: string }")).toEqual(["JOTL1046"]);
		expect(fieldCodes(": union[discriminator: 'k'] { a: {} 'a': {} }")).toEqual(["JOTL1046"]);
		expect(fieldCodes(": union[discriminator: 'k'] {}")).toEqual(["JOTL1047"]);
		expect(fieldCodes(": union[discriminator: 'k']")).toEqual(["JOTL1047"]);
	});

	it("元组位置从 0 连续, `?` 只在末尾, `*` 只有一个", () => {
		expect(fieldCodes(": array[array_item: 'tuple'] { 1: string }")).toEqual(["JOTL1046"]);
		expect(fieldCodes(": array[array_item: 'tuple'] { 0?: string  1: string }")).toEqual([
			"JOTL1046",
		]);
		expect(fieldCodes(": array[array_item: 'tuple'] { 0: string  *?: string }")).toEqual([
			"JOTL1046",
		]);
		expect(fieldCodes(": array[array_item: 'tuple']")).toEqual(["JOTL1046"]);
	});

	it("字段数字键只能是非负整数", () => {
		expect(fieldCodes(": { 1.5: string }")).toEqual(["JOTL1046"]);
	});
});
