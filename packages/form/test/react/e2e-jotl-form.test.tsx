// @vitest-environment jsdom
// 端到端: .jotl 源码经 @jotl/core 编译为 schema, 再由 JotlForm 渲染, 编辑与校验.
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compile } from "@jotl/core";
import type { JsonSchema } from "@jotl/core";
import { readFixture } from "../../../../test-utils/fixtures.js";
import { JotlForm, nodeId, type DegradeEvent, type JotlFormHandle } from "../../src/react/index.js";

afterEach(cleanup);

function compileFixture(name: string): JsonSchema {
	const fixture = readFixture(name);
	const result = compile(fixture.source ?? "", `${name}/source.jotl`);
	expect(result.diagnostics.filter(d => d.severity === "error")).toEqual([]);
	// 编译结果就是样例的期望 schema, 端到端只在此基础上验证渲染链路.
	expect(result.value?.schema).toEqual(fixture.schema);
	return result.value!.schema;
}

function input(formId: string, path: string): HTMLInputElement {
	const el = document.getElementById(nodeId(formId, path));
	if (
		!(
			el instanceof HTMLInputElement ||
			el instanceof HTMLSelectElement ||
			el instanceof HTMLTextAreaElement
		)
	) {
		throw new Error(`找不到 ${path} 的输入控件`);
	}
	return el as HTMLInputElement;
}

describe("Jotl → schema → 表单", () => {
	it("动态枚举跟随同一对象内的数组变化, 写回原始类型", async () => {
		const result = compile(
			`Form: {
			choices: array[array_item: 'any']
			selected?: enum[options_from: 'choices']
			many?: enum[options_from: 'choices', multiple: true]
		}`,
			"form.jotl"
		);
		expect(result.diagnostics).toEqual([]);
		const ref = createRef<JotlFormHandle>();
		render(
			<JotlForm
				ref={ref}
				id="choices"
				schema={result.value!.schema}
				defaultValue={{ choices: [false, 1, "1", 1, null] }}
			/>
		);
		const select = screen.getByRole<HTMLSelectElement>("combobox");
		const labels = () =>
			Array.from(select.options)
				.slice(1)
				.map(o => o.text);
		expect(labels()).toEqual(["false", "1", "1"]);
		fireEvent.change(select, { target: { value: select.options[2]!.value } });
		expect(ref.current!.getValues()).toMatchObject({ selected: 1 });
		act(() => ref.current!.setValues({ choices: ["new"], selected: 1, many: [false] }));
		expect(labels()).toEqual(["new"]);
		await act(async () => {
			expect((await ref.current!.validate()).valid).toBe(false);
		});
		const multi = screen.getByRole<HTMLSelectElement>("listbox");
		multi.options[0]!.selected = true;
		fireEvent.change(multi);
		fireEvent.change(select, { target: { value: select.options[1]!.value } });
		expect(ref.current!.getValues()).toEqual({
			choices: ["new"],
			selected: "new",
			many: ["new"],
		});
		await act(async () => {
			expect((await ref.current!.validate()).valid).toBe(true);
		});
	});
	it("行内枚举可分别引用当前行和根的带标签选项, 标签变化保留选中值", async () => {
		const result = compile(
			`Form: {
			choices: array[array_item: 'any']
			rows: array {
				choices?: array[array_item: 'any']
				local?: enum[options_from: 'choices']
				shared?: enum[options_from: '$.choices', multiple: true]
			}
		}`,
			"form.jotl"
		);
		expect(result.diagnostics).toEqual([]);
		const ref = createRef<JotlFormHandle>();
		const rootChoices = [{ label: "公共", value: false }];
		const rowChoices = [
			{ label: "本行", value: 1 },
			{ label: "重复", value: 1 },
			"1",
			{ label: "缺值" },
			{ value: "缺标签" },
			{ label: 2, value: "无效" },
		];
		render(
			<JotlForm
				id="rows"
				ref={ref}
				schema={result.value!.schema}
				nested={false}
				defaultValue={{ choices: rootChoices, rows: [{ choices: rowChoices }, {}] }}
			/>
		);
		const local = document.getElementById(nodeId("rows", "/rows/0/local")) as HTMLSelectElement;
		const shared = document.getElementById(
			nodeId("rows", "/rows/0/shared")
		) as HTMLSelectElement;
		const missing = document.getElementById(
			nodeId("rows", "/rows/1/local")
		) as HTMLSelectElement;
		expect(
			Array.from(local.options)
				.slice(1)
				.map(o => o.text)
		).toEqual(["本行", "1"]);
		expect(Array.from(shared.options).map(o => o.text)).toEqual(["公共"]);
		expect(missing.options).toHaveLength(1);
		fireEvent.change(local, { target: { value: local.options[1]!.value } });
		shared.options[0]!.selected = true;
		fireEvent.change(shared);
		expect(ref.current!.getValues()).toMatchObject({
			rows: [{ local: 1, shared: [false] }, {}],
		});
		act(() =>
			ref.current!.setValues({
				choices: rootChoices,
				rows: [{ choices: [{ label: "改名", value: 1 }], local: 1, shared: [false] }, {}],
			})
		);
		expect(local.selectedOptions[0]!.text).toBe("改名");
		await act(async () => {
			expect((await ref.current!.validate()).valid).toBe(true);
		});
	});
	it("006 嵌套对象: 默认值补全, 编辑后取值, 设值后校验通过", async () => {
		const schema = compileFixture("006-nested-object");
		const ref = createRef<JotlFormHandle>();
		render(<JotlForm ref={ref} id="f" schema={schema} defaultValue={{}} />);

		expect(ref.current!.getValues()).toEqual(readFixture("006-nested-object").defaults);
		expect(input("f", "/title").value).toBe("首页");
		// 嵌套对象默认钻取: 根页上是入口行, 点击进入.
		fireEvent.click(document.getElementById(nodeId("f", "/meta"))!);
		expect(screen.getAllByText("SEO").length).toBeGreaterThan(0);

		fireEvent.change(input("f", "/meta/author"), { target: { value: "张三" } });
		expect(ref.current!.getValues()).toEqual({
			meta: { seo: { robots: "index" }, author: "张三" },
			title: "首页",
		});

		// 每个必填字段都有默认值, 这份数据合法; 错误落位由 008 验证.
		const next = { meta: { seo: { robots: "nofollow", keywords: ["a", "b"] } }, title: "x" };
		act(() => ref.current!.setValues(next));
		let result: Awaited<ReturnType<JotlFormHandle["validate"]>> | undefined;
		await act(async () => {
			result = await ref.current!.validate();
		});
		expect(result?.valid).toBe(true);
		expect(ref.current!.getValues()).toEqual(next);
		fireEvent.click(within(screen.getByRole("navigation")).getAllByRole("button")[0]!);
		expect(input("f", "/title").value).toBe("x");
	});

	it("008 对象数组: 增加元素, 提交时缺失必填的错误显示在元素字段上", async () => {
		const schema = compileFixture("008-array-object");
		const onSubmit = vi.fn();
		const ref = createRef<JotlFormHandle>();
		render(
			<JotlForm
				ref={ref}
				id="g"
				schema={schema}
				defaultValue={{ items: [] }}
				onSubmit={onSubmit}
			/>
		);

		fireEvent.click(document.getElementById(nodeId("g", "/items"))!);
		fireEvent.click(screen.getByRole("button", { name: "新增" }));
		expect(ref.current!.getValues()).toEqual({ items: [{}] });

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "提交" }));
		});
		expect(onSubmit).not.toHaveBeenCalled();
		// 提交失败跳到第一个错误所在的层(元素对象页).
		expect(input("g", "/items/0/src").getAttribute("aria-invalid")).toBe("true");

		fireEvent.change(input("g", "/items/0/src"), {
			target: { value: "https://example.com/1.png" },
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "提交" }));
		});
		expect(onSubmit).toHaveBeenCalledWith({ items: [{ src: "https://example.com/1.png" }] });
	});

	it("013 x-ui 注解: 未注册的自定义组件降级上报, 表单照常可用, 隐藏字段不显示", () => {
		const schema = compileFixture("013-x-ui-basic");
		const events: DegradeEvent[] = [];
		const ref = createRef<JotlFormHandle>();
		render(
			<JotlForm
				ref={ref}
				id="u"
				schema={schema}
				defaultValue={{ title: "a", bare: "b", level: "low" }}
				onDegrade={e => events.push(e)}
			/>
		);

		const degradedFrom = new Set(events.filter(e => e.code === "F1").map(e => e.from));
		for (const name of ["headline", "tag-list", "table"]) expect(degradedFrom).toContain(name);
		expect(input("u", "/title").value).toBe("a");
		expect(document.getElementById(nodeId("u", "/secret"))).toBeNull();

		// 枚举默认用下拉框.
		const level = document.getElementById(nodeId("u", "/level")) as HTMLSelectElement;
		const high = within(level).getByRole("option", { name: "高" }) as HTMLOptionElement;
		fireEvent.change(level, { target: { value: high.value } });
		expect(ref.current!.getValues()).toMatchObject({ level: "high" });
	});
});
