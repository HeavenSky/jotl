// 渲染器(react/)面向使用者的全部文案: 诊断代码表(JOTL6xxx 中的渲染器段)与界面文字, 均为中英双语.
import {
	defineDiagnostics,
	formatMessage,
	type Diagnostic,
	type DiagnosticExtras,
	type Locale,
} from "@jotl/core";

export const REACT_DIAGNOSTICS = {
	JOTL6001: {
		severity: "error",
		message: "{label} 的数据与定义的类型不符, 已保留原值并改用 JSON 编辑(F8)",
		en: "The data of {label} does not match its declared type; kept the original value and switched to JSON editing (F8)",
	},
	JOTL6002: {
		severity: "error",
		message: "无法生成渲染计划, 已改用 JSON 编辑整个表单",
		en: "Could not build the render plan; editing the whole form as JSON",
	},
	JOTL6003: {
		severity: "warning",
		message: "无法展开递归节点 {pointer}, 已改用 JSON 编辑",
		en: "Could not expand recursive node {pointer}; switched to JSON editing",
	},
} as const;

export type ReactDiagnosticCode = keyof typeof REACT_DIAGNOSTICS;

/** 语言取全局 getLocale(). */
export const reactDiagnostic = defineDiagnostics(REACT_DIAGNOSTICS);

/** 按指定语言生成渲染器诊断(表单的 locale 可以不同于全局语言). */
export function localizedDiagnostic(
	locale: Locale,
	code: ReactDiagnosticCode,
	params?: Readonly<Record<string, string | number>>,
	extras?: DiagnosticExtras
): Diagnostic {
	const def = REACT_DIAGNOSTICS[code];
	return {
		...reactDiagnostic(code, params, extras),
		message: formatMessage(locale === "en" ? def.en : def.message, params),
	};
}

const ZH = {
	rootLabel: "数据",
	branchTitle: (index: number) => `选项 ${index + 1}`,
	typeTitles: {
		string: "文本",
		number: "数字",
		integer: "整数",
		boolean: "是/否",
		array: "列表",
		object: "对象",
		null: "空",
	} as Readonly<Record<string, string>>,
	loading: "加载中…",
	loadFailed: "组件加载失败",
	retry: "重试",
	jsonInvalid: "JSON 格式不正确, 修正前不会保存",
	enter: "进入",
	enterMark: "›",
	errorCount: (n: number) => `${n} 个错误`,
	item: (index: number) => `第 ${index + 1} 项`,
	empty: "未填写",
	itemCount: (n: number) => `${n} 项`,
	filledCount: (n: number) => `已填 ${n} 项`,
	breadcrumb: "当前位置",
	debug: {
		caption: "Jotl 渲染计划",
		dataPath: "数据路径",
		schemaPointer: "schema 指针",
		widget: "组件",
		level: "层级",
		source: "来源",
		degraded: "降级记录",
		lazy: "按需展开",
		none: "-",
	},
};

export type Copy = typeof ZH;

const EN: Copy = {
	rootLabel: "Data",
	branchTitle: index => `Option ${index + 1}`,
	typeTitles: {
		string: "Text",
		number: "Number",
		integer: "Integer",
		boolean: "Yes/No",
		array: "List",
		object: "Object",
		null: "Empty",
	},
	loading: "Loading…",
	loadFailed: "Failed to load the widget",
	retry: "Retry",
	jsonInvalid: "Invalid JSON; it will not be saved until fixed",
	enter: "Open",
	enterMark: "›",
	errorCount: n => (n === 1 ? "1 error" : `${n} errors`),
	item: index => `Item ${index + 1}`,
	empty: "Empty",
	itemCount: n => (n === 1 ? "1 item" : `${n} items`),
	filledCount: n => `${n} filled`,
	breadcrumb: "Current location",
	debug: {
		caption: "Jotl render plan",
		dataPath: "Data path",
		schemaPointer: "Schema pointer",
		widget: "Widget",
		level: "Level",
		source: "Source",
		degraded: "Degradations",
		lazy: "expanded on demand",
		none: "-",
	},
};

export function copyOf(locale: Locale): Copy {
	return locale === "en" ? EN : ZH;
}
