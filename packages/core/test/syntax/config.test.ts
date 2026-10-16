// 项目配置 jotl.config.json: 内容校验, 底层类型换算, 编译选项与配置文件自身的 schema.
import { describe, expect, it } from "vitest";
import type { JsonSchemaObject } from "../../src/schema/index.js";
import { compile, configCompileOptions, createJotlConfigJsonSchema, readJotlConfig } from "../../src/syntax/index.js";
import { checkDefaultValue } from "../../src/syntax/value-check.js";
import { FILE } from "./helpers.js";

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
    expect(readJotlConfig(value)).toEqual({ config: { widgets: {}, modules: {} }, issues: [{ pointer: "", message: "配置必须是 JSON 对象" }] });
  });

  it("widgets 不是对象时报错; 缺省时为空", () => {
    expect(readJotlConfig({ widgets: ["A"] }).issues.map((i) => i.pointer)).toEqual(["/widgets"]);
    expect(readJotlConfig({})).toEqual({ config: { widgets: {}, modules: {} }, issues: [] });
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
