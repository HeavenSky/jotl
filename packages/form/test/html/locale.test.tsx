// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { LocaleContext } from "../../src/locale-context.js";
import { FieldDecorator, FormWidget, JsonWidget, KvWidget, ListWidget, SelectWidget, TreeWidget } from "../../src/html/index.js";
import { arrayProps, decoratorProps, fieldProps, mapProps, treeProps, viewProps } from "./helpers.js";

const en = (children: ReactNode) => <LocaleContext.Provider value="en">{children}</LocaleContext.Provider>;
const ITEMS = [
  { key: "k1", dataPath: "/f/0" },
  { key: "k2", dataPath: "/f/1" },
];

describe("html 文案按表单语言输出", () => {
  it("LocaleContext 为 en 时数组, 字典, 树, 表单按钮为英文", () => {
    render(
      en(
        <>
          <ListWidget {...arrayProps({ items: ITEMS })} />
          <KvWidget {...mapProps({ id: "m" })} />
          <TreeWidget {...treeProps({ id: "t" })} />
          <FormWidget {...viewProps()} />
        </>,
      ),
    );
    expect(screen.getAllByRole("button", { name: "Add" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Remove item 2" }).textContent).toBe("Remove");
    expect(screen.getByRole("button", { name: "Move item 1 down" }).textContent).toBe("Down");
    expect(screen.getByRole("button", { name: "Expand" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
  });

  it("en 时下拉空选项, 必填提示与草稿错误为英文", () => {
    render(
      en(
        <FieldDecorator {...decoratorProps({ label: "Title", required: true })}>
          <SelectWidget {...fieldProps<unknown>({ id: "s", schema: { enum: ["a"] } })} />
          <JsonWidget {...fieldProps<unknown>({ schema: {} })} />
        </FieldDecorator>,
      ),
    );
    expect(screen.getByRole("option", { name: "Select…" })).toBeTruthy();
    expect(document.querySelector(".jotl-required")?.getAttribute("title")).toBe("Required");
    fireEvent.change(document.getElementById("f")!, { target: { value: "{" } });
    expect(screen.getByRole("alert").textContent).toBe("Invalid JSON; not saved until fixed");
  });

  it("没有 LocaleContext 时为中文", () => {
    render(<ListWidget {...arrayProps({ items: ITEMS })} />);
    expect(screen.getByRole("button", { name: "删除第 2 项" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "新增" })).toBeTruthy();
  });
});
