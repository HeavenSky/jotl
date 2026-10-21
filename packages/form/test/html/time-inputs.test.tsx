// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JsonSchemaObject } from "@jotl/core";
import { DateTimeWidget, DateWidget, TimeWidget } from "../../src/html/index.js";
import { ERROR, fieldProps, MODES } from "./helpers.js";

const control = () => document.getElementById("f") as HTMLInputElement;

const originalTz = process.env.TZ;
beforeAll(() => {
	process.env.TZ = "Asia/Shanghai";
});
afterAll(() => {
	if (originalTz === undefined) delete process.env.TZ;
	else process.env.TZ = originalTz;
});

const vf = (format: string, type: "string" | "integer" = "string"): JsonSchemaObject => ({
	type,
	"x-valueFormat": format,
});

describe.each([
	["date", DateWidget, "date"],
	["time", TimeWidget, "time"],
	["datetime", DateTimeWidget, "datetime-local"],
] as const)("%s 通用行为", (kind, Widget, type) => {
	it("空值显示为空, 清空写回 undefined", () => {
		const props = fieldProps<string | number>();
		render(<Widget {...props} />);
		expect(control().type).toBe(type);
		expect(control().value).toBe("");
		expect(control().className).toContain(`jotl-${kind}`);
	});

	it.each(MODES)("mode=%s", mode => {
		render(<Widget {...fieldProps<string | number>({ mode })} />);
		expect(control().readOnly).toBe(mode === "view");
		expect(control().disabled).toBe(mode === "disabled");
	});

	it("有错误时 aria-invalid", () => {
		render(<Widget {...fieldProps<string | number>({ errors: [ERROR] })} />);
		expect(control().getAttribute("aria-invalid")).toBe("true");
	});
});

describe("date", () => {
	it("默认格式 YYYY-MM-DD", () => {
		const props = fieldProps<string | number>({
			value: "2026-10-08",
			schema: { type: "string", format: "date" },
		});
		render(<DateWidget {...props} />);
		expect(control().value).toBe("2026-10-08");
		fireEvent.change(control(), { target: { value: "2026-10-09" } });
		expect(props.onChange).toHaveBeenLastCalledWith("2026-10-09");
		fireEvent.change(control(), { target: { value: "" } });
		expect(props.onChange).toHaveBeenLastCalledWith(undefined);
	});

	it("自定义格式与毫秒时间戳(当天本地零点)", () => {
		const compact = fieldProps<string | number>({ value: "20261013", schema: vf("YYYYMMDD") });
		const { unmount } = render(<DateWidget {...compact} />);
		expect(control().value).toBe("2026-10-13");
		fireEvent.change(control(), { target: { value: "2026-10-14" } });
		expect(compact.onChange).toHaveBeenLastCalledWith("20261014");
		unmount();
		const stamp = fieldProps<string | number>({
			value: 1791820800000,
			schema: vf("x", "integer"),
		});
		render(<DateWidget {...stamp} />);
		expect(control().value).toBe("2026-10-13");
		fireEvent.change(control(), { target: { value: "2026-10-14" } });
		expect(stamp.onChange).toHaveBeenLastCalledWith(1791907200000);
	});
});

describe("time", () => {
	it("默认格式 HH:mm:ss, 有秒时显示秒并设 step=1", () => {
		const props = fieldProps<string | number>({ value: "10:00:30", schema: vf("HH:mm:ss") });
		render(<TimeWidget {...props} />);
		expect(control().value).toBe("10:00:30");
		expect(control().step).toBe("1");
		fireEvent.change(control(), { target: { value: "11:30" } });
		expect(props.onChange).toHaveBeenLastCalledWith("11:30:00");
	});

	it("自定义格式 HH:mm", () => {
		const props = fieldProps<string | number>({ value: "09:30", schema: vf("HH:mm") });
		render(<TimeWidget {...props} />);
		expect(control().value).toBe("09:30");
		expect(control().step).toBe("");
		fireEvent.change(control(), { target: { value: "10:15" } });
		expect(props.onChange).toHaveBeenLastCalledWith("10:15");
	});

	it("格式含 ss 时秒为零也显示秒, step=1", () => {
		render(
			<TimeWidget
				{...fieldProps<string | number>({ value: "10:00:00", schema: vf("HH:mm:ss") })}
			/>
		);
		expect(control().value).toBe("10:00:00");
		expect(control().step).toBe("1");
	});

	it("格式含 SSS 时读入小数秒, step=0.001, 写回补足三位毫秒", () => {
		const props = fieldProps<string | number>({
			value: "10:00:30.120",
			schema: vf("HH:mm:ss.SSS"),
		});
		render(<TimeWidget {...props} />);
		expect(control().type).toBe("time");
		expect(control().value).toBe("10:00:30.120");
		expect(control().step).toBe("0.001");
		fireEvent.change(control(), { target: { value: "11:30:15.5" } });
		expect(props.onChange).toHaveBeenLastCalledWith("11:30:15.500");
		fireEvent.change(control(), { target: { value: "11:30" } });
		expect(props.onChange).toHaveBeenLastCalledWith("11:30:00.000");
	});
});

describe("datetime", () => {
	it.each([
		[
			"默认 iso",
			{ type: "string", format: "date-time" },
			"2026-10-13T09:30:15+08:00",
			"2026-10-14T08:00:00+08:00",
		],
		[
			"iso-x",
			{ type: "string", format: "date-time", "x-valueFormat": "iso-x" },
			"2026-10-13T09:30:15.000+08:00",
			"2026-10-14T08:00:00.000+08:00",
		],
		[
			"utc",
			{ type: "string", format: "date-time", "x-valueFormat": "utc" },
			"2026-10-13T01:30:15Z",
			"2026-10-14T00:00:00Z",
		],
		[
			"utc-x",
			{ type: "string", format: "date-time", "x-valueFormat": "utc-x" },
			"2026-10-13T01:30:15.000Z",
			"2026-10-14T00:00:00.000Z",
		],
		["x", vf("x", "integer"), 1791855015000, 1791936000000],
		["X", vf("X", "integer"), 1791855015, 1791936000],
		["自定义", vf("YYYY-MM-DD HH:mm:ss"), "2026-10-13 09:30:15", "2026-10-14 08:00:00"],
	] as [string, JsonSchemaObject, string | number, string | number][])(
		"%s 按本地时区显示, 写回符合格式",
		(_, schema, value, next) => {
			const props = fieldProps<string | number>({ value, schema });
			render(<DateTimeWidget {...props} />);
			expect(control().type).toBe("datetime-local");
			expect(control().value).toBe("2026-10-13T09:30:15");
			expect(control().step).toBe("1");
			fireEvent.change(control(), { target: { value: "2026-10-14T08:00" } });
			expect(props.onChange).toHaveBeenLastCalledWith(next);
		}
	);

	it("自定义格式含 SSS 时读入小数秒, step=0.001", () => {
		const props = fieldProps<string | number>({
			value: "2026-10-13 09:30:15.256",
			schema: vf("YYYY-MM-DD HH:mm:ss.SSS"),
		});
		render(<DateTimeWidget {...props} />);
		expect(control().type).toBe("datetime-local");
		expect(control().value).toBe("2026-10-13T09:30:15.256");
		expect(control().step).toBe("0.001");
		fireEvent.change(control(), { target: { value: "2026-10-14T08:00:00.05" } });
		expect(props.onChange).toHaveBeenLastCalledWith("2026-10-14 08:00:00.050");
	});

	it("别名读取放宽: 带毫秒与其他偏移的值照常显示", () => {
		render(
			<DateTimeWidget
				{...fieldProps<string | number>({
					value: "2026-10-12T20:30:15.123-05:00",
					schema: vf("utc"),
				})}
			/>
		);
		expect(control().type).toBe("datetime-local");
		expect(control().value).toBe("2026-10-13T09:30:15");
	});
});

describe("不合存储格式的存量值", () => {
	it("用文本框原样显示并提示, 不改写数据; 键入合格式的文本才写回", () => {
		const props = fieldProps<string | number>({ value: "2026-10-13", schema: vf("YYYYMMDD") });
		render(<DateWidget {...props} />);
		expect(control().type).toBe("text");
		expect(control().value).toBe("2026-10-13");
		expect(control().getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByRole("alert").textContent).toContain("YYYYMMDD");
		expect(props.onChange).not.toHaveBeenCalled();
		fireEvent.change(control(), { target: { value: "2026-10-1" } });
		expect(props.onChange).not.toHaveBeenCalled();
		expect(control().value).toBe("2026-10-1");
		fireEvent.change(control(), { target: { value: "20261013" } });
		expect(props.onChange).toHaveBeenLastCalledWith("20261013");
	});

	it("时间戳格式下的字符串值同样不改写", () => {
		const props = fieldProps<string | number>({ value: "十点", schema: vf("x", "integer") });
		render(<DateTimeWidget {...props} />);
		expect(control().type).toBe("text");
		expect(control().value).toBe("十点");
		fireEvent.change(control(), { target: { value: "1791855015000" } });
		expect(props.onChange).toHaveBeenLastCalledWith(1791855015000);
	});
});
