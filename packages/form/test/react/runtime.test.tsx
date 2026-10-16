// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JsonSchema } from "@jotl/core";
import { JotlDebug, JotlForm, useDegradeLog } from "../../src/react/index.js";
import { byPath, errorsAt, formErrors, renderForm } from "./helpers.js";
import { compositeRegistry } from "./widgets.js";

describe("三种 mode(R6)", () => {
  const SCHEMA: JsonSchema = {
    type: "object",
    properties: { name: { type: "string" }, list: { type: "array", items: { type: "string" } } },
  };

  it("edit 可编辑, 有增删按钮与提交按钮", () => {
    renderForm({ schema: SCHEMA, mode: "edit", defaultValue: { list: ["a"] } });
    const input = byPath("/name") as HTMLInputElement;
    expect(input.readOnly || input.disabled).toBe(false);
    expect(screen.getByRole("button", { name: "新增" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "提交" })).toBeTruthy();
  });

  it("view 只读, 不显示增删与提交", () => {
    renderForm({ schema: SCHEMA, mode: "view", defaultValue: { name: "n", list: ["a"] } });
    expect((byPath("/name") as HTMLInputElement).readOnly).toBe(true);
    expect((byPath("/list/0") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.queryByRole("button", { name: "新增" })).toBeNull();
    expect(screen.queryByRole("button", { name: "提交" })).toBeNull();
  });

  it("disabled 禁用控件, 渲染器拒绝改动", () => {
    const { handle } = renderForm({ schema: SCHEMA, mode: "disabled", defaultValue: { name: "n", list: ["a"] } });
    expect((byPath("/name") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "新增" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(byPath("/name")!, { target: { value: "x" } });
    expect(handle().getValues()).toEqual({ name: "n", list: ["a"] });
  });

  it("mode 可在挂载后切换", () => {
    const { rerender } = render(<JotlForm id="f" schema={SCHEMA} mode="view" defaultValue={{ name: "n" }} />);
    expect((byPath("/name") as HTMLInputElement).readOnly).toBe(true);
    rerender(<JotlForm id="f" schema={SCHEMA} mode="edit" defaultValue={{ name: "n" }} />);
    expect((byPath("/name") as HTMLInputElement).readOnly).toBe(false);
  });
});

describe("联合类型分支切换(R7, D45)", () => {
  const SCHEMA: JsonSchema = {
    type: "object",
    properties: {
      target: {
        anyOf: [
          { title: "链接", type: "object", properties: { url: { type: "string" } } },
          { title: "页面", type: "object", properties: { page: { type: "integer", default: 1 } } },
        ],
      },
    },
  };

  it("切换时用新分支的默认数据替换当前值; 切回时恢复先前的值", () => {
    const { handle } = renderForm({ schema: SCHEMA, registry: compositeRegistry(), defaultValue: { target: { url: "https://a" } } });
    const select = () => screen.getByLabelText("branch:/target") as HTMLSelectElement;
    expect(select().value).toBe("0");
    fireEvent.change(select(), { target: { value: "1" } });
    expect(handle().getValues()).toEqual({ target: { page: 1 } });
    expect(select().value).toBe("1");
    fireEvent.change(byPath("/target/page")!, { target: { value: "7" } });
    fireEvent.change(select(), { target: { value: "0" } });
    expect(handle().getValues()).toEqual({ target: { url: "https://a" } });
    expect((byPath("/target/url") as HTMLInputElement).value).toBe("https://a");
    fireEvent.change(select(), { target: { value: "1" } });
    expect(handle().getValues()).toEqual({ target: { page: 7 } });
  });

  it("可区分联合切换后新值带上区分字段, 当前分支由区分字段决定", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        shape: {
          oneOf: [
            { type: "object", properties: { kind: { const: "circle" }, r: { type: "number" } }, required: ["kind"] },
            { type: "object", properties: { kind: { const: "square" }, side: { type: "number" } }, required: ["kind"] },
          ],
        },
      },
    };
    const { handle } = renderForm({ schema, registry: compositeRegistry(), defaultValue: { shape: { kind: "circle", r: 2 } } });
    fireEvent.change(screen.getByLabelText("branch:/shape"), { target: { value: "1" } });
    expect(handle().getValues()).toEqual({ shape: { kind: "square" } });
    expect([...(screen.getByLabelText("branch:/shape") as HTMLSelectElement).options].map((o) => o.text)).toEqual(["circle", "square"]);
  });

  it("可空值置空后恢复先前的值", () => {
    const schema: JsonSchema = { type: "object", properties: { note: { type: ["string", "null"] } } };
    const { handle } = renderForm({ schema, registry: compositeRegistry(), defaultValue: { note: "hi" } });
    fireEvent.click(screen.getByLabelText("null:/note"));
    expect(handle().getValues()).toEqual({ note: null });
    fireEvent.click(screen.getByLabelText("null:/note"));
    expect(handle().getValues()).toEqual({ note: "hi" });
  });

  it("数组元素的分支缓存随元素排序移动", () => {
    const schema: JsonSchema = { type: "array", items: (SCHEMA as { properties: { target: JsonSchema } }).properties.target };
    const { handle } = renderForm({ schema, registry: compositeRegistry(), defaultValue: [{ url: "a" }, { url: "b" }] });
    fireEvent.change(screen.getByLabelText("branch:/0"), { target: { value: "1" } });
    fireEvent.click(screen.getAllByRole("button", { name: "下移第 1 项" })[0]!);
    expect(handle().getValues()).toEqual([{ url: "b" }, { page: 1 }]);
    fireEvent.change(screen.getByLabelText("branch:/1"), { target: { value: "0" } });
    expect(handle().getValues()).toEqual([{ url: "b" }, { url: "a" }]);
  });
});

describe("显示条件 visibleIf(R8, D43)", () => {
  const SCHEMA: JsonSchema = {
    type: "object",
    properties: {
      custom: { type: "boolean", title: "自定义" },
      color: { type: "string", title: "颜色", maxLength: 3, "x-ui": { visibleIf: { field: "/custom", eq: true } } },
    },
  };

  it("不可见字段保留数据, 校验照常, 错误进入表单级列表; 变为可见后错误回到字段", () => {
    const onSubmit = vi.fn();
    const { handle } = renderForm({ schema: SCHEMA, onSubmit, defaultValue: { custom: false, color: "toolong" } });
    expect(byPath("/color")).toBeNull();
    let valid: boolean | undefined;
    act(() => {
      valid = handle().submit().valid;
    });
    expect(valid).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(handle().getValues()).toEqual({ custom: false, color: "toolong" });
    expect(formErrors()?.textContent).toContain("颜色");
    fireEvent.click(byPath("/custom")!);
    expect((byPath("/color") as HTMLInputElement).value).toBe("toolong");
    expect(errorsAt("/color")?.textContent).toContain("颜色");
    expect(formErrors()).toBeNull();
  });

  it("数组元素中的条件按元素下标求值", () => {
    const schema: JsonSchema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["a", "b"] },
          extra: { type: "string", "x-ui": { visibleIf: { field: "/*/kind", eq: "b" } } },
        },
      },
    };
    renderForm({ schema, defaultValue: [{ kind: "a" }, { kind: "b" }] });
    expect(byPath("/0/extra")).toBeNull();
    expect(byPath("/1/extra")).not.toBeNull();
  });
});

describe("实例 API(R4)", () => {
  const SCHEMA: JsonSchema = {
    type: "object",
    properties: { name: { type: "string", title: "名称", minLength: 2, default: "默认" } },
    required: ["name"],
  };

  it("getValues setValues validate reset submit", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { handle } = renderForm({ schema: SCHEMA, onChange, onSubmit });
    expect(handle().getValues()).toEqual({ name: "默认" });

    act(() => handle().setValues({ name: "x" }));
    expect((byPath("/name") as HTMLInputElement).value).toBe("x");
    expect(onChange).toHaveBeenLastCalledWith({ name: "x" });

    let result: ReturnType<ReturnType<typeof handle>["validate"]> | undefined;
    act(() => {
      result = handle().validate();
    });
    expect(result?.valid).toBe(false);
    expect(result?.errors.map((e) => e.location)).toEqual([{ kind: "pointer", pointer: "/name" }]);
    expect(errorsAt("/name")?.textContent).toContain("名称");

    act(() => {
      result = handle().submit();
    });
    expect(onSubmit).not.toHaveBeenCalled();

    act(() => handle().reset());
    expect(handle().getValues()).toEqual({ name: "默认" });
    expect(errorsAt("/name")).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith({ name: "默认" });

    act(() => {
      result = handle().submit();
    });
    expect(result?.valid).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith({ name: "默认" });
  });

  it("表单的重置按钮调用 reset", () => {
    const { handle } = renderForm({ schema: SCHEMA });
    fireEvent.change(byPath("/name")!, { target: { value: "改过" } });
    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    expect(handle().getValues()).toEqual({ name: "默认" });
  });

  it("受控模式下 setValues 经 onChange 交给父组件", () => {
    const onChange = vi.fn();
    const { handle } = renderForm({ schema: SCHEMA, value: { name: "受控" }, onChange });
    act(() => handle().setValues({ name: "新" }));
    expect(onChange).toHaveBeenCalledWith({ name: "新" });
    // 父组件没有采纳, 仍显示受控值.
    expect((byPath("/name") as HTMLInputElement).value).toBe("受控");
  });
});

describe("调试视图 JotlDebug(W9)", () => {
  it("列出每个节点选中的组件, 来源与降级记录, 并合并表单上报的事件", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        a: { type: "string", "x-ui": { widget: "missing" } },
        b: { type: "number" },
        items: { type: "array", items: { type: "string" } },
      },
    };
    function Page() {
      const log = useDegradeLog();
      return (
        <>
          <JotlForm schema={schema} onDegrade={log.onDegrade} defaultValue={{ b: "x" }} />
          <JotlDebug schema={schema} events={log.events} />
        </>
      );
    }
    render(<Page />);
    const row = (path: string) => document.querySelector(`tr[data-data-path="${path}"]`)!;
    expect(row("/a").textContent).toContain("input");
    expect(row("/a").textContent).toContain("builtin");
    expect(row("/a").textContent).toContain("F1: missing → input");
    expect(row("/a").textContent).toContain("F1 /a: missing → input");
    expect(row("/b").textContent).toContain("F8 /b: number → json");
    expect(row("/items/*").getAttribute("data-widget")).toBe("input");
    expect([...document.querySelectorAll('tr[data-data-path=""]')].map((r) => r.getAttribute("data-widget"))).toEqual(["form", "page"]);
    expect(screen.getByRole("table").querySelector("caption")?.textContent).toBe("Jotl 渲染计划");
  });

  it("标出按需展开的递归节点", () => {
    const schema: JsonSchema = {
      $ref: "#/$defs/Node",
      $defs: { Node: { type: "object", properties: { next: { $ref: "#/$defs/Node" } } } },
    };
    render(<JotlDebug schema={schema} registry={compositeRegistry()} maxDepth={0} />);
    expect(screen.getByRole("table").textContent).toContain("按需展开");
  });
});
