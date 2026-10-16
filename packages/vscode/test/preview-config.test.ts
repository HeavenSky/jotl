// 预览中扩展组件模块的本地路径: 相对路径按给定目录解析, / 与 file: 取绝对路径.
import { join, posix, resolve, win32 } from "node:path";
import { describe, expect, it } from "vitest";
import { localModulePath, schemaModuleImports } from "../src/preview-config.js";
import { isDrivePath } from "../src/preview-modules.js";

const ROOT = resolve("/w");

describe("预览的模块本地路径", () => {
  it("本地路径: ./ ../ 按目录解析, / 与 file: 取绝对路径, https 等不是本地文件", () => {
    const dir = join(ROOT, "app");
    expect(localModulePath("./w/a.js", dir)).toBe(join(dir, "w", "a.js"));
    expect(localModulePath("../lib/b.js", dir)).toBe(join(ROOT, "lib", "b.js"));
    expect(localModulePath("https://esm.sh/x", dir)).toBeUndefined();
    expect(localModulePath("x", dir)).toBeUndefined();
  });

  it("Windows 路径实现下盘符路径与盘符 file: 地址是本地文件; posix 下盘符路径不是", () => {
    const dir = "C:\\w\\app";
    expect(localModulePath("C:\\a\\b.js", dir, win32)).toBe("C:\\a\\b.js");
    expect(localModulePath("C:/a/b.js", dir, win32)).toBe("C:\\a\\b.js");
    expect(localModulePath("file:///C:/a/b.js", dir, win32)).toBe("C:\\a\\b.js");
    expect(localModulePath("./w/a.js", dir, win32)).toBe("C:\\w\\app\\w\\a.js");
    expect(localModulePath("https://esm.sh/x", dir, win32)).toBeUndefined();
    expect(isDrivePath("C:\\a\\b.js")).toBe(true);
    expect(isDrivePath("c:/a/b.js")).toBe(true);
    expect(isDrivePath("C:a.js")).toBe(false);
    expect(isDrivePath("https://x")).toBe(false);
  });

  it("schema 中 file: 与盘符地址映射到 webview 地址并收集目录, 相对地址只收集目录", () => {
    const toUrl = (file: string) => `https://webview/${win32.resolve(file).replace(/\\/g, "/")}`;
    const schema = {
      "x-ui": {
        widgets: {
          A: { module: "C:\\a\\b.js" },
          B: { module: "C:/a/c.js" },
          C: { module: "file:///C:/lib/d.js", export: "D" },
          D: { module: "./rel/e.js" },
          E: { module: "https://esm.sh/x" },
          F: "string",
        },
      },
    };
    const found = schemaModuleImports(schema, "C:\\w", toUrl, win32);
    expect(found.imports).toEqual({
      "C:\\a\\b.js": "https://webview/C:/a/b.js",
      "C:/a/c.js": "https://webview/C:/a/c.js",
      "file:///C:/lib/d.js": "https://webview/C:/lib/d.js",
    });
    expect(found.dirs.sort()).toEqual(["C:\\a", "C:\\lib", "C:\\w\\rel"]);
  });

  it("posix: schema 中 file: 地址映射, / 地址由 webview 按基准解析只收集目录", () => {
    const toUrl = (file: string) => `https://webview${file}`;
    const schema = { "x-ui": { widgets: { A: { module: "file:///lib/a.js" }, B: { module: "/abs/b.js" }, C: { module: "C:/a/c.js" } } } };
    const found = schemaModuleImports(schema, "/w", toUrl, posix);
    expect(found.imports).toEqual({ "file:///lib/a.js": "https://webview/lib/a.js" });
    expect(found.dirs.sort()).toEqual(["/abs", "/lib"]);
  });
});
