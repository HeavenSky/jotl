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
