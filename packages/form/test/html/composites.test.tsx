// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { InputWidget, KvWidget, nextEntryName, NullableWidget, NumberWidget, RadioWidget, TreeWidget, TupleWidget, UnionWidget } from "../../src/html/index.js";
import { ERROR, fieldProps, mapProps, MODES, nullableProps, treeProps, tupleProps, unionProps } from "./helpers.js";

const root = () => document.getElementById("f") as HTMLElement;

/** 复合组件自己显示本节点的错误(外壳不显示), 根元素经 aria-describedby 指向它. */
function expectOwnErrors(present: boolean) {
  if (!present) {
    expect(root().hasAttribute("aria-invalid")).toBe(false);
    expect(root().hasAttribute("aria-describedby")).toBe(false);
    expect(document.getElementById("f-errors")).toBeNull();
    return;
  }
  expect(root().getAttribute("aria-invalid")).toBe("true");
  expect(root().getAttribute("aria-describedby")).toBe("f-errors");
  expect(document.getElementById("f-errors")?.textContent).toBe("类型不符");
}

describe("nullable", () => {
  const toggle = () => screen.getByRole("checkbox", { name: "置为空" }) as HTMLInputElement;

  it("非空时开关未勾选并用 renderContent() 渲染原组件", () => {
    const props = nullableProps();
    render(<NullableWidget {...props} />);
    expect(toggle().checked).toBe(false);
    expect(props.renderContent).toHaveBeenCalled();
    expect(root().textContent).toContain("content");
  });

  it("为空时开关勾选, 不调用 renderContent(), 显示空值", () => {
    const props = nullableProps({ isNull: true });
    render(<NullableWidget {...props} />);
    expect(toggle().checked).toBe(true);
    expect(props.renderContent).not.toHaveBeenCalled();
    expect(root().textContent).toContain("空值");
  });

  it("切换开关调用 setNull", () => {
    const props = nullableProps();
    const { rerender } = render(<NullableWidget {...props} />);
    fireEvent.click(toggle());
    expect(props.setNull).toHaveBeenLastCalledWith(true);
    rerender(<NullableWidget {...props} isNull />);
    fireEvent.click(toggle());
    expect(props.setNull).toHaveBeenLastCalledWith(false);
  });

  it.each(MODES)("mode=%s: 只有 edit 时开关可用, 内容照常渲染", (mode) => {
    const props = nullableProps({ mode });
    render(<NullableWidget {...props} />);
    expect(toggle().disabled).toBe(mode !== "edit");
    expect(props.renderContent).toHaveBeenCalled();
  });

  it("有错误时 aria-invalid 并显示错误", () => {
    const { rerender } = render(<NullableWidget {...nullableProps()} />);
    expectOwnErrors(false);
    rerender(<NullableWidget {...nullableProps({ errors: [ERROR] })} />);
    expectOwnErrors(true);
  });
});

describe("union", () => {
  const select = () => screen.getByRole("combobox", { name: "类型" }) as HTMLSelectElement;

  it("选项取 branches 的 title, 选中 activeBranch, 用 renderContent() 渲染当前分支", () => {
    const props = unionProps({ activeBranch: 1 });
    render(<UnionWidget {...props} />);
    expect([...select().options].map((o) => o.text)).toEqual(["文本", "数字"]);
    expect(select().value).toBe("1");
    expect(props.renderContent).toHaveBeenCalled();
    expect(root().textContent).toContain("content");
  });

  it("选择分支调用 selectBranch(i)", () => {
    const props = unionProps();
    render(<UnionWidget {...props} />);
    fireEvent.change(select(), { target: { value: "1" } });
    expect(props.selectBranch).toHaveBeenLastCalledWith(1);
  });

  it("只有一个分支时不显示分支选择", () => {
    const props = unionProps({ branches: [{ title: "文本" }] });
    render(<UnionWidget {...props} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(props.renderContent).toHaveBeenCalled();
  });

  it.each(MODES)("mode=%s: 只有 edit 时可切换分支", (mode) => {
    const props = unionProps({ mode });
    render(<UnionWidget {...props} />);
    expect(select().disabled).toBe(mode !== "edit");
    expect(props.renderContent).toHaveBeenCalled();
  });

  it("有错误时 aria-invalid 并显示错误", () => {
    const { rerender } = render(<UnionWidget {...unionProps()} />);
    expectOwnErrors(false);
    rerender(<UnionWidget {...unionProps({ errors: [ERROR] })} />);
    expectOwnErrors(true);
  });
});

describe("union 的分段按钮(props.selector: buttons)", () => {
  const radios = () => screen.getAllByRole("radio") as HTMLInputElement[];

  it("一组单选, 文字取 title, 选中 activeBranch; 点击调用 selectBranch(i)", () => {
    const props = unionProps({ activeBranch: 1, props: { selector: "buttons" } });
    render(<UnionWidget {...props} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "类型" })).toBeTruthy();
    expect(radios().map((r) => [r.labels?.[0]?.textContent, r.checked])).toEqual([["文本", false], ["数字", true]]);
    fireEvent.click(radios()[0]!);
    expect(props.selectBranch).toHaveBeenLastCalledWith(0);
    expect(props.renderContent).toHaveBeenCalled();
  });

  it("分支超过 4 个时仍用下拉", () => {
    const branches = ["a", "b", "c", "d", "e"].map((title) => ({ title }));
    render(<UnionWidget {...unionProps({ branches, props: { selector: "buttons" } })} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByRole("combobox", { name: "类型" })).toBeTruthy();
  });

  it.each(MODES)("mode=%s: 只有 edit 时可切换分支", (mode) => {
    render(<UnionWidget {...unionProps({ mode, props: { selector: "buttons" } })} />);
    for (const radio of radios()) expect(radio.disabled).toBe(mode !== "edit");
  });
});

describe("tuple", () => {
  it("按位置用 renderChild(String(i)) 渲染, 没有增删按钮", () => {
    const props = tupleProps({ items: [{ dataPath: "/f/0" }, { dataPath: "/f/1" }] });
    render(<TupleWidget {...props} />);
    expect(props.renderChild.mock.calls.map(([path]) => path)).toEqual(["0", "1"]);
    expect(root().querySelectorAll(".jotl-tuple-item")).toHaveLength(2);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("有 rest 时位置之后渲染剩余元素与增删按钮, 按实际下标调用", () => {
    const add = vi.fn<() => void>();
    const remove = vi.fn<(index: number) => void>();
    const rest = { items: [{ key: "k2", index: 2, dataPath: "/f/2" }], canAdd: true, canRemove: true, add, remove };
    const props = tupleProps({ items: [{ dataPath: "/f/0" }, { dataPath: "/f/1" }], rest });
    render(<TupleWidget {...props} />);
    expect(props.renderChild.mock.calls.map(([path]) => path)).toEqual(["0", "1", "2"]);
    expect(root().querySelectorAll(".jotl-tuple-rest-item")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "新增" }));
    expect(add).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "删除第 3 项" }));
    expect(remove).toHaveBeenCalledWith(2);
  });

  it("rest 的 canAdd / canRemove 为 false 时按钮禁用, view 模式不显示按钮", () => {
    const rest = { items: [{ key: "k1", index: 1, dataPath: "/f/1" }], canAdd: false, canRemove: false, add: vi.fn(), remove: vi.fn() };
    const { rerender } = render(<TupleWidget {...tupleProps({ items: [{ dataPath: "/f/0" }], rest })} />);
    expect((screen.getByRole("button", { name: "新增" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "删除第 2 项" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<TupleWidget {...tupleProps({ items: [{ dataPath: "/f/0" }], rest, mode: "view" })} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("rest 提供 move / duplicate 时剩余元素带上移, 下移, 复制, 按实际下标调用; 首个剩余元素不能上移, 末个不能下移", () => {
    const move = vi.fn<(from: number, to: number) => void>();
    const duplicate = vi.fn<(index: number) => void>();
    const items = [
      { key: "k1", index: 1, dataPath: "/f/1" },
      { key: "k2", index: 2, dataPath: "/f/2" },
    ];
    const rest = { items, canAdd: true, canRemove: true, add: vi.fn(), remove: vi.fn(), move, duplicate };
    const { rerender } = render(<TupleWidget {...tupleProps({ items: [{ dataPath: "/f/0" }], rest })} />);
    const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
    expect(button("上移第 2 项").disabled).toBe(true);
    expect(button("下移第 3 项").disabled).toBe(true);
    fireEvent.click(button("下移第 2 项"));
    expect(move).toHaveBeenLastCalledWith(1, 2);
    fireEvent.click(button("上移第 3 项"));
    expect(move).toHaveBeenLastCalledWith(2, 1);
    fireEvent.click(button("复制第 3 项"));
    expect(duplicate).toHaveBeenCalledWith(2);
    rerender(<TupleWidget {...tupleProps({ items: [{ dataPath: "/f/0" }], rest: { ...rest, canAdd: false }, mode: "disabled" })} />);
    expect(button("复制第 2 项").disabled).toBe(true);
    expect(button("下移第 2 项").disabled).toBe(true);
  });

  it("rest 不提供 move / duplicate 时不显示上移, 下移, 复制", () => {
    const rest = { items: [{ key: "k1", index: 1, dataPath: "/f/1" }], canAdd: true, canRemove: true, add: vi.fn(), remove: vi.fn() };
    render(<TupleWidget {...tupleProps({ items: [{ dataPath: "/f/0" }], rest })} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["新增", "删除"]);
  });

  it("有错误时 aria-invalid 并显示错误", () => {
    const { rerender } = render(<TupleWidget {...tupleProps()} />);
    expectOwnErrors(false);
    rerender(<TupleWidget {...tupleProps({ errors: [ERROR] })} />);
    expectOwnErrors(true);
  });
});

describe("tree", () => {
  const toggle = () => screen.getByRole("button") as HTMLButtonElement;

  it("折叠时不调用 renderContent(), 按钮为展开", () => {
    const props = treeProps();
    render(<TreeWidget {...props} />);
    expect(props.renderContent).not.toHaveBeenCalled();
    expect(toggle().textContent).toBe("展开");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().hasAttribute("aria-controls")).toBe(false);
  });

  it("展开时渲染内容, aria-controls 指向内容", () => {
    const props = treeProps({ expanded: true });
    render(<TreeWidget {...props} />);
    expect(props.renderContent).toHaveBeenCalled();
    expect(toggle().textContent).toBe("收起");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(toggle().getAttribute("aria-controls") ?? "")?.textContent).toBe("content");
  });

  it("点击按钮调用 setExpanded 取反", () => {
    const props = treeProps();
    const { rerender } = render(<TreeWidget {...props} />);
    fireEvent.click(toggle());
    expect(props.setExpanded).toHaveBeenLastCalledWith(true);
    rerender(<TreeWidget {...props} expanded />);
    fireEvent.click(toggle());
    expect(props.setExpanded).toHaveBeenLastCalledWith(false);
  });

  it.each(MODES)("mode=%s: 展开是展示操作, 只有 disabled 时禁用", (mode) => {
    render(<TreeWidget {...treeProps({ mode })} />);
    expect(toggle().disabled).toBe(mode === "disabled");
  });

  it("有错误时 aria-invalid 并显示错误", () => {
    const { rerender } = render(<TreeWidget {...treeProps()} />);
    expectOwnErrors(false);
    rerender(<TreeWidget {...treeProps({ errors: [ERROR] })} />);
    expectOwnErrors(true);
  });
});

describe("map", () => {
  const ENTRIES = [
    { key: "k1", name: "a", dataPath: "/f/a" },
    { key: "k2", name: "x/y", dataPath: "/f/x~1y" },
  ];
  const keyInput = (i: number) => screen.getByRole("textbox", { name: `第 ${i + 1} 项的键名` }) as HTMLInputElement;
  const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

  it("列出键名, 值用 renderChild(转义后的键名) 渲染", () => {
    const props = mapProps({ entries: ENTRIES });
    render(<KvWidget {...props} />);
    expect(keyInput(0).value).toBe("a");
    expect(keyInput(1).value).toBe("x/y");
    expect(props.renderChild.mock.calls.map(([path]) => path)).toEqual(["a", "x~1y"]);
    expect(document.querySelectorAll("li.jotl-map-entry")).toHaveLength(2);
  });

  it("改键名调用 renameEntry", () => {
    const props = mapProps({ entries: ENTRIES });
    render(<KvWidget {...props} />);
    fireEvent.change(keyInput(0), { target: { value: "b" } });
    expect(props.renameEntry).toHaveBeenLastCalledWith("a", "b");
  });

  it.each([
    ["", "键名不能为空, 修正前不会保存"],
    ["x/y", '键名 "x/y" 已存在, 修正前不会保存'],
  ])("键名改为 %j 时保留草稿并提示, 不写回; 改回合法后写回并清除提示", (bad, message) => {
    const props = mapProps({ entries: ENTRIES });
    render(<KvWidget {...props} />);
    fireEvent.change(keyInput(0), { target: { value: bad } });
    expect(props.renameEntry).not.toHaveBeenCalled();
    expect(keyInput(0).value).toBe(bad);
    expect(keyInput(0).getAttribute("aria-invalid")).toBe("true");
    const hint = document.getElementById(keyInput(0).getAttribute("aria-describedby") ?? "");
    expect(hint?.textContent).toBe(message);
    expect(hint?.getAttribute("role")).toBe("alert");

    fireEvent.change(keyInput(0), { target: { value: "c" } });
    expect(props.renameEntry).toHaveBeenLastCalledWith("a", "c");
    expect(keyInput(0).hasAttribute("aria-invalid")).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("改回原键名不写回, 也不提示重复", () => {
    const props = mapProps({ entries: ENTRIES });
    render(<KvWidget {...props} />);
    fireEvent.change(keyInput(0), { target: { value: "" } });
    fireEvent.change(keyInput(0), { target: { value: "a" } });
    expect(props.renameEntry).not.toHaveBeenCalled();
    expect(keyInput(0).hasAttribute("aria-invalid")).toBe(false);
  });

  it("改名后条目 key 不变: 行被复用, 键名框保留焦点", () => {
    const props = mapProps({ entries: ENTRIES });
    const { rerender } = render(<KvWidget {...props} />);
    const row = document.querySelectorAll("li")[0];
    keyInput(0).focus();
    fireEvent.change(keyInput(0), { target: { value: "ab" } });
    rerender(<KvWidget {...props} entries={[{ key: "k1", name: "ab", dataPath: "/f/ab" }, ENTRIES[1]!]} />);
    expect(document.querySelectorAll("li")[0]).toBe(row);
    expect(document.activeElement).toBe(keyInput(0));
    expect(keyInput(0).value).toBe("ab");
  });

  it("增加用未占用的默认键名调用 addEntry, 删除调用 removeEntry", () => {
    const props = mapProps({ entries: ENTRIES });
    render(<KvWidget {...props} />);
    fireEvent.click(button("新增"));
    expect(props.addEntry).toHaveBeenLastCalledWith("key3");
    fireEvent.click(button("删除 x/y"));
    expect(props.removeEntry).toHaveBeenLastCalledWith("x/y");
  });

  it("nextEntryName 跳过已占用的键名", () => {
    expect(nextEntryName([])).toBe("key1");
    expect(nextEntryName(["a", "key3", "key4"])).toBe("key5");
  });

  it("按 canAdd canRemove 禁用按钮", () => {
    const props = mapProps({ entries: ENTRIES, canAdd: false, canRemove: false });
    render(<KvWidget {...props} />);
    expect(button("新增").disabled).toBe(true);
    expect(button("删除 a").disabled).toBe(true);
    fireEvent.click(button("新增"));
    expect(props.addEntry).not.toHaveBeenCalled();
  });

  it("mode=edit: 键名可编辑, 按钮可用", () => {
    render(<KvWidget {...mapProps({ entries: ENTRIES })} />);
    expect(keyInput(0).readOnly).toBe(false);
    expect(keyInput(0).disabled).toBe(false);
    expect(button("新增").disabled).toBe(false);
  });

  it("mode=view: 键名只读, 没有按钮", () => {
    render(<KvWidget {...mapProps({ entries: ENTRIES, mode: "view", canAdd: false, canRemove: false })} />);
    expect(keyInput(0).readOnly).toBe(true);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("mode=disabled: 键名与按钮全部禁用", () => {
    render(<KvWidget {...mapProps({ entries: ENTRIES, mode: "disabled", canAdd: false, canRemove: false })} />);
    expect(keyInput(0).disabled).toBe(true);
    const buttons = screen.getAllByRole("button") as HTMLButtonElement[];
    expect(buttons).toHaveLength(3);
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });

  it("有错误时 aria-invalid 并显示错误", () => {
    const { rerender } = render(<KvWidget {...mapProps({ entries: ENTRIES })} />);
    expectOwnErrors(false);
    rerender(<KvWidget {...mapProps({ entries: ENTRIES, errors: [ERROR] })} />);
    expectOwnErrors(true);
  });
});

describe("内容节点的可访问名称", () => {
  const withLabel = (node: React.ReactNode) => (
    <>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: 模拟字段外壳标签, 被测控件经 aria-labelledby 关联 */}
      <label id="f-label">外围</label>
      {node}
    </>
  );

  it("id 以 + 结尾的输入控件经 aria-labelledby 取外围标签; 嵌套内容节点同样", () => {
    render(withLabel(<InputWidget {...fieldProps<string>({ id: "f+" })} />));
    expect(screen.getByLabelText("外围").id).toBe("f+");
    cleanup();
    render(withLabel(<NumberWidget {...fieldProps<number>({ id: "f++", schema: { type: "number" } })} />));
    expect(screen.getByLabelText("外围").id).toBe("f++");
  });

  it("普通控件不加 aria-labelledby, 仍由 label 的 for 关联", () => {
    render(<InputWidget {...fieldProps<string>()} />);
    expect(document.getElementById("f")?.hasAttribute("aria-labelledby")).toBe(false);
  });

  it("内容节点的单选组以外围标签为组名, 各选项仍以自身文字为名", () => {
    render(withLabel(<RadioWidget {...fieldProps<unknown>({ id: "f+", schema: { enum: ["a", "b"] } })} />));
    expect(screen.getByRole("radiogroup", { name: "外围" }).id).toBe("f+");
    expect(screen.getByRole("radio", { name: "a" })).toBeTruthy();
  });

  it("内容节点的复合组件以外围标签为组名", () => {
    render(withLabel(<UnionWidget {...unionProps({ id: "f+" })} />));
    expect(screen.getByRole("group", { name: "外围" }).id).toBe("f+");
  });
});
