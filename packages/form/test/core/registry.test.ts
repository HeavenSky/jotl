import { describe, expect, it } from "vitest";
import { createRegistry } from "../../src/core/index.js";
import { widget } from "./helpers.js";

describe("createRegistry", () => {
  it("register 与 get, 同名后者覆盖", () => {
    const registry = createRegistry([widget("text")]);
    expect(registry.get("text")?.component).toBe("text");
    registry.register({ ...widget("text"), component: "v2" });
    expect(registry.get("text")?.component).toBe("v2");
    expect(registry.get("missing")).toBeUndefined();
    expect(registry.list().map((r) => r.name)).toEqual(["text"]);
  });

  it("extend 的实例级注册表回落父级, 本级覆盖父级, 不影响父级", () => {
    const global = createRegistry([widget("text"), widget("number")]);
    const local = global.extend();
    local.register({ ...widget("text"), component: "local-text" });
    local.register(widget("slider"));
    expect(local.get("text")?.component).toBe("local-text");
    expect(local.get("number")?.component).toBe("number");
    expect(global.get("text")?.component).toBe("text");
    expect(global.get("slider")).toBeUndefined();
    expect(local.list().map((r) => [r.name, r.component])).toEqual([
      ["text", "local-text"],
      ["slider", "slider"],
      ["number", "number"],
    ]);
    // 父级之后的登记对子级可见.
    global.register(widget("color"));
    expect(local.get("color")?.name).toBe("color");
    expect(local.extend().get("slider")?.name).toBe("slider");
  });

  it("createRegistry 可直接指定父级", () => {
    const parent = createRegistry([widget("a")]);
    const child = createRegistry([widget("b")], parent);
    expect(child.list().map((r) => r.name)).toEqual(["b", "a"]);
  });
});
