// 跳转定义, 查找引用与大纲(E5)的光标位置样例.
import { type DocumentSymbol, type Location, type Range, SymbolKind } from "vscode-languageserver";
import { describe, expect, it } from "vitest";
import { getDefinition, getDocumentSymbols, getReferences } from "../src/index.js";
import { URI, withCursor } from "./helpers.js";

/** 返回 needle 在 text 中第 nth 次出现(从 0 起)的单行范围. */
function rangeOf(text: string, needle: string, nth = 0): Range {
	let index = -1;
	for (let i = 0; i <= nth; i++) {
		index = text.indexOf(needle, index + 1);
		if (index < 0) throw new Error(`找不到第 ${nth} 个 ${needle}`);
	}
	const before = text.slice(0, index).split("\n");
	const line = before.length - 1;
	const character = before[line]!.length;
	return { start: { line, character }, end: { line, character: character + needle.length } };
}

function definition(source: string): Location[] {
	const { text, position } = withCursor(source);
	return getDefinition(text, URI, position);
}

function references(source: string, includeDeclaration: boolean): Range[] {
	const { text, position } = withCursor(source);
	return getReferences(text, URI, position, includeDeclaration).map(l => l.range);
}

const SAMPLE = [
	"Home: {",
	"  banner: Banner",
	"  list?: array[array_item: 'Banner', maxItems: 5]",
	"  map: map[map_item: 'Banner']",
	"  either: union[union_item: 'string | Banner']",
	"  // Banner 在注释里不算",
	"  note: string[default: 'Banner x']",
	"}",
	"Banner: { img: image }",
].join("\n");

/** 在 SAMPLE 中第 nth 个 needle 的第 offsetInNeedle 个字符处放光标. */
function at(needle: string, nth: number, offsetInNeedle = 1): string {
	const index = SAMPLE.split(needle, nth + 1).join(needle).length;
	return `${SAMPLE.slice(0, index + offsetInNeedle)}‸${SAMPLE.slice(index + offsetInNeedle)}`;
}

const DECLARATION = rangeOf(SAMPLE, "Banner", 6);

describe("跳转定义", () => {
	it.each([0, 1, 2, 3])("第 %i 处引用(组件位置与类型串)跳到声明", nth => {
		expect(definition(at("Banner", nth))).toEqual([{ uri: URI, range: DECLARATION }]);
	});

	it("声明名上返回自身", () => {
		expect(definition(at("Banner", 6))).toEqual([{ uri: URI, range: DECLARATION }]);
	});

	it("光标紧贴名字末尾也算", () => {
		expect(definition(at("Banner", 0, 6))).toEqual([{ uri: URI, range: DECLARATION }]);
	});

	it("注释, 普通字符串, 字段键与内置组件上没有结果", () => {
		expect(definition(at("Banner", 4))).toEqual([]);
		expect(definition(at("Banner", 5))).toEqual([]);
		expect(definition(at("banner", 0))).toEqual([]);
		expect(definition(at("image", 0))).toEqual([]);
	});

	it("未声明的类型没有结果", () => {
		expect(definition("A: { a: Mis‸sing }")).toEqual([]);
	});

	it("重复声明取第一个", () => {
		const text = "A: { a: B }\nB: string\nB: number";
		expect(definition("A: { a: ‸B }\nB: string\nB: number")).toEqual([
			{ uri: URI, range: rangeOf(text, "B", 1) },
		]);
	});
});

describe("查找引用", () => {
	const refs = [0, 1, 2, 3].map(n => rangeOf(SAMPLE, "Banner", n));

	it("从引用或声明出发, 返回全部引用", () => {
		expect(references(at("Banner", 0), false)).toEqual(refs);
		expect(references(at("Banner", 6), false)).toEqual(refs);
	});

	it("includeDeclaration 时连同声明", () => {
		expect(references(at("Banner", 2), true)).toEqual([...refs, DECLARATION]);
	});

	it("字段键上没有结果", () => {
		expect(references(at("banner", 0), true)).toEqual([]);
	});
});

describe("大纲", () => {
	it("每个顶层类型一项, 其下为字段, 枚举成员与分支", () => {
		const text = [
			"Home(首页): {",
			"  a(甲): string",
			"  nested: { b: number }",
			"  level: enum{ low(低) high }",
			"  block: union[discriminator: 'k'] { text: { c: string } }",
			"}",
			"Level: enum{ x y }",
			"Name: string",
		].join("\n");
		const symbols = getDocumentSymbols(text, URI);
		const shape = (s: DocumentSymbol): unknown => [
			s.name,
			s.kind,
			s.detail,
			s.children?.map(shape),
		];
		expect(symbols.map(shape)).toEqual([
			[
				"Home",
				SymbolKind.Struct,
				"首页",
				[
					["a", SymbolKind.Field, "甲", undefined],
					[
						"nested",
						SymbolKind.Field,
						undefined,
						[["b", SymbolKind.Field, undefined, undefined]],
					],
					[
						"level",
						SymbolKind.Field,
						undefined,
						[
							["low", SymbolKind.EnumMember, "低", undefined],
							["high", SymbolKind.EnumMember, undefined, undefined],
						],
					],
					[
						"block",
						SymbolKind.Field,
						undefined,
						[
							[
								"text",
								SymbolKind.Field,
								undefined,
								[["c", SymbolKind.Field, undefined, undefined]],
							],
						],
					],
				],
			],
			[
				"Level",
				SymbolKind.Enum,
				undefined,
				[
					["x", SymbolKind.EnumMember, undefined, undefined],
					["y", SymbolKind.EnumMember, undefined, undefined],
				],
			],
			["Name", SymbolKind.TypeParameter, undefined, undefined],
		]);
		expect(symbols[0]!.selectionRange).toEqual(rangeOf(text, "Home"));
	});

	it("selectionRange 总在 range 内; 不完整源码不抛异常", () => {
		for (const text of ["A: {", "A: { a", "<root/>", "A: string[", ""]) {
			for (const symbol of getDocumentSymbols(text, URI)) {
				const { range, selectionRange } = symbol;
				expect(range.start.line <= selectionRange.start.line).toBe(true);
			}
		}
	});
});
