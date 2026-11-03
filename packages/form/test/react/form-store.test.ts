// FormStore 的分支缓存: 外部换数据后旧分支缓存失效, 受控回显(引用相同或深度相等)时保留.
import { describe, expect, it, vi } from "vitest";
import { FormStore } from "../../src/react/form-store.js";

function createStore(initial: unknown): FormStore {
	return new FormStore({
		initial,
		validate: () => ({ valid: true, errors: [] }),
		validateOn: "change",
	});
}

describe("分支缓存与外部换值", () => {
	it("外部 replace 换记录后, 切回旧分支不再恢复上一条记录的值", () => {
		const store = createStore({ kind: "a", secret: "old-record" });
		store.switchBranch("", 0, 1, () => ({ kind: "b" }));
		// 外部载入新记录: 值实际变化, 旧分支缓存应失效.
		store.replace({ kind: "b", label: "new-record" });
		store.switchBranch("", 1, 0, () => ({ kind: "a", fresh: true }));
		expect(store.getAt("")).toEqual({ kind: "a", fresh: true });
	});

	it("受控回显(引用相同或深度相等)不失效分支缓存", () => {
		const store = createStore({ kind: "a", secret: "draft" });
		store.switchBranch("", 0, 1, () => ({ kind: "b" }));
		// 引用相同的回显直接跳过.
		const current = store.value;
		store.replace(current);
		// 深度相等的克隆回显(父组件复制后传回)也不失效.
		store.replace(JSON.parse(JSON.stringify(current)) as unknown);
		store.switchBranch("", 1, 0, () => ({ kind: "a" }));
		expect(store.getAt("")).toEqual({ kind: "a", secret: "draft" });
	});

	it("可空缓存同样随外部换值失效", () => {
		const store = createStore(null);
		store.setNull("", false, () => ({ v: "first" }));
		store.setNull("", true, () => ({ v: "first" }));
		store.replace({ v: "second" });
		store.setNull("", false, () => ({ v: "fresh" }));
		expect(store.getAt("")).toEqual({ v: "fresh" });
	});

	it("setValues 走同一换值口径并通知 onChange", () => {
		const store = createStore({ kind: "a" });
		store.switchBranch("", 0, 1, () => ({ kind: "b" }));
		const onChange = vi.fn();
		store.onChange = onChange;
		store.setValues({ kind: "b", next: 1 });
		expect(onChange).toHaveBeenCalledWith({ kind: "b", next: 1 });
		store.switchBranch("", 1, 0, () => ({ kind: "a", fresh: true }));
		expect(store.getAt("")).toEqual({ kind: "a", fresh: true });
	});
});
