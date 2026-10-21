// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@jotl/core";
import { htmlWidgets } from "../../src/html/index.js";
import type { FieldProps } from "../../src/core/index.js";
import { createDefaultRegistry, JotlForm } from "../../src/react/index.js";
import { byPath, renderForm } from "./helpers.js";

const SCHEMA: JsonSchema = {
	type: "object",
	properties: {
		name: { type: "string" },
		agree: { type: "boolean", title: "同意" },
		avatar: { type: "string", format: "uri", "x-ui": { widget: "image" } },
	},
};

describe("默认注册 @jotl/form 组件", () => {
	it("createDefaultRegistry 登记了 htmlWidgets 的全部组件", () => {
		const registry = createDefaultRegistry();
		for (const registration of htmlWidgets)
			expect(registry.get(registration.name)).toBe(registration);
	});

	it("不传 registry 时用原生 HTML 组件渲染", () => {
		renderForm({ schema: SCHEMA, defaultValue: { name: "n", agree: true } });
		expect(document.querySelector("form.jotl-form")).not.toBeNull();
		expect((byPath("/name") as HTMLInputElement).type).toBe("text");
		expect((byPath("/agree") as HTMLInputElement).checked).toBe(true);
	});
});

describe("实例级注册表覆盖", () => {
	it("在 extend() 得到的注册表中登记同名组件即可替换单个组件, 其余组件不变", () => {
		const registry = createDefaultRegistry().extend();
		registry.register({
			name: "switch",
			level: "field",
			component: (props: FieldProps<boolean, ReactNode>) => (
				<button
					type="button"
					id={props.id}
					role="switch"
					aria-checked={props.value === true}
					onClick={() => props.onChange(props.value !== true)}
				>
					开关
				</button>
			),
		});
		const { handle } = renderForm({ schema: SCHEMA, registry, defaultValue: { agree: false } });
		const toggle = screen.getByRole("switch");
		fireEvent.click(toggle);
		expect(handle().getValues()).toEqual({ agree: true });
		expect((byPath("/name") as HTMLInputElement).type).toBe("text");
	});

	it("实例级覆盖不影响其他表单", () => {
		const registry = createDefaultRegistry().extend();
		registry.register({
			name: "input",
			level: "field",
			component: () => <span data-testid="custom-text" />,
		});
		render(
			<>
				<JotlForm id="a" schema={SCHEMA} registry={registry} />
				<JotlForm id="b" schema={SCHEMA} />
			</>
		);
		expect(screen.getAllByTestId("custom-text")).toHaveLength(1);
		expect((document.getElementById("b:/name") as HTMLInputElement).type).toBe("text");
	});
});

describe("适配器经属性传入", () => {
	it("adapters 原样传给组件; @jotl/form 的图片组件有 upload 时提供文件选择", async () => {
		const upload = async () => "https://cdn.example/x.png";
		const seen: unknown[] = [];
		const registry = createDefaultRegistry().extend();
		registry.register({
			name: "input",
			level: "field",
			component: (props: FieldProps<string, ReactNode>) => {
				seen.push(props.adapters);
				return null;
			},
		});
		const adapters = { upload };
		renderForm({ schema: SCHEMA, registry, adapters });
		expect(seen.at(-1)).toBe(adapters);
		expect(document.querySelector('input[type="file"]')).not.toBeNull();
	});
});
