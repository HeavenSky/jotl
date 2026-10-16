// 预览代码着色: 片段拼回原文, JSON 的键与值, TS 的关键字, 类型名, 成员名与注释各归其类.
import { describe, expect, it } from "vitest";
import { highlight, type Token } from "../src/webview/highlight.js";

function kinds(tokens: Token[]): [string, string][] {
  return tokens.filter((t) => t.kind !== "plain").map((t) => [t.kind, t.text]);
}

describe("代码着色", () => {
  it("JSON: 键是 property, 值按字符串, 数字与字面量区分", () => {
    const code = '{\n  "type": "integer",\n  "minimum": -9007199254740991,\n  "x": true, "y": null\n}';
    const tokens = highlight(code, "json");
    expect(tokens.map((t) => t.text).join("")).toBe(code);
    expect(kinds(tokens)).toEqual([
      ["property", '"type"'],
      ["string", '"integer"'],
      ["property", '"minimum"'],
      ["number", "-9007199254740991"],
      ["property", '"x"'],
      ["literal", "true"],
      ["property", '"y"'],
      ["literal", "null"],
    ]);
  });

  it("TS: 注释, 关键字, 类型名, 可选成员与字符串联合", () => {
    const code = '// 生成\n/** @title 站点 */\nexport interface Site {\n  count?: number;\n  mode: "a" | "b";\n}\nexport default Site;\n';
    const tokens = highlight(code, "typescript");
    expect(tokens.map((t) => t.text).join("")).toBe(code);
    expect(kinds(tokens)).toEqual([
      ["comment", "// 生成"],
      ["comment", "/** "],
      ["doctag", "@title"],
      ["comment", " 站点 */"],
      ["keyword", "export"],
      ["keyword", "interface"],
      ["type", "Site"],
      ["property", "count"],
      ["type", "number"],
      ["property", "mode"],
      ["string", '"a"'],
      ["string", '"b"'],
      ["keyword", "export"],
      ["keyword", "default"],
      ["type", "Site"],
    ]);
  });

  it("TS 文档注释: 标签名与标签后的值着色, 描述文字中的数字保持注释色", () => {
    const code = '/**\n * 共 2 项\n * @defaultValue "hi"\n * @minimum -9007199254740991\n * @deprecated true\n */\nx: string;';
    const tokens = highlight(code, "typescript");
    expect(tokens.map((t) => t.text).join("")).toBe(code);
    expect(kinds(tokens)).toEqual([
      ["comment", "/**\n * 共 2 项\n * "],
      ["doctag", "@defaultValue"],
      ["comment", " "],
      ["string", '"hi"'],
      ["comment", "\n * "],
      ["doctag", "@minimum"],
      ["comment", " "],
      ["number", "-9007199254740991"],
      ["comment", "\n * "],
      ["doctag", "@deprecated"],
      ["comment", " "],
      ["literal", "true"],
      ["comment", "\n */"],
      ["property", "x"],
      ["type", "string"],
    ]);
  });

  it("行注释与 JSON 不切文档标签", () => {
    expect(kinds(highlight("// @title x\n", "typescript"))).toEqual([["comment", "// @title x"]]);
    expect(kinds(highlight('"@title"', "json"))).toEqual([["string", '"@title"']]);
  });

  it("未闭合的字符串与注释不卡死, 原文保留", () => {
    for (const code of ['"abc', "/* x", "`t"]) expect(highlight(code, "typescript").map((t) => t.text).join("")).toBe(code);
  });
});
