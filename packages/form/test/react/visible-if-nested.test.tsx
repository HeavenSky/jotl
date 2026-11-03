// @vitest-environment jsdom
// 排查: 层级子页内 visibleIf(root_if / node_if 编译产物)不出现的复现.
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { compile, type JsonSchema } from "@jotl/core";
import { byPath, renderForm } from "./helpers.js";

const SOURCE = `Root(配送): {
  order(订单): Order
}
Order(订单): {
  method(配送方式): enum[default: 'express']{ express(快递) pickup(自提) }
  address(收货地址)?: string[node_if: {left: 'method', op: 'eq', right: 'express'}]
  rootAddr(根基准地址)?: string[root_if: {left: 'method', op: 'eq', right: 'express'}]
}`;

const compiled = compile(SOURCE, "test.jotl");
const SCHEMA = compiled.value!.schema as JsonSchema;

describe("层级子页内 visibleIf 复现(编译产物)", () => {
	it("子页内填同层字段后条件字段出现", () => {
		const { handle } = renderForm({ schema: SCHEMA, nested: true });
		// 进入子页.
		fireEvent.click(byPath("/order") as HTMLButtonElement);
		// 填同层字段(select 的 option value 是选项下标).
		fireEvent.change(byPath("/order/method")!, { target: { value: "0" } });
		expect(handle().getValues()).toEqual({ order: { method: "express" } });
		expect(byPath("/order/address")).not.toBeNull();
		// root_if {left: 'method'} 按语义从数据根起算: 根没有 /method, 该字段不出现(需写 Order.method).
		expect(byPath("/order/rootAddr")).toBeNull();
		// 切走后条件字段消失, 切回后重现.
		fireEvent.change(byPath("/order/method")!, { target: { value: "1" } });
		expect(byPath("/order/address")).toBeNull();
		fireEvent.change(byPath("/order/method")!, { target: { value: "0" } });
		expect(byPath("/order/address")).not.toBeNull();
	});
});
