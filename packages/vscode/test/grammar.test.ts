// TextMate 语法(syntaxes/jotl.tmLanguage.json)的 token 快照与逐类记号断言.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { listFixtures, readFixture } from "../../../test-utils/fixtures.js";
import { COMPONENT_NAMES, CONDITION_OPS, META_KEY_NAMES } from "../../core/src/syntax/builtins.js";

type TextMate = typeof import("vscode-textmate");
type Oniguruma = typeof import("vscode-oniguruma");
type Grammar = import("vscode-textmate").IGrammar;

// vscode-textmate 与 vscode-oniguruma 是 UMD/CJS 包, ESM 具名导入在 Node 下取不到导出.
const require = createRequire(import.meta.url);
const vsctm = require("vscode-textmate") as TextMate;
const oniguruma = require("vscode-oniguruma") as Oniguruma;

const GRAMMAR_PATH = fileURLToPath(new URL("../syntaxes/jotl.tmLanguage.json", import.meta.url));
const PACKAGE_JSON_PATH = fileURLToPath(new URL("../package.json", import.meta.url));
const SNAPSHOT_FIXTURES = /^(?:0(?:0[1-9]|1[0-7])|1(?:0[1-9]|1[0-2]))-/;

interface Token {
	text: string;
	scopes: string[];
}

let grammar: Grammar;

beforeAll(async () => {
	await oniguruma.loadWASM(readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm")));
	const registry = new vsctm.Registry({
		onigLib: Promise.resolve({
			createOnigScanner: sources => oniguruma.createOnigScanner(sources),
			createOnigString: str => oniguruma.createOnigString(str),
		}),
		loadGrammar: async scopeName =>
			scopeName === "source.jotl"
				? vsctm.parseRawGrammar(readFileSync(GRAMMAR_PATH, "utf8"), GRAMMAR_PATH)
				: null,
	});
	const loaded = await registry.loadGrammar("source.jotl");
	if (!loaded) throw new Error("source.jotl 语法加载失败");
	grammar = loaded;
});

/** 逐行 tokenize, 去掉根作用域 source.jotl. */
function tokenize(source: string): Token[][] {
	let stack = vsctm.INITIAL;
	return source
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map(line => {
			const result = grammar.tokenizeLine(line, stack);
			stack = result.ruleStack;
			return result.tokens.map(t => ({
				text: line.slice(t.startIndex, t.endIndex),
				scopes: t.scopes.slice(1),
			}));
		});
}

function render(source: string): string {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const tokens = tokenize(source);
	const out: string[] = [];
	lines.forEach((line, i) => {
		out.push(`> ${line}`.trimEnd());
		for (const t of tokens[i] ?? []) {
			if (t.text.trim() === "") continue;
			out.push(`  ${JSON.stringify(t.text)} ${t.scopes.join(" ")}`.trimEnd());
		}
	});
	return out.join("\n") + "\n";
}

/** 取整段源码中第 occurrence 个文本恰为 text 的 token 的作用域. */
function scopesOf(source: string, text: string, occurrence = 0): string[] {
	const found = tokenize(source)
		.flat()
		.filter(t => t.text === text);
	const token = found[occurrence];
	if (!token) throw new Error(`未找到第 ${occurrence} 个 token ${JSON.stringify(text)}`);
	return token.scopes;
}

function fixtureSource(name: string): string {
	const source = readFixture(name).source;
	if (source === undefined) throw new Error(`样例 ${name} 缺少 source.jotl`);
	return source;
}

const snapshotFixtures = listFixtures().filter(name => SNAPSHOT_FIXTURES.test(name));

describe("语法定义文件", () => {
	it("scopeName 与 package.json 的 contributes.grammars 一致", () => {
		const raw = JSON.parse(readFileSync(GRAMMAR_PATH, "utf8")) as { scopeName: string };
		const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as {
			contributes: { grammars: { language: string; scopeName: string; path: string }[] };
		};
		expect(pkg.contributes.grammars).toContainEqual({
			language: "jotl",
			scopeName: raw.scopeName,
			path: "./syntaxes/jotl.tmLanguage.json",
		});
		expect(raw.scopeName).toBe("source.jotl");
	});

	it("所有 #include 都指向 repository 中存在的规则", () => {
		const raw = JSON.parse(readFileSync(GRAMMAR_PATH, "utf8")) as {
			repository: Record<string, unknown>;
		};
		const missing: string[] = [];
		const walk = (node: unknown): void => {
			if (Array.isArray(node)) node.forEach(walk);
			else if (node && typeof node === "object") {
				for (const [key, value] of Object.entries(node)) {
					if (key === "include" && typeof value === "string" && value.startsWith("#")) {
						if (!(value.slice(1) in raw.repository)) missing.push(value);
					} else walk(value);
				}
			}
		};
		walk(raw);
		expect(missing).toEqual([]);
	});
});

describe("fixtures token 快照", () => {
	it("覆盖 001-017 与 101-112 共 29 个样例", () => {
		expect(snapshotFixtures).toHaveLength(29);
	});

	it.each(snapshotFixtures)("%s", async name => {
		await expect(render(fixtureSource(name))).toMatchFileSnapshot(
			`./grammar-snapshots/${name}.txt`
		);
	});
});

describe("逐类记号", () => {
	it("行注释与块注释; /// 只是普通行注释", () => {
		const src = "// 行注释\n/* 块\n注释 */\n/// 三斜杠\nA: string // 尾注释\n";
		expect(scopesOf(src, " 行注释")).toContain("comment.line.double-slash.jotl");
		expect(scopesOf(src, "//")).toContain("punctuation.definition.comment.jotl");
		expect(scopesOf(src, "/*")).toContain("comment.block.jotl");
		expect(scopesOf(src, "注释 ")).toContain("comment.block.jotl");
		expect(scopesOf(src, "*/")).toContain("punctuation.definition.comment.end.jotl");
		expect(scopesOf(src, "/ 三斜杠")).toEqual(["comment.line.double-slash.jotl"]);
		expect(scopesOf(src, " 尾注释")).toContain("comment.line.double-slash.jotl");
		expect(
			tokenize(src)
				.flat()
				.some(t => t.scopes.some(s => s.includes("documentation")))
		).toBe(false);
	});

	it("标识记号 <root/> <default/>; 其他 < 开头的写法是非法字符", () => {
		const src = fixtureSource("111-markers-conditions");
		expect(scopesOf(src, "root")).toEqual(["meta.marker.jotl", "keyword.control.marker.jotl"]);
		expect(scopesOf(src, "default")).toContain("keyword.control.marker.jotl");
		expect(scopesOf(src, "<")).toContain("punctuation.definition.marker.begin.jotl");
		expect(scopesOf(src, "/>")).toContain("punctuation.definition.marker.end.jotl");
		const plain = "<root/> A: {\n  root: string\n  default?: string\n}\n<foo/>\n";
		expect(scopesOf(plain, "A")).toContain("entity.name.type.alias.jotl");
		expect(scopesOf(plain, "root", 1)).toEqual([
			"meta.object.type.jotl",
			"variable.other.property.jotl",
		]);
		expect(scopesOf(plain, "default")).toContain("variable.other.property.jotl");
		expect(scopesOf(plain, "<", 1)).toContain("invalid.illegal.character.jotl");
	});

	it("顶层类型名, 字段键与各种键的写法", () => {
		const src = fixtureSource("001-primitives");
		expect(scopesOf(src, "Primitives")).toContain("entity.name.type.alias.jotl");
		expect(scopesOf(src, "name")).toContain("variable.other.property.jotl");
		const keys = `A: { a-b: string, 价格: number; 0(零): string *: number 'x.y': string "x y"?: url $_k: any }`;
		for (const key of ["a-b", "价格", "0", "*", "$_k"]) {
			expect(scopesOf(keys, key), key).toEqual([
				"meta.object.type.jotl",
				"variable.other.property.jotl",
			]);
		}
		expect(scopesOf(keys, "x.y")).toEqual(
			expect.arrayContaining(["variable.other.property.jotl", "string.quoted.single.jotl"])
		);
		expect(scopesOf(keys, "x y")).toEqual(
			expect.arrayContaining(["variable.other.property.jotl", "string.quoted.double.jotl"])
		);
		expect(scopesOf(keys, ",")).toContain("punctuation.separator.field.jotl");
		expect(scopesOf(keys, ";")).toContain("punctuation.separator.field.jotl");
	});

	it("标签: 成对嵌套, 转义, 不跨行; ? 与 :", () => {
		const src = fixtureSource("001-primitives");
		expect(scopesOf(src, "基础类型")).toContain("string.unquoted.label.jotl");
		expect(scopesOf(src, "(")).toContain("punctuation.definition.label.begin.jotl");
		expect(scopesOf(src, ")")).toContain("punctuation.definition.label.end.jotl");
		expect(scopesOf(src, "?")).toContain("keyword.operator.optional.jotl");
		expect(scopesOf(src, ":")).toContain("punctuation.separator.type.jotl");
		const nested = "A: { price(价格(元)): number }";
		expect(scopesOf(nested, "元")).toContain("string.unquoted.label.jotl");
		expect(scopesOf(nested, ")")).toContain("string.unquoted.label.jotl");
		expect(scopesOf(nested, ")", 1)).toContain("punctuation.definition.label.end.jotl");
		expect(scopesOf(nested, "number")).toContain("support.type.builtin.jotl");
		const esc = String.raw`A(a\)b\(c\\): { k: string }`;
		for (const e of [String.raw`\)`, String.raw`\(`, String.raw`\\`]) {
			expect(scopesOf(esc, e), e).toContain("constant.character.escape.jotl");
		}
		expect(scopesOf(esc, "k")).toContain("variable.other.property.jotl");
		// 未闭合的标签在行尾结束, 不吞掉后续行.
		const open = "A: {\n  k(未闭合: string\n  m: string\n}";
		expect(scopesOf(open, "m")).toContain("variable.other.property.jotl");
		expect(scopesOf(open, "string")).toContain("support.type.builtin.jotl");
	});

	it("组件位置: 全部内置组件名, 大驼峰类型名与保留字", () => {
		for (const name of COMPONENT_NAMES) {
			const src = `A: { ${name}: ${name}[description: 'x'] }`;
			expect(scopesOf(src, name), name).toEqual([
				"meta.object.type.jotl",
				"variable.other.property.jotl",
			]);
			expect(scopesOf(src, name, 1), name).toEqual([
				"meta.object.type.jotl",
				"support.type.builtin.jotl",
			]);
		}
		const named = fixtureSource("010-named-types");
		expect(scopesOf(named, "Page")).toContain("entity.name.type.jotl");
		expect(scopesOf(named, "Page", 2)).toContain("entity.name.type.alias.jotl");
		expect(scopesOf("A: { x: import }", "import")).toContain("invalid.illegal.reserved.jotl");
		expect(scopesOf("A: { import: string }", "import")).toContain(
			"variable.other.property.jotl"
		);
	});

	it("语法中的名字列表与 core 双向一致: 不缺也不多", () => {
		// 收集命中 scope 的规则里 `(?:a|b|...)` 前缀的纯标识符候选; 不足两个候选的分组(如 `(op)`)不计.
		const raw = JSON.parse(readFileSync(GRAMMAR_PATH, "utf8"));
		const listsFor = (scope: string): string[][] => {
			const out: string[][] = [];
			const walk = (node: unknown): void => {
				if (Array.isArray(node)) return node.forEach(walk);
				if (!node || typeof node !== "object") return;
				const rule = node as {
					match?: string;
					name?: string;
					captures?: Record<string, { name?: string }>;
				};
				const hit =
					rule.name === scope ||
					Object.values(rule.captures ?? {}).some(c => c.name === scope);
				if (hit && typeof rule.match === "string") {
					for (const m of rule.match.matchAll(
						/\((?:\?:)?((?:[A-Za-z_]\w*\|)+[A-Za-z_]\w*)(?=[|)])/g
					)) {
						if (m[1]) out.push(m[1].split("|"));
					}
				}
				Object.values(node).forEach(walk);
			};
			walk(raw);
			return out;
		};
		const sorted = (xs: Iterable<string>) => [...xs].sort();
		const meta = listsFor("entity.other.attribute-name.metadata.jotl");
		expect(meta.length).toBeGreaterThan(0);
		for (const list of meta) expect(sorted(list)).toEqual(sorted(META_KEY_NAMES));
		const builtin = listsFor("support.type.builtin.jotl");
		expect(builtin.length).toBe(2);
		// 类型串额外接受 `tuple`(对应 `array_item: 'tuple'`).
		for (const list of builtin)
			expect(sorted(list.filter(n => n !== "tuple"))).toEqual(sorted(COMPONENT_NAMES));
		const ops = listsFor("support.constant.condition-operator.jotl");
		expect(ops.length).toBe(2);
		for (const list of ops) expect(sorted(list)).toEqual(sorted(CONDITION_OPS));
	});

	it("组件之后的下一个键: 同一行或下一行", () => {
		const src = "A: { a: string b(标签)?: number c: Foo d e: [maxLength: 3] f: {} g }";
		for (const key of ["b", "c", "d", "e", "f", "g"]) {
			expect(scopesOf(src, key), key).toEqual([
				"meta.object.type.jotl",
				"variable.other.property.jotl",
			]);
		}
		expect(scopesOf(src, "Foo")).toContain("entity.name.type.jotl");
		expect(scopesOf(src, "}", 1)).toContain("punctuation.definition.object.end.jotl");
		const lines =
			"A: {\n  a: Foo\n  b: string[maxLength: 3]\n  c(丙)\n  d: {\n    e: url\n  }\n  f: enum{ x }\n  g?: map\n}\n";
		for (const key of ["b", "c", "d", "e", "f", "g"]) {
			expect(scopesOf(lines, key), key).toContain("variable.other.property.jotl");
		}
	});

	it("元数据: 全部元数据键, x_* 与其他键", () => {
		for (const key of [...META_KEY_NAMES, "x_biz_code"]) {
			const src = `A: string[${key}: 1]`;
			expect(scopesOf(src, key), key).toEqual([
				"meta.metadata.jotl",
				"entity.other.attribute-name.metadata.jotl",
			]);
		}
		const src =
			"A: [layout: 'tabs'] {\n  a: string[maxLen: 3, props: {maxWidth: 750, 'k-v': true}]\n}";
		expect(scopesOf(src, "[")).toContain("punctuation.definition.metadata.begin.jotl");
		expect(scopesOf(src, "]")).toContain("punctuation.definition.metadata.end.jotl");
		expect(scopesOf(src, "maxLen")).not.toContain("entity.other.attribute-name.metadata.jotl");
		expect(scopesOf(src, "maxWidth")).toEqual(
			expect.arrayContaining(["meta.object.literal.jotl", "support.type.property-name.jotl"])
		);
		expect(scopesOf(src, "k-v")).toContain("support.type.property-name.jotl");
		expect(scopesOf(src, "{", 1)).toContain("punctuation.definition.dictionary.begin.jotl");
		expect(scopesOf(src, "a")).toContain("variable.other.property.jotl");
	});

	it("元数据中的 JSON5 值", () => {
		const src = String.raw`A: any[x_a: ['s', "d", 0x1F, +1, .5, -1.5e3, 10, true, false, null, [{k: 'v'}], Infinity, 'a\n\q\'']]`;
		for (const n of ["0x1F", "+1", ".5", "-1.5e3", "10"]) {
			expect(scopesOf(src, n), n).toContain("constant.numeric.jotl");
		}
		expect(scopesOf(src, "s")).toContain("string.quoted.single.jotl");
		expect(scopesOf(src, "d")).toContain("string.quoted.double.jotl");
		expect(scopesOf(src, "'")).toContain("punctuation.definition.string.begin.jotl");
		expect(scopesOf(src, "true")).toContain("constant.language.boolean.jotl");
		expect(scopesOf(src, "false")).toContain("constant.language.boolean.jotl");
		expect(scopesOf(src, "null")).toContain("constant.language.null.jotl");
		expect(scopesOf(src, "[", 1)).toEqual(
			expect.arrayContaining([
				"meta.array.literal.jotl",
				"punctuation.definition.array.begin.jotl",
			])
		);
		expect(scopesOf(src, "k")).toContain("support.type.property-name.jotl");
		expect(scopesOf(src, "v")).toEqual(
			expect.arrayContaining(["meta.object.literal.jotl", "string.quoted.single.jotl"])
		);
		expect(scopesOf(src, "Infinity")).toContain("invalid.illegal.number.jotl");
		expect(scopesOf(src, String.raw`\n`)).toContain("constant.character.escape.jotl");
		expect(scopesOf(src, String.raw`\'`)).toContain("constant.character.escape.jotl");
		expect(scopesOf(src, String.raw`\q`)).toContain(
			"invalid.illegal.unrecognized-string-escape.jotl"
		);
		// 跨行的元数据与行尾 `\` 续行的字符串.
		const multi = "A: [\n  description: 'a\\\n  b',\n  closed: true\n] {\n  x: string\n}";
		expect(scopesOf(multi, "  b")).toContain("string.quoted.single.jotl");
		expect(scopesOf(multi, "closed")).toContain("entity.other.attribute-name.metadata.jotl");
		expect(scopesOf(multi, "x")).toContain("variable.other.property.jotl");
		// 未闭合的字符串在行尾结束.
		const open = "A: [description: 'abc\n] {\n  y: string\n}";
		expect(scopesOf(open, "]")).toContain("punctuation.definition.metadata.end.jotl");
		expect(scopesOf(open, "y")).toContain("variable.other.property.jotl");
	});

	it("条件的 op 取值", () => {
		const src = fixtureSource("111-markers-conditions");
		for (const op of ["eq", "gte", "lt", "gt", "lte", "falsy", "in", "truthy"]) {
			expect(scopesOf(src, op), op).toEqual(
				expect.arrayContaining([
					"string.quoted.single.jotl",
					"support.constant.condition-operator.jotl",
				])
			);
		}
		for (const op of CONDITION_OPS) {
			expect(scopesOf(`A: string[root_if: {left: "a", op: "${op}"}]`, op), op).toContain(
				"support.constant.condition-operator.jotl"
			);
		}
		expect(scopesOf("A: string[x_a: {op: 'eqq'}]", "eqq")).not.toContain(
			"support.constant.condition-operator.jotl"
		);
	});

	it("体与枚举成员", () => {
		const src = fixtureSource("004-enum-labeled");
		expect(scopesOf(src, "light", 1)).toEqual([
			"meta.object.type.jotl",
			"meta.enum.jotl",
			"variable.other.enummember.jotl",
		]);
		expect(scopesOf(src, "浅色")).toContain("string.unquoted.label.jotl");
		expect(scopesOf(src, "1")).toEqual(
			expect.arrayContaining(["meta.enum.jotl", "constant.numeric.jotl"])
		);
		expect(scopesOf(src, "{", 1)).toContain("punctuation.definition.enum.begin.jotl");
		expect(scopesOf(src, "{")).toContain("punctuation.definition.object.begin.jotl");
		const ui = fixtureSource("013-x-ui-basic");
		expect(scopesOf(ui, "low")).toContain("variable.other.enummember.jotl");
		expect(scopesOf(ui, "description")).toEqual(
			expect.arrayContaining(["meta.enum.jotl", "entity.other.attribute-name.metadata.jotl"])
		);
		const consts = fixtureSource("017-const-literal");
		expect(scopesOf(consts, "true")).toContain("constant.language.boolean.jotl");
		expect(scopesOf(consts, "2")).toContain("constant.numeric.jotl");
		// 引用全局枚举的字段不进枚举体; union 分支的键是普通键.
		const union = fixtureSource("106-discriminated-union");
		expect(scopesOf(union, "text")).toContain("variable.other.property.jotl");
		expect(scopesOf(union, "TextBlock")).toContain("entity.name.type.jotl");
		expect(scopesOf(union, "divider")).toContain("variable.other.property.jotl");
	});

	it("组件, 元数据与体分行书写", () => {
		const src = [
			"A: object[closed: true]",
			"{",
			"  a: enum",
			"  { x y }",
			"  b: string",
			"    [maxLength: 3]",
			"  c: object",
			"  {",
			"    d: string",
			"  }",
			"  e: enum[multiple: true]",
			"  f: string",
			"}",
			"B: array[",
			"  array_item: 'string',",
			"  item_meta: {",
			"    widget: 'tag'",
			"  }",
			"]",
		].join("\n");
		expect(scopesOf(src, "{")).toEqual([
			"meta.object.type.jotl",
			"punctuation.definition.object.begin.jotl",
		]);
		expect(scopesOf(src, "x")).toEqual([
			"meta.object.type.jotl",
			"meta.enum.jotl",
			"variable.other.enummember.jotl",
		]);
		expect(scopesOf(src, "maxLength")).toContain("entity.other.attribute-name.metadata.jotl");
		expect(scopesOf(src, "d")).toEqual([
			"meta.object.type.jotl",
			"meta.object.type.jotl",
			"variable.other.property.jotl",
		]);
		for (const key of ["e", "f"])
			expect(scopesOf(src, key), key).toEqual([
				"meta.object.type.jotl",
				"variable.other.property.jotl",
			]);
		expect(scopesOf(src, "B")).toEqual(["entity.name.type.alias.jotl"]);
		expect(scopesOf(src, "widget")).toEqual([
			"meta.metadata.jotl",
			"meta.object.literal.jotl",
			"support.type.property-name.jotl",
		]);
		expect(scopesOf(src, "]", 3)).toEqual([
			"meta.metadata.jotl",
			"punctuation.definition.metadata.end.jotl",
		]);
	});

	it("类型串内细分名字与 `|`, 嵌套在 item_meta 中同样细分", () => {
		const src = `A: union[union_item: 'string | Link', item_meta: {Link: {array_item: "tuple"}}, description: 'string|Link']`;
		expect(scopesOf(src, "string")).toEqual(
			expect.arrayContaining([
				"meta.type-string.jotl",
				"string.quoted.single.jotl",
				"support.type.builtin.jotl",
			])
		);
		expect(scopesOf(src, "|")).toContain("punctuation.separator.type-union.jotl");
		expect(scopesOf(src, "Link")).toEqual(
			expect.arrayContaining(["meta.type-string.jotl", "entity.name.type.jotl"])
		);
		expect(scopesOf(src, "union_item")).toContain("entity.other.attribute-name.metadata.jotl");
		expect(scopesOf(src, "array_item")).toContain("support.type.property-name.jotl");
		expect(scopesOf(src, "tuple")).toEqual(
			expect.arrayContaining(["string.quoted.double.jotl", "support.type.builtin.jotl"])
		);
		expect(scopesOf(src, "string|Link")).toEqual([
			"meta.metadata.jotl",
			"string.quoted.single.jotl",
		]);
	});

	it("类型串内的 null 是非法名字, 不着色为类型名; nullable 等含 null 的名字不受影响", () => {
		const src = `A: union[union_item: 'string | null | nullable']`;
		expect(scopesOf(src, "null")).toEqual(
			expect.arrayContaining(["meta.type-string.jotl", "invalid.illegal.jotl"])
		);
		expect(scopesOf(src, "null")).not.toContain("entity.name.type.jotl");
		expect(scopesOf(src, "nullable")).toEqual(
			expect.arrayContaining(["meta.type-string.jotl", "entity.name.type.jotl"])
		);
	});

	it("v0 写法不再着色为关键字, 注解与 = 是非法字符", () => {
		const src =
			'export default type A = {\n  a(x): string @hidden = "x"\n  b: T[]\n  c: string | null\n}\nimport { B } from "./b.jotl"\n';
		const all = tokenize(src).flat();
		expect(
			all.some(t =>
				t.scopes.some(s => /^(?:keyword\.control\.(?!marker)|storage\.type)/.test(s))
			)
		).toBe(false);
		expect(scopesOf(src, "@")).toContain("invalid.illegal.character.jotl");
		expect(scopesOf(src, "=", 1)).toContain("invalid.illegal.character.jotl");
		expect(scopesOf(src, "|")).toContain("invalid.illegal.character.jotl");
		expect(scopesOf(src, "type")).toContain("entity.name.type.alias.jotl");
	});
});
