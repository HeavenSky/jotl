// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { BUILTIN_WIDGETS } from "@jotl/form/core";
import { JsonWidget } from "@jotl/form";
import {
	AntdInputWidget,
	AntdNullableWidget,
	AntdOutputWidget,
	AntdTreeWidget,
	AntdUnionWidget,
	antdWidgets,
	createAntdRegistry,
	registerAntdWidgets,
} from "../src/index.js";
import { dayjs } from "./helpers.js";

describe("登记", () => {
	it("名字都是内置 widget 名, 层级与 BUILTIN_WIDGETS 一致", () => {
		for (const r of antdWidgets({ dayjs })) {
			expect(r.name in BUILTIN_WIDGETS).toBe(true);
			expect(r.level).toBe(BUILTIN_WIDGETS[r.name as keyof typeof BUILTIN_WIDGETS].level);
		}
	});

	it("不传 dayjs 时不登记日期组件", () => {
		const names = (opts?: Parameters<typeof antdWidgets>[0]) =>
			antdWidgets(opts).map(r => r.name);
		expect(names()).not.toContain("date");
		expect(names({ dayjs })).toEqual(expect.arrayContaining(["date", "time", "datetime"]));
	});

	it("createAntdRegistry 覆盖已实现的名字, 其余回落到原生组件", () => {
		const registry = createAntdRegistry();
		expect(registry.get("input")?.component).toBe(AntdInputWidget);
		expect(registry.get("output")?.component).toBe(AntdOutputWidget);
		expect(registry.get("union")?.component).toBe(AntdUnionWidget);
		expect(registry.get("nullable")?.component).toBe(AntdNullableWidget);
		expect(registry.get("tree")?.component).toBe(AntdTreeWidget);
		expect(registry.get("json")?.component).toBe(JsonWidget);
	});

	it("registerAntdWidgets 登记到给定注册表", () => {
		const seen: string[] = [];
		registerAntdWidgets({ register: r => seen.push(r.name) });
		expect(seen).toContain("field");
		expect(seen).toContain("form");
	});
});
