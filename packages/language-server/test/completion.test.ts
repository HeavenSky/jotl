// 补全(E3)的光标位置样例: 组件名, 元数据键, widget 取值, 条件 op, 类型串, 标识记号, 以及不完整源码与非补全位置.
import { COMPONENT_NAMES, CONDITION_OPS } from "@jotl/core";
import type { CompletionItem, TextEdit } from "vscode-languageserver";
import { describe, expect, it } from "vitest";
import { getCompletions, type LanguageServiceOptions } from "../src/index.js";
import { withCursor } from "./helpers.js";

function complete(source: string, options?: LanguageServiceOptions): CompletionItem[] {
  const { text, position } = withCursor(source);
  return getCompletions(text, position, options);
}

function labels(source: string, options?: LanguageServiceOptions): string[] {
  return complete(source, options).map((item) => item.label);
}

function edit(items: CompletionItem[], label: string): TextEdit {
  const found = items.find((item) => item.label === label);
  if (found === undefined) throw new Error(`缺少补全项 ${label}`);
  return found.textEdit as TextEdit;
}

describe("组件位置补内置组件, 本文件类型与扩展组件", () => {
  it("字段的 `:` 之后: 内置组件与全部顶层类型(含光标之后声明的)", () => {
    const result = labels("Home: {\n  a: ‸\n}\nBanner: { img: image }\nTag: string");
    expect(result).toEqual([...COMPONENT_NAMES, "Home", "Banner", "Tag"]);
  });

  it("顶层条目的 `:` 之后", () => {
    expect(labels("A: ‸")).toContain("object");
  });

  it("可选字段与带标签字段; 标签里的 `:` `(` 不影响判定", () => {
    expect(labels("A: {\n  title(标题: (主))?: ‸\n}")).toContain("string");
  });

  it("前面字段带元数据, 枚举, 注释与对象值时", () => {
    const source = [
      "A: {",
      "  a: string[props: {style: {k: [1, 2]}}, default: 'x:y']",
      "  b: enum{ low(低) high }",
      "  /* c: */ c: string[maxLength: 3], // d:",
      "  'e-f'?: number",
      "  g: ‸",
      "}",
    ].join("\n");
    expect(labels(source)).toContain("string");
  });

  it("已登记的大驼峰扩展组件", () => {
    expect(labels("A: { a: ‸ }", { registeredWidgets: ["ImagePicker", "fancy"] })).toEqual([...COMPONENT_NAMES, "A", "ImagePicker"]);
  });

  it("根元数据 `widgets` 声明的名字: 大驼峰名作组件, 全部名字作 widget 候选", () => {
    const head = "A: object[widgets: {ImagePicker: {base: 'string', module: 'https://x'}, rating: {module: 'https://y'}}] {\n";
    expect(labels(`${head}  a: ‸\n}`)).toEqual([...COMPONENT_NAMES, "A", "ImagePicker"]);
    expect(labels(`${head}  a: string[widget: '‸']\n}`)).toContain("rating");
  });

  it("已输入部分名字时替换范围覆盖该部分", () => {
    const items = complete("A: {\n  title: str‸\n}");
    expect(edit(items, "string")).toEqual({
      range: { start: { line: 1, character: 9 }, end: { line: 1, character: 12 } },
      newText: "string",
    });
  });

  it("CRLF 换行下位置正确", () => {
    const items = complete("A: {\r\n  a: s‸\r\n}");
    expect(edit(items, "string").range).toEqual({ start: { line: 1, character: 5 }, end: { line: 1, character: 6 } });
  });

  it("不完整源码: 未闭合的体与后续残缺条目不影响补全", () => {
    expect(labels("Banner: { img: image }\nA: {\n  a: string[maxLength: 3]\n  b: Ba‸\n  c: \nB")).toEqual(
      expect.arrayContaining(["string", "Banner", "A"]),
    );
  });
});

describe("元数据键按组件过滤", () => {
  it("string: 字符串类与通用键, 没有数值与对象键", () => {
    const result = labels("A: { a: string[‸] }");
    expect(result).toEqual(expect.arrayContaining(["description", "default", "minLength", "maxLength", "pattern", "widget", "root_if"]));
    for (const key of ["minimum", "closed", "array_item", "rules", "id"]) expect(result).not.toContain(key);
  });

  it("扩展组件按底层类型补约束键: 配置, 文件内声明, 只在设置中登记的按 string", () => {
    const fromConfig = labels("A: { a: Rating[‸] }", { registeredWidgets: ["Rating"], widgets: { Rating: { type: "integer" } } });
    expect(fromConfig).toEqual(expect.arrayContaining(["minimum", "maximum", "description"]));
    expect(fromConfig).not.toContain("minLength");
    const head = "A: object[widgets: {Tags: {base: 'array', module: 'https://x'}}] {\n";
    const own = labels(`${head}  a: Tags[‸]\n}`);
    expect(own).toEqual(expect.arrayContaining(["minItems", "maxItems", "uniqueItems"]));
    expect(own).not.toContain("minimum");
    expect(labels("A: { a: Picker[‸] }", { registeredWidgets: ["Picker"] })).toEqual(expect.arrayContaining(["minLength", "pattern"]));
  });

  it("已写过的键不再给出", () => {
    expect(labels("A: { a: number[minimum: 1, ‸] }")).not.toContain("minimum");
    expect(labels("A: { a: number[minimum: 1, ‸] }")).toContain("maximum");
  });

  it.each([
    ["money", ["currency", "unit", "decimals", "thousands"]],
    ["array", ["array_item", "item_meta", "minItems"]],
    ["map", ["map_item", "key_meta", "minProperties"]],
    ["union", ["discriminator", "union_item"]],
    ["enum", ["multiple", "minItems"]],
    ["jsontext", ["json_item"]],
    ["object", ["closed", "order", "groups", "layout", "columns", "summary"]],
  ])("%s", (component, keys) => {
    expect(labels(`A: { a: ${component}[‸ }`)).toEqual(expect.arrayContaining(keys));
  });

  it("引用类型只给不改变结构的键", () => {
    const result = labels("A: { a: B[‸] }\nB: { x: string }");
    expect(result).toEqual(expect.arrayContaining(["default", "nullable", "widget", "summary", "multiple"]));
    for (const key of ["closed", "minLength", "examples"]) expect(result).not.toContain(key);
  });

  it("省略组件时给 string 与 object 两者的键", () => {
    const result = labels("A: { a: [‸ }");
    expect(result).toEqual(expect.arrayContaining(["maxLength", "closed", "layout"]));
  });

  it("只在根条目的 rules 与 id 只在顶层条目给出", () => {
    expect(labels("A: [‸")).toEqual(expect.arrayContaining(["rules", "id"]));
    expect(labels("A: { a: [‸ }")).not.toContain("id");
  });

  it("枚举成员的元数据只给 description", () => {
    expect(labels("A: enum{ a(甲)[‸ }")).toEqual(["description"]);
  });

  it("正在输入键名时替换范围覆盖已输入部分", () => {
    const items = complete("A: {\n  title: string[max‸\n  b: number\n}");
    expect(edit(items, "maxLength").range).toEqual({ start: { line: 1, character: 16 }, end: { line: 1, character: 19 } });
  });

  it("元数据值位置不补键名", () => {
    expect(labels("A: string[maxLength: ‸")).toEqual([]);
    expect(labels("A: string[pattern: 'a‸")).toEqual([]);
    expect(labels("A: string[props: {a: ‸")).toEqual([]);
  });
});

describe("widget 与 decorator 取值", () => {
  it("引号内给该组件的候选, 插入时不带引号", () => {
    const items = complete("A: { a: string[widget: '‸'] }");
    expect(items.map((i) => i.label)).toEqual(["input", "textarea", "password", "richtext", "output", "json"]);
    expect(edit(items, "textarea").newText).toBe("textarea");
  });

  it.each([
    ["boolean", ["switch", "checkbox", "output", "json"]],
    ["object", ["page", "inline", "output", "json"]],
    ["array", ["list", "output", "json"]],
    ["map", ["kv", "output", "json"]],
    ["image", ["image", "input", "textarea", "password", "richtext", "url", "file", "output", "json"]],
    ["jsontext", ["json", "input", "textarea", "password", "richtext", "output"]],
  ])("%s", (component, expected) => {
    expect(labels(`A: { a: ${component}[widget: '‸`)).toEqual(expected);
  });

  it("还没写引号时插入带引号的组件名", () => {
    const items = complete("A: { a: number[widget: ‸");
    expect(edit(items, "range").newText).toBe("'range'");
  });

  it("已登记的组件名追加在候选之后, 与内置重名的去掉", () => {
    expect(labels("A: string[widget: \"‸\"]", { registeredWidgets: ["tag-list", "select"] })).toEqual(["input", "textarea", "password", "richtext", "output", "json", "tag-list"]);
  });

  it("组件名含 `-` 时替换范围仍从引号之后开始", () => {
    const items = complete("A: string[widget: 'tag-l‸']", { registeredWidgets: ["tag-list"] });
    expect(edit(items, "tag-list").range.start.character).toBe(19);
  });

  it("decorator 只补外壳组件与已登记名", () => {
    expect(labels("A: string[decorator: '‸", { registeredWidgets: ["card"] })).toEqual(["field", "card"]);
  });

  it("其他键的字符串值不补", () => {
    expect(labels("A: string[description: '‸")).toEqual([]);
    expect(labels("A: string[props: {widget: '‸")).toEqual([]);
  });
});

describe("value_format 取值", () => {
  it("按组件给常用格式, 时间戳(time 除外)与 4 个别名", () => {
    expect(labels("A: { a: date[value_format: '‸'] }")).toEqual(["YYYY-MM-DD", "YYYYMMDD", "YYYY/MM/DD", "x", "X", "iso", "iso-x", "utc", "utc-x"]);
    expect(labels("A: { a: time[value_format: '‸'] }")).toEqual(["HH:mm:ss", "HH:mm", "HH:mm:ssZ", "iso", "iso-x", "utc", "utc-x"]);
    expect(labels("A: { a: datetime[value_format: ‸")).toContain("utc-x");
    expect(edit(complete("A: { a: datetime[value_format: ‸"), "utc").newText).toBe("'utc'");
  });

  it("其他组件不给 value_format 键", () => {
    expect(labels("A: { a: string[‸] }")).not.toContain("value_format");
    expect(labels("A: { a: datetime[‸] }")).toContain("value_format");
  });
});

describe("条件 op", () => {
  it("root_if / node_if 叶子的 op 取值", () => {
    expect(labels("A: { a: string[root_if: {left: 'b', op: '‸'}] }")).toEqual([...CONDITION_OPS]);
    expect(labels("A: { a: string[node_if: {and: [{left: 'b', op: ‸")).toEqual([...CONDITION_OPS]);
    expect(edit(complete("A: string[node_if: {left: 'b', op: ‸"), "eq").newText).toBe("'eq'");
  });

  it("条件之外的 op 键不补", () => {
    expect(labels("A: string[props: {op: '‸")).toEqual([]);
  });
});

describe("类型串", () => {
  it("引号内给内置组件(除 enum)与本文件类型; 替换最后一个 `|` 之后的名字", () => {
    const items = complete("A: { a: union[union_item: 'string| Ba‸'] }\nBanner: { x: string }");
    expect(items.map((i) => i.label)).toEqual([...COMPONENT_NAMES.filter((n) => n !== "enum"), "A", "Banner"]);
    expect(edit(items, "Banner").range.start.character).toBe(35);
  });
});

describe("标识记号", () => {
  it("文件开头与顶层条目之间", () => {
    expect(labels("‸")).toEqual(["<root/>", "<default/>"]);
    expect(labels("A: string\n‸")).toEqual(["<root/>", "<default/>"]);
  });

  it("输入 `<` 后替换范围包含 `<`", () => {
    const items = complete("A: string\n<ro‸");
    expect(edit(items, "<root/>").range).toEqual({ start: { line: 1, character: 0 }, end: { line: 1, character: 3 } });
  });

  it("体内不补", () => {
    expect(labels("A: {\n  <‸\n}")).toEqual([]);
  });
});

describe("item_meta 与 variants 内的补全", () => {
  it("variants 场景覆盖补 x-ui 字段名, 条件写 root_if / node_if, 已写过的不再给出", () => {
    const result = labels("A: { a: string[variants: {mobile: {widget: 'textarea', ‸}}] }");
    expect(result).toEqual(expect.arrayContaining(["props", "decorator", "order", "hidden", "summary", "root_if", "node_if"]));
    for (const key of ["widget", "visibleIf", "variants", "maxLength"]) expect(result).not.toContain(key);
  });

  it("场景覆盖的 widget 按所属组件补组件名, decorator 补外壳", () => {
    expect(labels("A: { a: boolean[variants: {m: {widget: '‸'}}] }")).toEqual(["switch", "checkbox", "output", "json"]);
    expect(labels("A: { a: string[variants: {m: {decorator: '‸'}}] }")).toEqual(["field"]);
    expect(labels("A: { a: string[variants: {m: {props: {‸}}}] }")).toEqual([]);
  });

  it("场景覆盖的条件取值补 op", () => {
    expect(labels("A: { a: string[variants: {m: {root_if: {path: '/x', op: '‸'}}}] }")).toEqual([...CONDITION_OPS]);
  });

  it("直接写的 item_meta 按类型串中的组件补元数据键与 widget", () => {
    const result = labels("A: { a: array[array_item: 'number', item_meta: {‸}] }");
    expect(result).toEqual(expect.arrayContaining(["minimum", "decimals", "widget"]));
    for (const key of ["minLength", "id", "rules"]) expect(result).not.toContain(key);
    expect(labels("A: { a: array[array_item: 'boolean', item_meta: {widget: '‸'}] }")).toEqual(["switch", "checkbox", "output", "json"]);
  });

  it("没有类型串时 item_meta 是元素对象的元数据; 嵌套的 item_meta 逐层判定", () => {
    expect(labels("A: { a: array[item_meta: {‸}] { x: string } }")).toEqual(expect.arrayContaining(["closed", "order"]));
    const nestedKeys = labels("A: { a: array[array_item: 'array', item_meta: {array_item: 'string', item_meta: {‸}}] }");
    expect(nestedKeys).toEqual(expect.arrayContaining(["minLength", "pattern"]));
    expect(nestedKeys).not.toContain("minimum");
  });

  it("按名字分键的 item_meta: 键补类型串中的名字, 各分支内按该名字补元数据键", () => {
    expect(labels("A: { a: union[union_item: 'number|string', item_meta: {string: {}, ‸}] }")).toEqual(["number"]);
    const result = labels("A: { a: union[union_item: 'number|string', item_meta: {string: {‸}}] }");
    expect(result).toEqual(expect.arrayContaining(["pattern", "minLength"]));
    expect(result).not.toContain("minimum");
  });
});

describe("非补全位置返回空", () => {
  it.each([
    ["字段名位置", "A: {\n  ‸\n}"],
    ["正在输入顶层类型名", "Ho‸"],
    ["行注释内", "A: { a: string } // a: ‸"],
    ["块注释内", "/* A: ‸"],
    ["标签内", "A: {\n  a(标签 ‸"],
    ["枚举成员位置", "A: enum{ ‸"],
    ["组件之后", "A: string ‸"],
  ])("%s", (_name, source) => {
    expect(labels(source)).toEqual([]);
  });

  it("光标之后的内容不影响判定", () => {
    expect(labels("A: {\n  a: ‸string[maxLength: 3]\n}")).toContain("string");
  });
});
