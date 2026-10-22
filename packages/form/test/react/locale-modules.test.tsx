// @vitest-environment jsdom
// 表单语言(locale prop)与扩展组件模块(moduleWidgetRegistrations, schemaModules).
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JsonSchema } from "@jotl/core";
import type { FieldProps } from "../../src/core/index.js";
import {
	createDefaultRegistry,
	moduleWidgetRegistrations,
	schemaWidgetModules,
	type DegradeEvent,
} from "../../src/react/index.js";
import { byPath, renderForm } from "./helpers.js";

describe("locale", () => {
	const schema: JsonSchema = {
		type: "object",
		properties: {
			name: { type: "string", minLength: 3 },
			links: {
				type: "array",
				items: { type: "object", properties: { text: { type: "string" } } },
			},
		},
	};

	it("en: 渲染器文案与校验消息为英文", () => {
		const { handle } = renderForm({
			schema,
			defaultValue: { name: "x", links: [{}] },
			locale: "en",
			collapsible: true,
		});
		expect(document.body.textContent).toContain("1 item");
		act(() => {
			handle().validate();
		});
		expect(document.body.textContent).not.toMatch(/[一-鿿]/);
	});

	it("缺省为中文", () => {
		renderForm({ schema, defaultValue: { name: "x", links: [{}] }, collapsible: true });
		expect(document.body.textContent).toContain("1 项");
	});

	it("可区分联合数组新增项写入第一个分支的区分字段", () => {
		const onChange = vi.fn();
		const union: JsonSchema = {
			type: "object",
			properties: {
				blocks: {
					type: "array",
					items: {
						oneOf: [
							{
								type: "object",
								properties: { kind: { const: "text" }, body: { type: "string" } },
								required: ["kind"],
							},
							{
								type: "object",
								properties: { kind: { const: "image" }, src: { type: "string" } },
								required: ["kind"],
							},
						],
					},
				},
			},
		};
		renderForm({ schema: union, defaultValue: { blocks: [] }, onChange });
		fireEvent.click(screen.getByRole("button", { name: /新增/ }));
		expect(onChange).toHaveBeenLastCalledWith({
			blocks: [expect.objectContaining({ kind: "text" })],
		});
	});
});

function Picker(props: FieldProps<string>) {
	return (
		<input
			id={props.id}
			data-picker="1"
			value={props.value ?? ""}
			onChange={e => props.onChange(e.target.value)}
		/>
	);
}

describe("扩展组件模块", () => {
	it("moduleWidgetRegistrations: 按 export 取导出, 相对地址按 baseUrl 解析, 缺省级别为 field", async () => {
		const importer = vi.fn(async () => ({ default: () => null, Named: Picker }));
		const [a, b] = moduleWidgetRegistrations(
			{ A: { module: "./a.js" }, B: { module: "https://cdn.example/b.js", export: "Named" } },
			{ importer, baseUrl: "https://host.example/x/" }
		);
		expect(a!.level).toBe("field");
		await a!.load!();
		expect(importer).toHaveBeenLastCalledWith("https://host.example/x/a.js");
		expect(await b!.load!()).toBe(Picker);
		await expect(
			moduleWidgetRegistrations({ C: { module: "c", export: "missing" } }, { importer })[0]!
				.load!()
		).rejects.toThrow("missing");
	});

	it("moduleWidgetRegistrations: 导出不是组件时的错误文案按 locale 选项取语言", async () => {
		const importer = async () => ({ default: 1 });
		await expect(
			moduleWidgetRegistrations({ C: { module: "c" } }, { importer, locale: "en" })[0]!
				.load!()
		).rejects.toThrow("Widget C: export default of module c is not a React component");
		await expect(
			moduleWidgetRegistrations({ C: { module: "c" } }, { importer })[0]!.load!()
		).rejects.toThrow("扩展组件 C: 模块 c 的导出 default 不是 React 组件");
	});

	it("schemaWidgetModules 只取带 module 的声明", () => {
		expect(
			schemaWidgetModules({
				"x-ui": {
					widgets: {
						A: { module: "m", export: "X" },
						B: { base: "string" },
						C: "string",
					},
				},
			} as unknown as JsonSchema)
		).toEqual({ A: { module: "m", export: "X" } });
	});

	it("schemaWidgetModules 读取 level 并传到登记结果; 不合法的 level 忽略, 按 field 登记", () => {
		const modules = schemaWidgetModules({
			"x-ui": {
				widgets: {
					L: { module: "l", level: "layout" },
					C: { module: "c", export: "C", level: "composite" },
					F: { module: "f" },
					Bad: { module: "b", level: "row" },
				},
			},
		} as unknown as JsonSchema);
		expect(modules).toEqual({
			L: { module: "l", level: "layout" },
			C: { module: "c", export: "C", level: "composite" },
			F: { module: "f" },
			Bad: { module: "b" },
		});
		expect(
			Object.fromEntries(moduleWidgetRegistrations(modules).map(r => [r.name, r.level]))
		).toEqual({ L: "layout", C: "composite", F: "field", Bad: "field" });
	});

	const schema = {
		type: "object",
		"x-ui": { widgets: { Picker: { module: "https://cdn.example/picker.js" } } },
		properties: { img: { type: "string", "x-ui": { widget: "Picker" } } },
	} as JsonSchema;

	it("schemaModules: 读根 x-ui.widgets 登记并加载", async () => {
		const importer = vi.fn(async () => ({ default: Picker }));
		renderForm({ schema, defaultValue: { img: "a" }, schemaModules: { importer } });
		await waitFor(() => expect(byPath("/img")?.getAttribute("data-picker")).toBe("1"));
		expect(importer).toHaveBeenCalledWith("https://cdn.example/picker.js");
	});

	it("schemaModules 缺省关闭; 加载失败按 F9 显示失败与重试", async () => {
		const events: DegradeEvent[] = [];
		const { unmount } = renderForm({
			schema,
			defaultValue: { img: "a" },
			onDegrade: e => events.push(e),
		});
		expect(byPath("/img")?.getAttribute("data-picker")).toBeNull();
		unmount();
		let attempt = 0;
		const importer = async () => {
			attempt += 1;
			if (attempt === 1) throw new Error("网络错误");
			return { default: Picker };
		};
		renderForm({
			schema,
			defaultValue: { img: "a" },
			schemaModules: { importer },
			onDegrade: e => events.push(e),
		});
		await screen.findByText("组件加载失败");
		expect(events.some(e => e.code === "F9" && e.from === "Picker")).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "重试" }));
		await waitFor(() => expect(byPath("/img")?.getAttribute("data-picker")).toBe("1"));
	});
	it("schemaModules 加载失败的错误文案取表单的 locale", async () => {
		const events: DegradeEvent[] = [];
		const importer = async () => ({ default: "not a component" });
		const enSchema = {
			...(schema as object),
			"x-ui": { widgets: { Picker: { module: "https://cdn.example/picker-en.js" } } },
		} as JsonSchema;
		renderForm({
			schema: enSchema,
			defaultValue: { img: "a" },
			locale: "en",
			schemaModules: { importer },
			onDegrade: e => events.push(e),
		});
		await waitFor(() => expect(events.some(e => e.code === "F9")).toBe(true));
		const error = events.find(e => e.code === "F9")!.error as Error;
		expect(error.message).toBe(
			"Widget Picker: export default of module https://cdn.example/picker-en.js is not a React component"
		);
	});

	it("直接调用 moduleWidgetRegistrations 不传 locale 时, 加载失败文案取触发加载的表单的 locale", async () => {
		const events: DegradeEvent[] = [];
		const registry = createDefaultRegistry().extend();
		const importer = async () => ({ default: "not a component" });
		for (const r of moduleWidgetRegistrations(
			{ Picker: { module: "https://cdn.example/picker-direct.js" } },
			{ importer }
		))
			registry.register(r);
		const plain = {
			type: "object",
			properties: { img: { type: "string", "x-ui": { widget: "Picker" } } },
		} as JsonSchema;
		renderForm({
			schema: plain,
			registry,
			defaultValue: { img: "a" },
			locale: "en",
			onDegrade: e => events.push(e),
		});
		await waitFor(() => expect(events.some(e => e.code === "F9")).toBe(true));
		expect((events.find(e => e.code === "F9")!.error as Error).message).toBe(
			"Widget Picker: export default of module https://cdn.example/picker-direct.js is not a React component"
		);
	});
});
