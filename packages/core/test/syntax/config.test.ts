// 项目配置 jotl.config.json: 内容校验, 底层类型换算, 编译选项与配置文件自身的 schema.
import { describe, expect, it } from "vitest";
import { type JsonSchemaObject, setLocale } from "../../src/schema/index.js";
import { compile, configCompileOptions, createJotlConfigJsonSchema, readJotlConfig } from "../../src/syntax/index.js";
import { checkDefaultValue } from "../../src/syntax/value-check.js";
import { FILE, compileCodes } from "./helpers.js";

describe("readJotlConfig", () => {
  it("底层类型: JSON Schema 基本类型名, 无体的 Jotl 内置组件名(去掉 x-ui)与 schema 对象", () => {
    const { config, issues } = readJotlConfig({
      $schema: "./jotl.config.schema.json",
      widgets: { ImagePicker: "url", "tag-list": "array", headline: "text", Count: "integer", Pick: { type: "string", format: "uri" } },
    });
    expect(issues).toEqual([]);
    expect(config.widgets).toEqual({
      ImagePicker: { type: "string", format: "uri" },
      "tag-list": { type: "array" },
      headline: { type: "string" },
      Count: { type: "integer" },
      Pick: { type: "string", format: "uri" },
    });
  });

  it("不合法的项记入 issues 并跳过, 其余照常返回", () => {
    const { config, issues } = readJotlConfig({ widgets: { A: "enum", B: 1, "": "string", "a/b": "nope", C: "string" }, extra: true });
    expect(config.widgets).toEqual({ C: { type: "string" } });
    expect(issues.map((i) => i.pointer)).toEqual(["/extra", "/widgets/A", "/widgets/B", "/widgets/", "/widgets/a~1b"]);
    expect(issues[1]!.message).toContain("`enum`");
  });

  it.each([null, [], "x"])("顶层不是对象 %j 时报错", (value) => {
    expect(readJotlConfig(value)).toEqual({ config: { widgets: {}, modules: {}, widgetTypes: {} }, issues: [{ pointer: "", message: "配置必须是 JSON 对象" }] });
  });

  it("widgets 不是对象时报错; 缺省时为空", () => {
    expect(readJotlConfig({ widgets: ["A"] }).issues.map((i) => i.pointer)).toEqual(["/widgets"]);
    expect(readJotlConfig({})).toEqual({ config: { widgets: {}, modules: {}, widgetTypes: {} }, issues: [] });
  });

  it("widgetTypes 只收写了底层类型的非大驼峰名; 不带 base 的模块声明视为没写", () => {
    const { config } = readJotlConfig({
      widgets: { ImagePicker: "url", headline: "string", rich: { module: "./rich.js" }, stepper: { base: "integer", module: "s" }, pick: { type: "string", format: "uri" } },
    });
    expect(config.widgetTypes).toEqual({ headline: { type: "string" }, stepper: { type: "integer" }, pick: { type: "string", format: "uri" } });
  });

  it("各次返回的 schema 互不共享", () => {
    const first = readJotlConfig({ widgets: { A: "url" } }).config.widgets["A"]!;
    first.format = "changed";
    expect(readJotlConfig({ widgets: { A: "url" } }).config.widgets["A"]).toEqual({ type: "string", format: "uri" });
  });
});

describe("configCompileOptions", () => {
  it("只把大驼峰名作为扩展组件传给编译器, 底层类型取自配置", () => {
    const { config } = readJotlConfig({ widgets: { ImagePicker: "url", "tag-list": "array" } });
    const options = configCompileOptions(config.widgets);
    expect(options).toEqual({ widgets: { ImagePicker: { type: "string", format: "uri" } } });
    const schema = compile("A: { pic: ImagePicker }", FILE, options).value?.schema;
    expect((schema?.$defs?.["A"] as { properties: Record<string, unknown> } | undefined)?.properties["pic"]).toEqual({ type: "string", format: "uri", "x-ui": { widget: "ImagePicker" } });
    expect(configCompileOptions({ headline: { type: "string" } })).toEqual({});
  });

  it("写了底层类型的非大驼峰名作为 widgetTypes 传入, 只用于兼容检查", () => {
    const { config } = readJotlConfig({ widgets: { ImagePicker: "url", headline: "string" } });
    const options = configCompileOptions(config.widgets, config.widgetTypes);
    expect(options).toEqual({ widgets: { ImagePicker: { type: "string", format: "uri" } }, widgetTypes: { headline: { type: "string" } } });
    expect(compileCodes("A: { count: integer[widget: 'headline'] }", options)).toEqual(["JOTL1052"]);
    expect(configCompileOptions({}, { Fancy: { type: "string" } })).toEqual({});
  });
});

describe("widget 底层类型与字段类型的兼容检查(JOTL1052)", () => {
  const widgetTypes: Record<string, JsonSchemaObject> = {
    headline: { type: "string" },
    gauge: { type: "number" },
    stepper: { type: "integer" },
    picker: { type: "string", format: "uri" },
    either: { type: ["string", "number", "null"] },
    card: { type: "object" },
    wallet: readJotlConfig({ widgets: { w: "money" } }).config.widgets["w"]!,
    loose: { anyOf: [{ $ref: "#/$defs/X" }] },
    any: {},
    levels: { enum: [1, 2, 3] },
  };
  const check = (text: string) => compileCodes(text, { widgetTypes });

  it("不兼容时报 warning, 消息含 widget 名, 底层类型与字段类型, widget 照常写入", () => {
    const result = compile("A: { count: integer[widget: 'headline'] }", FILE, { widgetTypes });
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.message])).toEqual([
      ["JOTL1052", "warning", "widget `headline` 声明的底层类型 `string` 与字段类型 `integer` 不兼容"],
    ]);
    expect(result.diagnostics[0]!.location).toMatchObject({ kind: "source", range: { start: { column: 29 } } });
    const count = (result.value!.schema.$defs!["A"] as JsonSchemaObject).properties!["count"];
    expect(count).toMatchObject({ type: "integer", "x-ui": { widget: "headline" } });
  });

  it.each([
    ["integer[widget: 'gauge']", []],
    ["number[widget: 'gauge']", []],
    ["number[widget: 'stepper']", ["JOTL1052"]],
    ["url[widget: 'headline']", []],
    ["string[widget: 'picker']", []],
    ["string[nullable: true, widget: 'headline']", []],
    ["enum[widget: 'headline'] { a, b }", []],
    ["enum[widget: 'stepper'] { 1, 2.5 }", ["JOTL1052"]],
    ["integer[widget: 'levels']", []],
    ["string[widget: 'levels']", ["JOTL1052"]],
    ["boolean[widget: 'either']", ["JOTL1052"]],
    ["integer[nullable: true, widget: 'either']", []],
    ["money[widget: 'card']", []],
    ["object[widget: 'wallet']", ["JOTL1052"]],
    ["array[array_item: 'string', widget: 'headline']", ["JOTL1052"]],
    ["array[array_item: 'integer', item_meta: {widget: 'headline'}]", ["JOTL1052"]],
    ["integer[widget: 'loose']", []],
    ["integer[widget: 'any']", []],
    ["any[widget: 'headline']", []],
    ["string[widget: 'unknown-name']", []],
  ])("x: %s → %j", (field, expected) => {
    expect(check(`A: { x: ${field} }`)).toEqual(expected);
  });

  it("引用类型无法判断时不报; 扩展组件按其底层类型比较", () => {
    expect(check("A: { x: B[widget: 'headline'] }\nB: { y: string }")).toEqual([]);
    expect(compileCodes("A: { x: Count[widget: 'headline'] }", { widgets: { Count: { type: "integer" } }, widgetTypes })).toEqual(["JOTL1052"]);
  });

  it("内置 widget 名不按 widgetTypes 检查", () => {
    expect(compileCodes("A: { x: integer[widget: 'number'] }", { widgetTypes: { number: { type: "string" } } })).toEqual([]);
  });

  it("根元数据 widgets 的非大驼峰名: 写了底层类型的参与检查并覆盖配置, 不带 base 的模块声明视为没写", () => {
    expect(compileCodes("A: [widgets: {headline: 'string'}] { x: integer[widget: 'headline'] }")).toEqual(["JOTL1052"]);
    expect(compileCodes("A: [widgets: {headline: 'integer'}] { x: integer[widget: 'headline'] }", { widgetTypes })).toEqual([]);
    expect(compileCodes("A: [widgets: {headline: {module: 'm'}}] { x: integer[widget: 'headline'] }", { widgetTypes })).toEqual([]);
    expect(compileCodes("A: [widgets: {headline: {base: 'string', module: 'm'}}] { x: integer[widget: 'headline'] }")).toEqual(["JOTL1052"]);
  });

  it("英文文案", () => {
    setLocale("en");
    try {
      expect(compile("A: { count: integer[widget: 'headline'] }", FILE, { widgetTypes }).diagnostics[0]!.message).toBe("widget `headline` is declared with base type `string`, which is incompatible with field type `integer`");
    } finally {
      setLocale("zh-CN");
    }
  });
});

describe("createJotlConfigJsonSchema", () => {
  it("字符串底层类型的可选值与 readJotlConfig 接受的一致", () => {
    const schema = createJotlConfigJsonSchema();
    const anyOf = (schema.properties!["widgets"] as { additionalProperties: { anyOf: { enum?: string[] }[] } }).additionalProperties.anyOf;
    const names = anyOf[0]!.enum!;
    expect(names).toEqual(expect.arrayContaining(["string", "number", "integer", "boolean", "array", "object", "text", "url", "money"]));
    expect(names).not.toContain("enum");
    expect(names).not.toContain("union");
    expect(readJotlConfig({ widgets: Object.fromEntries(names.map((n, i) => [`W${i}`, n])) }).issues).toEqual([]);
    expect(schema.additionalProperties).toBe(false);
  });

  it("每一项的对象层直接列出模块声明的键(空对象里也能补全), 且不改变校验结论", () => {
    const schema = createJotlConfigJsonSchema();
    const widgets = schema.properties!["widgets"] as JsonSchemaObject;
    const item = widgets.additionalProperties as JsonSchemaObject;
    expect(Object.keys(item.properties ?? {})).toEqual(["base", "module", "export"]);
    const { properties: _, ...withoutKeys } = item;
    const before = { ...widgets, additionalProperties: withoutKeys };
    const samples = [
      {},
      { A: {} },
      { A: "url" },
      { A: { type: "string" } },
      { A: { module: "m" } },
      { A: { base: "url", module: "m", export: "x" } },
      { A: 1 },
      { A: "enum" },
      { A: { module: "" } },
      { A: { module: "m", x: 1 } },
    ];
    for (const value of samples) expect(checkDefaultValue(widgets, value, {}, schema)).toBe(checkDefaultValue(before, value, {}, schema));
    expect(checkDefaultValue(widgets, { A: {} }, {}, schema)).toBeUndefined();
    expect(checkDefaultValue(widgets, { A: 1 }, {}, schema)).toBeDefined();
  });
});
