// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { JsonSchema } from "@jotl/core";
import {
	PageWidget,
	InputWidget,
	type HtmlFieldProps,
	type HtmlLayoutProps,
} from "../../src/html/index.js";
import { createDefaultRegistry, JotlForm, type JotlFormHandle } from "../../src/react/index.js";
import { byPath, renderForm } from "./helpers.js";

const PERSON: JsonSchema = {
	type: "object",
	properties: {
		name: { type: "string", title: "姓名" },
		city: { type: "string", title: "城市" },
		address: {
			type: "object",
			properties: { street: { type: "string" }, zip: { type: "string" } },
		},
	},
};

function countingRegistry(counts: Map<string, number>) {
	const registry = createDefaultRegistry().extend();
	const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
	registry.register({
		name: "input",
		level: "field",
		component: (props: HtmlFieldProps<string>) => {
			bump(props.dataPath);
			return <InputWidget {...props} />;
		},
	});
	registry.register({
		name: "page",
		level: "layout",
		component: (props: HtmlLayoutProps) => {
			bump(`object:${props.dataPath}`);
			return <PageWidget {...props} />;
		},
	});
	return registry;
}

describe("字段级订阅(R9)", () => {
	it("修改一个字段只重渲染该字段, 兄弟字段与容器不重渲染", () => {
		const counts = new Map<string, number>();
		renderForm({
			schema: PERSON,
			registry: countingRegistry(counts),
			defaultValue: { name: "a", city: "b", address: { street: "s", zip: "z" } },
		});
		const before = new Map(counts);
		fireEvent.change(byPath("/name")!, { target: { value: "ab" } });
		expect(counts.get("/name")).toBe(before.get("/name")! + 1);
		for (const key of [
			"/city",
			"/address/street",
			"/address/zip",
			"object:",
			"object:/address",
		])
			expect(counts.get(key)).toBe(before.get(key));
		fireEvent.change(byPath("/address/zip")!, { target: { value: "z2" } });
		expect(counts.get("/address/zip")).toBe(before.get("/address/zip")! + 1);
		expect(counts.get("/address/street")).toBe(before.get("/address/street"));
		expect(counts.get("/name")).toBe(before.get("/name")! + 1);
		expect(counts.get("object:/address")).toBe(before.get("object:/address"));
	});

	it("受控模式下父组件随每次输入重渲染, 未改动的字段仍不重渲染", () => {
		const counts = new Map<string, number>();
		const registry = countingRegistry(counts);
		function Parent() {
			const [value, setValue] = useState<unknown>({ name: "a", city: "b" });
			return (
				<JotlForm
					id="f"
					schema={PERSON}
					registry={registry}
					value={value}
					onChange={setValue}
				/>
			);
		}
		render(<Parent />);
		const before = new Map(counts);
		fireEvent.change(byPath("/name")!, { target: { value: "ax" } });
		expect((byPath("/name") as HTMLInputElement).value).toBe("ax");
		expect(counts.get("/city")).toBe(before.get("/city"));
		expect(counts.get("object:")).toBe(before.get("object:"));
	});
});

describe("受控与非受控(R1)", () => {
	it("非受控: defaultValue 为初始值, 改动经 onChange 通知", () => {
		const onChange = vi.fn();
		const { handle } = renderForm({ schema: PERSON, defaultValue: { name: "张三" }, onChange });
		expect((byPath("/name") as HTMLInputElement).value).toBe("张三");
		fireEvent.change(byPath("/city")!, { target: { value: "上海" } });
		expect(onChange).toHaveBeenLastCalledWith({ name: "张三", city: "上海" });
		expect(handle().getValues()).toEqual({ name: "张三", city: "上海" });
	});

	it("受控: 值来自 value, 父组件采纳 onChange 后更新", () => {
		function Parent() {
			const [value, setValue] = useState<unknown>({ name: "a" });
			return (
				<>
					<JotlForm id="f" schema={PERSON} value={value} onChange={setValue} />
					<output data-testid="mirror">{JSON.stringify(value)}</output>
					<button type="button" onClick={() => setValue({ name: "外部" })}>
						外部改值
					</button>
				</>
			);
		}
		const { getByTestId, getByText } = render(<Parent />);
		fireEvent.change(byPath("/name")!, { target: { value: "ab" } });
		expect(getByTestId("mirror").textContent).toBe(JSON.stringify({ name: "ab" }));
		fireEvent.click(getByText("外部改值"));
		expect((byPath("/name") as HTMLInputElement).value).toBe("外部");
	});

	it("受控: 父组件不采纳改动时恢复为受控值", () => {
		const onChange = vi.fn();
		render(<JotlForm id="f" schema={PERSON} value={{ name: "固定" }} onChange={onChange} />);
		fireEvent.change(byPath("/name")!, { target: { value: "改动" } });
		expect(onChange).toHaveBeenCalledWith({ name: "改动" });
		expect((byPath("/name") as HTMLInputElement).value).toBe("固定");
	});
});

describe("默认值初始化(R2)", () => {
	const WITH_DEFAULTS: JsonSchema = {
		type: "object",
		properties: {
			title: { type: "string", default: "无标题" },
			count: { type: "integer", default: 1 },
			note: { type: "string" },
		},
	};

	it("非受控: 用 fillDefaults 补全缺失字段, 已有值不覆盖", () => {
		const { handle } = renderForm({ schema: WITH_DEFAULTS, defaultValue: { count: 5 } });
		expect(handle().getValues()).toEqual({ title: "无标题", count: 5 });
		expect((byPath("/title") as HTMLInputElement).value).toBe("无标题");
	});

	it("没有初始值时生成默认数据", () => {
		const { handle } = renderForm({ schema: WITH_DEFAULTS });
		expect(handle().getValues()).toEqual({ title: "无标题", count: 1 });
	});

	it("受控: 补全后通过 onChange 回报一次", () => {
		const onChange = vi.fn();
		render(
			<JotlForm id="f" schema={WITH_DEFAULTS} value={{ note: "n" }} onChange={onChange} />
		);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith({ title: "无标题", count: 1, note: "n" });
	});

	it("受控: 没有可补的默认值时不回报", () => {
		const onChange = vi.fn();
		render(
			<JotlForm
				id="f"
				schema={WITH_DEFAULTS}
				value={{ title: "t", count: 2 }}
				onChange={onChange}
			/>
		);
		expect(onChange).not.toHaveBeenCalled();
	});
});

describe("mock 初始数据", () => {
	const SCHEMA: JsonSchema = {
		type: "object",
		properties: {
			name: { type: "string", minLength: 1 },
			age: { type: "integer", minimum: 0, maximum: 120 },
			title: { type: "string", default: "无标题" },
		},
		required: ["name", "age"],
	};

	it("initialData 为 mock 时用 mock() 生成且通过校验; 同一 mockSeed 生成同样的数据, reset 回到它", () => {
		const first = renderForm({ schema: SCHEMA, initialData: "mock", mockSeed: 7 });
		const value = first.handle().getValues() as Record<string, unknown>;
		expect(typeof value.name).toBe("string");
		expect(Number.isInteger(value.age)).toBe(true);
		expect(first.handle().validate().valid).toBe(true);
		fireEvent.change(byPath("/name") as HTMLInputElement, { target: { value: "改" } });
		first.handle().reset();
		expect(first.handle().getValues()).toEqual(value);
		first.unmount();
		const second = renderForm({ schema: SCHEMA, initialData: "mock", mockSeed: 7 });
		expect(second.handle().getValues()).toEqual(value);
	});

	it("传了 defaultValue 时仍按默认值补全, 不用 mock; 默认为 defaults", () => {
		expect(
			renderForm({ schema: SCHEMA, initialData: "mock", defaultValue: { name: "n" } })
				.handle()
				.getValues()
		).toEqual({ name: "n", title: "无标题" });
	});
});

describe("schema 变化与引用稳定", () => {
	const V1: JsonSchema = {
		type: "object",
		properties: { title: { type: "string", title: "标题", minLength: 3, default: "旧" } },
	};
	const V2: JsonSchema = {
		type: "object",
		properties: {
			name: { type: "string", title: "名称", default: "新" },
			n: { type: "integer", default: 2 },
		},
	};

	it("非受控: schema 变化时按新 schema 重新取默认值, 清掉触碰与错误, 经 onChange 通知", () => {
		const onChange = vi.fn();
		const view = render(<JotlForm id="f" drill={false} schema={V1} onChange={onChange} />);
		fireEvent.change(byPath("/title")!, { target: { value: "x" } });
		fireEvent.blur(byPath("/title")!);
		expect(document.getElementById("f:/title-errors")).not.toBeNull();
		view.rerender(<JotlForm id="f" drill={false} schema={V2} onChange={onChange} />);
		expect((byPath("/name") as HTMLInputElement).value).toBe("新");
		expect(byPath("/title")).toBeNull();
		expect(document.querySelector(".jotl-error")).toBeNull();
		expect(onChange).toHaveBeenLastCalledWith({ name: "新", n: 2 });
		// 回到旧 schema: 不保留之前的输入与错误.
		view.rerender(<JotlForm id="f" drill={false} schema={V1} onChange={onChange} />);
		expect((byPath("/title") as HTMLInputElement).value).toBe("旧");
		expect(document.querySelector(".jotl-error")).toBeNull();
	});

	it("非受控: 有 defaultValue 时按它与新 schema 的默认值重新初始化; initialData 为 mock 时重新 mock", () => {
		const view = render(
			<JotlForm id="f" drill={false} schema={V1} defaultValue={{ name: "保留" }} />
		);
		view.rerender(
			<JotlForm id="f" drill={false} schema={V2} defaultValue={{ name: "保留" }} />
		);
		expect((byPath("/name") as HTMLInputElement).value).toBe("保留");
		expect((byPath("/n") as HTMLInputElement).value).toBe("2");
		view.unmount();
		const M2: JsonSchema = {
			type: "object",
			properties: { age: { type: "integer", minimum: 1, maximum: 9 } },
			required: ["age"],
		};
		const ref = createRef<JotlFormHandle>();
		const mocked = render(
			<JotlForm id="f" ref={ref} drill={false} schema={V1} initialData="mock" mockSeed={1} />
		);
		mocked.rerender(
			<JotlForm id="f" ref={ref} drill={false} schema={M2} initialData="mock" mockSeed={1} />
		);
		expect(Number.isInteger((ref.current!.getValues() as { age: unknown }).age)).toBe(true);
	});

	it("内容相同的新 schema 对象不重新初始化", () => {
		const view = render(<JotlForm id="f" drill={false} schema={structuredClone(V1)} />);
		fireEvent.change(byPath("/title")!, { target: { value: "改过" } });
		view.rerender(<JotlForm id="f" drill={false} schema={structuredClone(V1)} />);
		expect((byPath("/title") as HTMLInputElement).value).toBe("改过");
	});

	it("受控: schema 变化不改数据", () => {
		const onChange = vi.fn();
		const view = render(
			<JotlForm
				id="f"
				drill={false}
				schema={V1}
				value={{ title: "受控" }}
				onChange={onChange}
			/>
		);
		view.rerender(
			<JotlForm
				id="f"
				drill={false}
				schema={V2}
				value={{ title: "受控", name: "n", n: 1 }}
				onChange={onChange}
			/>
		);
		expect((byPath("/name") as HTMLInputElement).value).toBe("n");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("每次渲染新建内容相同的 adapters 与 registry 不让字段重渲染", () => {
		const counts = new Map<string, number>();
		const component = countingRegistry(counts).get("input")!.component;
		const upload = async () => "u";
		const make = () => {
			const registry = createDefaultRegistry().extend();
			registry.register({ name: "input", level: "field", component });
			return registry;
		};
		const view = render(
			<JotlForm
				id="f"
				drill={false}
				schema={PERSON}
				registry={make()}
				adapters={{ upload }}
			/>
		);
		const before = counts.get("/name");
		view.rerender(
			<JotlForm
				id="f"
				drill={false}
				schema={PERSON}
				registry={make()}
				adapters={{ upload }}
			/>
		);
		expect(counts.get("/name")).toBe(before);
		// 内容变化时照常生效.
		view.rerender(
			<JotlForm
				id="f"
				drill={false}
				schema={PERSON}
				registry={make()}
				adapters={{ upload: async () => "v" }}
			/>
		);
		expect(counts.get("/name")).toBe(before! + 1);
	});
});
