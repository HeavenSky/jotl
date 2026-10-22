// 扩展组件模块声明: 根元数据 `widgets` 的登记与根 `x-ui.widgets`, 打印往返, jotl.config.json 的模块声明, 以及 `schema` 写入的 x-ui 校验.
import {
	JSON_SCHEMA_DIALECT,
	type JsonSchemaObject,
	xUiMetaSchema,
} from "../../src/schema/index.js";
import { describe, expect, it } from "vitest";
import { checkDefaultValue } from "../../src/syntax/value-check.js";
import {
	compile,
	configCompileOptions,
	createJotlConfigJsonSchema,
	print,
	readJotlConfig,
} from "../../src/syntax/index.js";
import { FILE, codes, compileCodes, compileDoc } from "./helpers.js";

const URL = "https://esm.sh/image-picker";

describe("根元数据 widgets", () => {
	it("大驼峰名登记为扩展组件, 文件内可用; 模块声明写入根 x-ui.widgets", () => {
		const doc = compileDoc(
			`A: [widgets: {ImagePicker: {base: 'url', module: '${URL}', export: 'Picker'}, Tags: 'array', rich: {module: './rich.js'}}] {\n  pic: ImagePicker\n  tags?: Tags\n  body?: string[widget: 'rich']\n}`
		);
		expect(doc["x-ui"]).toEqual({
			version: 1,
			widgets: {
				ImagePicker: { base: "url", module: URL, export: "Picker" },
				rich: { module: "./rich.js" },
			},
		});
		const a = doc.$defs!["A"] as JsonSchemaObject;
		expect(a.properties).toEqual({
			pic: { type: "string", format: "uri", "x-ui": { widget: "ImagePicker" } },
			tags: { type: "array", "x-ui": { widget: "Tags" } },
			body: { type: "string", "x-ui": { widget: "rich" } },
		});
	});

	it("模块声明缺省 base 为 object; schema 对象原样作底层类型", () => {
		const doc = compileDoc(
			`A: [widgets: {Map: {module: 'm'}, Pick: {type: 'string', format: 'uri'}}] {\n  m: Map\n  p: Pick\n}`
		);
		expect((doc.$defs!["A"] as JsonSchemaObject).properties).toEqual({
			m: { type: "object", "x-ui": { widget: "Map" } },
			p: { type: "string", format: "uri", "x-ui": { widget: "Pick" } },
		});
		expect(doc["x-ui"]).toEqual({ version: 1, widgets: { Map: { module: "m" } } });
	});

	it("模块声明的 base 为 object 以外时原样写入根 x-ui.widgets, 写 'object' 视同缺省", () => {
		const doc = compileDoc(
			`A: [widgets: {O: {base: 'object', module: 'o'}, S: {base: {type: 'string', maxLength: 3}, module: 's'}}] {\n  o: O\n  s: S\n}`
		);
		expect(doc["x-ui"]).toEqual({
			version: 1,
			widgets: {
				O: { module: "o" },
				S: { base: { type: "string", maxLength: 3 }, module: "s" },
			},
		});
	});

	it("与 options.widgets 合并, 文件内声明优先", () => {
		const doc = compileDoc("A: [widgets: {Pic: 'string'}] {\n  a: Pic\n  b: Other\n}", {
			widgets: { Pic: { type: "integer" }, Other: { type: "boolean" } },
		});
		expect((doc.$defs!["A"] as JsonSchemaObject).properties).toEqual({
			a: { type: "string", "x-ui": { widget: "Pic" } },
			b: { type: "boolean", "x-ui": { widget: "Other" } },
		});
	});

	it("只能写在根条目; 未声明时仍报 JOTL1006", () => {
		expect(compileCodes("A: {\n  b: B\n}\nB: [widgets: {Pic: 'string'}] {}")).toEqual([
			"JOTL1012",
		]);
		expect(compileCodes("A: {\n  a: Pic\n}")).toEqual(["JOTL1006"]);
	});

	it("取值不合法报 JOTL1020, 类型名与文件内声明的扩展组件重名报 JOTL1028", () => {
		const bad = [
			"[widgets: 'x']",
			"[widgets: {A1: 1}]",
			"[widgets: {A1: 'nope'}]",
			"[widgets: {A1: {module: ''}}]",
			"[widgets: {A1: {module: 'm', export: 1}}]",
			"[widgets: {A1: {module: 'm', base: 1}}]",
			"[widgets: {A1: {module: 'm', base: 'nope'}}]",
			"[widgets: {A1: {module: 'm', extra: 1}}]",
			"[widgets: {'': 'string'}]",
		];
		for (const meta of bad) expect(compileCodes(`A: ${meta} {}`), meta).toEqual(["JOTL1020"]);
		expect(compileCodes("A: [widgets: {B: 'string'}] {}\nB: string")).toEqual(["JOTL1028"]);
	});

	it("英文环境下 widgets 的取值问题为英文", async () => {
		const { setLocale } = await import("../../src/schema/index.js");
		setLocale("en");
		try {
			expect(
				compile("A: [widgets: {A1: {module: ''}}] {}", FILE).diagnostics[0]!.message
			).toBe("Invalid metadata value: `module` of `A1` must be a non-empty string");
		} finally {
			setLocale("zh-CN");
		}
	});
});

describe("扩展组件的约束元数据", () => {
	const RATING = `A: [widgets: {Rating: {base: 'integer', module: 'm'}}] {\n  score: Rating`;
	const field = (text: string, widgets?: Record<string, JsonSchemaObject>) =>
		(
			compileDoc(`A: {\n  x: ${text}\n}`, widgets ? { widgets } : undefined).$defs![
				"A"
			] as JsonSchemaObject
		).properties!["x"];
	const fieldCodes = (text: string, widgets: Record<string, JsonSchemaObject>) =>
		compileCodes(`A: {\n  x: ${text}\n}`, { widgets });

	it("按 base 放行并合并进底层 schema, 覆盖底层同名关键字", () => {
		const doc = compileDoc(
			`${RATING}[minimum: 0, maximum: 5, default: 3, props: {count: 5}]\n}`
		);
		expect((doc.$defs!["A"] as JsonSchemaObject).properties!["score"]).toEqual({
			type: "integer",
			minimum: 0,
			maximum: 5,
			default: 3,
			"x-ui": { widget: "Rating", props: { count: 5 } },
		});
	});

	it("字符串, 数值, 数组, 对象与 money 底层各按对应内置组件放行", () => {
		expect(
			field("Code[minLength: 2, maxLength: 4, pattern: '^[A-Z]+$']", {
				Code: { type: "string" },
			})
		).toEqual({
			type: "string",
			minLength: 2,
			maxLength: 4,
			pattern: "^[A-Z]+$",
			"x-ui": { widget: "Code" },
		});
		expect(
			field("Ratio[exclusiveMinimum: 0, decimals: 2]", {
				Ratio: { type: ["number", "null"] },
			})
		).toEqual({
			type: ["number", "null"],
			exclusiveMinimum: 0,
			"x-decimals": 2,
			"x-ui": { widget: "Ratio" },
		});
		expect(
			field("Tags[minItems: 1, uniqueItems: true]", {
				Tags: { type: "array", items: { type: "string" } },
			})
		).toMatchObject({ minItems: 1, uniqueItems: true });
		expect(field("Bag[maxProperties: 3]", { Bag: { type: "object" } })).toMatchObject({
			maxProperties: 3,
		});
		const doc = compileDoc(
			"A: [widgets: {Price: 'money'}] {\n  p: Price[minimum: '0', maximum: '99.5']\n}"
		);
		expect((doc.$defs!["A"] as JsonSchemaObject).properties!["p"]).toMatchObject({
			"x-decimalRange": { minimum: "0", maximum: "99.5" },
		});
	});

	it("不适用于底层类型的约束, 以及无 type 或多类型的底层, 仍报 JOTL1007", () => {
		expect(compileCodes(`${RATING}[minLength: 1]\n}`)).toEqual(["JOTL1007"]);
		expect(fieldCodes("Pick[decimals: 2]", { Pick: { type: "integer" } })).toEqual([
			"JOTL1007",
		]);
		expect(
			fieldCodes("Pick[minimum: 1]", {
				Pick: { anyOf: [{ type: "string" }, { type: "number" }] },
			})
		).toEqual(["JOTL1007"]);
		expect(fieldCodes("Pick[minimum: 1]", { Pick: { type: ["string", "number"] } })).toEqual([
			"JOTL1007",
		]);
		expect(fieldCodes("Pick[closed: true]", { Pick: { type: "object" } })).toEqual([
			"JOTL1007",
		]);
	});

	it("默认值按合并后的约束检查, 违反时报 JOTL1008", () => {
		expect(compileCodes(`${RATING}[minimum: 0, maximum: 5, default: 7]\n}`)).toEqual([
			"JOTL1008",
		]);
		expect(
			fieldCodes("Code[maxLength: 2, default: 'abc']", { Code: { type: "string" } })
		).toEqual(["JOTL1008"]);
	});

	it("与底层 schema 的上下界冲突报 JOTL1020, format 不同报 JOTL1048 warning", () => {
		expect(fieldCodes("Pick[minimum: 10]", { Pick: { type: "number", maximum: 5 } })).toEqual([
			"JOTL1020",
		]);
		expect(
			fieldCodes("Pick[format: 'email']", { Pick: { type: "string", format: "uri" } })
		).toEqual(["JOTL1048"]);
	});
});

describe("打印往返", () => {
	it("根 x-ui.widgets 写回根元数据 widgets(模块声明形态), 再编译深度相等", () => {
		const schema: JsonSchemaObject = {
			$schema: JSON_SCHEMA_DIALECT,
			$ref: "#/$defs/A",
			"x-ui": {
				version: 1,
				widgets: {
					ImagePicker: { module: URL, export: "Picker" },
					rich: { module: "./rich.js" },
				},
			},
			$defs: {
				A: {
					type: "object",
					properties: {
						pic: { type: "string", format: "uri", "x-ui": { widget: "ImagePicker" } },
					},
					required: ["pic"],
				},
			},
		};
		const printed = print(schema);
		expect(printed.diagnostics).toEqual([]);
		expect(printed.value).toBe(
			`A: [widgets: {ImagePicker: {module: '${URL}', export: 'Picker'}, rich: {module: './rich.js'}}] {\n  pic: url[widget: 'ImagePicker']\n}\n`
		);
		const compiled = compile(printed.value!, FILE);
		expect(compiled.diagnostics).toEqual([]);
		expect(compiled.value!.schema).toEqual(schema);
	});

	it("不合法或与类型名重名的根 x-ui.widgets 报 JOTL1032", () => {
		const doc = (widgets: unknown): JsonSchemaObject =>
			({
				$schema: JSON_SCHEMA_DIALECT,
				$ref: "#/$defs/A",
				"x-ui": { version: 1, widgets },
				$defs: { A: { type: "object" } },
			}) as never;
		expect(codes(print(doc({ A: { module: "m" } })).diagnostics)).toEqual(["JOTL1032"]);
		expect(codes(print(doc({ P: { module: "" } })).diagnostics)).toEqual(["JOTL1032"]);
		expect(codes(print(doc({ P: { module: "m", base: "nope" } })).diagnostics)).toEqual([
			"JOTL1032",
		]);
		expect(codes(print(doc({ P: { module: "m", base: 1 } })).diagnostics)).toEqual([
			"JOTL1032",
		]);
	});

	it("带 base 的模块声明写回 base, 再编译深度相等且扩展组件按 base 登记", () => {
		const source = `A: [widgets: {Rating: {base: 'url', module: './r.js'}, Pick: {base: {type: 'string', format: 'uri'}, module: 'p', export: 'P'}}] {\n  score: Rating\n  pic?: Pick\n}`;
		const schema = compileDoc(source);
		const printed = print(schema);
		expect(printed.diagnostics).toEqual([]);
		expect(printed.value).toContain(
			`[widgets: {Rating: {base: 'url', module: './r.js'}, Pick: {base: {type: 'string', format: 'uri'}, module: 'p', export: 'P'}}]`
		);
		const compiled = compile(printed.value!, FILE);
		expect(compiled.diagnostics).toEqual([]);
		expect(compiled.value!.schema).toEqual(schema);
		const reprinted = `${printed.value!.replace(/\n}\n$/, "")}\n  n: Rating[maxLength: 5]\n  m: Pick[maxLength: 5]\n}`;
		expect(compileCodes(reprinted)).toEqual([]);
		expect(compileCodes(reprinted.replace(/base: 'url', /, ""))).not.toEqual([]);
	});

	it("底层为 integer 的扩展组件不补安全整数上下界: 缺上界或下界时写回组件名, 已有的界照写; 两界都有时仍为 integer[widget: ...]", () => {
		const max = Number.MAX_SAFE_INTEGER;
		for (const base of ["'integer'", "{type: 'integer'}"]) {
			const source = `A: [widgets: {Stars: {base: ${base}, module: 'm'}}] {\n  a: Stars\n  b?: Stars[minimum: 0, nullable: true, default: 3]\n  c?: Stars[maximum: ${max}]\n  d?: integer[widget: 'Stars']\n}`;
			const schema = compileDoc(source);
			expect((schema.$defs!["A"] as JsonSchemaObject).properties!["a"]).toEqual({
				type: "integer",
				"x-ui": { widget: "Stars" },
			});
			const printed = print(schema);
			expect(printed.diagnostics).toEqual([]);
			expect(printed.value).toBe(`${source}\n`);
			const compiled = compile(printed.value!, FILE);
			expect(compiled.diagnostics).toEqual([]);
			expect(compiled.value!.schema).toEqual(schema);
		}
		// 未登记为扩展组件的 widget 与无 widget 的 integer 一样, 编译补上下界.
		const plain = print({
			$schema: JSON_SCHEMA_DIALECT,
			$ref: "#/$defs/A",
			"x-ui": { version: 1 },
			$defs: { A: { type: "integer", "x-ui": { widget: "Stars" } } },
		});
		expect(plain.value).toBe("A: integer[widget: 'Stars']\n");
	});
});

describe("x-ui meta-schema", () => {
	it("根 widgets 只接受 {base?, module, export?}", () => {
		const check = (value: unknown) =>
			checkDefaultValue(xUiMetaSchema, value, xUiMetaSchema.$defs as never, xUiMetaSchema);
		expect(
			check({ version: 1, widgets: { P: { module: "m", export: "default" } } })
		).toBeUndefined();
		expect(check({ widgets: { P: { module: "" } } })).toBeDefined();
		expect(
			check({
				widgets: {
					P: { base: "integer", module: "m" },
					Q: { base: { type: "string" }, module: "q" },
				},
			})
		).toBeUndefined();
		expect(check({ widgets: { P: { module: "m", base: 1 } } })).toBeDefined();
		expect(check({ widgets: { P: { module: "m", base: "" } } })).toBeDefined();
		expect(check({ widgets: { P: { module: "m", extra: 1 } } })).toBeDefined();
		expect(check({ variants: { view: { widgets: {} } } })).toBeDefined();
	});

	it("模块声明的 level 可选, 取值同组件登记级别", () => {
		const check = (value: unknown) =>
			checkDefaultValue(xUiMetaSchema, value, xUiMetaSchema.$defs as never, xUiMetaSchema);
		for (const level of ["view", "layout", "composite", "field", "decorator"])
			expect(check({ widgets: { P: { module: "m", level } } })).toBeUndefined();
		expect(check({ widgets: { P: { module: "m", level: "row" } } })).toBeDefined();
		expect(check({ widgets: { P: { module: "m", level: "" } } })).toBeDefined();
		expect(check({ widgets: { P: { module: "m", level: 1 } } })).toBeDefined();
	});
});

describe("schema 写入的 x-ui", () => {
	it("不合法时报 warning JOTL1050, 照常写入不阻断", () => {
		const result = compile(
			"A: {\n  a: string[schema: {'x-ui': {widget: '', foo: 1}}]\n}",
			FILE
		);
		expect(result.diagnostics.map(d => [d.code, d.severity])).toEqual([
			["JOTL1050", "warning"],
		]);
		expect(
			(
				(result.value!.schema.$defs!["A"] as JsonSchemaObject).properties![
					"a"
				] as JsonSchemaObject
			)["x-ui"]
		).toEqual({ widget: "", foo: 1 });
	});

	it("含根专属字段 rules version widgets 时逐个报 warning JOTL1050, 照常写入", () => {
		const result = compile(
			"A: {\n  a: string[schema: {'x-ui': {version: 1, rules: [], widgets: {}, widget: 'x'}}]\n}",
			FILE
		);
		expect(result.diagnostics.map(d => [d.code, d.severity])).toEqual([
			["JOTL1050", "warning"],
			["JOTL1050", "warning"],
			["JOTL1050", "warning"],
		]);
		expect(result.diagnostics.map(d => d.message)).toEqual(
			["/version", "/rules", "/widgets"].map(
				p => `\`schema\` 写入的 x-ui 不合法, 已原样写入: 位置 \`${p}\`: 只能写在根条目上`
			)
		);
		expect(
			(
				(result.value!.schema.$defs!["A"] as JsonSchemaObject).properties![
					"a"
				] as JsonSchemaObject
			)["x-ui"]
		).toEqual({ version: 1, rules: [], widgets: {}, widget: "x" });
		expect(compileCodes("A: [schema: {'x-ui': {rules: []}}] {}")).toEqual(["JOTL1050"]);
	});

	it("合法时无诊断", () => {
		expect(
			compileCodes(
				"A: {\n  a: string[schema: {'x-ui': {layout: 'stack', visibleIf: {field: '/b', truthy: true}}}]\n}"
			)
		).toEqual([]);
	});
});

describe("jotl.config.json 的模块声明", () => {
	it("带 module 的对象为模块声明: 底层类型取 base(缺省 object), 模块记入 modules", () => {
		const { config, issues } = readJotlConfig({
			widgets: {
				ImagePicker: { base: "url", module: URL, export: "Picker" },
				Map: { module: "./map.js" },
				Pick: { base: { type: "string" }, module: "p" },
				Plain: "string",
			},
		});
		expect(issues).toEqual([]);
		expect(config.widgets).toEqual({
			ImagePicker: { type: "string", format: "uri" },
			Map: { type: "object" },
			Pick: { type: "string" },
			Plain: { type: "string" },
		});
		expect(config.modules).toEqual({
			ImagePicker: { module: URL, export: "Picker" },
			Map: { module: "./map.js" },
			Pick: { module: "p" },
		});
		expect(configCompileOptions(config.widgets).widgets?.["Map"]).toEqual({ type: "object" });
	});

	it("不合法的模块声明记入 issues 并跳过", () => {
		const { config, issues } = readJotlConfig({
			widgets: {
				A: { module: 1 },
				B: { module: "m", export: "" },
				C: { module: "m", base: [] },
				D: { module: "m", x: 1 },
				E: { module: "m" },
			},
		});
		expect(issues.map(i => i.pointer)).toEqual([
			"/widgets/A",
			"/widgets/B",
			"/widgets/C",
			"/widgets/D",
		]);
		expect(Object.keys(config.widgets)).toEqual(["E"]);
		expect(config.modules).toEqual({ E: { module: "m" } });
	});

	it("配置文件的 JSON Schema 接受模块声明", () => {
		const schema = createJotlConfigJsonSchema();
		const widgets = schema.properties!["widgets"] as JsonSchemaObject;
		const value = {
			A: { base: "url", module: "m", export: "x" },
			B: "string",
			C: { type: "string" },
		};
		expect(checkDefaultValue(widgets, value, {}, schema)).toBeUndefined();
		expect(checkDefaultValue(widgets, { A: 1 }, {}, schema)).toBeDefined();
	});
});
