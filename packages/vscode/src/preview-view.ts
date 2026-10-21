// 预览 webview 的视图模型: 把插件发来的消息转为标题, 状态, 诊断条目, schema, TS 文本与表单用的 schema 对象, 不接触 DOM.
import type { PreviewDiagnostic } from "@jotl/language-server";
import { type PreviewModules, schemaModuleRefs } from "./preview-modules.js";
import type { ToWebview } from "./preview-protocol.js";
import { formatText, type PreviewText } from "./preview-text.js";

export const PREVIEW_TABS = ["schema", "typescript", "form"] as const;
export type PreviewTab = (typeof PREVIEW_TABS)[number];

export function isPreviewTab(value: unknown): value is PreviewTab {
	return (PREVIEW_TABS as readonly unknown[]).includes(value);
}

export interface PreviewDiagnosticView {
	severity: PreviewDiagnostic["severity"];
	text: string;
}

export interface DiagnosticsView {
	summary: string;
	items: PreviewDiagnosticView[];
}

export interface ModulesView extends PreviewModules {
	/** 声明了模块的组件名(配置与 schema 合并, 按名字排序). */
	declared: string[];
}

const NO_MODULES: PreviewModules = { load: false, config: {}, baseUrl: undefined };

export type PreviewView =
	| { kind: "message"; title: string; status: string }
	| {
			kind: "content";
			title: string;
			diagnostics: DiagnosticsView;
			/** 编译失败时为 undefined. */
			schema: string | undefined;
			/** schema 文本解析出的对象, 供表单渲染. */
			formSchema: unknown;
			typescript: string | undefined;
			typescriptDiagnostics: DiagnosticsView;
			modules: ModulesView;
	  };

function diagnosticText(d: PreviewDiagnostic, text: PreviewText): string {
	const position =
		d.line !== undefined && d.column !== undefined
			? ` ${d.line}:${d.column}`
			: d.pointer !== undefined
				? ` ${d.pointer === "" ? "#" : d.pointer}`
				: "";
	return `${text.severity[d.severity]} ${d.code}${position} ${d.message}`;
}

function diagnosticsView(
	diagnostics: readonly PreviewDiagnostic[],
	text: PreviewText
): DiagnosticsView {
	const count = (severity: PreviewDiagnostic["severity"]) =>
		diagnostics.filter(d => d.severity === severity).length;
	return {
		summary:
			diagnostics.length === 0
				? text.noDiagnostics
				: formatText(text.diagnosticCount, count("error"), count("warning"), count("info")),
		items: diagnostics.map(d => ({ severity: d.severity, text: diagnosticText(d, text) })),
	};
}

/** message 为 undefined 表示还没收到插件的消息. */
export function describePreview(message: ToWebview | undefined, text: PreviewText): PreviewView {
	if (message === undefined) return { kind: "message", title: "", status: text.waiting };
	const title = formatText(text.panelTitle, message.fileName);
	if (message.type === "unavailable") return { kind: "message", title, status: message.reason };
	const { schema, diagnostics, typescript, typescriptDiagnostics } = message.content;
	const formSchema: unknown = schema === undefined ? undefined : JSON.parse(schema);
	const modules = message.modules ?? NO_MODULES;
	const declared = [
		...new Set([...Object.keys(modules.config), ...Object.keys(schemaModuleRefs(formSchema))]),
	].sort();
	return {
		kind: "content",
		title,
		diagnostics: diagnosticsView(diagnostics, text),
		schema,
		formSchema,
		typescript,
		typescriptDiagnostics: diagnosticsView(typescriptDiagnostics, text),
		modules: { ...modules, declared },
	};
}

/** 表单语言(由 VS Code 显示语言得出), 与语言服务同用 `@jotl/core` 的 resolveLocale. */
export { resolveLocale as previewLocale } from "@jotl/form";
