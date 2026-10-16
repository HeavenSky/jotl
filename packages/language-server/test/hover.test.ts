// 悬停(E4)的光标位置样例: 内置组件, 元数据键, 标识记号的说明, 类型名, 类型引用与字段键上的编译片段, 以及不应出卡片的位置.
import { COMPONENT_NAMES, META_KEY_NAMES, setLocale } from "@jotl/core";
import type { Hover, MarkupContent } from "vscode-languageserver";
import { describe, expect, it } from "vitest";
import { COMPONENT_DOCS, COMPONENT_DOCS_EN, MARKER_DOCS, MARKER_DOCS_EN, META_KEY_DOCS, META_KEY_DOCS_EN } from "../src/hover-docs.js";
import { getHover, type LanguageServiceOptions, MAX_FRAGMENT_LINES } from "../src/index.js";
import { URI, withCursor } from "./helpers.js";

function hover(source: string, options?: LanguageServiceOptions): Hover | null {
  const { text, position } = withCursor(source);
  return getHover(text, URI, position, options);
}

function markdown(source: string, options?: LanguageServiceOptions): string {
  const result = hover(source, options);
  if (result === null) throw new Error("没有悬停结果");
  return (result.contents as MarkupContent).value;
}

/** 取卡片中第一个 json 代码块并解析. */
function fragment(source: string): unknown {
  const match = /(`{3,})json\n([\s\S]*?)\n\1/.exec(markdown(source));
  if (match === null) throw new Error("卡片中没有 json 代码块");
  return JSON.parse(match[2]!);
}

describe("文案表覆盖全部名字", () => {
  it("内置组件与元数据键各有说明", () => {
    expect(Object.keys(COMPONENT_DOCS).sort()).toEqual([...COMPONENT_NAMES].sort());
    expect(Object.keys(META_KEY_DOCS).sort()).toEqual([...META_KEY_NAMES].sort());
  });

  it("英文表与中文表的键一致", () => {
    expect(Object.keys(COMPONENT_DOCS_EN).sort()).toEqual(Object.keys(COMPONENT_DOCS).sort());
    expect(Object.keys(META_KEY_DOCS_EN).sort()).toEqual(Object.keys(META_KEY_DOCS).sort());
    expect(Object.keys(MARKER_DOCS_EN).sort()).toEqual(Object.keys(MARKER_DOCS).sort());
  });

  it("英文下悬停卡片用英文文案", () => {
    setLocale("en");
    try {
      expect(markdown("A: { a: string[minLen‸gth: 1] }")).toContain("Applies to");
      expect(markdown("<ro‸ot/>\nA: string")).toContain("marks the following top-level type as the root");
    } finally {
      setLocale("zh-CN");
    }
  });

  it("文案不再提 semantic", () => {
    for (const doc of [...Object.values(COMPONENT_DOCS), ...Object.values(META_KEY_DOCS)]) expect(doc).not.toContain("semantic");
  });
});

describe("内置组件", () => {
  it("组件位置显示说明与编译结果", () => {
    const value = markdown("A: {\n  a: ima‸ge\n}");
    expect(value).toContain("内置组件 `image`");
    expect(value).toContain('"format": "uri"');
  });

  it.each(COMPONENT_NAMES.map((name) => [name]))("%s 有说明", (name) => {
    expect(markdown(`A: ${name}‸`)).toContain(`内置组件 \`${name}\``);
  });

  it("单独写编译不过的组件用完整写法探测编译结果", () => {
    expect(markdown("A: en‸um{ x y }")).toContain('"enum"');
    expect(markdown("A: uni‸on[union_item: 'number|string']")).toContain('"anyOf"');
  });

  it("类型串中的内置组件名", () => {
    expect(markdown("A: array[array_item: 'num‸ber']")).toContain("内置组件 `number`");
  });
});

describe("元数据键", () => {
  it("显示说明与适用组件", () => {
    const value = markdown("A: string[maxLe‸ngth: 3]");
    expect(value).toContain("元数据 `maxLength`");
    expect(value).toContain("适用于: `string`");
  });

  it("item_meta 内(直接写与按名字分键)与 variants 场景覆盖内的键", () => {
    expect(markdown("A: array[array_item: 'string', item_meta: {maxLe‸ngth: 3}]")).toContain("元数据 `maxLength`");
    expect(markdown("A: array[array_item: 'array', item_meta: {array_item: 'number', item_meta: {mini‸mum: 1}}]")).toContain("元数据 `minimum`");
    expect(markdown("A: union[union_item: 'number|string', item_meta: {string: {patt‸ern: 'x'}}]")).toContain("元数据 `pattern`");
    expect(markdown("A: string[variants: {m: {wid‸get: 'textarea'}}]")).toContain("元数据 `widget`");
    expect(hover("A: string[props: {wid‸get: 'x'}]")).toBeNull();
  });

  it("value_format 说明别名与适用的日期组件", () => {
    const value = markdown("A: datetime[value_fo‸rmat: 'utc']");
    expect(value).toContain("元数据 `value_format`");
    expect(value).toContain("`'utc-x'`");
    expect(value).toContain("适用于: `date` `time` `datetime`");
  });

  it("底层类型放行的约束键注明扩展组件", () => {
    expect(markdown("A: string[maxLe‸ngth: 3]")).toContain("及底层类型匹配的扩展组件");
    expect(markdown("A: string[desc‸ription: 'x']")).not.toContain("及底层类型匹配的扩展组件");
  });

  it("任意组件与只在根条目", () => {
    expect(markdown("A: string[desc‸ription: 'x']")).toContain("任意组件");
    expect(markdown("A: [i‸d: 'https://a.b/c'] { a: string }")).toContain("只能写在根条目上");
  });

  it("元数据值内的嵌套键不出卡片", () => {
    expect(hover("A: string[root_if: {le‸ft: 'a', op: 'truthy'}]")).toBeNull();
  });
});

describe("标识记号", () => {
  it("<root/> 与 <default/>", () => {
    expect(markdown("<ro‸ot/>\nA: string")).toContain("`<root/>`");
    expect(markdown("<default/>‸ A: string")).toContain("`<default/>`");
  });
});

describe("编译片段", () => {
  const source = "Home(首页): {\n  title(标题): string[maxLength: 20]\n  b: Banner\n}\nBanner(轮播): { img: image }";

  it("类型名显示 $defs 条目与标签", () => {
    const at = source.replace("Home", "Ho‸me");
    expect(markdown(at)).toContain("类型 `Home` 首页");
    expect(fragment(at)).toMatchObject({ title: "首页", type: "object", required: ["title", "b"] });
  });

  it("字段键显示该字段的 schema", () => {
    const at = source.replace("title(", "tit‸le(");
    expect(markdown(at)).toContain("字段 `title` 标题");
    expect(fragment(at)).toEqual({ title: "标题", type: "string", maxLength: 20 });
  });

  it("类型引用显示被引用类型的 $defs 条目", () => {
    const at = source.replace(": Banner", ": Ban‸ner");
    expect(markdown(at)).toContain("类型 `Banner` 轮播");
    expect(fragment(at)).toMatchObject({ title: "轮播", type: "object" });
  });

  it("文件有错误时提示修正后显示", () => {
    expect(markdown("A: {\n  ti‸tle: strng\n}")).toContain("文件存在错误");
  });

  it("片段过长时截断", () => {
    const fields = Array.from({ length: 40 }, (_, i) => `  f${i}: string`).join("\n");
    const value = markdown(`A‸: {\n${fields}\n}`);
    expect(value).toContain(`只显示前 ${MAX_FRAGMENT_LINES} 行`);
  });
});

describe("扩展组件", () => {
  it("已登记的大驼峰组件显示说明; 未登记且未声明时不出卡片", () => {
    expect(markdown("A: { a: Pic‸ker }", { registeredWidgets: ["Picker"] })).toContain("扩展组件 `Picker`");
    expect(hover("A: { a: Pic‸ker }")).toBeNull();
  });

  it("显示实际底层 schema: 配置登记, 只在设置中登记(string), 文件根 widgets 声明", () => {
    expect(markdown("A: { a: Pic‸ker }", { registeredWidgets: ["Picker"], widgets: { Picker: { type: "integer" } } })).toContain('"type": "integer"');
    expect(markdown("A: { a: Pic‸ker }", { registeredWidgets: ["Picker"] })).toContain('"type": "string"');
    const own = markdown("A: object[widgets: {Tags: {base: 'array', module: 'https://x'}}] {\n  a: Ta‸gs\n}", { registeredWidgets: ["Tags"] });
    expect(own).toContain("扩展组件 `Tags`");
    expect(own).toContain('"type": "array"');
  });
});

describe("不出卡片的位置", () => {
  it.each([
    ["注释内", "// A‸: string\nA: string"],
    ["标签内", "A(标‸签): string"],
    ["元数据字符串值内", "A: string[default: 'ab‸c']"],
    ["枚举成员", "A: enum{ lo‸w high }"],
    ["空白", "A: string ‸ "],
  ])("%s", (_name, source) => {
    expect(hover(source)).toBeNull();
  });
});
