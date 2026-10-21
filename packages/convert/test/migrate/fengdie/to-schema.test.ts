// umo JSON → JSON Schema 2020-12: 映射表每一行与元数据表每一类至少一例, 每例都核对 Jotl 往返一致.
import type { JsonSchemaObject } from "@jotl/core";
import { describe, expect, it } from "vitest";
import { migrateFengdie, umoJsonToSchema } from "../../../src/migrate/index.js";
import { FILE, codes, field, located, roundTrip } from "./helpers.js";

const STR: JsonSchemaObject = { type: "string" };
const NUM: JsonSchemaObject = { type: "number" };

describe("映射表: 叶子类型", () => {
  it.each<[string, string, JsonSchemaObject]>([
    ["省略类型为 string", "", { title: "X", type: "string" }],
    ["String", ": String", { title: "X", type: "string" }],
    ["Text", ": Text", { title: "X", type: "string", "x-ui": { widget: "textarea" } }],
    ["RichText", ": RichText", { title: "X", type: "string", contentMediaType: "text/html" }],
    ["URL", ": URL", { title: "X", type: "string", format: "uri" }],
    ["Color", ": Color", { title: "X", type: "string", format: "color" }],
    ["File", ": File", { title: "X", type: "string", format: "uri", "x-ui": { widget: "file" } }],
    ["Boolean", ": Boolean", { title: "X", type: "boolean" }],
    ["Number", ": Number", { title: "X", type: "number" }],
    ["Date 为毫秒时间戳的日期时间", ": Date", { title: "X", type: "integer", minimum: -Number.MAX_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER, "x-valueFormat": "x", "x-ui": { widget: "datetime" } }],
    ["Component 为实例 id", ": Component", { title: "X", type: "string", "x-fengdie": { type: "component" } }],
  ])("%s", (_name, typeAndMeta, expected) => {
    const { x, diagnostics } = field(typeAndMeta);
    expect(x).toStrictEqual(expected);
    expect(diagnostics).toEqual([]);
  });

  it("Date 打印为 datetime[value_format: 'x']", () => {
    expect(field(`: Date[default: 1700000000000]`).jotl).toContain("x(X)?: datetime[value_format: 'x', default: 1700000000000]");
  });

  it("Image 的尺寸类元数据进入 x-ui.props", () => {
    const { x, jotl } = field(`: Image[width: 590, height: 250, maxWidth: 750, maxHeight: 300, aspectRatio: "16:9", maxSize: 1024, setDefaultColorTo: "bg"]`);
    expect(x).toStrictEqual({
      title: "X",
      type: "string",
      format: "uri",
      "x-ui": { widget: "image", props: { width: 590, height: 250, maxWidth: 750, maxHeight: 300, aspectRatio: "16:9", maxSize: 1024, setDefaultColorTo: "bg" } },
    });
    expect(jotl).toContain("x(X)?: image[props: {");
  });

  it("Number 的 min max step(含负数)", () => {
    expect(field(`: Number[min: -10, max: 10, step: 0.5]`).x).toStrictEqual({ title: "X", type: "number", minimum: -10, maximum: 10, "x-ui": { props: { step: 0.5 } } });
  });

  it("未知类型名(umo JSON 输入)退回 string 并报 JOTL8111", () => {
    const result = umoJsonToSchema({ type: "object", description: "根", properties: { x: { key: "x", type: "foo", description: "X" } } });
    expect(result.value!.$defs!.Root).toMatchObject({ properties: { x: { type: "string" } } });
    expect(codes(result.diagnostics)).toEqual(["JOTL8111"]);
    expect(result.diagnostics[0]!.location).toEqual({ kind: "pointer", pointer: "/properties/x" });
  });
});

describe("映射表: 枚举", () => {
  it("带说明为 oneOf, 2-5 项单选写 radio", () => {
    expect(field(`: Enum { a(甲) b(乙) }`).x).toStrictEqual({
      title: "X",
      type: "string",
      oneOf: [{ const: "a", title: "甲" }, { const: "b", title: "乙" }],
      "x-ui": { widget: "radio" },
    });
  });

  it("超过 5 项且无说明为 enum, 保持下拉", () => {
    expect(field(`: Enum { a() b() c() d() e() f() }`).x).toStrictEqual({ title: "X", type: "string", enum: ["a", "b", "c", "d", "e", "f"] });
  });

  it("multiple 为多选数组, 写 checkbox; 标量默认值转为数组(JOTL8107)", () => {
    const { x, diagnostics } = field(`: Enum[multiple: true, default: "0"] { 0(仅弹窗) 1(弹窗+跳转) }`);
    expect(x).toStrictEqual({
      title: "X",
      type: "array",
      items: { type: "string", oneOf: [{ const: "0", title: "仅弹窗" }, { const: "1", title: "弹窗+跳转" }] },
      uniqueItems: true,
      default: ["0"],
      "x-ui": { widget: "checkbox" },
    });
    expect(codes(diagnostics)).toEqual(["JOTL8107"]);
  });

  it("无成员的枚举迁移为字符串(JOTL8114), source 进入 x-fengdie", () => {
    const { x, diagnostics } = field(`: Enum[source: "api"]`);
    expect(x).toStrictEqual({ title: "X", type: "string", "x-fengdie": { source: "api" } });
    expect(codes(diagnostics)).toEqual(["JOTL8114"]);
  });

  it("重复的枚举值保留第一个(JOTL8113)", () => {
    const { x, diagnostics } = field(`: Enum { a(甲) a(乙) b(丙) }`);
    expect(x).toMatchObject({ oneOf: [{ const: "a", title: "甲" }, { const: "b", title: "丙" }] });
    expect(codes(diagnostics)).toEqual(["JOTL8113"]);
  });
});

describe("映射表: 数组与对象", () => {
  it("Array<string> / Array<number> 为元素数组, 允许为空", () => {
    expect(field(`: Array<string>`).x).toStrictEqual({ title: "X", type: "array", items: { type: "string" } });
    expect(field(`: Array<number>`).x).toStrictEqual({ title: "X", type: "array", items: { type: "number" } });
  });

  it("Object 与空对象", () => {
    expect(field(`: Object { a(A) }`).x).toStrictEqual({ title: "X", type: "object", properties: { a: { title: "A", type: "string" } } });
    expect(field(`: Object {}`).x).toStrictEqual({ title: "X", type: "object" });
  });

  it("Action / OpenAction 为对象, 类型名记入 x-fengdie", () => {
    expect(field(`: Action { u(U): URL }`).x).toStrictEqual({
      title: "X",
      type: "object",
      properties: { u: { title: "U", type: "string", format: "uri" } },
      "x-fengdie": { type: "action" },
    });
    expect(field(`: OpenAction {}`).x).toStrictEqual({ title: "X", type: "object", "x-fengdie": { type: "openAction" } });
  });

  it("Array: properties 改为 items, minLength / maxLength → minItems / maxItems, showKey → summary", () => {
    expect(field(`: Array[minLength: 2, maxLength: 5, showKey: "a"] { a(A) }`).x).toStrictEqual({
      title: "X",
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "object", properties: { a: { title: "A", type: "string" } } },
      "x-ui": { summary: "a" },
    });
  });

  it("showKey 不是元素字段时丢弃(JOTL8106)", () => {
    const { x, diagnostics } = field(`: Array[showKey: "zz"] { a(A) }`);
    expect(x).not.toHaveProperty("x-ui");
    expect(codes(diagnostics)).toEqual(["JOTL8106"]);
  });

  it("Module / ModuleArray: 模块信息记入 x-fengdie, 不报警告", () => {
    const m = field(`: Module[namespace: "ns", component: "C", version: "1.0.0", url: "https://a.com/x.js"] { t(T) }`);
    expect(m.x).toStrictEqual({
      title: "X",
      type: "object",
      properties: { t: { title: "T", type: "string" } },
      "x-fengdie": { type: "module", namespace: "ns", component: "C", version: "1.0.0", url: "https://a.com/x.js", dist: "https://alipay.com" },
    });
    expect(m.diagnostics).toEqual([]);
    expect(field(`: ModuleArray[namespace: "ns"] { t(T) }`).x).toMatchObject({
      type: "array",
      items: { type: "object" },
      "x-fengdie": { type: "modulearray", namespace: "ns" },
    });
  });

  it("命名空间.组件 为对象, [Array] 为对象数组, 原类型名记入 x-fengdie", () => {
    expect(field(`: ns.Comp { t(T) }`).x).toMatchObject({ type: "object", "x-fengdie": { type: "ns.Comp" } });
    expect(field(`: ns.Comp[Array] { t(T) }`).x).toMatchObject({ type: "array", items: { type: "object" }, "x-fengdie": { type: "ns.Comp[Array]" } });
  });

  it("Spm 为 spma spmb spmc 三个字符串", () => {
    expect(field(`: Spm`).x).toStrictEqual({
      title: "X",
      type: "object",
      properties: {
        spma: { title: "a位", type: "string" },
        spmb: { title: "b位", type: "string" },
        spmc: { title: "c位", type: "string" },
      },
      "x-fengdie": { type: "spm" },
    });
  });
});

describe("映射表: 按 mock 数据形态的对象", () => {
  it.each<[string, Record<string, JsonSchemaObject>]>([
    ["Box", { left: NUM, top: NUM, width: NUM, height: NUM }],
    ["Plugin", { id: STR, pluginId: STR, originId: STR, data: {} }],
    ["Animation", { type: STR, src: STR, width: NUM, height: NUM, downgradeUrl: STR, size: STR }],
    [
      "Video",
      { assetId: STR, assetUrl: STR, format: STR, type: STR, assetType: STR, materialSource: STR, fileSize: NUM, size: STR, url: STR, downgradeUrl: STR },
    ],
  ])("%s", (type, properties) => {
    expect(field(`: ${type}`).x).toStrictEqual({ title: "X", type: "object", properties, "x-fengdie": { type: type.toLowerCase() } });
  });

  it("Resource 的 type 元数据记为 x-fengdie.metaType", () => {
    const { x, diagnostics } = field(`: Resource[type: "coupon"]`);
    expect(x).toStrictEqual({ title: "X", type: "object", properties: { bizId: STR, data: {} }, "x-fengdie": { type: "resource", metaType: "coupon" } });
    expect(diagnostics).toEqual([]);
  });

  it("对象类默认值只接受 JSON 对象字符串", () => {
    expect(field(`: Resource[default: "{\\"bizId\\":\\"1\\"}"]`).x).toMatchObject({ default: { bizId: "1" } });
    expect(codes(field(`: Resource[default: "c-001"]`).diagnostics)).toEqual(["JOTL8108"]);
  });
});

describe("映射表: 根与多文档", () => {
  it("Lottery 与 public 无损记入 x-fengdie, 不报警告", () => {
    const result = roundTrip(`public Lottery(抽奖) { flag(F) }`);
    expect(result.schema.$defs!.Root).toStrictEqual({
      title: "抽奖",
      type: "object",
      properties: { flag: { title: "F", type: "string" } },
      "x-fengdie": { lottery: true, public: true },
    });
    expect(result.diagnostics).toEqual([]);
  });

  it("export 多文档: 各自成为 $defs 类型, 第一条为根, 名字按打印器规则改名(JOTL8117)", () => {
    const result = roundTrip(`export header Object(页头) { t(T) } export Footer Array(页脚) { t(T) }`);
    expect(result.schema.$ref).toBe("#/$defs/Header");
    expect(Object.keys(result.schema.$defs!)).toEqual(["Header", "Footer"]);
    expect(result.schema.$defs!.Footer).toMatchObject({ type: "array", items: { type: "object" } });
    expect(codes(result.diagnostics)).toEqual(["JOTL8117"]);
  });

  it("重复的导出名后者覆盖(JOTL8116)", () => {
    const result = roundTrip(`export A Object(一) { t(T) } export A Object(二) { t(T) }`);
    expect(result.schema.$defs!.A).toMatchObject({ title: "二" });
    expect(codes(result.diagnostics)).toEqual(["JOTL8116"]);
  });

  it("根为数组时第一层分组写在元素对象上", () => {
    const result = roundTrip(`Array(列表) { a(A): String[group: "advance"] }`);
    expect(result.schema.$defs!.Root).toMatchObject({ items: { "x-ui": { groups: [{ title: "高级", fields: ["a"] }] } } });
  });
});

describe("元数据表", () => {
  it("标签为 title, 元数据 description 为 description", () => {
    expect(field(`: String[description: "说明"]`).x).toStrictEqual({ title: "X", type: "string", description: "说明" });
  });

  it("default / defaultValue 按类型修正; 同时出现时取 default(JOTL8115)", () => {
    expect(field(`: Number[defaultValue: "9.9"]`)).toMatchObject({ x: { default: 9.9 }, diagnostics: [{ code: "JOTL8107" }] });
    expect(field(`: Boolean[default: "true"]`).x).toMatchObject({ default: true });
    expect(field(`: Date[default: 1700000000000]`).x).toMatchObject({ default: 1700000000000 });
    const both = field(`: String[defaultValue: "b", default: "a"]`);
    expect(both.x).toMatchObject({ default: "a" });
    expect(codes(both.diagnostics)).toEqual(["JOTL8115"]);
  });

  it("不满足约束的默认值丢弃(JOTL8108)", () => {
    const { x, diagnostics } = field(`: String[minLength: 10, default: "领取折扣"]`);
    expect(x).not.toHaveProperty("default");
    expect(codes(diagnostics)).toEqual(["JOTL8108"]);
  });

  it("字符串 minLength / maxLength; 0 等于不限", () => {
    expect(field(`: String[minLength: 2, maxLength: 5]`).x).toStrictEqual({ title: "X", type: "string", minLength: 2, maxLength: 5 });
    expect(field(`: String[minLength: 0]`).x).toStrictEqual({ title: "X", type: "string" });
  });

  it("regExp → pattern; 带定界符时去掉定界符, i 改写进 pattern, g 忽略", () => {
    const https = field(`: URL[regExp: "/^https:/gi"]`);
    expect(https.x).toStrictEqual({ title: "X", type: "string", format: "uri", pattern: "^[hH][tT][tT][pP][sS]:" });
    expect(https.diagnostics).toEqual([]);
    expect(field(`: String[regExp: "^\\d+$"]`).x).toMatchObject({ pattern: "^\\d+$" });
    expect(codes(field(`: String[regExp: "("]`).diagnostics)).toEqual(["JOTL8106"]);
  });

  it("i 标志: 转义, 字符类, 区间与命名组按大小写改写, 结果与带 i 的正则一致", () => {
    const cases: [string, string][] = [
      ["^\\d+[a-c_]\\.x$", "^\\d+[a-c_A-C]\\.[xX]$"],
      ["[^k-]\\x41(?<Ab>b)", "[^k\\-K][\\x41a](?<Ab>[bB])"],
      ["[W-c]é", "[W-cA-Cw-z][éÉ]"],
    ];
    for (const [source, pattern] of cases) {
      const { x, diagnostics } = field(`: String[regExp: "/${source}/i"]`);
      expect(x).toMatchObject({ pattern });
      expect(diagnostics).toEqual([]);
      const expected = new RegExp(source, "iu");
      const actual = new RegExp(pattern, "u");
      for (const sample of ["1a.x", "2C.X", "1d.x", "AB", "kb", "-B", "Ab", "xé", "aÉ", "_", "[", "^"]) {
        expect(actual.test(sample), `${pattern} ${sample}`).toBe(expected.test(sample));
      }
    }
  });

  it("i 与 u 标志: 补上 Unicode 特殊折叠, 穷举 Unicode 字母与 /x/iu 一致", () => {
    expect(field(`: String[regExp: "/^k[s]$/iu"]`).x).toMatchObject({ pattern: "^[kK\u212a][s\u017fS]$" });
    expect(field(`: String[regExp: "/^k$/i"]`).x).toMatchObject({ pattern: "^[kK]$" });
    // 遍历 BMP 字母, 每个写法在全部字母拼成的文本上一次扫完, 比对两边匹配到的字母.
    const letters: string[] = [];
    for (let cp = 0; cp < 0x10000; cp++) {
      const char = String.fromCharCode(cp);
      if (char.toLowerCase() !== char || char.toUpperCase() !== char) letters.push(char);
    }
    const text = letters.join("\n");
    const matched = (re: RegExp) => [...text.matchAll(re)].map((m) => m[0]).join("");
    const escapeChar = (c: string) => `\\u{${c.codePointAt(0)!.toString(16)}}`;
    const sources = [...letters.map(escapeChar), ...letters.map((c) => `[${escapeChar(c)}]`), "[a-z]", "[A-Z]", "[j-t]", "[^k\\n]"];
    let folded = 0;
    for (const source of sources) {
      const pattern = (field(`: String[regExp: "/${source}/iu"]`).x as { pattern: string }).pattern;
      // 无法改写(如 `ı` `İ`)时保持原样, 由 JOTL8119 兜底.
      if (pattern === source) continue;
      folded += 1;
      expect(matched(new RegExp(pattern, "gu")), pattern).toBe(matched(new RegExp(source, "giu")));
    }
    expect(folded).toBeGreaterThan(sources.length * 0.9);
  });

  it("i 标志无法安全改写时 pattern 保持原样(JOTL8119); m s u y 报 JOTL8120; 未生效的标志记入 x-fengdie", () => {
    for (const source of ["\\p{Lu}", "(a)\\1", "ß", "ς"]) {
      const { x, diagnostics } = field(`: String[regExp: "/${source}/gi"]`);
      expect(x).toMatchObject({ "x-fengdie": { regExpFlags: "i" } });
      expect(codes(diagnostics)).toEqual(["JOTL8119"]);
    }
    const multi = field(`: String[regExp: "/^a$/msi"]`);
    expect(multi.x).toMatchObject({ pattern: "^[aA]$", "x-fengdie": { regExpFlags: "ms" } });
    expect(codes(multi.diagnostics)).toEqual(["JOTL8120", "JOTL8120"]);
  });

  it("errorMsg → errorMessage, placeholder → x-ui.props.placeholder", () => {
    expect(field(`: Text[errorMsg: "格式不对", placeholder: "请输入"]`).x).toStrictEqual({
      title: "X",
      type: "string",
      errorMessage: "格式不对",
      "x-ui": { widget: "textarea", props: { placeholder: "请输入" } },
    });
  });

  it("if: \"$.路径\" → visibleIf; 其他写法无损记入 x-fengdie, 不报警告", () => {
    expect(field(`: Boolean[if: "$.a.list[0]"]`).x).toStrictEqual({ title: "X", type: "boolean", "x-ui": { visibleIf: { field: "/a/list/0", truthy: true } } });
    const other = field(`: Boolean[if: "showShare"]`);
    expect(other.x).toMatchObject({ "x-fengdie": { if: "showShare" } });
    expect(other.diagnostics).toEqual([]);
  });

  describe("if 表达式 → visibleIf: 只转换与 JS 求值逐值一致的写法", () => {
    /** 根上有各类型的兄弟字段, 返回 x 的 visibleIf 与 x-fengdie. */
    const cond = (expr: string): { visibleIf: unknown; trace: unknown; codes: string[] } => {
      const result = roundTrip(`Object(根) {
  n(N): Number
  d(D): Date
  s(S): String
  b(B): Boolean
  e(E): Enum { a(甲) b(乙) }
  list(L): Array { v(V): Number }
  nums(NS): Array<number>
  o(O): Object { k(K): String }
  x(X): Boolean[if: "${expr}"]
}`);
      const x = (result.schema.$defs!.Root as JsonSchemaObject).properties!.x as JsonSchemaObject;
      return { visibleIf: (x["x-ui"] as { visibleIf?: unknown } | undefined)?.visibleIf, trace: (x["x-fengdie"] as { if?: unknown } | undefined)?.if, codes: codes(result.diagnostics) };
    };

    it.each<[string, unknown]>([
      ["$.o.k", { field: "/o/k", truthy: true }],
      ["!$.s", { field: "/s", truthy: false }],
      ["!!$.s", { field: "/s", truthy: true }],
      ["$.list[0].v", { field: "/list/0/v", truthy: true }],
      ["$.o['k']", { field: "/o/k", truthy: true }],
      ["$.s === 'a'", { field: "/s", eq: "a" }],
      ["$.n === -1.5", { field: "/n", eq: -1.5 }],
      ["$.b === true", { field: "/b", eq: true }],
      ["$.s === null", { field: "/s", eq: null }],
      ["$.s !== 'a'", { field: "/s", ne: "a" }],
      ["'a' === $.s", { field: "/s", eq: "a" }],
      ["$.s == 'a'", { field: "/s", eq: "a" }],
      ["$.e != 'b'", { field: "/e", ne: "b" }],
      ["$.n == 2", { field: "/n", eq: 2 }],
      ["$.b != false", { field: "/b", ne: false }],
      ["$.s == null", { all: [{ field: "/s", truthy: false }, { field: "/s", notIn: [false, 0, ""] }] }],
      ["$.s != null", { any: [{ field: "/s", truthy: true }, { field: "/s", in: [false, 0, ""] }] }],
      ["$.n > 1", { field: "/n", gt: 1 }],
      ["$.n >= 1e3", { field: "/n", gte: 1000 }],
      ["$.d < 0", { field: "/d", lt: 0 }],
      ["$.nums[1] <= 2", { field: "/nums/1", lte: 2 }],
      ["3 < $.n", { field: "/n", gt: 3 }],
      ["$.b && $.s === 'a' && !$.o.k", { all: [{ field: "/b", truthy: true }, { field: "/s", eq: "a" }, { field: "/o/k", truthy: false }] }],
      ["$.b || $.n > 1", { any: [{ field: "/b", truthy: true }, { field: "/n", gt: 1 }] }],
      ["$.b && ($.s === 'a' || $.s === 'b')", { all: [{ field: "/b", truthy: true }, { any: [{ field: "/s", eq: "a" }, { field: "/s", eq: "b" }] }] }],
      ["$.b || $.s && $.n", { any: [{ field: "/b", truthy: true }, { all: [{ field: "/s", truthy: true }, { field: "/n", truthy: true }] }] }],
      ["!($.b && $.s)", { not: { all: [{ field: "/b", truthy: true }, { field: "/s", truthy: true }] } }],
      ["!($.s === 'a')", { not: { field: "/s", eq: "a" } }],
      ["$.zz.yy", { field: "/zz/yy", truthy: true }],
    ])("%s", (expr, expected) => {
      const { visibleIf, trace, codes: c } = cond(expr);
      expect(visibleIf).toStrictEqual(expected);
      expect(trace).toBeUndefined();
      expect(c).toEqual([]);
    });

    it.each([
      ["其他变量", "showShare"],
      ["函数调用", "$.s.includes('a')"],
      ["数组长度", "$.list.length > 0"],
      ["字符串长度", "$.s.length"],
      ["未声明路径上的原型成员", "$.zz.length"],
      ["!x 再比较(比较的是布尔值)", "!$.s === true"],
      ["两侧都是路径", "$.s === $.o.k"],
      ["两侧都是字面量", "1 === 1"],
      ["宽松相等的类型不同", "$.n == '1'"],
      ["宽松相等的字段类型未知", "$.zz == 1"],
      ["字符串字段比大小", "$.s > 1"],
      ["数值字段与字符串比大小", "$.n > '1'"],
      ["未知字段比大小", "$.zz > 1"],
      ["连续比较", "$.n > 1 === true"],
      ["undefined", "$.s === undefined"],
      ["三元", "$.b ? $.s : $.n"],
      ["算术", "$.n + 1 > 2"],
      ["前导零数字", "$.n === 01"],
      ["单独的 $", "$"],
      ["括号不配对", "($.b"],
      ["空串", ""],
    ])("%s 不转换, 记入 x-fengdie 且不报警告", (_name, expr) => {
      const { visibleIf, trace, codes: c } = cond(expr);
      expect(visibleIf).toBeUndefined();
      expect(trace).toBe(expr);
      expect(c).toEqual([]);
    });

    it("多类型文档中字段类型未知: 严格比较与真值照常转换, 依赖类型的比较不转换", () => {
      const umo = (expr: string) => ({ A: { type: "object", properties: { n: { key: "n", type: "number" }, x: { key: "x", type: "boolean", meta: { if: expr } } } } });
      const ok = umoJsonToSchema(umo("$.n === 1 && !$.n"));
      expect(ok.value!.$defs!.A).toMatchObject({ properties: { x: { "x-ui": { visibleIf: { all: [{ field: "/n", eq: 1 }, { field: "/n", truthy: false }] } } } } });
      const kept = umoJsonToSchema(umo("$.n > 1"));
      expect(kept.value!.$defs!.A).toMatchObject({ properties: { x: { "x-fengdie": { if: "$.n > 1" } } } });
    });
  });

  it("required: true 进入父对象 required(D4)", () => {
    const { root, jotl } = field(`: String[required: true]`);
    expect(root.required).toEqual(["x"]);
    expect(jotl).toContain("  x(X): string\n");
  });

  it("第一层 group → 根对象 x-ui.groups(D2); 更深层记入 x-fengdie", () => {
    const result = roundTrip(`Object(根) {
  a(A): String[group: "advance"]
  b(B): Number[group: "operator"]
  c(C): Boolean[group: "advance"]
  d(D): Object[group: "developer"] { e(E): String[group: "normal"] }
}`);
    const root = result.schema.$defs!.Root as JsonSchemaObject;
    expect(root["x-ui"]).toEqual({
      groups: [
        { title: "高级", fields: ["a", "c"] },
        { title: "运营", fields: ["b"] },
        { title: "开发者", fields: ["d"] },
      ],
    });
    expect(root.properties!.d).toMatchObject({ properties: { e: { "x-fengdie": { group: "normal" } } } });
  });

  it("其余白名单内与 custom* 元数据无损进入 x-fengdie(D3)不报警告, 白名单外的丢弃(JOTL8105)", () => {
    const { x, diagnostics } = field(`: Object[rule: "r", entityType: "user", customA: 1, foo: 2] { a(A) }`);
    expect(x).toMatchObject({ "x-fengdie": { rule: "r", entityType: "user", customA: 1 } });
    expect(codes(diagnostics)).toEqual(["JOTL8105"]);
  });

  it("不合法的取值丢弃(JOTL8106)", () => {
    expect(codes(field(`: String[maxLength: -1]`).diagnostics)).toEqual(["JOTL8106"]);
    expect(codes(field(`: Number[min: "a"]`).diagnostics)).toEqual(["JOTL8106"]);
    expect(codes(field(`: String[required: "yes"]`).diagnostics)).toEqual(["JOTL8106"]);
  });

  it("诊断位置指向源码中的元数据", () => {
    const result = migrateFengdie(`Object(根) {\n  x(X): String[foo: 1, rule: "r"]\n}`, FILE);
    expect(located(result.diagnostics)).toEqual([
      { code: "JOTL8105", line: 2, column: 16 },
    ]);
  });
});

describe("umo JSON 输入", () => {
  const umo = {
    type: "object",
    description: "首页",
    properties: {
      title: { key: "title", type: "string", description: "标题", meta: { maxLength: 20, default: "欢迎" } },
      when: { key: "when", type: "date", description: "时间" },
      mode: { key: "mode", type: "enum", description: "模式", items: [{ label: "浅色", value: "light" }, { label: "深色", value: "dark" }] },
      list: { key: "list", type: "array", description: "列表", properties: { a: { key: "a", type: "image", description: "图" } }, meta: { rule: "r", foo: 1 } },
    },
  };
  const source = `Object(首页) {
  title(标题): String[maxLength: 20, default: "欢迎"]
  when(时间): Date
  mode(模式): Enum { light(浅色) dark(深色) }
  list(列表): Array[rule: "r", foo: 1] { a(图): Image }
}`;

  it("对象, JSON 文本与源码三种输入的结果相同; 诊断位置为 umo JSON 指针", () => {
    const fromObject = roundTrip(umo);
    expect(migrateFengdie(JSON.stringify(umo), FILE).jotl).toBe(fromObject.jotl);
    expect(migrateFengdie(source, FILE).jotl).toBe(fromObject.jotl);
    expect(fromObject.diagnostics).toEqual([expect.objectContaining({ code: "JOTL8105", location: { kind: "pointer", pointer: "/properties/list/meta/foo", document: FILE } })]);
  });

  it("JSON 语法错误报 JOTL8006, 结构不合法报 JOTL8007", () => {
    expect(codes(migrateFengdie("{ bad", FILE).diagnostics)).toEqual(["JOTL8006"]);
    const result = migrateFengdie({ type: "object", description: "", properties: { x: 1 } } as never, FILE);
    expect(result.jotl).toBeUndefined();
    expect(codes(result.diagnostics)).toEqual(["JOTL8007"]);
  });
});
