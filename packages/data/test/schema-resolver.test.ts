// 引用解析按嵌套 $id 的 base URI 做相对解析: 指针相对所在资源根, $anchor 按资源分作用域; 以 Ajv 对同一 schema 的校验结果为对照.
import { describe, expect, it } from "vitest";
import type { JsonSchemaObject } from "@jotl/core";
import { createResolver } from "../src/schema-resolver.js";
import { getDefaults, mock, validate } from "../src/index.js";

const valid = (schema: JsonSchemaObject, data: unknown): boolean | undefined => {
  const result = validate(schema, data);
  if (result.value === undefined) throw new Error(JSON.stringify(result.diagnostics));
  return result.value.valid;
};

/** 根 $id 为绝对 URI, 子资源用相对 $id, 子资源内的 #/$defs/num 与根上的同名定义类型不同. */
const nested: JsonSchemaObject = {
  $id: "https://x.test/root.json",
  $defs: {
    num: { type: "string", default: "root" },
    tag: { $anchor: "x", type: "string", default: "root-anchor" },
    child: {
      $id: "sub/child.json",
      type: "object",
      properties: { n: { $ref: "#/$defs/num" }, t: { $ref: "#x" } },
      required: ["n", "t"],
      $defs: {
        num: { type: "integer", default: 7 },
        tag: { $anchor: "x", type: "integer", default: 9 },
      },
    },
  },
  type: "object",
  properties: {
    abs: { $ref: "https://x.test/sub/child.json" },
    rel: { $ref: "sub/child.json" },
    rootNum: { $ref: "#/$defs/num" },
    rootTag: { $ref: "#x" },
    childTag: { $ref: "sub/child.json#x" },
    childNum: { $ref: "https://x.test/sub/child.json#/$defs/num" },
  },
  required: ["abs", "rel", "rootNum", "rootTag", "childTag", "childNum"],
};

const expected = {
  abs: { n: 7, t: 9 },
  rel: { n: 7, t: 9 },
  rootNum: "root",
  rootTag: "root-anchor",
  childTag: 9,
  childNum: 7,
};

describe("嵌套 $id 的引用解析", () => {
  it("绝对 URI 引用相对 $id 的子资源, 子资源内指针与 $anchor 在子资源内解析", () => {
    const result = getDefaults(nested, { strategy: "required" });
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toEqual(expected);
    // Ajv 对照: 取到的默认值校验通过, 换成根上同名定义的取值则不通过.
    expect(valid(nested, expected)).toBe(true);
    expect(valid(nested, { ...expected, abs: { n: "root", t: 9 } })).toBe(false);
    expect(valid(nested, { ...expected, abs: { n: 7, t: "root-anchor" } })).toBe(false);
    expect(valid(nested, { ...expected, rootTag: 9 })).toBe(false);
  });

  it("Mock 结果通过 Ajv 校验", () => {
    for (const seed of [1, 2, 3]) {
      const result = mock(nested, { seed });
      expect(result.diagnostics.filter((d) => d.code === "JOTL4016")).toEqual([]);
      expect(valid(nested, result.value)).toBe(true);
    }
  });

  it("校验错误转换沿子资源内的引用定位", () => {
    const result = validate(nested, { ...expected, abs: { n: "x", t: 9 } });
    expect(result.value?.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.location?.kind === "pointer" && d.location.pointer === "/abs/n")).toBe(true);
  });

  it("根没有 $id 时相对 $id 在伪 base 上解析", () => {
    const schema: JsonSchemaObject = {
      $defs: {
        num: { type: "string", default: "root" },
        child: {
          $id: "child.json",
          $defs: { num: { type: "integer", default: 3 } },
          type: "object",
          properties: { v: { $ref: "#/$defs/num" } },
          required: ["v"],
        },
      },
      type: "object",
      properties: { a: { $ref: "child.json" }, b: { $ref: "#/$defs/num" } },
      required: ["a", "b"],
    };
    const result = getDefaults(schema, { strategy: "required" });
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toEqual({ a: { v: 3 }, b: "root" });
    expect(valid(schema, result.value)).toBe(true);
  });

  it("$anchor 按资源分作用域, 不在当前资源内的锚点解析失败", () => {
    const resolver = createResolver(nested);
    const child = (nested.$defs!.child as JsonSchemaObject);
    expect(resolver.resolveRef("#x", nested)).toBe(nested.$defs!.tag);
    expect(resolver.resolveRef("#x", child)).toBe(child.$defs!.tag);
    expect(resolver.resolveRef("https://x.test/root.json#x", child)).toBe(nested.$defs!.tag);
    expect(resolver.resolveRef("#none", child)).toBeUndefined();
    const onlyChild = createResolver({ $defs: { c: { $id: "c.json", $anchor: "a" } }, $ref: "#a" });
    expect(onlyChild.resolveRef("#a", undefined)).toBeUndefined();
    expect(onlyChild.resolveRef("c.json#a", undefined)).toBeDefined();
  });

  it("原有行为: 无 $id 文档的 #/... 与 $anchor, 文档外节点按根资源解析, 无法解析时报 JOTL4016", () => {
    const schema: JsonSchemaObject = {
      $defs: { Name: { type: "string", default: "n" }, Tag: { $anchor: "tag", type: "integer", default: 1 } },
      type: "object",
      properties: { name: { $ref: "#/$defs/Name" }, tag: { $ref: "#tag" }, bad: { $ref: "#/$defs/None" } },
      required: ["name", "tag"],
    };
    const result = getDefaults(schema, { strategy: "required" });
    expect(result.value).toEqual({ name: "n", tag: 1 });
    expect(getDefaults(schema, { strategy: "all" }).diagnostics.map((d) => d.code)).toContain("JOTL4016");
    const resolver = createResolver(schema);
    expect(resolver.resolveRef("#/$defs/Name", { synthesized: true })).toBe(schema.$defs!.Name);
    expect(resolver.resolveRef("#", undefined)).toBe(schema);
  });
});
