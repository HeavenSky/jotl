// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JsonSchemaObject } from "@jotl/core";
import type { DecimalValue } from "../../src/core/index.js";
import { BigintWidget, MoneyWidget, moneyDecimals } from "../../src/html/index.js";
import { fieldProps, MODES } from "./helpers.js";

const control = () => document.getElementById("f") as HTMLInputElement;

function money(
	currency: JsonSchemaObject,
	extra: Record<string, JsonSchemaObject> = {},
	pattern = "^-?\\d+\\.\\d{2}$"
): JsonSchemaObject {
	return {
		type: "object",
		properties: {
			type: { const: "money" },
			value: { type: "string", pattern },
			currency,
			...extra,
		},
		required: ["type", "value", "currency"],
		additionalProperties: false,
	};
}

const BIGINT: JsonSchemaObject = {
	type: "object",
	properties: { type: { const: "bigint" }, value: { type: "string", pattern: "^-?\\d+$" } },
	required: ["type", "value"],
};

describe("money", () => {
	it("文本框 + inputmode decimal; 默认千分位, 聚焦显示原值", () => {
		const props = fieldProps<DecimalValue>({
			value: { type: "money" as const, value: "1234567.80", currency: "CNY" },
			schema: money({ const: "CNY" }),
		});
		render(<MoneyWidget {...props} />);
		expect(control().type).toBe("text");
		expect(control().inputMode).toBe("decimal");
		expect(control().value).toBe("1,234,567.80");
		fireEvent.focus(control());
		expect(control().value).toBe("1234567.80");
		expect(document.getElementById("f-currency")?.textContent).toBe("CNY");
		// 固定币种的名称经视觉隐藏的文字提供给读屏.
		expect(document.getElementById("f-currency")?.parentElement?.textContent).toBe("币种 CNY");
	});

	it("输入去掉千分位后写回值对象, 失焦补齐定长小数位", () => {
		const props = fieldProps<DecimalValue>({ schema: money({ const: "CNY" }) });
		const { rerender } = render(<MoneyWidget {...props} />);
		fireEvent.focus(control());
		fireEvent.change(control(), { target: { value: "1,000.5" } });
		expect(props.onChange).toHaveBeenLastCalledWith({
			type: "money" as const,
			value: "1000.5",
			currency: "CNY",
		});
		rerender(
			<MoneyWidget
				{...props}
				value={{ type: "money" as const, value: "1000.5", currency: "CNY" }}
			/>
		);
		fireEvent.blur(control());
		expect(props.onChange).toHaveBeenLastCalledWith({
			type: "money" as const,
			value: "1000.50",
			currency: "CNY",
		});
		expect(props.onBlur).toHaveBeenCalled();
	});

	it("不合法的输入保留草稿并提示, 不写回", () => {
		const props = fieldProps<DecimalValue>({ schema: money({ const: "CNY" }) });
		render(<MoneyWidget {...props} />);
		fireEvent.change(control(), { target: { value: "12abc" } });
		expect(props.onChange).not.toHaveBeenCalled();
		expect(control().value).toBe("12abc");
		expect(screen.getByRole("alert")).not.toBeNull();
	});

	it("可选币种与单位为下拉框, 切换写回对应字段", () => {
		const schema = money(
			{ enum: ["CNY", "USD"] },
			{ unit: { enum: ["yuan", "fen"] } },
			"^-?\\d+(\\.\\d+)?$"
		);
		const props = fieldProps<DecimalValue>({
			value: { type: "money" as const, value: "5", currency: "CNY", unit: "yuan" },
			schema,
		});
		render(<MoneyWidget {...props} />);
		const currency = screen.getByLabelText("币种") as HTMLSelectElement;
		fireEvent.change(currency, { target: { value: "USD" } });
		expect(props.onChange).toHaveBeenLastCalledWith({
			type: "money" as const,
			value: "5",
			currency: "USD",
			unit: "yuan",
		});
		fireEvent.change(screen.getByLabelText("单位"), { target: { value: "fen" } });
		expect(props.onChange).toHaveBeenLastCalledWith({
			type: "money" as const,
			value: "5",
			currency: "CNY",
			unit: "fen",
		});
	});

	it("thousands 为 false 时不插逗号; 币种不限时为文本框", () => {
		const props = fieldProps<DecimalValue>({
			value: { type: "money" as const, value: "1234", currency: "JPY" },
			schema: money({ type: "string", pattern: "^[A-Z]{3}$" }, {}, "^-?\\d+$"),
			thousands: false,
		});
		render(<MoneyWidget {...props} />);
		expect(control().value).toBe("1234");
		expect(control().inputMode).toBe("numeric");
		expect((screen.getByLabelText("币种") as HTMLInputElement).value).toBe("JPY");
	});

	it("moneyDecimals 读取定长小数位", () => {
		expect(moneyDecimals(money({ const: "CNY" }))).toBe(2);
		expect(moneyDecimals(money({ const: "JPY" }, {}, "^-?\\d+$"))).toBe(0);
		expect(moneyDecimals(money({ const: "CNY" }, {}, "^-?\\d+(\\.\\d+)?$"))).toBeUndefined();
	});

	it.each(MODES)("mode=%s", mode => {
		render(
			<MoneyWidget
				{...fieldProps<DecimalValue>({
					mode,
					value: { type: "money" as const, value: "1", currency: "CNY" },
					schema: money({ const: "CNY" }),
				})}
			/>
		);
		expect(control().readOnly).toBe(mode === "view");
		expect(control().disabled).toBe(mode === "disabled");
	});
});

describe("bigint", () => {
	it("只接受整数, inputmode numeric, 默认不插千分位", () => {
		const props = fieldProps<DecimalValue>({
			value: { type: "bigint" as const, value: "12345678901234567890" },
			schema: BIGINT,
		});
		render(<BigintWidget {...props} />);
		expect(control().inputMode).toBe("numeric");
		expect(control().value).toBe("12345678901234567890");
		fireEvent.change(control(), { target: { value: "-99_999" } });
		expect(props.onChange).toHaveBeenLastCalledWith({ type: "bigint", value: "-99999" });
		fireEvent.change(control(), { target: { value: "1.5" } });
		expect(props.onChange).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("alert")).not.toBeNull();
	});

	it("开了千分位时失焦显示千分位", () => {
		render(
			<BigintWidget
				{...fieldProps<DecimalValue>({
					value: { type: "bigint" as const, value: "1000000" },
					schema: BIGINT,
					thousands: true,
				})}
			/>
		);
		expect(control().value).toBe("1,000,000");
	});
});
