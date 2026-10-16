// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmailWidget, InputWidget, PasswordWidget, TextareaWidget, UrlWidget } from "../../src/html/index.js";
import { ERROR, fieldProps, MODES } from "./helpers.js";

const control = () => document.getElementById("f") as HTMLInputElement;

describe("password", () => {
  it("type=password, 写回字符串", () => {
    const props = fieldProps<string>({ value: "s" });
    render(<PasswordWidget {...props} />);
    expect(control().type).toBe("password");
    fireEvent.change(control(), { target: { value: "s3" } });
    expect(props.onChange).toHaveBeenLastCalledWith("s3");
  });
});

describe("input", () => {
  it("显示值并在输入时写回字符串", () => {
    const props = fieldProps<string>({ value: "你好" });
    render(<InputWidget {...props} />);
    expect(control().type).toBe("text");
    expect(control().value).toBe("你好");
    expect(control().className).toContain("jotl-text");
    fireEvent.change(control(), { target: { value: "世界" } });
    expect(props.onChange).toHaveBeenLastCalledWith("世界");
    fireEvent.blur(control());
    expect(props.onBlur).toHaveBeenCalledTimes(1);
  });

  it("清空时写回空串", () => {
    const props = fieldProps<string>({ value: "a" });
    render(<InputWidget {...props} />);
    fireEvent.change(control(), { target: { value: "" } });
    expect(props.onChange).toHaveBeenLastCalledWith("");
  });

  it("maxLength 与 pattern 同步为原生属性, pattern 保持不锚定语义", () => {
    render(<InputWidget {...fieldProps<string>({ schema: { type: "string", maxLength: 20, pattern: "^a\\d" } })} />);
    expect(control().maxLength).toBe(20);
    const native = control().getAttribute("pattern") ?? "";
    expect(new RegExp(`^(?:${native})$`).test("a1xyz")).toBe(true);
    expect(new RegExp(`^(?:${native})$`).test("xa1")).toBe(false);
  });

  it("没有约束时不写原生属性", () => {
    render(<InputWidget {...fieldProps<string>()} />);
    expect(control().hasAttribute("maxlength")).toBe(false);
    expect(control().hasAttribute("pattern")).toBe(false);
  });

  it.each(MODES)("mode=%s", (mode) => {
    render(<InputWidget {...fieldProps<string>({ mode, value: "x" })} />);
    expect(control().readOnly).toBe(mode === "view");
    expect(control().disabled).toBe(mode === "disabled");
  });

  it("有错误时 aria-invalid 并指向错误元素, 有说明时指向说明", () => {
    const { rerender } = render(<InputWidget {...fieldProps<string>()} />);
    expect(control().hasAttribute("aria-invalid")).toBe(false);
    expect(control().hasAttribute("aria-describedby")).toBe(false);
    rerender(<InputWidget {...fieldProps<string>({ errors: [ERROR], schema: { type: "string", description: "说明" } })} />);
    expect(control().getAttribute("aria-invalid")).toBe("true");
    expect(control().getAttribute("aria-describedby")).toBe("f-description f-errors");
  });
});

describe("textarea", () => {
  it("显示值, 写回, maxLength", () => {
    const props = fieldProps<string>({ value: "多行\n文本", schema: { type: "string", maxLength: 5 } });
    render(<TextareaWidget {...props} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.value).toBe("多行\n文本");
    expect(textarea.maxLength).toBe(5);
    fireEvent.change(textarea, { target: { value: "新" } });
    expect(props.onChange).toHaveBeenLastCalledWith("新");
  });

  it.each(MODES)("mode=%s", (mode) => {
    render(<TextareaWidget {...fieldProps<string>({ mode })} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.readOnly).toBe(mode === "view");
    expect(textarea.disabled).toBe(mode === "disabled");
  });

  it("有错误时 aria-invalid", () => {
    render(<TextareaWidget {...fieldProps<string>({ errors: [ERROR] })} />);
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
  });
});

describe.each([
  ["url", UrlWidget, "https://example.com/a.png", "https://example.com/b"],
  ["email", EmailWidget, "a@example.com", "b@example.com"],
] as const)("%s", (type, Widget, initial, next) => {
  it("显示值, 写回, 清空写回 undefined", () => {
    const props = fieldProps<string>({ value: initial });
    render(<Widget {...props} />);
    expect(control().type).toBe(type);
    expect(control().value).toBe(initial);
    expect(control().className).toContain(`jotl-${type}`);
    fireEvent.change(control(), { target: { value: next } });
    expect(props.onChange).toHaveBeenLastCalledWith(next);
    fireEvent.change(control(), { target: { value: "" } });
    expect(props.onChange).toHaveBeenLastCalledWith(undefined);
  });

  it.each(MODES)("mode=%s", (mode) => {
    render(<Widget {...fieldProps<string>({ mode, value: initial })} />);
    expect(control().readOnly).toBe(mode === "view");
    expect(control().disabled).toBe(mode === "disabled");
  });

  it("有错误时 aria-invalid", () => {
    render(<Widget {...fieldProps<string>({ errors: [ERROR] })} />);
    expect(control().getAttribute("aria-invalid")).toBe("true");
  });
});
