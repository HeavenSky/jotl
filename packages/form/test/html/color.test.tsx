// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ColorWidget } from "../../src/html/index.js";
import { ERROR, fieldProps, MODES } from "./helpers.js";

const picker = () => document.querySelector<HTMLInputElement>('input[type="color"]');
const text = () => document.getElementById("f") as HTMLInputElement;

describe("color", () => {
  it("#rrggbb 值同时显示取色器与文本框, 两者都写回", () => {
    const props = fieldProps<string>({ value: "#FF8800" });
    render(<ColorWidget {...props} />);
    expect(picker()?.value).toBe("#ff8800");
    expect(text().type).toBe("text");
    expect(text().value).toBe("#FF8800");
    fireEvent.change(picker() as HTMLInputElement, { target: { value: "#00ff00" } });
    expect(props.onChange).toHaveBeenLastCalledWith("#00ff00");
    fireEvent.change(text(), { target: { value: "red" } });
    expect(props.onChange).toHaveBeenLastCalledWith("red");
    fireEvent.change(text(), { target: { value: "" } });
    expect(props.onChange).toHaveBeenLastCalledWith(undefined);
  });

  it.each(["red", "#fff", "rgba(0,0,0,0.5)", undefined])("值 %s 不是 #rrggbb 时只显示文本框", (value) => {
    render(<ColorWidget {...fieldProps<string>({ value })} />);
    expect(picker()).toBeNull();
    expect(text().value).toBe(value ?? "");
  });

  it.each(MODES)("mode=%s", (mode) => {
    render(<ColorWidget {...fieldProps<string>({ mode, value: "#112233" })} />);
    expect(text().readOnly).toBe(mode === "view");
    expect(text().disabled).toBe(mode === "disabled");
    expect(picker()?.disabled).toBe(mode !== "edit");
  });

  it("有错误时 aria-invalid", () => {
    render(<ColorWidget {...fieldProps<string>({ errors: [ERROR] })} />);
    expect(text().getAttribute("aria-invalid")).toBe("true");
  });
});
