import { describe, expect, it } from "vitest";
import type { JsonSchemaObject } from "@jotl/core";
import { readFixture } from "../../../../test-utils/fixtures.js";
import { plan, resolveXUi } from "../../src/core/index.js";
import { builtinRegistry, dataRoot, findNode, planOk, widget } from "./helpers.js";

const registry = builtinRegistry([
  widget("banner-card", "composite"),
  widget("banner-mini", "composite"),
  widget("avatar"),
  widget("uri-input"),
  widget("r1"),
  widget("r2"),
  widget("v-ref"),
  widget("v-node"),
  widget("w-ref"),
  widget("w-node"),
  widget("w-rule"),
]);

describe("引用处覆盖(fixture 014)", () => {
  const schema = readFixture("014-x-ui-ref-override").schema as JsonSchemaObject;
  const root = planOk(schema, registry);

  it("被引用类型的 x-ui 生效, 引用处的 x-ui 优先", () => {
    expect(findNode(root, "/hero")).toMatchObject({ widget: "banner-card", source: "ref", fallbackChain: ["page", "json"] });
    expect(findNode(root, "/mini")).toMatchObject({ widget: "banner-mini", source: "node", fallbackChain: ["banner-card", "page", "json"] });
  });

  it("被引用类型内部节点的 widget 与 props", () => {
    const local: JsonSchemaObject = {
      type: "object",
      properties: { mini: { $ref: "#/$defs/Banner" } },
      $defs: { Banner: { type: "object", properties: { img: { type: "string", format: "uri", "x-ui": { widget: "image", props: { maxWidth: 750 } } } } } },
    };
    expect(findNode(planOk(local, registry), "/mini/img")).toMatchObject({
      widget: "image",
      source: "node",
      schemaPointer: "/$defs/Banner/properties/img",
      props: { maxWidth: 750 },
      fallbackChain: ["url", "json"],
    });
  });
});

describe("合并顺序", () => {
  const schema: JsonSchemaObject = {
    "x-ui": {
      rules: [
        { match: { type: "string" }, ui: { widget: "r1", props: { a: "rule1", b: "rule1" }, decorator: "rule1" } },
        { match: { pointer: "/properties/*" }, ui: { widget: "r2", props: { b: "rule2" }, hidden: true } },
      ],
    },
    type: "object",
    properties: {
      all: {
        $ref: "#/$defs/Pic",
        "x-ui": {
          widget: "w-node",
          props: { d: "node" },
          decorator: "node",
          variants: { view: { widget: "v-node", props: { e: "v-node" }, decorator: "v-node" } },
        },
      },
      plain: { type: "string" },
      photo: { type: "string", format: "uri", "x-ui": { widget: "image" } },
      avatar: { type: "string", format: "uri", "x-ui": { widget: "avatar" } },
    },
    $defs: {
      Pic: {
        type: "string",
        format: "uri",
        "x-ui": {
          widget: "w-ref",
          props: { c: "ref", d: "ref" },
          decorator: "ref",
          variants: { view: { widget: "v-ref", props: { e: "v-ref", f: "v-ref" }, decorator: "v-ref" } },
        },
      },
    },
  };

  it("rules → 被引用类型 → 节点 → 变体, props 浅合并一层", () => {
    const view = findNode(planOk(schema, registry, { scene: "view" }), "/all");
    expect(view).toMatchObject({
      widget: "v-node",
      source: "node",
      fallbackChain: ["v-ref", "w-node", "w-ref", "r2", "r1", "url", "json"],
      props: { a: "rule1", b: "rule2", c: "ref", d: "node", e: "v-node", f: "v-ref" },
      decorator: "v-node",
      hidden: true,
    });
    const edit = findNode(planOk(schema, registry), "/all");
    expect(edit).toMatchObject({
      widget: "w-node",
      fallbackChain: ["w-ref", "r2", "r1", "url", "json"],
      props: { a: "rule1", b: "rule2", c: "ref", d: "node" },
      decorator: "node",
    });
  });

  it("规则表多条命中按数组顺序合并, 后者优先", () => {
    expect(findNode(planOk(schema, registry), "/plain")).toMatchObject({
      widget: "r2",
      source: "rule",
      fallbackChain: ["r1", "input", "json"],
      props: { a: "rule1", b: "rule2" },
      decorator: "rule1",
      hidden: true,
    });
  });

  it("节点 x-ui 的 widget 覆盖规则", () => {
    const root = planOk(schema, registry);
    expect(findNode(root, "/photo")).toMatchObject({ widget: "image", source: "node", fallbackChain: ["r2", "r1", "url", "json"] });
    expect(findNode(root, "/avatar")).toMatchObject({ widget: "avatar", source: "node", fallbackChain: ["r2", "r1", "url", "json"] });
    const noRules = planOk({ ...schema, "x-ui": {} }, registry);
    expect(findNode(noRules, "/photo")).toMatchObject({ widget: "image", source: "node", fallbackChain: ["url", "json"] });
    expect(findNode(noRules, "/avatar")).toMatchObject({ widget: "avatar", source: "node", fallbackChain: ["url", "json"] });
  });

  it("规则的 format enum widget 条件", () => {
    const ruled: JsonSchemaObject = {
      "x-ui": {
        rules: [
          { match: { format: "uri" }, ui: { props: { kind: "uri" } } },
          { match: { enum: true }, ui: { props: { kind: "enum" } } },
          { match: { widget: "switch" }, ui: { widget: "w-rule" } },
          { match: { type: "string", enum: false, widget: "input" }, ui: { props: { plain: true } } },
        ],
      },
      type: "object",
      properties: {
        link: { type: "string", format: "uri" },
        pick: { type: "string", enum: ["a", "b"] },
        flag: { type: "boolean" },
        name: { type: "string" },
      },
    };
    const root = planOk(ruled, registry);
    expect(findNode(root, "/link").props).toEqual({ kind: "uri" });
    expect(findNode(root, "/pick").props).toEqual({ kind: "enum" });
    expect(findNode(root, "/flag")).toMatchObject({ widget: "w-rule", source: "rule", fallbackChain: ["switch", "json"] });
    expect(findNode(root, "/name").props).toEqual({ plain: true });
  });

  it("变体: 场景名默认 default, 未定义的场景不覆盖", () => {
    const varied: JsonSchemaObject = {
      type: "object",
      properties: {
        t: { type: "string", "x-ui": { props: { a: 1 }, variants: { default: { widget: "textarea", props: { b: 2 } }, view: { hidden: true } } } },
      },
    };
    expect(findNode(planOk(varied, registry), "/t")).toMatchObject({ widget: "textarea", source: "node", props: { a: 1, b: 2 }, hidden: false });
    expect(findNode(planOk(varied, registry, { scene: "view" }), "/t")).toMatchObject({ widget: "input", props: { a: 1 }, hidden: true });
    expect(findNode(planOk(varied, registry, { scene: "print" }), "/t")).toMatchObject({ widget: "input", props: { a: 1 }, hidden: false });
  });
});

describe("非法 x-ui(F3)", () => {
  const schema: JsonSchemaObject = {
    type: "object",
    properties: {
      bad: { type: "string", "x-ui": { widget: "avatar", columns: 0 } },
      good: { type: "string", "x-ui": { widget: "avatar" } },
      viaRef: { $ref: "#/$defs/Bad" },
      viaRef2: { $ref: "#/$defs/Bad" },
      img: { type: "string", format: "uri", "x-ui": { semantic: "Image", unknown: 1 } as never },
    },
    $defs: { Bad: { type: "string", "x-ui": { widget: "" } } },
  };
  const result = plan(schema, registry);
  const root = result.value!;

  it("按没有 x-ui 处理并记 F3, 其他节点不受影响", () => {
    expect(findNode(root, "/bad")).toMatchObject({ widget: "input", source: "builtin", degraded: [{ reason: "F3" }] });
    expect(findNode(root, "/good")).toMatchObject({ widget: "avatar", degraded: [] });
    expect(findNode(root, "/viaRef")).toMatchObject({ widget: "input", degraded: [{ reason: "F3" }] });
    expect(findNode(root, "/viaRef2")).toMatchObject({ widget: "input", degraded: [{ reason: "F3" }] });
    expect(findNode(root, "/img")).toMatchObject({ widget: "url", source: "builtin", degraded: [{ reason: "F3" }] });
  });

  it("诊断为警告, 指向 x-ui 位置, 同一 x-ui 只报一次, 消息来自代码表", () => {
    const f3 = result.diagnostics.filter((d) => d.code === "JOTL5003");
    expect(f3.map((d) => [d.severity, d.location])).toEqual([
      ["warning", { kind: "pointer", pointer: "/properties/bad/x-ui" }],
      ["warning", { kind: "pointer", pointer: "/$defs/Bad/x-ui" }],
      ["warning", { kind: "pointer", pointer: "/properties/img/x-ui" }],
    ]);
    expect(f3[0]!.message).toBe("x-ui 不合法(x-ui/columns: 必须是不小于 1 的整数), 该节点已按没有 x-ui 处理(F3)");
  });

  it("根 x-ui 不合法时规则表不生效", () => {
    const rooted = plan({ "x-ui": { rules: [{ match: {}, ui: { widget: "avatar" } }], version: 2 } as never, type: "object", properties: { a: { type: "string" } } }, registry);
    const data = dataRoot(rooted.value!);
    expect(data.degraded).toEqual([{ reason: "F3" }]);
    expect(findNode(rooted.value!, "/a").widget).toBe("input");
  });
});

describe("resolveXUi", () => {
  const schema = readFixture("013-x-ui-basic").schema as JsonSchemaObject;

  it("返回合并后的 x-ui, 候选与选中组件", () => {
    const result = resolveXUi(schema, "/$defs/Ui/properties/title");
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toEqual({
      ui: { props: { size: "large" } },
      candidates: [{ name: "headline", source: "node" }],
      matchedRules: [],
      widget: "headline",
      source: "node",
      fallbackChain: ["input", "json"],
      degraded: [],
    });
    const layout = resolveXUi(schema, "/$defs/Ui");
    expect(layout.value?.ui).toEqual({ props: {}, order: ["bare", "title"], groups: [{ title: "高级", fields: ["secret", "matrix"] }] });
  });

  it("传入注册表时按注册情况降级", () => {
    const result = resolveXUi(schema, "/$defs/Ui/properties/title", { registry: builtinRegistry() });
    expect(result.value).toMatchObject({ widget: "input", source: "builtin", degraded: [{ reason: "F1", from: "headline" }] });
    expect(result.diagnostics.map((d) => d.code)).toEqual(["JOTL5001"]);
  });

  it("指针不合法或不存在时返回错误", () => {
    expect(resolveXUi(schema, "/$defs/Nope").diagnostics.map((d) => [d.code, d.severity])).toEqual([["JOTL5102", "error"]]);
    expect(resolveXUi(schema, "no-slash").value).toBeUndefined();
    expect(resolveXUi(42 as never).diagnostics[0]?.code).toBe("JOTL5101");
  });
});
