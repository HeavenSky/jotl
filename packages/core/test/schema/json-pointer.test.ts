import { describe, expect, it } from "vitest";
import {
	appendPointer,
	escapePointerToken,
	evaluatePointer,
	fillWildcards,
	formatPointer,
	joinPointer,
	lookupPointer,
	matchPointer,
	parentPointer,
	parsePointer,
	tryParsePointer,
	unescapePointerToken,
} from "../../src/schema/index.js";

// RFC 6901 第 5 节的示例文档.
const doc = {
	foo: ["bar", "baz"],
	"": 0,
	"a/b": 1,
	"c%d": 2,
	"e^f": 3,
	"g|h": 4,
	"i\\j": 5,
	'k"l': 6,
	" ": 7,
	"m~n": 8,
};

describe("RFC 6901 第 5 节示例", () => {
	const cases: [string, unknown][] = [
		["", doc],
		["/foo", ["bar", "baz"]],
		["/foo/0", "bar"],
		["/", 0],
		["/a~1b", 1],
		["/c%d", 2],
		["/e^f", 3],
		["/g|h", 4],
		["/i\\j", 5],
		['/k"l', 6],
		["/ ", 7],
		["/m~0n", 8],
	];
	for (const [pointer, expected] of cases) {
		it(`求值 ${JSON.stringify(pointer)}`, () => {
			expect(evaluatePointer(doc, pointer)).toEqual({ value: expected, diagnostics: [] });
		});
	}
});

describe("转义", () => {
	it("~ 与 / 互不干扰", () => {
		expect(escapePointerToken("a~/b")).toBe("a~0~1b");
		expect(unescapePointerToken("~01")).toBe("~1");
		expect(unescapePointerToken(escapePointerToken("~1/~0"))).toBe("~1/~0");
	});
	it("格式化与解析互逆", () => {
		const tokens = ["a/b", "m~n", "", "0"];
		expect(tryParsePointer(formatPointer(tokens))).toEqual(tokens);
	});
});

describe("非法指针", () => {
	it("不以 / 开头", () => {
		const r = parsePointer("foo");
		expect(r.value).toBeUndefined();
		expect(r.diagnostics[0]?.code).toBe("JOTL0001");
	});
	it("非法转义", () => {
		expect(tryParsePointer("/a~2b")).toBeUndefined();
		expect(tryParsePointer("/a~")).toBeUndefined();
	});
	it("位置不存在", () => {
		expect(evaluatePointer(doc, "/missing").diagnostics[0]?.code).toBe("JOTL0002");
		expect(lookupPointer(doc, "/foo/2").found).toBe(false);
		expect(lookupPointer(doc, "/foo/01").found).toBe(false);
		expect(lookupPointer(doc, "/foo/-").found).toBe(false);
	});
});

describe("拼接", () => {
	it("appendPointer 转义片段", () => {
		expect(appendPointer("/properties", "a/b", 0)).toBe("/properties/a~1b/0");
	});
	it("joinPointer 接受已转义的相对路径", () => {
		expect(joinPointer("/banners", "0/img")).toBe("/banners/0/img");
		expect(joinPointer("", "img")).toBe("/img");
		expect(joinPointer("/a", "")).toBe("/a");
	});
	it("parentPointer", () => {
		expect(parentPointer("/a/b")).toBe("/a");
		expect(parentPointer("/a")).toBe("");
		expect(parentPointer("")).toBeUndefined();
	});
});

describe("通配匹配", () => {
	it("* 匹配任意单个片段", () => {
		expect(matchPointer("/banners/*/img", "/banners/3/img")).toBe(true);
		expect(matchPointer("/properties/*", "/properties/title")).toBe(true);
	});
	it("片段数不同或字面不同时不匹配", () => {
		expect(matchPointer("/banners/*", "/banners/3/img")).toBe(false);
		expect(matchPointer("/banners/*/img", "/banners/3/href")).toBe(false);
		expect(matchPointer("", "")).toBe(true);
	});
	it("fillWildcards 依次填入下标", () => {
		expect(fillWildcards("/a/*/b/*/c", [1, 2])).toBe("/a/1/b/2/c");
		expect(fillWildcards("/a/*/b/*", [1])).toBe("/a/1/b/*");
	});
});
