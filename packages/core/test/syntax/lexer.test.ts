// 词法(定稿 §1): 标识符, JSON5 字符串与数字, 标签, 标识记号, 注释, 空白与非法字符.
import { describe, expect, it } from "vitest";
import { scanToken } from "../../src/syntax/lexer.js";
import { parse } from "../../src/syntax/index.js";
import { FILE, compileField, located, parseCodes } from "./helpers.js";

function tokens(text: string): string[] {
  const out: string[] = [];
  let offset = 0;
  for (;;) {
    const { token } = scanToken(text, offset);
    if (token.kind === "eof") return out;
    out.push(`${token.kind}:${token.value ?? token.text}`);
    offset = token.end;
  }
}

describe("记号", () => {
  it("标识符含 Unicode, `$` `_` 与中间的 `-`", () => {
    expect(tokens("中文键 $a _b a-b-c ü")).toEqual(["ident:中文键", "ident:$a", "ident:_b", "ident:a-b-c", "ident:ü"]);
  });

  it("标点与 `*`", () => {
    expect(tokens("{}[],;:?*")).toEqual(["{:{", "}:}", "[:[", "]:]", ",:,", ";:;", ":::", "?:?", "*:*"]);
  });

  it("标识记号是整体记号", () => {
    expect(tokens("<root/> <default/>")).toEqual(["marker:root", "marker:default"]);
  });

  it("JSON5 数字: 正负号, 前导与末尾小数点, 十六进制, 指数", () => {
    expect(tokens("+1 -2 .5 5. 0x10 -0x1F 1e3")).toEqual([
      "number:1", "number:-2", "number:0.5", "number:5", "number:16", "number:-31", "number:1000",
    ]);
  });

  it("JSON5 字符串: 单双引号, 转义, 续行", () => {
    expect(tokens(`'a\\'b' "c\\"d" '\\x41\\u4e2d\\t\\v\\0' 'x\\\ny'`)).toEqual([
      "string:a'b", 'string:c"d', "string:A中\t\v\0", "string:xy",
    ]);
  });

  it("标签允许成对嵌套与转义, 去掉首尾空白", () => {
    expect(tokens("( 价格(元) ) (a\\)b) (\\(x)")).toEqual(["label:价格(元)", "label:a)b", "label:(x"]);
  });
});

describe("词法错误", () => {
  it("非法字符 `| < > . @ = #` 与未知 `<...>` 记号", () => {
    for (const ch of ["|", ">", ".", "@", "=", "#", "<x/>"]) {
      expect(parseCodes(`A: {\n  a ${ch}\n}`), ch).toContain("JOTL1001");
    }
  });

  it("未知转义报错, 保留反斜杠, 并给出改为 `\\\\` 的修复", () => {
    const result = parse("A: string[pattern: '\\d']", FILE);
    expect(located(result.diagnostics)).toEqual([{ code: "JOTL1022", line: 1, column: 21 }]);
    expect(result.diagnostics[0]!.fixes?.[0]?.edits[0]?.newText).toBe("\\\\");
    expect(result.value!.entries[0]!.meta!.members[0]!.value).toMatchObject({ value: "\\d" });
  });

  it("Infinity 与 NaN 报错; 数字后紧跟字母报错", () => {
    expect(parseCodes("A: number[minimum: Infinity]")).toEqual(["JOTL1023"]);
    expect(parseCodes("A: number[minimum: -NaN]")).toEqual(["JOTL1023"]);
    expect(parseCodes("A: number[minimum: 12px]")).toEqual(["JOTL1023"]);
  });

  it("未闭合的字符串, 块注释与标签; 空标签", () => {
    expect(parseCodes("A: string[default: 'x\n]")).toContain("JOTL1018");
    expect(parseCodes("A: string /* x")).toEqual(["JOTL1019"]);
    expect(parseCodes("A(标签: string")).toContain("JOTL1003");
    expect(parseCodes("A( ): string")).toEqual(["JOTL1026"]);
  });
});

describe("注释, 空白与位置", () => {
  it("`///` 是普通行注释, 编译时丢弃", () => {
    const ast = parse("/// 说明\nA: string // 行尾\n/* 块 */", FILE).value!;
    expect(ast.comments.map((c) => c.kind)).toEqual(["LineComment", "LineComment", "BlockComment"]);
    expect(compileField(": string /// x")).toEqual({ type: "string" });
  });

  it("U+2028 按空白, 不计行; BOM 忽略; 列按 UTF-16 计", () => {
    const result = parse("﻿A: {   x: string %\n}", FILE);
    expect(located(result.diagnostics)).toEqual([{ code: "JOTL1001", line: 1, column: 19 }]);
    const emoji = parse("A(😀): string %", FILE);
    expect(located(emoji.diagnostics)).toEqual([{ code: "JOTL1001", line: 1, column: 15 }]);
  });
});
