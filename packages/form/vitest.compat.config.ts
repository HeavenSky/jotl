// React 版本兼容用例: JOTL_REACT=16|17|18|19 把 react 与 react-dom 换成 devDependencies 中对应别名的版本, 只跑 test/compat.
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const version = process.env.JOTL_REACT ?? "19";
if (!["16", "17", "18", "19"].includes(version))
	throw new Error(`JOTL_REACT 只能是 16 17 18 19, 收到 ${version}`);
const suffix = version === "19" ? "" : `-${version}`;
const reactDir = dirname(require.resolve(`react${suffix}/package.json`));
const reactDomDir = dirname(require.resolve(`react-dom${suffix}/package.json`));
const runtime = resolve(here, "src/jsx-runtime.ts");
const devRuntime = resolve(here, "src/jsx-dev-runtime.ts");

export default defineConfig({
	resolve: {
		alias: [
			// 16.8 没有 react/jsx-runtime; 各版本都改用本包的运行时, 同时验证它.
			{ find: /^(react|@jotl\/form)\/jsx-runtime$/, replacement: runtime },
			{ find: /^(react|@jotl\/form)\/jsx-dev-runtime$/, replacement: devRuntime },
			{ find: /^react$/, replacement: resolve(reactDir, "index.js") },
			{ find: /^react-dom$/, replacement: resolve(reactDomDir, "index.js") },
			// react-dom/client 在 18 才有; 16 17 换成空模块, 用例按版本改用 ReactDOM.render.
			{
				find: /^react-dom\/client$/,
				replacement:
					Number(version) >= 18
						? resolve(reactDomDir, "client.js")
						: resolve(here, "test/compat/no-client.ts"),
			},
			{ find: /^react-dom\/(.*)$/, replacement: `${reactDomDir}/$1.js` },
		],
	},
	test: {
		include: ["test/compat/**/*.compat.tsx"],
		environment: "jsdom",
		setupFiles: ["test/compat/setup.ts"],
		env: { JOTL_REACT: version, JOTL_REACT_DIR: reactDir },
	},
});
