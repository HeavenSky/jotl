// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@jotl/core";
import { byPath, renderForm } from "./helpers.js";

const SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string", title: "标题" },
    meta: {
      type: "object",
      title: "元信息",
      properties: { author: { type: "string", title: "作者" }, seo: { type: "object", title: "SEO", properties: { robots: { type: "string" } } } },
      required: ["author"],
    },
    size: { type: "object", title: "尺寸", "x-ui": { widget: "inline" }, properties: { w: { type: "number" } } },
    links: {
      type: "array",
      title: "链接",
      items: { type: "object", properties: { href: { type: "string" }, text: { type: "string" } } },
      "x-ui": { summary: "text" },
    },
  },
  required: ["meta"],
};

const DATA = { title: "t", meta: { author: "张三", seo: { robots: "index" } }, size: { w: 1 }, links: [{ href: "https://a", text: "甲" }] };

const panelOf = (path: string) => byPath(path)?.closest("details.jotl-panel") as HTMLDetailsElement | null;
const header = (panel: HTMLDetailsElement | null) => panel?.querySelector(":scope > summary") as HTMLElement;

describe("折叠面板(drill=false, collapsible)", () => {
  it("对象与数组为面板, 标题行显示标题与摘要; inline 对象与标量字段照常渲染", () => {
    renderForm({ schema: SCHEMA, defaultValue: DATA, collapsible: true });
    expect(panelOf("/title")).toBeNull();
    expect(panelOf("/size")).toBeNull();
    expect(header(panelOf("/meta")).textContent).toContain("元信息");
    expect(header(panelOf("/meta")).textContent).toContain("张三");
    expect(header(panelOf("/links")).textContent).toContain("链接");
    expect(header(panelOf("/links")).textContent).toContain("1 项");
    // 可访问名称仍取标题.
    expect(screen.getByRole("group", { name: /元信息/ })).toBe(byPath("/meta"));
  });

  it("数组项面板标题为摘要(序号由列表显示, 不重复); 第一层默认展开, 更深的默认收起", () => {
    renderForm({ schema: SCHEMA, defaultValue: DATA, collapsible: true });
    const item = panelOf("/links/0");
    expect(item).not.toBe(panelOf("/links"));
    expect(header(item).textContent).not.toContain("第 1 项");
    expect(header(item).textContent).toContain("甲");
    expect(panelOf("/meta")?.open).toBe(true);
    expect(panelOf("/links")?.open).toBe(true);
    expect(item?.open).toBe(false);
    expect(panelOf("/meta/seo")?.open).toBe(false);
  });

  it("摘要随数据更新, 标题行显示其下错误数", () => {
    const { handle } = renderForm({ schema: SCHEMA, defaultValue: { ...DATA, meta: { author: "" } }, collapsible: true });
    fireEvent.change(byPath("/links/0/text") as HTMLInputElement, { target: { value: "乙" } });
    expect(header(panelOf("/links/0")).textContent).toContain("乙");
    act(() => {
      handle().setValues({ meta: {} });
      handle().validate();
    });
    expect(header(panelOf("/meta")).textContent).toContain("1 个错误");
  });

  it("提交校验失败时展开其下有错误的面板, 其余保持原状", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        a: { type: "object", properties: { b: { type: "object", properties: { c: { type: "string", minLength: 3 } } } } },
        d: { type: "object", properties: { e: { type: "object", properties: { f: { type: "string" } } } } },
      },
    };
    const { handle } = renderForm({ schema, defaultValue: { a: { b: { c: "x" } }, d: { e: { f: "y" } } }, collapsible: true });
    expect(panelOf("/a/b")?.open).toBe(false);
    act(() => {
      handle().submit();
    });
    expect(panelOf("/a/b")?.open).toBe(true);
    expect(panelOf("/d/e")?.open).toBe(false);
  });

  it("不传 collapsible 或 drill 为 true 时没有面板", () => {
    const { unmount } = renderForm({ schema: SCHEMA, defaultValue: DATA });
    expect(document.querySelector(".jotl-panel")).toBeNull();
    unmount();
    renderForm({ schema: SCHEMA, defaultValue: DATA, drill: true, collapsible: true });
    expect(document.querySelector(".jotl-panel")).toBeNull();
  });
});
