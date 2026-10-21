// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JsonSchema } from "@jotl/core";
import { createAntdRegistry } from "../src/index.js";
import { parseStored } from "../src/widgets/temporal.js";
import { byPath, dayjs, renderForm } from "./helpers.js";

const SCHEMA: JsonSchema = {
	type: "object",
	required: ["name"],
	properties: {
		name: { type: "string", title: "名称", description: "显示名" },
		bio: { type: "string", "x-ui": { widget: "textarea" } },
		age: { type: "integer", minimum: 0 },
		active: { type: "boolean" },
		agree: { type: "boolean", "x-ui": { widget: "checkbox" } },
		level: { type: "string", enum: ["low", "mid", "high"] },
		size: { type: "string", enum: ["s", "m"], "x-ui": { widget: "radio" } },
		tags: {
			type: "array",
			items: { type: "string", enum: ["a", "b", "c"] },
			"x-ui": { widget: "checkbox" },
		},
		color: { type: "string", format: "color" },
	},
};

describe("字段渲染与改值", () => {
	it("字符串, 数字, 布尔经 antd 控件写回", () => {
		const onChange = vi.fn();
		const { handle } = renderForm({ schema: SCHEMA, defaultValue: {}, onChange });
		const name = byPath("/name") as HTMLInputElement;
		expect(name.closest(".ant-form-item")).not.toBeNull();
		expect(name.classList.contains("ant-input")).toBe(true);
		expect(screen.getByText("显示名")).toBeTruthy();
		fireEvent.change(name, { target: { value: "张三" } });
		expect(handle().getValues()).toMatchObject({ name: "张三" });

		fireEvent.change(byPath("/bio"), { target: { value: "多行" } });
		expect(handle().getValues()).toMatchObject({ bio: "多行" });

		fireEvent.change(byPath("/age"), { target: { value: "42" } });
		expect(handle().getValues()).toMatchObject({ age: 42 });

		fireEvent.click(byPath("/active"));
		expect(handle().getValues()).toMatchObject({ active: true });
		fireEvent.click(byPath("/agree"));
		expect(handle().getValues()).toMatchObject({ agree: true });
		expect(onChange).toHaveBeenCalled();
	});

	it("枚举单选(Radio.Group)与枚举数组(Checkbox.Group)写回原值", () => {
		const { handle } = renderForm({ schema: SCHEMA, defaultValue: {} });
		fireEvent.click(screen.getByLabelText("m"));
		expect(handle().getValues()).toMatchObject({ size: "m" });
		fireEvent.click(screen.getByLabelText("c"));
		fireEvent.click(screen.getByLabelText("a"));
		// 写回按选项顺序.
		expect(handle().getValues()).toMatchObject({ tags: ["a", "c"] });
	});

	it("Select 选中项写回枚举值", async () => {
		const { handle } = renderForm({ schema: SCHEMA, defaultValue: {} });
		const select = byPath("/level");
		fireEvent.mouseDown(
			select
				.closest(".ant-select")!
				.querySelector(".ant-select-content, .ant-select-selector") ?? select
		);
		const option = await waitFor(() => {
			const el = document.querySelector('.ant-select-item-option[title="high"]');
			if (el === null) throw new Error("下拉未展开");
			return el;
		});
		fireEvent.click(option);
		expect(handle().getValues()).toMatchObject({ level: "high" });
	});

	it("已有颜色值显示在 ColorPicker 中", () => {
		renderForm({ schema: SCHEMA, defaultValue: { color: "#1677ff" } });
		expect(byPath("/color").textContent?.toUpperCase()).toContain("1677FF");
	});
});

describe("日期写回存储格式", () => {
	const schema: JsonSchema = {
		type: "object",
		properties: {
			day: { type: "string", format: "date" },
			custom: { type: "string", "x-valueFormat": "YYYY/MM/DD", "x-ui": { widget: "date" } },
			ts: { type: "integer", "x-valueFormat": "X", "x-ui": { widget: "date" } },
			bad: { type: "string", format: "date" },
		},
	};

	it("按存储格式显示, 选择日期后按存储格式写回", async () => {
		const { handle } = renderForm({
			schema,
			defaultValue: { custom: "2024/05/06", bad: "06.05.2024" },
		});
		const custom = byPath("/custom") as HTMLInputElement;
		expect(custom.value).toBe("2024-05-06");
		fireEvent.mouseDown(custom);
		fireEvent.click(custom);
		const cell = await waitFor(() => {
			const el = document.querySelector('td[title="2024-05-10"]');
			if (el === null) throw new Error("面板未展开");
			return el;
		});
		fireEvent.click(cell);
		expect(handle().getValues()).toMatchObject({ custom: "2024/05/10" });
	});

	it("时间戳格式与默认格式", async () => {
		const { handle } = renderForm({ schema, defaultValue: { ts: 1715000000 } });
		const ts = byPath("/ts") as HTMLInputElement;
		const shown = ts.value;
		expect(shown).toMatch(/^2024-05-0[67]$/);
		fireEvent.mouseDown(ts);
		fireEvent.click(ts);
		const cell = await waitFor(() => {
			const el = document.querySelector(`td[title="${shown}"]`);
			if (el === null) throw new Error("面板未展开");
			return el;
		});
		fireEvent.click(cell);
		const value = (handle().getValues() as { ts: number }).ts;
		// date 写回当天零点(本地时区)的秒级时间戳.
		expect(Number.isInteger(value)).toBe(true);
		expect(new Date(value * 1000).getHours()).toBe(0);
	});

	it("不符合存储格式的存量值交给原生组件原样显示, 不改写数据", () => {
		const { handle } = renderForm({ schema, defaultValue: { bad: "06.05.2024" } });
		const bad = byPath("/bad") as HTMLInputElement;
		expect(bad.type).toBe("text");
		expect(bad.value).toBe("06.05.2024");
		expect(handle().getValues()).toMatchObject({ bad: "06.05.2024" });
	});

	it("time 与 datetime 按存储格式的精度显示", () => {
		const schema2: JsonSchema = {
			type: "object",
			properties: {
				at: {
					type: "string",
					"x-valueFormat": "YYYY-MM-DD HH:mm",
					"x-ui": { widget: "datetime" },
				},
				clock: { type: "string", format: "time" },
			},
		};
		renderForm({
			schema: schema2,
			defaultValue: { at: "2024-05-06 08:30", clock: "08:30:15" },
		});
		expect((byPath("/at") as HTMLInputElement).value).toBe("2024-05-06 08:30");
		expect((byPath("/clock") as HTMLInputElement).value).toBe("08:30:15");
	});

	it("自定义格式带非本地时区偏移的值按偏移解析, 不回落原生组件", () => {
		const fmt = "YYYY-MM-DD HH:mm:ssZ";
		const raw = "2024-05-06 08:30:00-11:00";
		// 前提: 严格解析判不合法(本地时区不是 -11:00 时成立).
		expect(dayjs(raw, fmt, true).isValid()).toBe(false);
		expect(parseStored(dayjs, raw, fmt)?.toISOString()).toBe("2024-05-06T19:30:00.000Z");
		expect(parseStored(dayjs, "2024-05-06 25:30:00-11:00", fmt)).toBeUndefined();
		const schema2: JsonSchema = {
			type: "object",
			properties: {
				at: { type: "string", "x-valueFormat": fmt, "x-ui": { widget: "datetime" } },
			},
		};
		const { handle } = renderForm({ schema: schema2, defaultValue: { at: raw } });
		const at = byPath("/at") as HTMLInputElement;
		expect(at.closest(".ant-picker")).not.toBeNull();
		expect(at.value).toBe(dayjs(raw, fmt).format("YYYY-MM-DD HH:mm:ss"));
		expect(handle().getValues()).toMatchObject({ at: raw });
	});

	it("不传 dayjs 时日期回落到原生 input[type=date]", () => {
		renderForm({ schema, registry: createAntdRegistry(), defaultValue: { day: "2024-05-06" } });
		const day = byPath("/day") as HTMLInputElement;
		expect(day.type).toBe("date");
		expect(day.value).toBe("2024-05-06");
	});
});

describe("校验错误显示", () => {
	it("提交时必填错误显示在 Form.Item 中, 控件带 aria-invalid", async () => {
		const onSubmit = vi.fn();
		const { handle } = renderForm({ schema: SCHEMA, defaultValue: {}, onSubmit });
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /提\s*交/ }));
		});
		expect(onSubmit).not.toHaveBeenCalled();
		const errors = document.getElementById(`${byPath("/name").id}-errors`);
		expect(errors?.textContent).not.toBe("");
		expect(
			byPath("/name").closest(".ant-form-item")?.classList.contains("ant-form-item-has-error")
		).toBe(true);
		expect(byPath("/name").getAttribute("aria-invalid")).toBe("true");

		fireEvent.change(byPath("/name"), { target: { value: "ok" } });
		await act(async () => {
			handle().submit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it("英文表单的按钮文案", () => {
		renderForm({ schema: SCHEMA, defaultValue: {}, locale: "en" });
		expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
	});

	it("数组: Card 列表, 新增与删除", () => {
		const schema: JsonSchema = {
			type: "object",
			properties: { items: { type: "array", items: { type: "string" } } },
		};
		const { handle } = renderForm({ schema, defaultValue: { items: ["x"] } });
		fireEvent.click(screen.getByRole("button", { name: /新\s*增/ }));
		expect((handle().getValues() as { items: unknown[] }).items).toHaveLength(2);
		fireEvent.click(screen.getByRole("button", { name: "删除第 1 项" }));
		expect((handle().getValues() as { items: unknown[] }).items).toHaveLength(1);
	});
});

describe("外壳与控件细节", () => {
	it("标签的 for 只关联可关联控件, 复合组件(颜色)不带 for", () => {
		const schema: JsonSchema = {
			type: "object",
			properties: {
				name: { type: "string", title: "名称" },
				color: { type: "string", format: "color", title: "颜色" },
			},
		};
		renderForm({ schema, defaultValue: {} });
		expect(screen.getByText("名称").closest("label")?.getAttribute("for")).toBe(
			byPath("/name").id
		);
		expect(byPath("/color").tagName).toBe("SPAN");
		expect(screen.getByText("颜色").closest("label")?.hasAttribute("for")).toBe(false);
	});

	it("千分位只在失焦时显示, 聚焦编辑时不带分隔符", () => {
		const schema: JsonSchema = {
			type: "object",
			properties: { n: { type: "number", "x-ui": { thousands: true } } },
		};
		const { handle } = renderForm({ schema, defaultValue: { n: 1234567 } });
		const input = byPath("/n") as HTMLInputElement;
		expect(input.value).toBe("1,234,567");
		fireEvent.focus(input);
		expect(input.value).toBe("1234567");
		fireEvent.change(input, { target: { value: "7654321" } });
		expect(input.value).toBe("7654321");
		fireEvent.blur(input);
		expect(input.value).toBe("7,654,321");
		expect(handle().getValues()).toMatchObject({ n: 7654321 });
	});

	it("颜色为空时不传 disabledAlpha(无开发警告), 首次取色写回不含 alpha 的 #rrggbb", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const { handle } = renderForm({ schema: SCHEMA, defaultValue: {} });
			const messages = [...error.mock.calls, ...warn.mock.calls].map(args => args.join(" "));
			expect(messages.filter(m => m.includes("disabledAlpha"))).toEqual([]);
			fireEvent.click(byPath("/color").querySelector(".ant-color-picker-trigger")!);
			const hex = await waitFor(() => {
				const el = document.querySelector<HTMLInputElement>(
					".ant-color-picker-hex-input input"
				);
				if (el === null) throw new Error("面板未展开");
				return el;
			});
			// 空值时面板带透明度输入, 先调透明度: 写回仍是不含 alpha 的 #rrggbb.
			fireEvent.change(document.querySelector(".ant-color-picker-alpha-input input")!, {
				target: { value: "50" },
			});
			expect((handle().getValues() as { color?: string }).color).toMatch(/^#[0-9a-f]{6}$/);
			fireEvent.change(hex, { target: { value: "ff0000" } });
			expect(handle().getValues()).toMatchObject({ color: "#ff0000" });
		} finally {
			error.mockRestore();
			warn.mockRestore();
		}
	});
});
