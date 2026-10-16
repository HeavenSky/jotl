// 兼容用例的前置: 让 react-dom 别名包内部 require("react") 也指向同一版本的 react(pnpm 把它们的 peer 解析到了工作区的 react 19).
import Module from "node:module";
import { join } from "node:path";

const reactDir = process.env.JOTL_REACT_DIR;
if (reactDir === undefined) throw new Error("兼容用例须经 vitest.compat.config.ts 运行");

type Resolve = (request: string, ...rest: unknown[]) => string;
const loader = Module as unknown as { _resolveFilename: Resolve };
const original = loader._resolveFilename;
loader._resolveFilename = function (request, ...rest) {
  if (request === "react") return original.call(this, join(reactDir, "index.js"), ...rest);
  if (request.startsWith("react/")) return original.call(this, join(reactDir, request.slice("react/".length)), ...rest);
  return original.call(this, request, ...rest);
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
