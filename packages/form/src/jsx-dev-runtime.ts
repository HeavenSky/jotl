// 开发模式 JSX 运行时(jsxDEV): 与 jsx-runtime 相同, 忽略源码位置参数.
import type { ElementType, Key, ReactElement } from "react";
import { jsx, jsxs } from "./jsx-runtime.js";

export { Fragment } from "./jsx-runtime.js";
export type { JSX } from "react";

export function jsxDEV(
	type: ElementType,
	props: Record<string, unknown>,
	key: Key | undefined,
	isStatic: boolean
): ReactElement {
	return isStatic ? jsxs(type, props, key) : jsx(type, props, key);
}
