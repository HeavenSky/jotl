// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JsonSchema } from "@jotl/core";
import type { BaseProps, FieldProps } from "../../src/core/index.js";
import type { ReactNode } from "react";
import { createDefaultRegistry, nodeId } from "../../src/react/index.js";
import { byPath, errorsAt, FORM_ID, renderForm } from "./helpers.js";
import { compositeRegistry } from "./widgets.js";

describe("数组元素展开与嵌套", () => {
  it("按数据个数展开元素模板, 多层嵌套数组逐层递归", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        grid: { type: "array", items: { type: "array", items: { type: "array", items: { type: "number" } } } },
        cards: { type: "array", items: { type: "object", properties: { img: { type: "string" } } } },
      },
    };
    const { handle } = renderForm({ schema, defaultValue: { grid: [[[1, 2]], [[3], [4, 5]]], cards: [{ img: "a" }, { img: "b" }] } });
    expect((byPath("/grid/1/1/1") as HTMLInputElement).value).toBe("5");
    expect((byPath("/cards/1/img") as HTMLInputElement).value).toBe("b");
    fireEvent.change(byPath("/grid/0/0/1")!, { target: { value: "9" } });
    expect(handle().getValues()).toEqual({ grid: [[[1, 9]], [[3], [4, 5]]], cards: [{ img: "a" }, { img: "b" }] });
  });
});

describe("数组稳定 key", () => {
  const LIST: JsonSchema = { type: "array", items: { type: "number", "x-ui": { widget: "json" } } };

  it("排序后输入焦点与草稿跟随元素, 不串位", () => {
    const { handle } = renderForm({ schema: LIST, defaultValue: [1, 2] });
    const first = byPath("/0") as HTMLTextAreaElement;
    first.focus();
    // json 组件把不合法的 JSON 文本留作草稿, 不写回.
    fireEvent.change(first, { target: { value: "{" } });
    expect(first.value).toBe("{");
    fireEvent.click(screen.getByRole("button", { name: "下移第 1 项" }));
    expect(handle().getValues()).toEqual([2, 1]);
    expect(document.activeElement).toBe(first);
    expect(first.id).toBe(nodeId(FORM_ID, "/1"));
    expect(first.value).toBe("{");
    expect((byPath("/0") as HTMLTextAreaElement).value).toBe("2");
    expect(byPath("/0")).not.toBe(first);
  });

  it("删除中间元素后其余元素保持各自的 DOM 与草稿", () => {
    renderForm({ schema: LIST, defaultValue: [1, 2, 3] });
    const third = byPath("/2") as HTMLTextAreaElement;
    fireEvent.change(third, { target: { value: "[" } });
    fireEvent.click(screen.getByRole("button", { name: "删除第 2 项" }));
    expect(byPath("/1")).toBe(third);
    expect(third.value).toBe("[");
    expect((byPath("/0") as HTMLTextAreaElement).value).toBe("1");
  });
});

describe("联合类型选分支", () => {
  it("可区分联合按区分字段的值选分支", () => {
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
    renderForm({ schema, registry: compositeRegistry(), defaultValue: { shape: { kind: "square", side: 3 } } });
    const select = screen.getByLabelText("branch:/shape") as HTMLSelectElement;
    expect(select.value).toBe("1");
    expect((byPath("/shape/side") as HTMLInputElement).value).toBe("3");
    expect(byPath("/shape/r")).toBeNull();
  });

  it("其余联合取第一个通过校验的分支", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { id: { anyOf: [{ type: "string", maxLength: 2 }, { type: "number" }, { type: "string" }] } },
    };
    renderForm({ schema, registry: compositeRegistry(), defaultValue: { id: "long text" } });
    expect((screen.getByLabelText("branch:/id") as HTMLSelectElement).value).toBe("2");
  });

  it("$ref 分支按数据中的字段匹配", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { link: { anyOf: [{ $ref: "#/$defs/Circle" }, { $ref: "#/$defs/Square" }] } },
      $defs: {
        Circle: { type: "object", properties: { r: { type: "number" } }, required: ["r"] },
        Square: { type: "object", properties: { side: { type: "number" } }, required: ["side"] },
      },
    };
    renderForm({ schema, registry: compositeRegistry(), defaultValue: { link: { side: 2 } } });
    const select = screen.getByLabelText("branch:/link") as HTMLSelectElement;
    expect(select.value).toBe("1");
    expect([...select.options].map((o) => o.text)).toEqual(["Circle", "Square"]);
  });
});

describe("复合组件交还子节点(renderChild)", () => {
  const CARD: JsonSchema = {
    type: "object",
    properties: {
      card: {
        type: "object",
        "x-ui": { widget: "card" },
        properties: {
          img: { type: "string", title: "图片" },
          meta: { type: "object", properties: { alt: { type: "string", title: "说明" } } },
          note: { type: "string", maxLength: 2 },
        },
        required: ["img"],
      },
    },
  };

  function Card(props: FieldProps<unknown, ReactNode>) {
    return (
      <section id={props.id} data-testid="card">
        {props.renderChild("img")}
        {props.renderChild("meta/alt")}
        {props.errors.length > 0 && (
          <div id={`${props.id}-errors`} role="alert">
            {props.errors.map((e, i) => (
              <p key={i}>{e.message}</p>
            ))}
          </div>
        )}
      </section>
    );
  }

  it("接管整个子树的组件用相对路径交还子字段, 子字段照常编辑", () => {
    const registry = createDefaultRegistry().extend();
    registry.register({ name: "card", level: "composite", component: Card, claims: () => "all" });
    const { handle } = renderForm({ schema: CARD, registry, defaultValue: { card: { img: "a.png", meta: { alt: "x" } } } });
    expect(screen.getByTestId("card").querySelectorAll("input")).toHaveLength(2);
    expect((byPath("/card/meta/alt") as HTMLInputElement).value).toBe("x");
    fireEvent.change(byPath("/card/img")!, { target: { value: "b.png" } });
    expect(handle().getValues()).toEqual({ card: { img: "b.png", meta: { alt: "x" } } });
    expect(document.querySelector(`label[for="${nodeId(FORM_ID, "/card/img")}"]`)?.textContent).toContain("图片");
  });

  it("被接管且未交还的路径上的错误交给接管的复合组件, 交还的子字段自己显示", () => {
    const registry = createDefaultRegistry().extend();
    registry.register({ name: "card", level: "composite", component: Card, claims: () => ["img", "note"] });
    const { handle } = renderForm({ schema: CARD, registry, defaultValue: { card: { note: "too long", meta: {} } } });
    act(() => void handle().validate());
    expect(errorsAt("/card")?.textContent).toMatch(/note/);
    expect(errorsAt("/card")?.textContent).not.toMatch(/图片/);
    expect(errorsAt("/card/img")?.textContent).toMatch(/图片/);
  });

  it("renderChild 的子节点自身的 x-ui 照常生效", () => {
    const registry = createDefaultRegistry().extend();
    const seen: BaseProps<ReactNode>[] = [];
    registry.register({ name: "card", level: "composite", component: Card, claims: () => "all" });
    registry.register({
      name: "fancy",
      level: "field",
      component: (props: BaseProps<ReactNode>) => {
        seen.push(props);
        return <span id={props.id}>fancy</span>;
      },
    });
    const schema = structuredClone(CARD) as { properties: { card: { properties: { img: Record<string, unknown> } } } };
    schema.properties.card.properties.img["x-ui"] = { widget: "fancy", props: { size: 3 } };
    renderForm({ schema: schema as JsonSchema, registry, defaultValue: { card: { img: "a" } } });
    expect(byPath("/card/img")?.textContent).toBe("fancy");
    expect(seen.at(-1)?.props).toEqual({ size: 3 });
  });
});

describe("renderContent 与 lazy 节点", () => {
  const NODE: JsonSchema = {
    $ref: "#/$defs/Node",
    $defs: {
      Node: {
        type: "object",
        properties: { name: { type: "string" }, children: { type: "array", items: { $ref: "#/$defs/Node" } } },
      },
    },
  };

  it("递归类型超过 maxDepth 的节点在渲染时 expand(), 展开后可编辑", () => {
    const deep = { name: "0", children: [{ name: "1", children: [{ name: "2", children: [{ name: "3", children: [{ name: "4" }] }] }] }] };
    const { handle } = renderForm({ schema: NODE, registry: compositeRegistry(), defaultValue: deep, maxDepth: 1 });
    const path = ["", "/children/0", "/children/0/children/0", "/children/0/children/0/children/0", "/children/0/children/0/children/0/children/0"];
    for (const p of path.slice(1)) fireEvent.click(screen.getByLabelText(`toggle:${p}`));
    const deepest = byPath(`${path[4]}/name`) as HTMLInputElement;
    expect(deepest.value).toBe("4");
    fireEvent.change(deepest, { target: { value: "四" } });
    expect((handle().getValues() as typeof deep).children[0]!.children[0]!.children[0]!.children[0]!.name).toBe("四");
  });

  it("可空节点用 renderContent 渲染非空分支", () => {
    const schema: JsonSchema = { type: "object", properties: { note: { type: ["string", "null"] } } };
    renderForm({ schema, registry: compositeRegistry(), defaultValue: { note: "hi" } });
    expect((document.getElementById(`${nodeId(FORM_ID, "/note")}+`) as HTMLInputElement).value).toBe("hi");
  });
});
