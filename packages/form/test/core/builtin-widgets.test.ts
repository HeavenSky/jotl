import { describe, expect, it } from "vitest";
import { BUILTIN_WIDGETS, enumOptions, fieldLabel, isBuiltinWidget } from "../../src/core/index.js";

// 契约 C2 内置组件名表, 逐行对照.
const TABLE: [string, string, string][] = [
  ["form", "view", "P0"],
  ["field", "decorator", "P0"],
  ["page", "layout", "P0"],
  ["inline", "layout", "P0"],
  ["input", "field", "P0"],
  ["textarea", "field", "P0"],
  ["password", "field", "P0"],
  ["richtext", "field", "P1"],
  ["number", "field", "P0"],
  ["range", "field", "P0"],
  ["money", "field", "P0"],
  ["bigint", "field", "P0"],
  ["switch", "field", "P0"],
  ["checkbox", "field", "P0"],
  ["select", "field", "P0"],
  ["radio", "field", "P0"],
  ["output", "field", "P0"],
  ["date", "field", "P0"],
  ["time", "field", "P0"],
  ["datetime", "field", "P0"],
  ["url", "field", "P0"],
  ["email", "field", "P0"],
  ["color", "field", "P0"],
  ["image", "field", "P0"],
  ["file", "field", "P0"],
  ["json", "field", "P0"],
  ["list", "composite", "P0"],
  ["tuple", "composite", "P2"],
  ["kv", "composite", "P1"],
  ["union", "composite", "P1"],
  ["nullable", "composite", "P1"],
  ["tree", "composite", "P1"],
];

describe("BUILTIN_WIDGETS", () => {
  it("与契约 C2 名表逐行一致", () => {
    expect(Object.entries(BUILTIN_WIDGETS).map(([n, w]) => [n, w.level, w.priority])).toEqual(TABLE);
  });
  it("已移除的旧名不再是内置名", () => {
    for (const name of ["object", "text", "checkboxes", "const", "array", "map"]) expect(isBuiltinWidget(name)).toBe(false);
    expect(isBuiltinWidget("toString")).toBe(false);
  });
});

describe("enumOptions", () => {
  it("带标签枚举取 title, 缺省取值", () => {
    expect(enumOptions({ oneOf: [{ const: "light", title: "浅色" }, { const: 2 }] })).toEqual([
      { value: "light", label: "浅色" },
      { value: 2, label: "2" },
    ]);
  });
  it("enum 与非枚举", () => {
    expect(enumOptions({ enum: ["a", null] })).toEqual([
      { value: "a", label: "a" },
      { value: null, label: "null" },
    ]);
    expect(enumOptions({ oneOf: [{ type: "string" }] })).toBeUndefined();
    expect(enumOptions({ type: "string" })).toBeUndefined();
  });
  it("fieldLabel 优先 title", () => {
    expect(fieldLabel({ title: "标题" }, "title")).toBe("标题");
    expect(fieldLabel(true, "title")).toBe("title");
  });
});
