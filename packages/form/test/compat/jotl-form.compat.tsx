// JotlForm 在 React 16.8 / 17 / 18 / 19 下的主路径: 渲染, 输入改值, 数组新增, 联合切换, 钻取与折叠, 错误定位, schema 切换, ref 实例方法, 卸载.
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as TestUtils from "react-dom/test-utils";
import * as Client from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JsonSchema } from "@jotl/core";
import { JotlForm, nodeId, type JotlFormHandle, type JotlFormProps } from "../../src/index.js";

const major = Number(React.version.split(".")[0]);
const act: (callback: () => void) => void = (React as { act?: typeof TestUtils.act }).act ?? TestUtils.act;

interface Mounted {
  container: HTMLElement;
  /** 在同一根上重新渲染(更新而非重新挂载). */
  update(element: React.ReactElement): void;
  unmount(): void;
}

let mounted: Mounted[] = [];

function mount(element: React.ReactElement): Mounted {
  const container = document.createElement("div");
  // React 16 把事件委托在 document 上, 容器须在文档中.
  document.body.appendChild(container);
  let unmount: () => void;
  let update: (next: React.ReactElement) => void;
  if (major >= 18) {
    const root = (Client as unknown as { createRoot(c: Element): { render(e: unknown): void; unmount(): void } }).createRoot(container);
    update = (next) => act(() => root.render(next));
    unmount = () => act(() => root.unmount());
  } else {
    const legacy = ReactDOM as unknown as { render(e: unknown, c: Element): void; unmountComponentAtNode(c: Element): boolean };
    update = (next) => act(() => void legacy.render(next, container));
    unmount = () => act(() => void legacy.unmountComponentAtNode(container));
  }
  update(element);
  const result = {
    container,
    update,
    unmount: () => {
      unmount();
      container.remove();
      mounted = mounted.filter((m) => m !== result);
    },
  };
  mounted.push(result);
  return result;
}

afterEach(() => {
  for (const m of [...mounted]) m.unmount();
});

const FORM_ID = "c";
const byPath = (path: string) => document.getElementById(nodeId(FORM_ID, path));

/** 受控输入改值: 经原型上的 value setter 写入, 再派发 input 事件(React 各版本都监听). */
function typeInto(element: HTMLElement | null, value: string): void {
  const input = element as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function selectValue(element: HTMLElement | null, value: string): void {
  const select = element as HTMLSelectElement;
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function click(element: Element | null | undefined): void {
  act(() => {
    (element as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function buttonByText(text: RegExp): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find((b) => text.test(b.textContent ?? ""));
  if (button === undefined) throw new Error(`没有文字匹配 ${text} 的按钮`);
  return button;
}

const SCHEMA: JsonSchema = {
  type: "object",
  title: "文章",
  properties: {
    title: { type: "string", title: "标题", minLength: 2 },
    meta: { type: "object", title: "元信息", properties: { author: { type: "string", title: "作者" } } },
    tags: { type: "array", title: "标签", items: { type: "string" } },
    shape: {
      title: "形状",
      oneOf: [
        { type: "object", title: "圆", properties: { kind: { const: "circle" }, r: { type: "number" } }, required: ["kind"] },
        { type: "object", title: "方", properties: { kind: { const: "square" }, a: { type: "number" } }, required: ["kind"] },
      ],
    },
  },
  required: ["title"],
};

const DATA = { title: "ab", meta: { author: "张三" }, tags: ["a"], shape: { kind: "circle", r: 1 } };

function form(props: Omit<JotlFormProps, "schema"> & { schema?: JsonSchema }, ref?: React.Ref<JotlFormHandle>) {
  return <JotlForm id={FORM_ID} schema={SCHEMA} {...props} ref={ref} />;
}

describe(`React ${React.version}`, () => {
  it("别名生效: 用例与 react-dom 用的是同一个 React", () => {
    expect(String(major)).toBe(process.env.JOTL_REACT);
    // react-dom 内部若用了另一份 React, hooks 会报 Invalid hook call; 这里再核对版本号.
    const dom = ReactDOM as { version?: string; default?: { version?: string } };
    // react-dom 16.8 不导出 version.
    expect(dom.version ?? dom.default?.version ?? (major === 16 ? React.version : undefined)).toBe(React.version);
  });

  it("渲染对象, 输入改值触发 onChange, 数组新增, 联合切换", () => {
    const onChange = vi.fn();
    mount(form({ defaultValue: DATA, drill: false, onChange }));
    expect((byPath("/title") as HTMLInputElement).value).toBe("ab");
    expect((byPath("/meta/author") as HTMLInputElement).value).toBe("张三");

    typeInto(byPath("/meta/author"), "李四");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ meta: { author: "李四" } }));
    expect((byPath("/meta/author") as HTMLInputElement).value).toBe("李四");

    click(byPath("/tags")?.querySelector(".jotl-array-add"));
    expect(byPath("/tags/1")).not.toBeNull();
    expect((onChange.mock.lastCall![0] as { tags: unknown[] }).tags).toHaveLength(2);

    const selector = document.querySelector<HTMLSelectElement>(`select[id^="${nodeId(FORM_ID, "/shape")}"]`) ?? (byPath("/shape")?.querySelector("select") as HTMLSelectElement);
    selectValue(selector, "1");
    expect((onChange.mock.lastCall![0] as { shape: unknown }).shape).toEqual(expect.objectContaining({ kind: "square" }));
    expect(byPath("/shape/a")).not.toBeNull();
  });

  it("钻取: 入口行进入下一层, 面包屑退回", () => {
    mount(form({ defaultValue: DATA }));
    expect(byPath("/meta/author")).toBeNull();
    click(byPath("/meta"));
    expect((byPath("/meta/author") as HTMLInputElement).value).toBe("张三");
    click(buttonByText(/^文章/));
    expect(byPath("/meta/author")).toBeNull();
  });

  it("折叠面板: 提交失败展开含错误的面板", () => {
    const ref = React.createRef<JotlFormHandle>();
    const schema: JsonSchema = {
      type: "object",
      properties: { a: { type: "object", properties: { b: { type: "object", properties: { c: { type: "string", minLength: 3 } } } } } },
    };
    mount(form({ schema, defaultValue: { a: { b: { c: "x" } } }, drill: false, collapsible: true }, ref));
    const panel = byPath("/a/b")?.closest("details");
    expect(panel?.open).toBe(false);
    act(() => void ref.current!.submit());
    expect(panel?.open).toBe(true);
  });

  it("ref 实例方法: validate, setValues, getValues, reset, submit", () => {
    const ref = React.createRef<JotlFormHandle>();
    const onSubmit = vi.fn();
    mount(form({ defaultValue: DATA, drill: false, onSubmit, locale: "en" }, ref));
    let result: ReturnType<JotlFormHandle["validate"]> | undefined;
    act(() => {
      ref.current!.setValues({ ...DATA, title: "x" });
    });
    act(() => {
      result = ref.current!.validate();
    });
    expect(result?.valid).toBe(false);
    expect(document.body.textContent).toMatch(/title|标题/);
    expect(ref.current!.getValues()).toEqual(expect.objectContaining({ title: "x" }));
    act(() => ref.current!.reset());
    expect(ref.current!.getValues()).toEqual(DATA);
    act(() => void ref.current!.submit());
    expect(onSubmit).toHaveBeenCalledWith(DATA);
  });

  it("非受控: schema 切换后按新 schema 重新取默认值并清掉错误; 内容相同的新对象不重置", () => {
    const v1: JsonSchema = { type: "object", properties: { title: { type: "string", minLength: 3, default: "旧" } } };
    const v2: JsonSchema = { type: "object", properties: { name: { type: "string", default: "新" } } };
    const onChange = vi.fn();
    const ref = React.createRef<JotlFormHandle>();
    const view = mount(form({ schema: v1, drill: false, onChange }, ref));
    typeInto(byPath("/title"), "x");
    act(() => void ref.current!.validate());
    expect(view.container.querySelector(".jotl-error")).not.toBeNull();
    view.update(form({ schema: v2, drill: false, onChange }, ref));
    expect((byPath("/name") as HTMLInputElement).value).toBe("新");
    expect(view.container.querySelector(".jotl-error")).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith({ name: "新" });
    typeInto(byPath("/name"), "改过");
    view.update(form({ schema: JSON.parse(JSON.stringify(v2)) as JsonSchema, drill: false, onChange }, ref));
    expect((byPath("/name") as HTMLInputElement).value).toBe("改过");
  });

  it("钻取: 点击表单级错误切到所在页并聚焦字段", () => {
    const ref = React.createRef<JotlFormHandle>();
    mount(form({ defaultValue: { ...DATA, meta: { author: "" } }, schema: { ...SCHEMA, properties: { ...SCHEMA.properties, meta: { type: "object", properties: { author: { type: "string", minLength: 1 } } } } } }, ref));
    click(byPath("/tags"));
    act(() => void ref.current!.validate());
    expect(byPath("/meta/author")).toBeNull();
    click(document.getElementById(`${FORM_ID}-errors`)?.querySelector("button"));
    expect(document.activeElement).toBe(byPath("/meta/author"));
  });

  it("受控: 父组件不采纳新值时保持受控值; 卸载后不再回调", () => {
    const onChange = vi.fn();
    const view = mount(form({ value: DATA, drill: false, onChange }));
    typeInto(byPath("/title"), "abc");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ title: "abc" }));
    expect((byPath("/title") as HTMLInputElement).value).toBe("ab");
    view.unmount();
    expect(byPath("/title")).toBeNull();
    expect(document.querySelector(".jotl-form, form")).toBeNull();
  });
});
