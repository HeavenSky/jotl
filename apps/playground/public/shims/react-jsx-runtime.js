// 远程扩展组件模块的 `react/jsx-runtime`: index.html 的 import map 指到这里, 取宿主页面挂在 globalThis.__JOTL_JSX__ 上的同一份 JSX 运行时.
const runtime = globalThis.__JOTL_JSX__;
if (runtime === undefined)
	throw new Error(
		"Jotl Playground: host JSX runtime is not installed on globalThis.__JOTL_JSX__"
	);

export const { Fragment, jsx, jsxs } = runtime;
