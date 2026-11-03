import { describe, expect, it } from "vitest";
import { checkXUi } from "../../src/core/index.js";

describe("checkXUi 与 xUiMetaSchema 规则一致", () => {
	it("根 widgets 模块声明", () => {
		expect(
			checkXUi({
				version: 1,
				widgets: { ImagePicker: { module: "https://x/y.js", export: "Picker" } },
			})
		).toBeUndefined();
		expect(checkXUi({ widgets: { ImagePicker: {} } })).toEqual({
			path: "/widgets/ImagePicker/module",
			kind: "required",
		});
		expect(checkXUi({ widgets: { Panel: { module: "a", level: "layout" } } })).toBeUndefined();
		expect(checkXUi({ widgets: { Panel: { module: "a", level: "row" } } })).toEqual({
			path: "/widgets/Panel/level",
			kind: "enum",
		});
		expect(checkXUi({ widgets: { ImagePicker: { module: "a", extra: 1 } } })).toEqual({
			path: "/widgets/ImagePicker/extra",
			kind: "unknownKey",
		});
		expect(
			checkXUi({
				widgets: {
					A: { base: "url", module: "a" },
					B: { base: { type: "string" }, module: "b" },
				},
			})
		).toBeUndefined();
		expect(checkXUi({ widgets: { A: { base: "", module: "a" } } })).toEqual({
			path: "/widgets/A/base",
			kind: "empty",
		});
		expect(checkXUi({ widgets: { A: { base: 1, module: "a" } } })).toEqual({
			path: "/widgets/A/base",
			kind: "type",
		});
		expect(checkXUi({ widgets: { "": { module: "a" } } })).toEqual({
			path: "/widgets/",
			kind: "empty",
		});
	});

	it("合法的完整 x-ui", () => {
		expect(
			checkXUi({
				widget: "w",
				summary: "name",
				thousands: true,
				props: { a: 1 },
				decorator: false,
				order: ["a"],
				groups: [{ title: "基本", fields: ["a"] }],
				layout: "grid",
				columns: 3,
				hidden: false,
				visibleIf: {
					op: "and",
					conditions: [
						{ left: "a", op: "eq", right: 1 },
						{
							op: "or",
							conditions: [
								{ left: "b", op: "in", right: [1] },
								{ op: "not", condition: { left: "c", op: "truthy", right: true } },
								{ base: "node", left: "d", op: "gte", right: 1 },
							],
						},
					],
				},
				variants: { view: { widget: "input", columns: 1 } },
				rules: [
					{
						match: {
							pointer: "/*",
							type: "string",
							format: "uri",
							enum: false,
							widget: "input",
						},
						ui: { widget: "url" },
					},
				],
				version: 1,
			})
		).toBeUndefined();
		expect(checkXUi({})).toBeUndefined();
		expect(
			checkXUi({ columns: 2.0, visibleIf: { left: "a", op: "eq", right: null } })
		).toBeUndefined();
	});

	const INVALID: [string, unknown, string, string][] = [
		["不是对象", [], "", "type"],
		["未知字段", { color: "red" }, "/color", "unknownKey"],
		["空组件名", { widget: "" }, "/widget", "empty"],
		["组件名不是字符串", { widget: 1 }, "/widget", "type"],
		["props 是数组", { props: [] }, "/props", "type"],
		["decorator 为 true", { decorator: true }, "/decorator", "type"],
		["decorator 为空串", { decorator: "" }, "/decorator", "empty"],
		["order 含非字符串", { order: ["a", 1] }, "/order/1", "type"],
		["groups 缺 fields", { groups: [{ title: "x" }] }, "/groups/0/fields", "required"],
		[
			"groups 多余字段",
			{ groups: [{ title: "x", fields: [], extra: 1 }] },
			"/groups/0/extra",
			"unknownKey",
		],
		["layout 取值非法", { layout: "flex" }, "/layout", "enum"],
		["columns 非整数", { columns: 1.5 }, "/columns", "type"],
		["columns 小于 1", { columns: 0 }, "/columns", "minimum"],
		["hidden 非布尔", { hidden: "yes" }, "/hidden", "type"],
		["semantic 已移除", { semantic: "Text" }, "/semantic", "unknownKey"],
		["summary 为空串", { summary: "" }, "/summary", "empty"],
		["thousands 非布尔", { thousands: "yes" }, "/thousands", "type"],
		["version 非 1", { version: 2 }, "/version", "enum"],
		[
			"变体含 rules",
			{ variants: { view: { rules: [] } } },
			"/variants/view/rules",
			"unknownKey",
		],
		["规则缺 ui", { rules: [{ match: {} }] }, "/rules/0/ui", "required"],
		[
			"规则 match 未知条件",
			{ rules: [{ match: { name: "x" }, ui: {} }] },
			"/rules/0/match/name",
			"unknownKey",
		],
		[
			"规则 ui 含 variants",
			{ rules: [{ match: {}, ui: { variants: {} } }] },
			"/rules/0/ui/variants",
			"unknownKey",
		],
		[
			"规则 match.enum 非布尔",
			{ rules: [{ match: { enum: "yes" }, ui: {} }] },
			"/rules/0/match/enum",
			"type",
		],
		["叶子缺 right", { visibleIf: { left: "a", op: "eq" } }, "/visibleIf/right", "required"],
		[
			"叶子多余键",
			{ visibleIf: { left: "a", op: "eq", right: 1, like: 1 } },
			"/visibleIf",
			"condition",
		],
		[
			"gt 非数值",
			{ visibleIf: { left: "a", op: "gt", right: "1" } },
			"/visibleIf/right",
			"type",
		],
		[
			"base 取值非法",
			{ visibleIf: { left: "a", base: "parent", op: "eq", right: 1 } },
			"/visibleIf/base",
			"enum",
		],
		[
			"只有 left 与 base",
			{ visibleIf: { left: "a", base: "node" } },
			"/visibleIf/op",
			"required",
		],
		[
			"in 不是数组",
			{ visibleIf: { left: "a", op: "in", right: 1 } },
			"/visibleIf/right",
			"type",
		],
		[
			"truthy 非布尔",
			{ visibleIf: { left: "a", op: "truthy", right: 1 } },
			"/visibleIf/right",
			"type",
		],
		[
			"left 非字符串",
			{ visibleIf: { left: 1, op: "eq", right: 1 } },
			"/visibleIf/left",
			"type",
		],
		[
			"op 取值非法",
			{ visibleIf: { left: "a", op: "like", right: 1 } },
			"/visibleIf/op",
			"enum",
		],
		[
			"and 与 not 并存",
			{ visibleIf: { op: "and", conditions: [], condition: {} } },
			"/visibleIf",
			"condition",
		],
		[
			"conditions 不是数组",
			{ visibleIf: { op: "and", conditions: {} } },
			"/visibleIf/conditions",
			"type",
		],
		[
			"空的条件数组",
			{ visibleIf: { op: "and", conditions: [] } },
			"/visibleIf/conditions",
			"empty",
		],
		[
			"嵌套条件非法",
			{ visibleIf: { op: "not", condition: { op: "and", conditions: [{ left: "a" }] } } },
			"/visibleIf/condition/conditions/0/op",
			"required",
		],
	];

	for (const [title, value, path, kind] of INVALID) {
		it(title, () => {
			expect(checkXUi(value)).toEqual({ path, kind });
		});
	}
});
