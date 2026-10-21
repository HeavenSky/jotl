// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { JsonSchema } from "@jotl/core";
import { createRegistry, type FieldProps } from "../../src/core/index.js";
import {
	createDefaultRegistry,
	DEGRADE_TARGETS,
	JotlForm,
	type DegradeEvent,
	type ReactWidgetComponent,
} from "../../src/react/index.js";
import { byPath, errorsAt, renderForm } from "./helpers.js";

function Thrower(): ReactNode {
	throw new Error("组件故障");
}

let consoleError: MockInstance;
beforeEach(() => {
	// React 会把错误边界捕获的异常打印到 console.error.
	consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

function codes(events: DegradeEvent[]) {
	return events.map(({ code, dataPath, from, to }) => ({ code, dataPath, from, to }));
}

describe("F4 组件渲染报错", () => {
	it("错误边界按 fallbackChain 依次替换, 每次替换上报一次", () => {
		const schema: JsonSchema = {
			type: "object",
			properties: { title: { type: "string", "x-ui": { widget: "bad1" } } },
			"x-ui": {
				rules: [{ match: { pointer: "/properties/title" }, ui: { widget: "bad2" } }],
			},
		};
		const registry = createDefaultRegistry().extend();
		registry.register({ name: "bad1", level: "field", component: Thrower });
		registry.register({ name: "bad2", level: "field", component: Thrower });
		const events: DegradeEvent[] = [];
		const { handle } = renderForm({
			schema,
			registry,
			onDegrade: e => events.push(e),
			defaultValue: { title: "t" },
		});
		expect((byPath("/title") as HTMLInputElement).type).toBe("text");
		expect(codes(events.filter(e => e.code === "F4"))).toEqual([
			{ code: "F4", dataPath: "/title", from: "bad1", to: "bad2" },
			{ code: "F4", dataPath: "/title", from: "bad2", to: "input" },
		]);
		expect(events.find(e => e.code === "F4")?.error).toBeInstanceOf(Error);
		fireEvent.change(byPath("/title")!, { target: { value: "u" } });
		expect(handle().getValues()).toEqual({ title: "u" });
	});

	it("json 也报错时改用内置最小兜底", () => {
		const registry = createDefaultRegistry().extend();
		registry.register({ name: "input", level: "field", component: Thrower });
		registry.register({ name: "json", level: "field", component: Thrower });
		const events: DegradeEvent[] = [];
		renderForm({
			schema: { type: "object", properties: { a: { type: "string" } } },
			registry,
			onDegrade: e => events.push(e),
			defaultValue: { a: "v" },
		});
		expect((byPath("/a") as HTMLTextAreaElement).value).toBe('"v"');
		expect(events.filter(e => e.code === "F4").map(e => e.to)).toEqual([
			"json",
			DEGRADE_TARGETS.minimalJson,
		]);
	});

	it("外壳报错时不再包外壳, 字段照常渲染", () => {
		const registry = createDefaultRegistry().extend();
		registry.register({ name: "field", level: "decorator", component: Thrower });
		const events: DegradeEvent[] = [];
		renderForm({
			schema: { type: "object", properties: { a: { type: "string" } } },
			registry,
			onDegrade: e => events.push(e),
		});
		expect(byPath("/a")).not.toBeNull();
		expect(
			events.some(e => e.code === "F4" && e.from === "field" && e.to === DEGRADE_TARGETS.none)
		).toBe(true);
	});
});

describe("F5 复合组件报错", () => {
	it("拆开为逐个子节点渲染, 子节点仍可编辑", () => {
		const registry = createDefaultRegistry().extend();
		registry.register({ name: "list", level: "composite", component: Thrower });
		const events: DegradeEvent[] = [];
		const schema: JsonSchema = {
			type: "object",
			properties: { list: { type: "array", items: { type: "string" } } },
		};
		const { handle } = renderForm({
			schema,
			registry,
			onDegrade: e => events.push(e),
			defaultValue: { list: ["a", "b"] },
		});
		expect(codes(events.filter(e => e.code === "F5"))).toEqual([
			{ code: "F5", dataPath: "/list", from: "list", to: DEGRADE_TARGETS.split },
		]);
		expect((byPath("/list/1") as HTMLInputElement).value).toBe("b");
		fireEvent.change(byPath("/list/1")!, { target: { value: "c" } });
		expect(handle().getValues()).toEqual({ list: ["a", "c"] });
	});

	it("接管子树的自定义复合组件报错时按 schema 拆开属性", () => {
		const registry = createDefaultRegistry().extend();
		registry.register({
			name: "card",
			level: "composite",
			component: Thrower,
			claims: () => "all",
		});
		const schema: JsonSchema = {
			type: "object",
			properties: {
				card: {
					type: "object",
					"x-ui": { widget: "card" },
					properties: { img: { type: "string" }, alt: { type: "string" } },
				},
			},
		};
		renderForm({ schema, registry, defaultValue: { card: { img: "i", alt: "a" } } });
		expect((byPath("/card/img") as HTMLInputElement).value).toBe("i");
		expect((byPath("/card/alt") as HTMLInputElement).value).toBe("a");
	});
});

describe("F8 数据与 schema 不符", () => {
	it("保留原值, 标记错误, 该节点用 json; 改成正确类型后恢复原组件", () => {
		const events: DegradeEvent[] = [];
		const schema: JsonSchema = {
			type: "object",
			properties: {
				count: { type: "number", title: "数量" },
				list: { type: "array", items: { type: "string" } },
			},
		};
		const { handle } = renderForm({
			schema,
			onDegrade: e => events.push(e),
			defaultValue: { count: "12", list: { a: 1 } },
		});
		const count = byPath("/count") as HTMLTextAreaElement;
		expect(count.tagName).toBe("TEXTAREA");
		expect(count.value).toBe('"12"');
		expect(errorsAt("/count")?.textContent).toContain("数量");
		expect(byPath("/list")?.tagName).toBe("TEXTAREA");
		expect(handle().getValues()).toEqual({ count: "12", list: { a: 1 } });
		expect(codes(events.filter(e => e.code === "F8"))).toEqual([
			{ code: "F8", dataPath: "/count", from: "number", to: "json" },
			{ code: "F8", dataPath: "/list", from: "list", to: "json" },
		]);
		fireEvent.change(count, { target: { value: "12" } });
		expect((byPath("/count") as HTMLInputElement).type).toBe("number");
		expect(errorsAt("/count")).toBeNull();
	});
});

describe("F8 文案的标签", () => {
	it('没有标题的数组元素用序号, 不用根的 "数据"', () => {
		const schema: JsonSchema = {
			type: "object",
			properties: { list: { type: "array", items: { type: "number" } } },
		};
		const { container } = renderForm({ schema, defaultValue: { list: [1, "x"] } });
		expect(byPath("/list/1")?.tagName).toBe("TEXTAREA");
		expect(container.textContent).toContain("第 2 项 的数据与定义的类型不符");
		expect(container.textContent).not.toContain("数据 的数据");
	});
});

describe("内置最小兜底", () => {
	const SCHEMA: JsonSchema = { type: "object", properties: { a: { type: "string" } } };

	it("未注册任何组件包时不白屏: 显示 JSON 文本框并可编辑", () => {
		const events: DegradeEvent[] = [];
		const { handle, container } = renderForm({
			schema: SCHEMA,
			registry: createRegistry<ReactWidgetComponent>(),
			onDegrade: e => events.push(e),
			defaultValue: { a: "x" },
		});
		const textarea = container.querySelector("textarea")!;
		expect(JSON.parse(textarea.value)).toEqual({ a: "x" });
		fireEvent.change(textarea, { target: { value: '{"a":"y"}' } });
		expect(handle().getValues()).toEqual({ a: "y" });
		fireEvent.change(textarea, { target: { value: '{"a":' } });
		expect(screen.getByRole("alert").textContent).toContain("JSON");
		expect(handle().getValues()).toEqual({ a: "y" });
		expect(events.some(e => e.code === "F1" && e.from === "form")).toBe(true);
	});

	it("查看态为只读 pre", () => {
		const { container } = renderForm({
			schema: SCHEMA,
			registry: createRegistry<ReactWidgetComponent>(),
			mode: "view",
			defaultValue: { a: "x" },
		});
		expect(JSON.parse(container.querySelector("pre")!.textContent!)).toEqual({ a: "x" });
		expect(container.querySelector("textarea")).toBeNull();
	});

	it("schema 无法规划时整个表单用 JSON 编辑并提示", () => {
		const { container } = render(
			<JotlForm schema={"oops" as unknown as JsonSchema} defaultValue={{ a: 1 }} />
		);
		expect(screen.getByRole("alert").textContent).toContain("渲染计划");
		expect(container.querySelector("textarea")).not.toBeNull();
	});
});

describe("F10 降级事件与规划期降级", () => {
	it("plan() 的 F1 F2 F3 F7 也经 onDegrade 上报, 含节点指针, 原组件与替代组件", () => {
		const schema: JsonSchema = {
			type: "object",
			properties: {
				a: { type: "string", "x-ui": { widget: "missing" } },
				b: { type: "string", "x-ui": { widget: "number" } },
				c: { type: "string", "x-ui": { widget: "" } },
				d: { not: { type: "string" } },
			},
		};
		const events: DegradeEvent[] = [];
		renderForm({ schema, onDegrade: e => events.push(e) });
		expect(codes(events)).toEqual(
			expect.arrayContaining([
				{ code: "F1", dataPath: "/a", from: "missing", to: "input" },
				{ code: "F2", dataPath: "/b", from: "number", to: "input" },
				{ code: "F3", dataPath: "/c", from: undefined, to: "input" },
				{ code: "F7", dataPath: "/d", from: undefined, to: "json" },
			])
		);
		expect(events.find(e => e.dataPath === "/a")?.schemaPointer).toBe("/properties/a");
	});

	it("同一节点重渲染不重复上报", () => {
		const events: DegradeEvent[] = [];
		const schema: JsonSchema = {
			type: "object",
			properties: { a: { type: "string", "x-ui": { widget: "missing" } } },
		};
		renderForm({ schema, onDegrade: e => events.push(e) });
		fireEvent.change(byPath("/a")!, { target: { value: "1" } });
		fireEvent.change(byPath("/a")!, { target: { value: "2" } });
		expect(events.filter(e => e.code === "F1")).toHaveLength(1);
	});
});

describe("规划期降级事件去重与外壳未注册", () => {
	it("数组元素移动后不按新路径重报同一降级事件", () => {
		const events: DegradeEvent[] = [];
		const schema: JsonSchema = {
			type: "array",
			items: { type: "string", "x-ui": { widget: "missing" } },
		};
		renderForm({ schema, onDegrade: e => events.push(e), defaultValue: ["a", "b", "c"] });
		const before = codes(events.filter(e => e.code === "F1"));
		expect(before.map(e => e.dataPath).sort()).toEqual(["/0", "/1", "/2"]);
		fireEvent.click(screen.getByRole("button", { name: "下移第 1 项" }));
		fireEvent.click(screen.getByRole("button", { name: "上移第 3 项" }));
		expect(codes(events.filter(e => e.code === "F1"))).toEqual(before);
	});

	it("x-ui.decorator 指定的外壳未注册时改用默认外壳 field, 并上报 F1", () => {
		const events: DegradeEvent[] = [];
		const schema: JsonSchema = {
			type: "object",
			properties: { a: { type: "string", title: "名称", "x-ui": { decorator: "fancy" } } },
		};
		renderForm({ schema, onDegrade: e => events.push(e) });
		expect(screen.getByLabelText("名称")).toBe(byPath("/a"));
		expect(codes(events.filter(e => e.code === "F1"))).toEqual([
			{ code: "F1", dataPath: "/a", from: "fancy", to: "field" },
		]);
	});
});

describe("懒加载组件(W7, F9)", () => {
	function Fancy(props: FieldProps<string, ReactNode>) {
		return (
			<input
				id={props.id}
				data-testid="fancy"
				value={props.value ?? ""}
				onChange={e => props.onChange(e.target.value)}
			/>
		);
	}
	function Placeholder(props: FieldProps<string, ReactNode>) {
		return <span id={props.id} data-testid="placeholder" />;
	}
	const SCHEMA: JsonSchema = {
		type: "object",
		properties: { a: { type: "string", "x-ui": { widget: "fancy" } } },
	};

	function deferred() {
		let resolve!: (c: ReactWidgetComponent) => void;
		let reject!: (e: unknown) => void;
		const promise = new Promise<ReactWidgetComponent>((res, rej) => {
			resolve = res;
			reject = rej;
		});
		return { promise, resolve, reject };
	}

	it("加载中显示登记的占位组件, 加载完成后换成真正的组件", async () => {
		const pending = deferred();
		const registry = createDefaultRegistry().extend();
		registry.register({
			name: "fancy",
			level: "field",
			component: Placeholder,
			load: () => pending.promise,
		});
		const { handle } = renderForm({ schema: SCHEMA, registry, defaultValue: { a: "v" } });
		expect(screen.getByTestId("placeholder")).toBeTruthy();
		await act(async () => pending.resolve(Fancy));
		const input = screen.getByTestId("fancy") as HTMLInputElement;
		expect(input.value).toBe("v");
		fireEvent.change(input, { target: { value: "w" } });
		expect(handle().getValues()).toEqual({ a: "w" });
	});

	it("加载失败: 显示提示与重试, 同时按 F4 降级为下一个候选并上报 F9; 重试成功后换回", async () => {
		let attempt = 0;
		const registry = createDefaultRegistry().extend();
		registry.register({
			name: "fancy",
			level: "field",
			component: Placeholder,
			load: () =>
				++attempt === 1 ? Promise.reject(new Error("网络错误")) : Promise.resolve(Fancy),
		});
		const events: DegradeEvent[] = [];
		renderForm({
			schema: SCHEMA,
			registry,
			onDegrade: e => events.push(e),
			defaultValue: { a: "v" },
		});
		await act(async () => {});
		expect(screen.getByRole("alert").textContent).toContain("组件加载失败");
		expect((byPath("/a") as HTMLInputElement).type).toBe("text");
		expect(codes(events.filter(e => e.code === "F9"))).toEqual([
			{ code: "F9", dataPath: "/a", from: "fancy", to: "input" },
		]);
		await act(async () => fireEvent.click(screen.getByRole("button", { name: "重试" })));
		expect((screen.getByTestId("fancy") as HTMLInputElement).value).toBe("v");
		expect(screen.queryByText("组件加载失败")).toBeNull();
	});
});
