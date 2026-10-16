// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@jotl/core";
import { byPath, renderForm } from "./helpers.js";

const SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    price: {
      type: "object",
      properties: { type: { const: "money" }, value: { type: "string", pattern: "^-?\\d+\\.\\d{2}$" }, currency: { const: "CNY" } },
      required: ["type", "value", "currency"],
      additionalProperties: false,
    },
    count: { type: "number", "x-ui": { thousands: true } },
    flag: { type: "boolean" },
    picks: { type: "array", items: { $ref: "#/$defs/Color" }, uniqueItems: true, "x-ui": { widget: "radio" } },
  },
  $defs: { Color: { enum: ["red", "green"] } },
};

describe("数值与选择组件经渲染器", () => {
  it("money 为字段层组件, 千分位来自渲染计划; number 的 thousands 生效", () => {
    const { handle } = renderForm({ schema: SCHEMA, defaultValue: { price: { type: "money", value: "1234.50", currency: "CNY" }, count: 1000 }, drill: true });
    expect((byPath("/price") as HTMLInputElement).value).toBe("1,234.50");
    expect((byPath("/count") as HTMLInputElement).value).toBe("1,000");
    fireEvent.change(byPath("/price")!, { target: { value: "99" } });
    fireEvent.blur(byPath("/price")!);
    expect(handle().getValues()).toMatchObject({ price: { type: "money", value: "99.00", currency: "CNY" } });
  });

  it("boolean 默认 switch; 非法 widget 降级后枚举数组为多选下拉, 引用的选项可读到", () => {
    renderForm({ schema: SCHEMA, defaultValue: {}, drill: true });
    expect(screen.getByRole("switch")).not.toBeNull();
    const picks = byPath("/picks") as HTMLSelectElement;
    expect(picks.multiple).toBe(true);
    expect(Array.from(picks.options, (o) => o.textContent)).toEqual(["red", "green"]);
  });
});
