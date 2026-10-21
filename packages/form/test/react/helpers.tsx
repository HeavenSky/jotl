// 测试工具: 自动清理 DOM, 渲染表单并取得实例 API, 按数据路径取节点元素.
import { cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach } from "vitest";
import {
	JotlForm,
	nodeId,
	type JotlFormHandle,
	type JotlFormProps,
} from "../../src/react/index.js";

// 未启用 vitest globals, testing-library 不会自动清理, 不注册会让上一个用例的 DOM 残留.
afterEach(cleanup);

export const FORM_ID = "f";

/** 默认 drill: false(各层同页展开), 让字段级用例不受钻取导航影响; 钻取用例显式传 drill. */
export function renderForm(props: Omit<JotlFormProps, "ref">) {
	const ref = createRef<JotlFormHandle>();
	const view = render(<JotlForm id={FORM_ID} drill={false} {...props} ref={ref} />);
	return { ...view, handle: () => ref.current! };
}

/** 数据路径上节点的元素(输入控件或组件根元素). */
export function byPath(path: string): HTMLElement | null {
	return document.getElementById(nodeId(FORM_ID, path));
}

/** 数据路径上节点的错误列表(外壳或数组组件中 id 为 `<节点 id>-errors` 的元素). */
export function errorsAt(path: string): HTMLElement | null {
	return document.getElementById(`${nodeId(FORM_ID, path)}-errors`);
}

export function formErrors(): HTMLElement | null {
	return document.getElementById(`${FORM_ID}-errors`);
}
