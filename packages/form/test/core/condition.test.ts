import { describe, expect, it } from "vitest";
import type { Condition } from "@jotl/core";
import { evaluateCondition } from "../../src/core/index.js";

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
		expect(evaluateCondition({ left: "mode", op: "eq", right: "custom" }, data, "")).toBe(true);
		expect(
			evaluateCondition(
				{ left: "style", op: "eq", right: { size: [1, 2], color: "red" } },
				data,
				""
			)
		).toBe(true);
		expect(
			evaluateCondition({ left: "style", op: "eq", right: { color: "red" } }, data, "")
		).toBe(false);
		expect(evaluateCondition({ left: "missing", op: "eq", right: null }, data, "")).toBe(false);
	});

	it("ne", () => {
		expect(evaluateCondition({ left: "mode", op: "ne", right: "auto" }, data, "")).toBe(true);
		expect(evaluateCondition({ left: "tags", op: "ne", right: ["a", "b"] }, data, "")).toBe(
			false
		);
		expect(evaluateCondition({ left: "missing", op: "ne", right: 1 }, data, "")).toBe(true);
	});

	it("in", () => {
		expect(evaluateCondition({ left: "count", op: "in", right: [0, 1] }, data, "")).toBe(true);
		expect(evaluateCondition({ left: "tags", op: "in", right: [["a", "b"]] }, data, "")).toBe(
			true
		);
		expect(evaluateCondition({ left: "count", op: "in", right: ["0"] }, data, "")).toBe(false);
	});

	it("notIn", () => {
		expect(
			evaluateCondition({ left: "mode", op: "notIn", right: ["auto", "off"] }, data, "")
		).toBe(true);
		expect(evaluateCondition({ left: "mode", op: "notIn", right: ["custom"] }, data, "")).toBe(
			false
		);
	});

	it("truthy", () => {
		expect(evaluateCondition({ left: "mode", op: "truthy", right: true }, data, "")).toBe(true);
		expect(evaluateCondition({ left: "count", op: "truthy", right: true }, data, "")).toBe(
			false
		);
		expect(evaluateCondition({ left: "count", op: "truthy", right: false }, data, "")).toBe(
			true
		);
		expect(evaluateCondition({ left: "missing", op: "truthy", right: false }, data, "")).toBe(
			true
		);
	});

	it("and or not 组合", () => {
		const yes: Condition = { left: "mode", op: "eq", right: "custom" };
		const no: Condition = { left: "mode", op: "eq", right: "auto" };
		expect(evaluateCondition({ op: "and", conditions: [yes, yes] }, data, "")).toBe(true);
		expect(evaluateCondition({ op: "and", conditions: [yes, no] }, data, "")).toBe(false);
		// 空的组合不合法, 求值为 false.
		expect(evaluateCondition({ op: "and", conditions: [] }, data, "")).toBe(false);
		expect(evaluateCondition({ op: "or", conditions: [no, yes] }, data, "")).toBe(true);
		expect(evaluateCondition({ op: "or", conditions: [no] }, data, "")).toBe(false);
		expect(evaluateCondition({ op: "or", conditions: [] }, data, "")).toBe(false);
		expect(evaluateCondition({ op: "not", condition: no }, data, "")).toBe(true);
		expect(
			evaluateCondition(
				{
					op: "not",
					condition: {
						op: "and",
						conditions: [
							yes,
							{ op: "or", conditions: [no, { op: "not", condition: no }] },
						],
					},
				},
				data,
				""
			)
		).toBe(false);
	});

	it("* 取当前节点实际路径中同一位置的下标", () => {
		const cond: Condition = { left: "rows[*].kind", op: "eq", right: "image" };
		expect(evaluateCondition(cond, data, "/rows/0/cells/1")).toBe(true);
		expect(evaluateCondition(cond, data, "/rows/1/cells/0")).toBe(false);
		const nested: Condition = { left: "rows[*].cells[*].on", op: "eq", right: true };
		expect(evaluateCondition(nested, data, "/rows/0/cells/0/on")).toBe(true);
		expect(evaluateCondition(nested, data, "/rows/0/cells/1/on")).toBe(false);
		// dataPath 比 left 短, "*" 无从取值时按字段不存在处理.
		expect(evaluateCondition(cond, data, "")).toBe(false);
	});

	it("gt gte lt lte 只比较数值, 非数值为假", () => {
		expect(evaluateCondition({ left: "count", op: "gt", right: -1 }, data, "")).toBe(true);
		expect(evaluateCondition({ left: "count", op: "gt", right: 0 }, data, "")).toBe(false);
		expect(evaluateCondition({ left: "count", op: "gte", right: 0 }, data, "")).toBe(true);
		expect(evaluateCondition({ left: "count", op: "lt", right: 1 }, data, "")).toBe(true);
		expect(evaluateCondition({ left: "count", op: "lte", right: -1 }, data, "")).toBe(false);
		expect(evaluateCondition({ left: "mode", op: "gt", right: 0 }, data, "")).toBe(false);
		expect(evaluateCondition({ left: "missing", op: "lt", right: 100 }, data, "")).toBe(false);
		expect(evaluateCondition({ left: "n", op: "gt", right: 1 }, { n: "5" }, "")).toBe(false);
	});

	it("base: node 从当前节点所在对象起算, * 按拼接后的位置取下标", () => {
		expect(
			evaluateCondition(
				{ base: "node", left: "kind", op: "eq", right: "image" },
				data,
				"/rows/0/cells"
			)
		).toBe(true);
		expect(
			evaluateCondition(
				{ base: "node", left: "kind", op: "eq", right: "image" },
				data,
				"/rows/1/cells"
			)
		).toBe(false);
		expect(
			evaluateCondition(
				{ base: "node", left: "color", op: "eq", right: "red" },
				data,
				"/style/size"
			)
		).toBe(true);
		expect(
			evaluateCondition(
				{ base: "node", left: "mode", op: "eq", right: "custom" },
				data,
				"/count"
			)
		).toBe(true);
		expect(
			evaluateCondition(
				{ base: "node", left: "cells[*].on", op: "eq", right: true },
				data,
				"/rows/0/cells/0/on"
			)
		).toBe(false);
		expect(
			evaluateCondition(
				{ base: "node", left: "on", op: "truthy", right: true },
				data,
				"/rows/0/cells/0/x"
			)
		).toBe(true);
		expect(
			evaluateCondition(
				{ base: "node", left: "on", op: "truthy", right: true },
				data,
				"/rows/0/cells/1/x"
			)
		).toBe(false);
	});

	it("不可识别的条件为 false, 键名含特殊字符经括号写法", () => {
		expect(evaluateCondition({} as Condition, data, "")).toBe(false);
		expect(evaluateCondition({ left: "mode" } as Condition, data, "")).toBe(false);
		expect(
			evaluateCondition(
				{ left: "mode", op: "nope", right: 1 } as unknown as Condition,
				data,
				""
			)
		).toBe(false);
		expect(evaluateCondition({ left: "['a/b']", op: "eq", right: 1 }, { "a/b": 1 }, "")).toBe(
			true
		);
	});
});
