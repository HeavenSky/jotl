// 词法: 逐条覆盖 umo-edit-sdk `parse/schema.l` 的规则, 以及规则顺序带来的切分结果与词法错误.
import type { Diagnostic } from "@jotl/core";
import { describe, expect, it } from "vitest";
import { Lexer, type Token } from "../../../src/migrate/fengdie/lexer.js";
import { LineMap } from "../../../src/migrate/fengdie/line-map.js";
import { FILE, located } from "./helpers.js";

/** 读到 EOF 或词法错误为止; 记号写成 `KIND:value`. */
function lex(text: string): { tokens: string[]; error?: Diagnostic } {
  const lexer = new Lexer(text, new LineMap(text, FILE));
  const tokens: string[] = [];
  for (;;) {
    const next: Token | Diagnostic = lexer.next();
    if ("code" in next) return { tokens, error: next };
    if (next.kind === "EOF") return { tokens };
    tokens.push(`${next.kind}:${next.value}`);
  }
}

function tokensOf(text: string): string[] {
  const result = lex(text);
  expect(result.error).toBeUndefined();
  return result.tokens;
}

describe("schema.l 规则", () => {
  const rules: [rule: string, source: string, tokens: string[]][] = [
    ["Lottery", "Lottery", ["LOTTERY:Lottery"]],
    ["Array", "Array", ["ARRAY:Array"]],
    ["Object", "Object", ["OBJECT:Object"]],
    ["OpenAction", "OpenAction", ["OPEN_ACTION:OpenAction"]],
    ["Action", "Action", ["ACTION:Action"]],
    ["Enum", "Enum", ["ENUM:Enum"]],
    ["public", "public", ["PUBLIC:public"]],
    ["export", "export", ["EXPORT:export"]],
    ["Spm", "Spm", ["SPM:Spm"]],
    ["命名空间.组件[Array]", "ns.Comp[Array]", ["ARRAY:ns.Comp[Array]"]],
    ["命名空间.组件[Object]", "ns.Comp[Object]", ["OBJECT:ns.Comp[Object]"]],
    ["命名空间.组件", "ns.Comp", ["OBJECT:ns.Comp"]],
    ["ModuleArray", "ModuleArray", ["ARRAY:ModuleArray"]],
    ["Module", "Module", ["OBJECT:Module"]],
    [":", ":", ["COLON::"]],
    ["{ }", "{}", ["START:{", "END:}"]],
    ["<类型>", "Array<string>", ["ARRAY:Array", "TYPESTRING:string"]],
    ["[ 进入元数据模式", "[1", ["METASTART:[", "METAVALUE_NUMBER:1"]],
    ["] 退出元数据模式", "[a]1", ["METASTART:[", "VAR:a", "METAEND:]", "VAR:1"]],
    ["true|false", "true false", ["METAVALUE_BOOL:true", "METAVALUE_BOOL:false"]],
    ["负数在元数据内为数字", "[-1.5", ["METASTART:[", "METAVALUE_NUMBER:-1.5"]],
    ["负数在元数据外为名字", "-1", ["VAR:-1"]],
    ["名字可含 $ 与 -", "$a_b$c-d", ["VAR:$a_b$c-d"]],
    ["点号", "a.$b", ["VAR:a", "DOT:.", "VAR:$b"]],
    ["双引号字符串, 还原 \\\"", '"a\\"b"', ['METAVALUE_STRING:a"b']],
    ["(...) 说明, 不还原 \\)", "(标题 \\) 尾)", ["STRING:标题 \\) 尾"]],
    ["空白, 注释与逗号忽略", " \t\n/* 注释 */,a,", ["VAR:a"]],
  ];
  it.each(rules)("%s", (_rule, source, tokens) => {
    expect(tokensOf(source)).toEqual(tokens);
  });
});

describe("规则顺序与边界", () => {
  it("关键字后紧跟单词字符时是名字", () => {
    expect(tokensOf("Arrays Objective Actions Spmx Modules")).toEqual(["VAR:Arrays", "VAR:Objective", "VAR:Actions", "VAR:Spmx", "VAR:Modules"]);
  });

  it("关键字先于命名空间规则: `Array.x` 是 Array 加 `.x`", () => {
    expect(tokensOf("Array.x")).toEqual(["ARRAY:Array", "DOT:.", "VAR:x"]);
  });

  it("命名空间规则先于 Module: `Module.x` 整体是对象类型", () => {
    expect(tokensOf("Module.x")).toEqual(["OBJECT:Module.x"]);
  });

  it("命名空间规则没有单词边界: `a.b.c` 切成 `a.b` 与 `.c`", () => {
    expect(tokensOf("a.b.c")).toEqual(["OBJECT:a.b", "DOT:.", "VAR:c"]);
  });

  it("布尔值没有单词边界", () => {
    expect(tokensOf("trueName")).toEqual(["METAVALUE_BOOL:true", "VAR:Name"]);
  });
});

describe("词法错误", () => {
  it.each([
    ["无法识别的字符", "Object(a) { x(y) @ }", "JOTL8001"],
    ["块注释没有结束", "/* 注释", "JOTL8003"],
    ["字符串没有结束引号", '[a: "x', "JOTL8004"],
    ["说明没有右括号", "x(说明", "JOTL8005"],
  ])("%s", (_name, source, code) => {
    const { error } = lex(source);
    expect(error?.code).toBe(code);
  });

  it("位置指向出错处", () => {
    const { error } = lex("Object(a) {\n  x(y) @\n}");
    expect(located([error!])).toEqual([{ code: "JOTL8001", line: 2, column: 8 }]);
  });
});
