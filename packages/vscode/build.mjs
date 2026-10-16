// 用 esbuild 打包插件产物: CommonJS 的扩展入口与语言服务入口(只有 vscode 是外部依赖), 浏览器端的预览脚本(含 React 与表单组件)及表单样式, 扩展组件模块共用 React 的垫片, 以及 x-ui 编辑用与 jotl.config.json 的 JSON Schema.
// 用法: node build.mjs [--production] [--watch]; 依赖各 workspace 包已构建的 dist/, 缺少时先在仓库根执行 pnpm build.
import { getLocale, setLocale } from "@jotl/form";
import { createJotlConfigJsonSchema, createXUiJsonSchema } from "@jotl/language-server";
import { build, context } from "esbuild";
import { copyFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = fileURLToPath(new URL(".", import.meta.url));
const outdir = join(packageDir, "dist");
const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** X_UI_SCHEMA_FILE 必须等于 package.json 中 `contributes.jsonValidation` 的 url; 两份配置 schema 必须等于 package.nls*.json 中 `jsonValidation.configSchema` 的值. */
const X_UI_SCHEMA_FILE = "x-ui.schema.json";
const CONFIG_SCHEMA_FILE = "jotl.config.schema.json";
const CONFIG_SCHEMA_ZH_FILE = "jotl.config.schema.zh-cn.json";
/** 必须等于 src/preview-panel.ts 中的 FORM_STYLE_FILE. */
const FORM_STYLE_FILE = "preview-form.css";

/** 说明符 → 垫片文件名; 必须等于 src/preview-modules.ts 的 SHARED_MODULE_SHIMS. */
const SHIMS = {
  react: "preview-shim-react.js",
  "react/jsx-runtime": "preview-shim-react-jsx-runtime.js",
  "react-dom": "preview-shim-react-dom.js",
  "react-dom/client": "preview-shim-react-dom-client.js",
};
/** 必须等于 src/preview-modules.ts 的 SHARED_MODULES_GLOBAL. */
const SHARED_MODULES_GLOBAL = "__jotlPreviewModules";

/** ESM 垫片: 从预览脚本挂在全局的模块表取出同一份模块再导出; 具名导出按构建时安装的版本枚举, 预览脚本打进的是同一版本. */
function shimSource(specifier) {
  const names = Object.keys(createRequire(join(packageDir, "package.json"))(specifier)).filter(
    (name) => name !== "default" && /^[A-Za-z_$][\w$]*$/.test(name),
  );
  return `const m = globalThis[${JSON.stringify(SHARED_MODULES_GLOBAL)}]?.[${JSON.stringify(specifier)}];
if (m === undefined) throw new Error(${JSON.stringify(`Jotl preview: ${specifier} is not shared with extension widget modules`)});
export default m.default ?? m;
export const { ${names.join(", ")} } = m;
`;
}

/** typescript 只在调试时于 try/catch 中 require 它, 缺失即跳过; 换成空模块后行为相同, 产物也不留下外部 require. */
const OPTIONAL_REQUIRES = ["source-map-support"];
const emptyOptionalRequires = {
  name: "empty-optional-requires",
  setup(build) {
    const filter = new RegExp(`^(${OPTIONAL_REQUIRES.join("|")})$`);
    build.onResolve({ filter }, (args) => ({ path: args.path, namespace: "empty-optional-require" }));
    build.onLoad({ filter: /.*/, namespace: "empty-optional-require" }, () => ({ contents: "", loader: "js" }));
  },
};

/** @type {import("esbuild").BuildOptions} */
const nodeOptions = {
  absWorkingDir: packageDir,
  // 输出路径必须等于 package.json 的 main 与 src/index.ts 中的 SERVER_MODULE.
  entryPoints: { extension: "src/index.ts", server: "src/server.ts" },
  outdir: "dist",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  // 对齐 engines.vscode 下限(1.101)扩展宿主的 Node 22.
  target: "node22",
  external: ["vscode"],
  plugins: [emptyOptionalRequires],
  minify: production,
  sourcemap: production ? false : "linked",
  metafile: true,
  logLevel: "warning",
};

/** @type {import("esbuild").BuildOptions} */
const webviewOptions = {
  absWorkingDir: packageDir,
  // 输出名不能与 tsc 从 src/ 生成的 dist/*.js 重名.
  entryPoints: { preview: "src/webview/preview-app.tsx" },
  outdir: "dist",
  tsconfig: "tsconfig.webview.json",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": production ? '"production"' : '"development"' },
  minify: production,
  // webview 的 CSP 是 default-src 'none', 带 sourceMappingURL 时打开 DevTools 会报 CSP 违规; 只生成 .map 不写注释.
  sourcemap: production ? false : "external",
  metafile: true,
  logLevel: "warning",
};

function writeStaticOutputs() {
  copyFileSync(fileURLToPath(import.meta.resolve("@jotl/form/style.css")), join(outdir, FORM_STYLE_FILE));
  writeFileSync(join(outdir, X_UI_SCHEMA_FILE), `${JSON.stringify(createXUiJsonSchema(), null, 2)}\n`);
  writeFileSync(join(outdir, CONFIG_SCHEMA_FILE), `${JSON.stringify(createJotlConfigJsonSchema(), null, 2)}\n`);
  const locale = getLocale();
  setLocale("zh-CN");
  try {
    writeFileSync(join(outdir, CONFIG_SCHEMA_ZH_FILE), `${JSON.stringify(createJotlConfigJsonSchema(), null, 2)}\n`);
  } finally {
    setLocale(locale);
  }
  for (const [specifier, file] of Object.entries(SHIMS)) writeFileSync(join(outdir, file), shimSource(specifier));
}

if (watch) {
  writeStaticOutputs();
  const contexts = await Promise.all([context(nodeOptions), context(webviewOptions)]);
  await Promise.all(contexts.map((c) => c.watch()));
  console.log("watching… → dist/");
} else {
  const [node, webview] = await Promise.all([build(nodeOptions), build(webviewOptions)]);
  writeStaticOutputs();
  const outputs = { ...node.metafile.outputs, ...webview.metafile.outputs };
  for (const [file, output] of Object.entries(outputs)) {
    if (!file.endsWith(".map")) console.log(`${file}  ${(output.bytes / 1024).toFixed(1)} KiB`);
  }
  for (const file of [FORM_STYLE_FILE, X_UI_SCHEMA_FILE, CONFIG_SCHEMA_FILE, CONFIG_SCHEMA_ZH_FILE, ...Object.values(SHIMS)]) {
    console.log(`dist/${file}  ${(statSync(join(outdir, file)).size / 1024).toFixed(1)} KiB`);
  }
}
