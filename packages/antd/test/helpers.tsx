// 测试工具: jsdom 补 antd 需要的 matchMedia 与 ResizeObserver, 取 antd 所用的 dayjs, 渲染接了 antd 注册表的表单.
import { createRequire } from "node:module";
import { createRef } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach } from "vitest";
import { JotlForm, nodeId, type JotlFormHandle, type JotlFormProps } from "@jotl/form";
import { createAntdRegistry, type DayjsFactory } from "../src/index.js";

afterEach(cleanup);

if (typeof window !== "undefined" && window.matchMedia === undefined) {
	window.matchMedia = (query: string) =>
		({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}) as MediaQueryList;
}

if (typeof window !== "undefined" && window.ResizeObserver === undefined) {
	window.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
}

// 本包不直接依赖 dayjs, 测试经 antd 的解析位置取同一个实例(antd 已为它加载 customParseFormat 等插件).
const fromAntd = createRequire(createRequire(import.meta.url).resolve("antd/package.json"));
export const dayjs = fromAntd("dayjs") as DayjsFactory;

export const FORM_ID = "f";

export const registry = createAntdRegistry({ dayjs });

export function renderForm(props: Omit<JotlFormProps, "ref">) {
	const ref = createRef<JotlFormHandle>();
	const view = render(
		<JotlForm id={FORM_ID} drill={false} registry={registry} {...props} ref={ref} />
	);
	return { ...view, handle: () => ref.current! };
}

export function byPath(path: string): HTMLElement {
	const el = document.getElementById(nodeId(FORM_ID, path));
	if (el === null) throw new Error(`找不到 ${path} 的元素`);
	return el;
}
