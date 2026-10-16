// typiaTags 选项: 产物对 typia@15.1.0 的类型定义零类型错误(D46), 以及标签改写的具体写法.
import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@jotl/core";
import { isSkipped, listFixtures, readFixture } from "../../../../test-utils/fixtures.js";
import { schemaToTs, tsToSchema } from "../../src/ts/index.js";
import { PRESET_PATH, loadTsdocParser, tsdocMessages, typecheck } from "./support.js";

const fixtures = listFixtures().map(readFixture).filter((f) => f.hasSchema);
const { parser } = loadTsdocParser(PRESET_PATH);

function generate(schema: unknown): string {
  const result = schemaToTs(schema as JsonSchema, { typiaTags: true });
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return result.value as string;
}

function wrap(properties: Record<string, unknown>): JsonSchema {
  return { $ref: "#/$defs/T", $defs: { T: { type: "object", properties } } } as JsonSchema;
}

describe("typiaTags", () => {
  it("全部样例产物在 tsc 6.0.3 下对 typia 的类型定义零类型错误", () => {
    const files = Object.fromEntries(fixtures.map((f) => [`${f.name}.d.ts`, generate(f.schema)]));
    expect(Object.values(files).filter((text) => text.includes('import { tags } from "typia";')).length).toBeGreaterThan(5);
    expect(typecheck(files)).toEqual([]);
  });

  it("类型检查确实解析到 typia: 不支持的格式会报错", () => {
    const errors = typecheck({ "bad.d.ts": 'import { tags } from "typia";\nexport type T = string & tags.Format<"color">;\n' });
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("TS2344");
  });

  it("参与逐字比对的样例在 typia 模式下注释仍零告警", () => {
    for (const fixture of fixtures.filter((f) => f.types !== undefined && !isSkipped(f, "types.d.ts"))) {
      expect(tsdocMessages(parser, generate(fixture.schema))).toEqual([]);
    }
  });

  it("约束改写为类型交叉, typia 不支持的取值仍用 JSDoc", () => {
    const text = generate(readFixture("002-constraints").schema);
    expect(text).toContain('import { tags } from "typia";');
    expect(text).toContain('  title: string & tags.MinLength<1> & tags.MaxLength<20> & tags.Default<"欢迎">;');
    expect(text).toContain("  count: number & tags.Type<\"int32\"> & tags.Minimum<1> & tags.Maximum<10> & tags.Default<1>;");
    expect(text).toContain('  tags: string[] & tags.MinItems<1> & tags.MaxItems<3> & tags.UniqueItems & tags.Default<["a"]>;');
    expect(text).not.toContain("@asType");

    const semantic = generate(readFixture("003-semantic-types").schema);
    expect(semantic).toContain("   * @format color\n   */\n  theme?: string & tags.Default<\"#1677ff\">;");
    expect(semantic).toContain('  cover?: string & tags.Format<"uri"> & tags.JsonSchemaPlugin<{ "x-ui": { "widget": "image" } }>;');
  });

  it("元素级约束与注解在 typia 模式下可以表达", () => {
    const lists = schemaToTs(readFixture("007-array-primitive").schema as JsonSchema, { typiaTags: true });
    expect(lists.diagnostics).toEqual([]);
    expect(lists.value).toContain("  tags: (string & tags.MaxLength<10>)[] & tags.MaxItems<5>;");
    expect(lists.value).toContain("  loose?: Loose[] & tags.UniqueItems<false>;");
  });

  it("可空类型只给非 null 部分加标签; 无边界或越界的整数用 int64", () => {
    const text = generate(wrap({
      a: { type: ["string", "null"], maxLength: 3 },
      b: { type: "integer", minimum: 0 },
      c: { type: "integer", minimum: 0, maximum: 4294967295 },
      d: { type: "object", properties: {}, default: { k: 1 } },
    }));
    expect(text).toContain("  a?: (string & tags.MaxLength<3>) | null;");
    expect(text).toContain('  b?: number & tags.Type<"int64"> & tags.Minimum<0>;');
    expect(text).toContain('  c?: number & tags.Type<"int64"> & tags.Minimum<0> & tags.Maximum<4294967295>;');
    expect(text).toContain("   * @defaultValue `{\"k\":1}`\n   */\n  d?: {};");
    expect(typecheck({ "edge.d.ts": text })).toEqual([]);
  });

  it("类型名与 tags 冲突时改用别名导入", () => {
    const text = generate({ $defs: { tags: { type: "string", maxLength: 1 } } } as JsonSchema);
    expect(text).toContain('import { tags as typiaTags } from "typia";');
    expect(text).toContain("export type tags = string & typiaTags.MaxLength<1>;");
    expect(typecheck({ "alias.d.ts": text })).toEqual([]);
  });

  it("未用到 typia 标签时不输出导入", () => {
    expect(generate(wrap({ a: { type: "string" } }))).not.toContain("typia");
  });

  it("参与逐字比对的样例在 typia 模式下的产物反向转换后与 schema 深度相等", () => {
    for (const fixture of fixtures) {
      const back = tsToSchema(generate(fixture.schema));
      expect(back.diagnostics.filter((d) => d.code !== "JOTL2108")).toEqual([]);
      if (!isSkipped(fixture, "types.d.ts")) expect(back.value).toEqual(fixture.schema);
    }
    const lists = readFixture("007-array-primitive").schema;
    expect(tsToSchema(generate(lists)).value).toEqual(lists);
  });

  it("读取交叉类型上的 typia 标签, 含可空, 别名导入, 字面量参数与引用", () => {
    const schema = wrap({
      email: { type: "string", minLength: 1, format: "email" },
      count: { type: ["integer", "null"], minimum: 0, maximum: 9, default: 3 },
      list: { type: "array", items: { type: "string", pattern: "^a" }, uniqueItems: true, default: ["a", "b"] },
      ref: { $ref: "#/$defs/U", "x-ui": { widget: "card", props: { dense: true } } },
    });
    (schema as { $defs: Record<string, unknown> }).$defs.U = { type: "object", properties: { a: { type: "string" } } };
    const text = generate(schema);
    expect(text).toContain('  email?: string & tags.MinLength<1> & tags.Format<"email">;');
    const back = tsToSchema(text);
    expect(back.diagnostics.map((d) => d.code)).toEqual(["JOTL2108"]);
    expect(back.value?.$defs).toEqual((schema as { $defs: unknown }).$defs);

    const aliased = tsToSchema('import { tags as t } from "typia";\nexport type T = number & t.Type<"uint32"> & t.ExclusiveMaximum<5>;');
    expect(aliased.value?.$defs?.T).toEqual({ type: "integer", exclusiveMaximum: 5 });
  });

  it("未知的 typia 标签与未导入 typia 的 tags.X 报 JOTL2106", () => {
    const unknownTag = tsToSchema('import { tags } from "typia";\nexport type T = string & tags.Sequence<1>;');
    expect(unknownTag.diagnostics.map((d) => d.code)).toEqual(["JOTL2108", "JOTL2106"]);
    expect(tsToSchema("export type T = string & tags.MinLength<1>;").diagnostics.map((d) => d.code)).toEqual(["JOTL2106"]);
  });
});
