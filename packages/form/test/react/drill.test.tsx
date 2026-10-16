// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JsonSchema } from "@jotl/core";
import { JotlForm } from "../../src/index.js";
import { byPath, FORM_ID, renderForm } from "./helpers.js";

const SCHEMA: JsonSchema = {
  type: "object",
  title: "文章",
  properties: {
    title: { type: "string", title: "标题" },
    meta: {
      type: "object",
      title: "元信息",
      properties: { author: { type: "string", title: "作者" }, seo: { type: "object", title: "SEO", properties: { robots: { type: "string" } } } },
      required: ["author"],
    },
    size: { type: "object", title: "尺寸", "x-ui": { widget: "inline" }, properties: { w: { type: "number" }, h: { type: "number" } } },
    tags: { type: "array", title: "标签", items: { type: "string" } },
    links: {
      type: "array",
      title: "链接",
      items: { type: "object", properties: { href: { type: "string" }, text: { type: "string" } }, required: ["href"] },
      "x-ui": { summary: "text" },
    },
    blocks: { type: "array", title: "区块", items: { type: "object", properties: { n: { type: "number" } } } },
    dict: { type: "object", title: "字典", additionalProperties: { type: "object", properties: { v: { type: "string" } } } },
  },
  required: ["title", "meta"],
};

const DATA = {
  title: "t",
  meta: { author: "张三", seo: { robots: "index" } },
  size: { w: 1, h: 2 },
  tags: ["a"],
  links: [{ href: "https://a", text: "甲" }, { href: "https://b" }],
  blocks: [{ n: 1 }],
  dict: { k1: { v: "x" } },
};

const entry = (path: string) => byPath(path) as HTMLButtonElement;
const crumbs = () => within(screen.getByRole("navigation", { name: "当前位置" }));

describe("钻取渲染", () => {
  it("根页: 标量字段直接编辑, inline 对象展开, 组合字段为入口行(标签 + 摘要)", () => {
    renderForm({ schema: SCHEMA, defaultValue: DATA, drill: true });
    expect((byPath("/title") as HTMLInputElement).value).toBe("t");
    expect((byPath("/size/w") as HTMLInputElement).value).toBe("1");
    for (const path of ["/meta", "/tags", "/links", "/blocks", "/dict"]) expect(entry(path).tagName).toBe("BUTTON");
    expect(byPath("/meta/author")).toBeNull();
    // 不写 summary 时取第一个字符串字段.
    expect(entry("/meta").textContent).toContain("张三");
    expect(screen.getByText("元信息")).not.toBeNull();
    expect(crumbs().getAllByRole("listitem").map((li) => li.textContent)).toEqual(["文章"]);
  });

  it("非受控时 schema 变化后回到根页", () => {
    const onPathChange = vi.fn();
    const view = renderForm({ schema: SCHEMA, defaultValue: DATA, drill: true, onPathChange });
    fireEvent.click(entry("/meta"));
    expect(byPath("/title")).toBeNull();
    view.rerender(<JotlForm id={FORM_ID} drill schema={{ ...(SCHEMA as object), title: "新" } as JsonSchema} defaultValue={DATA} onPathChange={onPathChange} />);
    expect(onPathChange).toHaveBeenLastCalledWith("");
    expect(byPath("/title")).not.toBeNull();
  });

  it("点击入口进入下一层, 面包屑由各层标签组成, 点上一级退回", () => {
    const onPathChange = vi.fn();
    renderForm({ schema: SCHEMA, defaultValue: DATA, drill: true, onPathChange });
    fireEvent.click(entry("/meta"));
    expect(onPathChange).toHaveBeenLastCalledWith("/meta");
    expect((byPath("/meta/author") as HTMLInputElement).value).toBe("张三");
    expect(byPath("/title")).toBeNull();
    fireEvent.click(entry("/meta/seo"));
    expect((byPath("/meta/seo/robots") as HTMLInputElement).value).toBe("index");
    expect(crumbs().getAllByRole("listitem").map((li) => li.textContent)).toEqual(["文章", "元信息", "SEO"]);
    fireEvent.click(crumbs().getByRole("button", { name: "元信息" }));
    expect(byPath("/meta/author")).not.toBeNull();
    fireEvent.click(crumbs().getByRole("button", { name: "文章" }));
    expect(byPath("/title")).not.toBeNull();
    expect(onPathChange.mock.calls.map(([p]) => p)).toEqual(["/meta", "/meta/seo", "/meta", ""]);
  });

  it("数组页: 标量元素直接编辑; 对象元素为入口, 摘要取 summary 字段, 没有时为第 n 项; 面包屑同样", () => {
    const { handle } = renderForm({ schema: SCHEMA, defaultValue: DATA, drill: true, path: "/tags" });
    fireEvent.change(byPath("/tags/0")!, { target: { value: "b" } });
    expect(handle().getValues()).toMatchObject({ tags: ["b"] });
    act(() => {
      handle().setValues(DATA);
    });
  });

  it("对象元素的入口文字与面包屑", () => {
    const view = renderForm({ schema: SCHEMA, defaultValue: DATA, drill: true, path: "/links" });
    expect(entry("/links/0").textContent).toContain("甲");
    expect(entry("/links/1").textContent).toContain("已填 1 项");
    view.unmount();
    renderForm({ schema: SCHEMA, defaultValue: DATA, drill: true, path: "/links/0" });
    expect((byPath("/links/0/href") as HTMLInputElement).value).toBe("https://a");
    expect(crumbs().getAllByRole("listitem").map((li) => li.textContent)).toEqual(["文章", "链接", "甲"]);
  });

  it("字典页: 值为对象时是入口, 面包屑显示键名", () => {
    renderForm({ schema: SCHEMA, defaultValue: DATA, drill: true, path: "/dict/k1" });
    expect((byPath("/dict/k1/v") as HTMLInputElement).value).toBe("x");
    expect(crumbs().getAllByRole("listitem").map((li) => li.textContent)).toEqual(["文章", "字典", "k1"]);
  });

  it("受控 path: 只经 onPathChange 通知, 父组件不采纳时停在原页", () => {
    const onPathChange = vi.fn();
    renderForm({ schema: SCHEMA, defaultValue: DATA, drill: true, path: "", onPathChange });
    fireEvent.click(entry("/meta"));
    expect(onPathChange).toHaveBeenCalledWith("/meta");
    expect(byPath("/title")).not.toBeNull();
    expect(byPath("/meta/author")).toBeNull();
  });

  it("入口行显示其下错误数; 提交失败跳到第一个错误所在的层", () => {
    const onPathChange = vi.fn();
    const { handle } = renderForm({ schema: SCHEMA, defaultValue: { ...DATA, meta: { seo: {} } }, drill: true, onPathChange });
    act(() => void handle().validate());
    expect(entry("/meta").textContent).toContain("1 个错误");
    expect(entry("/meta").getAttribute("aria-invalid")).toBe("true");
    expect(byPath("/meta/author")).toBeNull();
    act(() => void handle().submit());
    expect(onPathChange).toHaveBeenLastCalledWith("/meta");
    expect(byPath("/meta/author")!.getAttribute("aria-invalid")).toBe("true");
  });

  it("不在当前页的错误: 面包屑各上层标出其下, 且不在下一层的错误数", () => {
    const defaultValue = { ...DATA, title: undefined, links: [{}], meta: { seo: { robots: "index" } } };
    const { handle } = renderForm({ schema: SCHEMA, defaultValue, drill: true, path: "/meta/seo" });
    act(() => void handle().validate());
    const items = crumbs().getAllByRole("listitem");
    expect(items[0]!.querySelector(".jotl-breadcrumb-errors")?.textContent).toBe("2 个错误");
    expect(items[1]!.querySelector(".jotl-breadcrumb-errors")?.textContent).toBe("1 个错误");
    expect(items[2]!.querySelector(".jotl-breadcrumb-errors")).toBeNull();
    expect(crumbs().getByRole("button", { name: "文章" })).not.toBeNull();
  });

  it("当前所在的数组元素被删除时退回父层", () => {
    const onPathChange = vi.fn();
    const { handle } = renderForm({ schema: SCHEMA, defaultValue: DATA, drill: true, onPathChange });
    fireEvent.click(entry("/links"));
    fireEvent.click(entry("/links/1"));
    expect(byPath("/links/1/href")).not.toBeNull();
    act(() => handle().setValues({ ...DATA, links: [DATA.links[0]] }));
    expect(onPathChange).toHaveBeenLastCalledWith("/links");
    expect(entry("/links/0")).not.toBeNull();
    expect(byPath("/links/1/href")).toBeNull();
  });

  it.each([
    ["删除", {}],
    ["改名", { k2: { v: "x" } }],
  ])("当前所在的字典键被%s时退回父层", (_, dict) => {
    const onPathChange = vi.fn();
    const { handle } = renderForm({ schema: SCHEMA, defaultValue: DATA, drill: true, onPathChange });
    fireEvent.click(entry("/dict"));
    fireEvent.click(entry("/dict/k1"));
    expect(byPath("/dict/k1/v")).not.toBeNull();
    act(() => handle().setValues({ ...DATA, dict }));
    expect(onPathChange).toHaveBeenLastCalledWith("/dict");
    expect(byPath("/dict/k1/v")).toBeNull();
    expect(crumbs().getAllByRole("listitem").map((li) => li.textContent)).toEqual(["文章", "字典"]);
  });

  it("首次渲染就落在不存在的字典键上时立即退回父层", () => {
    const onPathChange = vi.fn();
    renderForm({ schema: SCHEMA, defaultValue: DATA, drill: true, path: "/dict/nope", onPathChange });
    expect(onPathChange).toHaveBeenLastCalledWith("/dict");
    expect(entry("/dict/k1").tagName).toBe("BUTTON");
  });

  it("未填的对象字段照常进入, 不退回", () => {
    renderForm({ schema: SCHEMA, defaultValue: { ...DATA, meta: undefined }, drill: true, path: "/meta/seo" });
    expect(byPath("/meta/seo/robots")).not.toBeNull();
  });

  it("对象分支的联合为入口; 可空对象显示置空开关与入口", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        shape: {
          oneOf: [
            { type: "object", title: "圆", properties: { kind: { const: "circle" }, r: { type: "number" } }, required: ["kind"] },
            { type: "object", title: "方", properties: { kind: { const: "square" }, a: { type: "number" } }, required: ["kind"] },
          ],
        },
        extra: { type: ["object", "null"], properties: { note: { type: "string" } } },
      },
    };
    renderForm({ schema, defaultValue: { shape: { kind: "circle", r: 1 }, extra: { note: "n" } }, drill: true });
    expect(entry("/shape").tagName).toBe("BUTTON");
    expect(screen.getByRole("checkbox", { name: "置为空" })).not.toBeNull();
    expect(screen.getByRole("button", { name: /n/ })).not.toBeNull();
    fireEvent.click(entry("/shape"));
    expect((byPath("/shape/r") as HTMLInputElement).value).toBe("1");
    expect(screen.getByRole("combobox", { name: "类型" })).not.toBeNull();
  });

  it("drill=false 时各层同页展开", () => {
    renderForm({ schema: SCHEMA, defaultValue: DATA, drill: false });
    expect((byPath("/meta/author") as HTMLInputElement).value).toBe("张三");
    expect((byPath("/links/0/href") as HTMLInputElement).value).toBe("https://a");
  });
});

describe("表单级错误列表定位", () => {
  const formList = () => within(document.getElementById(`${FORM_ID}-errors`)!);

  it("钻取: 点击不在当前页的错误切到所在页并聚焦字段", () => {
    const onPathChange = vi.fn();
    const defaultValue = { ...DATA, title: "", links: [{}], meta: { seo: { robots: "index" } } };
    const { handle } = renderForm({ schema: SCHEMA, defaultValue, drill: true, path: "/meta/seo", onPathChange });
    act(() => void handle().validate());
    const buttons = formList().getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    const href = buttons.find((b) => /href/.test(b.textContent ?? ""))!;
    expect(href.getAttribute("aria-label")).toMatch(/跳到所在位置$/);
    fireEvent.click(href);
    expect(onPathChange).toHaveBeenLastCalledWith("/links/0");
  });

  it("钻取(内部维护 path): 切页后聚焦字段", () => {
    const defaultValue = { ...DATA, links: [{}] };
    const { handle } = renderForm({ schema: SCHEMA, defaultValue, drill: true });
    fireEvent.click(entry("/meta"));
    act(() => void handle().validate());
    fireEvent.click(formList().getAllByRole("button").find((b) => /href/.test(b.textContent ?? ""))!);
    expect(document.activeElement).toBe(byPath("/links/0/href"));
    expect(crumbs().getAllByRole("listitem")).toHaveLength(3);
  });

  it("不钻取: 点击聚焦对应字段, 字段被隐藏时聚焦最近的可见祖先中的控件", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        a: { type: "string", title: "甲" },
        b: { type: "string", title: "乙", minLength: 3, "x-ui": { visibleIf: { field: "/a", eq: "show" } } },
      },
    };
    const { handle } = renderForm({ schema, defaultValue: { a: "x", b: "1" } });
    act(() => void handle().validate());
    fireEvent.click(formList().getByRole("button"));
    expect(document.activeElement).toBe(byPath("/a"));
  });
});
