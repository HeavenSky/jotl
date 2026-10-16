// 格式化: 规范排版, 幂等, 保留注释, 编译结果不变.
import { describe, expect, it } from "vitest";
import { listFixtures, readFixture, sortByKey } from "../../../../test-utils/fixtures.js";
import { compile, format, parse } from "../../src/syntax/index.js";
import { FILE, codes } from "./helpers.js";

function commentTexts(text: string): string[] {
  return parse(text, FILE).value!.comments.map((c) => (c.kind === "BlockComment" ? c.text.replace(/\r\n?/g, "\n") : c.text.trimEnd()));
}

/** 格式化无诊断, 幂等, 注释按原顺序全部保留, 编译结果与诊断代码不变; 返回格式化结果. */
function formatOk(source: string): string {
  const once = format(source, FILE);
  expect(once.diagnostics).toEqual([]);
  const text = once.value!;
  expect(format(text, FILE).value, text).toBe(text);
  expect(commentTexts(text)).toEqual(commentTexts(source));
  const before = compile(source, FILE);
  const after = compile(text, FILE);
  expect(codes(after.diagnostics)).toEqual(codes(before.diagnostics));
  expect(after.value?.schema).toEqual(before.value?.schema);
  return text;
}

describe("fixtures 格式化", () => {
  for (const name of listFixtures()) {
    const fixture = readFixture(name);
    if (fixture.source === undefined) continue;
    it(`${name}: 幂等且编译结果不变`, () => {
      const once = format(fixture.source!, FILE).value!;
      expect(format(once, FILE).value).toBe(once);
      const before = compile(fixture.source!, FILE);
      const after = compile(once, FILE);
      if (fixture.diagnostics !== undefined) {
        expect(sortByKey([...new Set(codes(after.diagnostics))])).toEqual(sortByKey([...new Set(codes(before.diagnostics))]));
      } else {
        expect(after.diagnostics).toEqual([]);
        expect(after.value!.schema).toEqual(before.value!.schema);
      }
    });
  }
});

describe("排版", () => {
  it("统一空白, 去掉分隔符, 条目一行一个, 顶层条目之间空一行, 标识独占一行", () => {
    const source = [
      "B  ( 标\\)签 ) : [ closed : true , ] { a : string , b ?: number [ minimum : 1 , maximum : 2 ] ; c }",
      "<root/> A:{x:map[map_item:'B'],y:enum{a,b(乙),'c d'}",
      "  z : array [ array_item : 'tuple' ] { 0 : string , * : number } }",
      "E: {}",
    ].join("\n");
    expect(formatOk(source)).toBe(
      [
        "B(标\\)签): [closed: true] {",
        "  a: string",
        "  b?: number[minimum: 1, maximum: 2]",
        "  c",
        "}",
        "",
        "<root/>",
        "A: {",
        "  x: map[map_item: 'B']",
        "  y: enum{ a b(乙) 'c d' }",
        "  z: array[array_item: 'tuple'] {",
        "    0: string",
        "    *: number",
        "  }",
        "}",
        "",
        "E: {}",
        "",
      ].join("\n"),
    );
  });

  it("字符串与数字保持原文; 体内的空行压成一个, 块首不留空行", () => {
    expect(formatOk('A: {\n\n  a: string[default: "x", maxLength: 0x10]\n\n\n  b: string\n}')).toBe(
      'A: {\n  a: string[default: "x", maxLength: 0x10]\n\n  b: string\n}\n',
    );
  });

  it("注释留在原来的两个记号之间; 独占一行的注释保持独占; 枚举内有注释时成员一行一个", () => {
    const source = "// 头\nA: { // 行尾\n  /* 前 */ a: string\n  b: enum{ x // 甲\n    y }\n} // 尾\n";
    expect(formatOk(source)).toBe("// 头\nA: { // 行尾\n  /* 前 */\n  a: string\n  b: enum{\n    x // 甲\n    y\n  }\n} // 尾\n");
  });

  it("有语法错误时原样返回", () => {
    const source = "A: { a string }";
    const result = format(source, FILE);
    expect(result.value).toBe(source);
    expect(codes(result.diagnostics)).toEqual(["JOTL1040"]);
  });

  it("诊断按源码位置排序, 与 parse 一致", () => {
    const source = "A: string[x: 01]\nB: #";
    const offsets = format(source, FILE).diagnostics.map((d) => (d.location?.kind === "source" ? d.location.range.start.offset : -1));
    expect(offsets.length).toBeGreaterThan(1);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(format(source, FILE).diagnostics).toEqual(parse(source, FILE).diagnostics);
  });
});
