// 打包产物(D33): 运行生产构建, 检查两个 CommonJS 入口能加载且外部依赖只有 vscode, 预览脚本不依赖任何模块, 表单样式, x-ui 编辑用 schema 与配置 schema 与插件清单一致.
import { getLocale, setLocale } from "@jotl/form";
import { createJotlConfigJsonSchema, createXUiJsonSchema } from "@jotl/language-server";
import { build } from "esbuild";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { SHARED_MODULE_SHIMS, SHARED_MODULES_GLOBAL } from "../src/preview-modules.js";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
const EXTENSION = fileURLToPath(new URL("../dist/extension.cjs", import.meta.url));
const SERVER = fileURLToPath(new URL("../dist/server.cjs", import.meta.url));
const PREVIEW = fileURLToPath(new URL("../dist/preview.js", import.meta.url));
const FORM_STYLE = fileURLToPath(new URL("../dist/preview-form.css", import.meta.url));
const X_UI_SCHEMA = fileURLToPath(new URL("../dist/x-ui.schema.json", import.meta.url));
const CONFIG_SCHEMA = fileURLToPath(new URL("../dist/jotl.config.schema.json", import.meta.url));
const CONFIG_SCHEMA_ZH = fileURLToPath(new URL("../dist/jotl.config.schema.zh-cn.json", import.meta.url));
const PACKAGE_JSON = fileURLToPath(new URL("../package.json", import.meta.url));
const TIMEOUT_MS = 60_000;
const PREVIEW_URI = "file:///preview.jotl";

const BUILTINS = new Set(builtinModules);

function requiredModules(file: string): Set<string> {
  const source = readFileSync(file, "utf8");
  return new Set([...source.matchAll(/\brequire\("([^"]+)"\)/g)].map((m) => m[1]!));
}

function isBuiltin(name: string): boolean {
  return BUILTINS.has(name.startsWith("node:") ? name.slice("node:".length) : name);
}

function frame(message: object): string {
  const body = JSON.stringify({ jsonrpc: "2.0", ...message });
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

interface ServerRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** stdin 提前关闭时服务会直接退出, 因此等收到每个响应后再发下一条消息. */
function runServerHandshake(): Promise<ServerRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER, "--stdio"]);
    let stdout = "";
    let stderr = "";
    let step = 0;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`语言服务未在 ${TIMEOUT_MS} ms 内退出; stdout: ${stdout.slice(0, 200)}`));
    }, TIMEOUT_MS);
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
      if (step === 0 && stdout.includes('"id":1')) {
        step = 1;
        child.stdin.write(
          frame({ method: "initialized", params: {} })
          + frame({ method: "textDocument/didOpen", params: { textDocument: { uri: PREVIEW_URI, languageId: "jotl", version: 1, text: "<root/>\nA: {\n  a: string\n}\n" } } })
          + frame({ id: 2, method: "jotl/preview", params: { textDocument: { uri: PREVIEW_URI } } }),
        );
      } else if (step === 1 && stdout.includes('"id":2')) {
        step = 2;
        child.stdin.write(frame({ id: 3, method: "shutdown" }));
      } else if (step === 2 && stdout.includes('"id":3')) {
        step = 3;
        child.stdin.end(frame({ method: "exit" }));
      }
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
    child.stdin.write(frame({ id: 1, method: "initialize", params: { processId: null, rootUri: null, capabilities: {} } }));
  });
}

/** 在子进程中加载扩展入口, 用占位对象代替只在扩展宿主中存在的 vscode 模块. */
const LOAD_EXTENSION = `
const Module = require("node:module");
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === "vscode") return new Proxy({}, { get: () => class {} });
  return load.call(this, request, ...rest);
};
const extension = require(process.argv[1]);
process.stdout.write(JSON.stringify(Object.keys(extension).sort()));
`;

beforeAll(() => {
  execFileSync(process.execPath, ["build.mjs", "--production"], { cwd: PACKAGE_DIR, timeout: TIMEOUT_MS, stdio: "pipe" });
}, TIMEOUT_MS);

describe("插件打包产物", () => {
  it("package.json 的 main 指向扩展入口产物", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as { main: string };
    expect(fileURLToPath(new URL(`../${pkg.main}`, import.meta.url))).toBe(EXTENSION);
  });

  it("扩展入口只把 vscode 留作外部依赖, 其余 require 都是 Node 内置模块", () => {
    const external = [...requiredModules(EXTENSION)].filter((name) => !isBuiltin(name));
    expect(external).toEqual(["vscode"]);
  });

  it("语言服务入口没有外部依赖", () => {
    const external = [...requiredModules(SERVER)].filter((name) => !isBuiltin(name));
    expect(external).toEqual([]);
  });

  it("语言服务入口不含 typescript 编译器", () => {
    expect(statSync(SERVER).size).toBeLessThan(1024 * 1024);
  });

  it("扩展入口可被 require 加载并导出 activate 与 deactivate", () => {
    const result = spawnSync(process.execPath, ["-e", LOAD_EXTENSION, EXTENSION], { encoding: "utf8", timeout: TIMEOUT_MS });
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual(["activate", "deactivate"]);
  });

  it(
    "语言服务入口可被 require 加载, 在 stdio 上完成初始化, 预览与退出; 预览的 TS 输出不依赖 typescript",
    async () => {
      const result = await runServerHandshake();
      expect(result.stderr).not.toMatch(/Cannot find module/);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('"completionProvider"');
      expect(result.stdout).toContain('"jotl-language-server"');
      expect(result.stdout).toContain("export interface A {");
    },
    TIMEOUT_MS,
  );
});

interface Contributes {
  commands: { command: string; title: string; icon?: string }[];
  menus: Record<string, { command: string; when?: string; group?: string }[]>;
  jsonValidation: { fileMatch: string; url: string }[];
}

function contributes(): Contributes {
  return (JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as { contributes: Contributes }).contributes;
}

describe("插件清单", () => {
  it("不受信任的工作区中忽略扩展组件模块加载设置的工作区取值, 说明文字有中英两版", () => {
    const manifest = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
      capabilities: { untrustedWorkspaces: { supported: string; description: string; restrictedConfigurations: string[] } };
    };
    const untrusted = manifest.capabilities.untrustedWorkspaces;
    expect(untrusted.supported).toBe("limited");
    expect(untrusted.restrictedConfigurations).toEqual(["jotl.preview.loadWidgetModules"]);
    const key = untrusted.description.replace(/^%|%$/g, "");
    for (const file of ["package.nls.json", "package.nls.zh-cn.json"]) {
      const nls = JSON.parse(readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), "utf8")) as Record<string, string>;
      expect(nls[key]).toBeTruthy();
    }
  });
});

describe("预览脚本与 x-ui 校验产物", () => {
  it("预览脚本是自执行的浏览器脚本, 没有任何真实的 require 或 import(含 Node 内置模块); React 与表单组件已打进产物", async () => {
    const source = readFileSync(PREVIEW, "utf8");
    // 产物中 Ajv 的独立代码生成器带有 `require("ajv/...")` 字符串字面量, 只有经 esbuild 重新解析才能区分真实调用.
    const result = await build({
      entryPoints: [PREVIEW],
      bundle: true,
      write: false,
      metafile: true,
      platform: "node",
      packages: "external",
      logLevel: "silent",
    });
    const imports = Object.values(result.metafile.inputs).flatMap((input) => input.imports.map((i) => i.path));
    expect(imports).toEqual([]);
    expect(source).not.toMatch(/^\s*(import|export)\b/m);
    expect(source).not.toContain("process.env.NODE_ENV");
    expect(source).toContain("acquireVsCodeApi()");
    expect(source).toContain("react.dev/errors");
  });

  it("React 共享垫片: 每个 import map 说明符都有产物且列入 files, 从预览脚本挂的全局表导出同一份模块", async () => {
    const files = (JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as { files: string[] }).files;
    expect(readFileSync(PREVIEW, "utf8")).toContain(SHARED_MODULES_GLOBAL);
    for (const [specifier, file] of Object.entries(SHARED_MODULE_SHIMS)) {
      expect(files).toContain(`dist/${file}`);
      const path = fileURLToPath(new URL(`../dist/${file}`, import.meta.url));
      const fake = { default: { marker: specifier }, useState: "s", jsx: "j", createPortal: "p", createRoot: "r" };
      (globalThis as Record<string, unknown>)[SHARED_MODULES_GLOBAL] = { [specifier]: fake };
      try {
        const shim = (await import(`${path}?t=${Date.now()}`)) as Record<string, unknown>;
        expect(shim.default).toEqual({ marker: specifier });
        const named = { react: "useState", "react/jsx-runtime": "jsx", "react-dom": "createPortal", "react-dom/client": "createRoot" }[specifier]!;
        expect(shim[named]).toBe(fake[named as keyof typeof fake]);
      } finally {
        delete (globalThis as Record<string, unknown>)[SHARED_MODULES_GLOBAL];
      }
    }
  });

  it("表单样式是 @jotl/form/style.css 的副本", () => {
    const original = fileURLToPath(import.meta.resolve("@jotl/form/style.css"));
    expect(readFileSync(FORM_STYLE, "utf8")).toBe(readFileSync(original, "utf8"));
  });

  it("扩展入口加载的预览脚本路径与命令名与产物, 插件清单一致", () => {
    const extension = readFileSync(EXTENSION, "utf8");
    expect(extension).toContain('"preview.js"');
    expect(extension).toContain('"preview-form.css"');
    expect(extension).toContain('"jotl/preview"');
    const commands = contributes().commands.map((c) => c.command);
    expect(commands).toEqual(["jotl.showPreview"]);
    for (const command of commands) expect(extension).toContain(`"${command}"`);
  });

  it("预览命令出现在 jotl 编辑器的标题栏与命令面板中", () => {
    const { commands, menus } = contributes();
    expect(commands[0]!.icon).toBeDefined();
    expect(menus["editor/title"]).toEqual([{ command: "jotl.showPreview", when: "editorLangId == jotl", group: "navigation" }]);
    expect(menus.commandPalette).toEqual([{ command: "jotl.showPreview", when: "editorLangId == jotl" }]);
  });

  it("jsonValidation 对 *.schema.json 指向打包生成的 x-ui 编辑用 schema, 内容等于 createXUiJsonSchema()", () => {
    const { jsonValidation } = contributes();
    expect(jsonValidation[0]).toEqual({ fileMatch: "*.schema.json", url: "./dist/x-ui.schema.json" });
    const target = fileURLToPath(new URL(`../${jsonValidation[0]!.url}`, import.meta.url));
    expect(target).toBe(X_UI_SCHEMA);
    expect(existsSync(target)).toBe(true);
    expect(JSON.parse(readFileSync(target, "utf8"))).toEqual(createXUiJsonSchema());
  });

  it("jsonValidation 对 jotl.config.json 按界面语言指向打包生成的配置 schema, 英文版等于默认语言的 createJotlConfigJsonSchema(), 中文版等于 zh-CN 下的结果", () => {
    const { jsonValidation } = contributes();
    expect(jsonValidation).toHaveLength(2);
    expect(jsonValidation[1]).toEqual({ fileMatch: "jotl.config.json", url: "%jsonValidation.configSchema%" });
    const urls: Record<string, string> = {};
    for (const file of ["package.nls.json", "package.nls.zh-cn.json"]) {
      const nls = JSON.parse(readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), "utf8")) as Record<string, string>;
      urls[file] = nls["jsonValidation.configSchema"]!;
    }
    expect(urls).toEqual({ "package.nls.json": "./dist/jotl.config.schema.json", "package.nls.zh-cn.json": "./dist/jotl.config.schema.zh-cn.json" });
    const enTarget = fileURLToPath(new URL(`../${urls["package.nls.json"]}`, import.meta.url));
    const zhTarget = fileURLToPath(new URL(`../${urls["package.nls.zh-cn.json"]}`, import.meta.url));
    expect(enTarget).toBe(CONFIG_SCHEMA);
    expect(zhTarget).toBe(CONFIG_SCHEMA_ZH);
    const previous = getLocale();
    try {
      setLocale("en");
      expect(JSON.parse(readFileSync(enTarget, "utf8"))).toEqual(createJotlConfigJsonSchema());
      setLocale("zh-CN");
      expect(JSON.parse(readFileSync(zhTarget, "utf8"))).toEqual(createJotlConfigJsonSchema());
    } finally {
      setLocale(previous);
    }
    expect(readFileSync(zhTarget, "utf8")).toMatch(/[\u4e00-\u9fff]/);
    expect(readFileSync(enTarget, "utf8")).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("扩展入口监听 jotl.config.json 的变更并同步给语言服务", () => {
    expect(readFileSync(EXTENSION, "utf8")).toContain('"**/jotl.config.json"');
  });
});
