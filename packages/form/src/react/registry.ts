// 默认注册表: 登记 html/ 的全部原生组件; 实例级覆盖用它的 extend().
import { htmlWidgets } from "../html/index.js";
import { createRegistry } from "../core/index.js";
import type { ReactRegistry } from "./types.js";

/** 每次调用得到新的注册表, 互不影响. */
export function createDefaultRegistry(): ReactRegistry {
	return createRegistry(htmlWidgets);
}

let shared: ReactRegistry | undefined;

/** 未传 registry 的表单共用的默认注册表; 不对外导出, 避免被登记新组件后影响其他表单. */
export function sharedDefaultRegistry(): ReactRegistry {
	shared ??= createDefaultRegistry();
	return shared;
}
