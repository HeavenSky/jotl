// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormWidget, InputWidget } from "../../src/html/index.js";
import { ERROR, fieldProps, viewProps } from "./helpers.js";

const form = () => document.querySelector("form") as HTMLFormElement;

describe("form", () => {
  it("渲染子内容; 提交时调用 submit() 并阻止默认行为", () => {
    const props = viewProps({ children: <span>内容</span> });
    render(<FormWidget {...props} />);
    expect(form().id).toBe("form");
    expect(form().textContent).toContain("内容");
    const notPrevented = fireEvent.submit(form());
    expect(notPrevented).toBe(false);
    expect(props.submit).toHaveBeenCalledTimes(1);
  });

  it("点击提交按钮调用 submit(), 原生校验不拦截", () => {
    const props = viewProps({
      children: <InputWidget {...fieldProps<string>({ value: "x", schema: { type: "string", pattern: "^\\d+$" } })} />,
    });
    render(<FormWidget {...props} />);
    expect(form().noValidate).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    expect(props.submit).toHaveBeenCalledTimes(1);
  });

  it("重置调用 reset() 并阻止默认行为", () => {
    const props = viewProps();
    render(<FormWidget {...props} />);
    expect(fireEvent.reset(form())).toBe(false);
    expect(props.reset).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    expect(props.reset).toHaveBeenCalledTimes(2);
  });

  it.each(["view", "disabled"] as const)("mode=%s 不显示操作按钮, 提交不调用 submit()", (mode) => {
    const props = viewProps({ mode });
    render(<FormWidget {...props} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(fireEvent.submit(form())).toBe(false);
    expect(props.submit).not.toHaveBeenCalled();
  });

  it("mode=edit 显示提交与重置按钮", () => {
    render(<FormWidget {...viewProps()} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["提交", "重置"]);
  });

  it("显示不属于可见字段的错误", () => {
    const { rerender } = render(<FormWidget {...viewProps()} />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<FormWidget {...viewProps({ errors: [ERROR] })} />);
    expect(screen.getByRole("alert").textContent).toBe("类型不符");
  });
});
