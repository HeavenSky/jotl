import { BUILTIN_WIDGETS, type Registry, type WidgetRegistration } from "../../src/core/index.js";
import { describe, expect, it } from "vitest";
import { htmlWidgets, registerHtmlWidgets } from "../../src/html/index.js";

/** 测试内的最小注册表, 正式实现在 core/. */
function createRegistry<C>(parent?: Registry<C>): Registry<C> {
	const own = new Map<string, WidgetRegistration<C>>();
	const registry: Registry<C> = {
		register: r => void own.set(r.name, r),
		get: name => own.get(name) ?? parent?.get(name),
		extend: () => createRegistry(registry),
		list: () => {
			const merged = new Map((parent?.list() ?? []).map(r => [r.name, r] as const));
			for (const [name, r] of own) merged.set(name, r);
			return [...merged.values()];
		},
	};
	return registry;
}

/** 每个内置组件名都要有实现. */
const IMPLEMENTED_NAMES = Object.keys(BUILTIN_WIDGETS).sort();

const byName = (name: string) => {
	const registration = htmlWidgets.find(r => r.name === name);
	if (registration === undefined) throw new Error(`未登记 ${name}`);
	return registration;
};

describe("htmlWidgets", () => {
	it("名字与 BUILTIN_WIDGETS 中的全部名字一一对应, 无重复", () => {
		const names = htmlWidgets.map(r => r.name);
		expect(new Set(names).size).toBe(names.length);
		expect([...names].sort()).toEqual(IMPLEMENTED_NAMES);
		for (const name of [
			"richtext",
			"nullable",
			"union",
			"kv",
			"tree",
			"tuple",
			"money",
			"bigint",
			"switch",
			"password",
			"range",
		])
			expect(names).toContain(name);
	});

	it("层级取自 BUILTIN_WIDGETS, 每项都有组件, 不带 accepts(形态检查在 core/)", () => {
		for (const r of htmlWidgets) {
			expect(r.level).toBe(BUILTIN_WIDGETS[r.name as keyof typeof BUILTIN_WIDGETS].level);
			expect(typeof r.component).toBe("function");
			expect(r.accepts).toBeUndefined();
		}
		expect(byName("page").component).toBe(byName("inline").component);
	});
});

describe("registerHtmlWidgets", () => {
	it("把全部组件登记到注册表, 子注册表可覆盖同名项", () => {
		const registry = createRegistry<unknown>();
		registerHtmlWidgets(registry);
		expect(
			registry
				.list()
				.map(r => r.name)
				.sort()
		).toEqual(IMPLEMENTED_NAMES);
		expect(registry.get("input")?.component).toBe(byName("input").component);

		const child = registry.extend();
		const Custom = () => null;
		child.register({ name: "input", level: "field", component: Custom });
		expect(child.get("input")?.component).toBe(Custom);
		expect(child.get("number")?.component).toBe(byName("number").component);
		expect(registry.get("input")?.component).toBe(byName("input").component);
	});
});
