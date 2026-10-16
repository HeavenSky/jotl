import { describe, expect, it } from "vitest";
import type { Condition } from "@jotl/core";
import { evaluateCondition, jsonEqual } from "../../src/core/index.js";

const data = {
  mode: "custom",
  count: 0,
  tags: ["a", "b"],
  style: { color: "red", size: [1, 2] },
  rows: [
    { kind: "image", cells: [{ on: true }, { on: false }] },
    { kind: "text", cells: [{ on: false }] },
  ],
};

describe("evaluateCondition", () => {
  it("eq 按 JSON 深度相等", () => {
    expect(evaluateCondition({ field: "/mode", eq: "custom" }, data, "")).toBe(true);
    expect(evaluateCondition({ field: "/style", eq: { size: [1, 2], color: "red" } }, data, "")).toBe(true);
    expect(evaluateCondition({ field: "/style", eq: { color: "red" } }, data, "")).toBe(false);
    expect(evaluateCondition({ field: "/missing", eq: null }, data, "")).toBe(false);
  });

  it("ne", () => {
    expect(evaluateCondition({ field: "/mode", ne: "auto" }, data, "")).toBe(true);
    expect(evaluateCondition({ field: "/tags", ne: ["a", "b"] }, data, "")).toBe(false);
    expect(evaluateCondition({ field: "/missing", ne: 1 }, data, "")).toBe(true);
  });

  it("in", () => {
    expect(evaluateCondition({ field: "/count", in: [0, 1] }, data, "")).toBe(true);
    expect(evaluateCondition({ field: "/tags", in: [["a", "b"]] }, data, "")).toBe(true);
    expect(evaluateCondition({ field: "/count", in: ["0"] }, data, "")).toBe(false);
  });

  it("notIn", () => {
    expect(evaluateCondition({ field: "/mode", notIn: ["auto", "off"] }, data, "")).toBe(true);
    expect(evaluateCondition({ field: "/mode", notIn: ["custom"] }, data, "")).toBe(false);
  });

  it("truthy", () => {
    expect(evaluateCondition({ field: "/mode", truthy: true }, data, "")).toBe(true);
    expect(evaluateCondition({ field: "/count", truthy: true }, data, "")).toBe(false);
    expect(evaluateCondition({ field: "/count", truthy: false }, data, "")).toBe(true);
    expect(evaluateCondition({ field: "/missing", truthy: false }, data, "")).toBe(true);
  });

  it("all any not 组合", () => {
    const yes: Condition = { field: "/mode", eq: "custom" };
    const no: Condition = { field: "/mode", eq: "auto" };
    expect(evaluateCondition({ all: [yes, yes] }, data, "")).toBe(true);
    expect(evaluateCondition({ all: [yes, no] }, data, "")).toBe(false);
    expect(evaluateCondition({ all: [] }, data, "")).toBe(true);
    expect(evaluateCondition({ any: [no, yes] }, data, "")).toBe(true);
    expect(evaluateCondition({ any: [no] }, data, "")).toBe(false);
    expect(evaluateCondition({ any: [] }, data, "")).toBe(false);
    expect(evaluateCondition({ not: no }, data, "")).toBe(true);
    expect(evaluateCondition({ not: { all: [yes, { any: [no, { not: no }] }] } }, data, "")).toBe(false);
  });

  it("* 取当前节点实际路径中同一位置的下标", () => {
    const cond: Condition = { field: "/rows/*/kind", eq: "image" };
    expect(evaluateCondition(cond, data, "/rows/0/cells/1")).toBe(true);
    expect(evaluateCondition(cond, data, "/rows/1/cells/0")).toBe(false);
    const nested: Condition = { field: "/rows/*/cells/*/on", eq: true };
    expect(evaluateCondition(nested, data, "/rows/0/cells/0/on")).toBe(true);
    expect(evaluateCondition(nested, data, "/rows/0/cells/1/on")).toBe(false);
    // dataPath 比 field 短, "*" 无从取值时按字段不存在处理.
    expect(evaluateCondition(cond, data, "")).toBe(false);
  });

  it("gt gte lt lte 只比较数值, 非数值为假", () => {
    expect(evaluateCondition({ field: "/count", gt: -1 }, data, "")).toBe(true);
    expect(evaluateCondition({ field: "/count", gt: 0 }, data, "")).toBe(false);
    expect(evaluateCondition({ field: "/count", gte: 0 }, data, "")).toBe(true);
    expect(evaluateCondition({ field: "/count", lt: 1 }, data, "")).toBe(true);
    expect(evaluateCondition({ field: "/count", lte: -1 }, data, "")).toBe(false);
    expect(evaluateCondition({ field: "/mode", gt: 0 }, data, "")).toBe(false);
    expect(evaluateCondition({ field: "/missing", lt: 100 }, data, "")).toBe(false);
    expect(evaluateCondition({ field: "/n", gt: 1 }, { n: "5" }, "")).toBe(false);
  });

  it("base: node 从当前节点所在对象起算, * 按拼接后的位置取下标", () => {
    expect(evaluateCondition({ field: "/kind", base: "node", eq: "image" }, data, "/rows/0/cells")).toBe(true);
    expect(evaluateCondition({ field: "/kind", base: "node", eq: "image" }, data, "/rows/1/cells")).toBe(false);
    expect(evaluateCondition({ field: "/color", base: "node", eq: "red" }, data, "/style/size")).toBe(true);
    expect(evaluateCondition({ field: "/mode", base: "node", eq: "custom" }, data, "/count")).toBe(true);
    expect(evaluateCondition({ field: "/cells/*/on", base: "node", eq: true }, data, "/rows/0/cells/0/on")).toBe(false);
    expect(evaluateCondition({ field: "/on", base: "node", truthy: true }, data, "/rows/0/cells/0/x")).toBe(true);
    expect(evaluateCondition({ field: "/on", base: "node", truthy: true }, data, "/rows/0/cells/1/x")).toBe(false);
  });

  it("不可识别的条件为 false, 指针转义按 RFC 6901", () => {
    expect(evaluateCondition({} as Condition, data, "")).toBe(false);
    expect(evaluateCondition({ field: "/a~1b", eq: 1 }, { "a/b": 1 }, "")).toBe(true);
    expect(evaluateCondition({ field: "", eq: 5 }, 5, "")).toBe(true);
  });
});

describe("jsonEqual", () => {
  it("对象不看键顺序, 数组看位置", () => {
    expect(jsonEqual({ a: 1, b: [1, { c: null }] }, { b: [1, { c: null }], a: 1 })).toBe(true);
    expect(jsonEqual([1, 2], [2, 1])).toBe(false);
    expect(jsonEqual({ a: undefined }, {})).toBe(false);
    expect(jsonEqual(null, {})).toBe(false);
    expect(jsonEqual([], {})).toBe(false);
  });
});
