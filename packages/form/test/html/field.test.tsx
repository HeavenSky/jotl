// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ListWidget,
  FieldDecorator,
  KvWidget,
  NullableWidget,
  PageWidget,
  RadioWidget,
  InputWidget,
  TreeWidget,
  UnionWidget,
} from "../../src/html/index.js";
import { arrayProps, decoratorProps, ERROR, fieldProps, layoutProps, mapProps, nullableProps, treeProps, unionProps } from "./helpers.js";

describe("field", () => {
  it("label for 指向字段 id, 点击标签可聚焦控件", () => {
    render(
      <FieldDecorator {...decoratorProps({ label: "标题" })}>
        <InputWidget {...fieldProps<string>()} />
      </FieldDecorator>,
    );
    const label = document.querySelector("label");
    expect(label?.htmlFor).toBe("f");
    expect(label?.id).toBe("f-label");
    expect(screen.getByLabelText("标题")).toBe(document.getElementById("f"));
  });

  it("内层在复合组件与输入控件之间切换时 for 随之去掉或补回", () => {
    const { rerender } = render(
      <FieldDecorator {...decoratorProps({ label: "配置" })}>
        <ListWidget {...arrayProps()} />
      </FieldDecorator>,
    );
    expect(document.querySelector("label")?.hasAttribute("for")).toBe(false);
    rerender(
      <FieldDecorator {...decoratorProps({ label: "配置" })}>
        <InputWidget {...fieldProps<string>()} />
      </FieldDecorator>,
    );
    expect(document.querySelector("label")?.htmlFor).toBe("f");
  });

  it("必填标记只在 required 时出现", () => {
    const { rerender } = render(<FieldDecorator {...decoratorProps({ label: "标题" })} />);
    expect(document.querySelector(".jotl-required")).toBeNull();
    rerender(<FieldDecorator {...decoratorProps({ label: "标题", required: true })} />);
    expect(document.querySelector(".jotl-required")?.textContent).toBe("*");
    expect(document.querySelector(".jotl-field")?.className).toContain("jotl-field--required");
  });

  it("帮助文本带 id, 控件经 aria-describedby 引用", () => {
    render(
      <FieldDecorator {...decoratorProps({ label: "标题", description: "不超过 20 字" })}>
        <InputWidget {...fieldProps<string>({ schema: { type: "string", description: "不超过 20 字" } })} />
      </FieldDecorator>,
    );
    expect(document.getElementById("f-description")?.textContent).toBe("不超过 20 字");
    expect(screen.getByRole("textbox", { description: "不超过 20 字" })).toBeTruthy();
  });

  it("有错误时显示错误元素, 控件 aria-invalid 并经 aria-describedby 指向它", () => {
    render(
      <FieldDecorator {...decoratorProps({ label: "标题", errors: [ERROR] })}>
        <InputWidget {...fieldProps<string>({ errors: [ERROR] })} />
      </FieldDecorator>,
    );
    const input = document.getElementById("f") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const errorElement = document.getElementById(describedBy);
    expect(errorElement?.textContent).toBe("类型不符");
    expect(errorElement?.getAttribute("role")).toBe("alert");
    expect(document.querySelector(".jotl-field")?.className).toContain("jotl-field--invalid");
  });

  it("无错误时不渲染错误元素, 控件不带 aria-invalid", () => {
    render(
      <FieldDecorator {...decoratorProps({ label: "标题" })}>
        <InputWidget {...fieldProps<string>()} />
      </FieldDecorator>,
    );
    expect(document.getElementById("f-errors")).toBeNull();
    expect(document.getElementById("f")?.hasAttribute("aria-invalid")).toBe(false);
  });

  it("单选组由外壳标签命名", () => {
    render(
      <FieldDecorator {...decoratorProps({ label: "尺寸" })}>
        <RadioWidget {...fieldProps<unknown>({ schema: { enum: ["s", "m"] } })} />
      </FieldDecorator>,
    );
    expect(screen.getByRole("radiogroup", { name: "尺寸" })).toBeTruthy();
  });

  it.each([
    ["object", () => <PageWidget {...layoutProps({ schema: { type: "object", title: "横幅" } })} />, "FIELDSET"],
    ["array", () => <ListWidget {...arrayProps()} />, "DIV"],
    ["nullable", () => <NullableWidget {...nullableProps()} />, "DIV"],
    ["union", () => <UnionWidget {...unionProps()} />, "DIV"],
    ["map", () => <KvWidget {...mapProps()} />, "DIV"],
    ["tree", () => <TreeWidget {...treeProps()} />, "DIV"],
  ])("%s: 外壳标签不带 for, 经 aria-labelledby 命名容器, getByLabelText 可定位", (_, widget, tag) => {
    render(<FieldDecorator {...decoratorProps({ label: "配置" })}>{widget()}</FieldDecorator>);
    expect(document.querySelector("label")?.hasAttribute("for")).toBe(false);
    const container = screen.getByLabelText("配置");
    expect(container).toBe(document.getElementById("f"));
    expect(container.tagName).toBe(tag);
    expect(screen.getByRole("group", { name: "配置" })).toBe(container);
  });

  it("没有外壳时对象组名回落到 legend", () => {
    render(<PageWidget {...layoutProps({ schema: { type: "object", title: "横幅" } })} />);
    expect(screen.getByRole("group", { name: "横幅" })).toBe(document.getElementById("f"));
  });

  it("hidden 时隐藏外壳但保留子组件", () => {
    render(
      <FieldDecorator {...decoratorProps({ label: "标题", hidden: true })}>
        <InputWidget {...fieldProps<string>()} />
      </FieldDecorator>,
    );
    expect((document.querySelector(".jotl-field") as HTMLElement).hidden).toBe(true);
    expect(document.getElementById("f")).not.toBeNull();
  });

  it("没有 label 时不渲染 label 元素", () => {
    render(<FieldDecorator {...decoratorProps()} />);
    expect(document.querySelector("label")).toBeNull();
  });
});
