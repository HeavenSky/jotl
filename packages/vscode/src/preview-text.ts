// 预览面板与预览命令中面向使用者的文字: 由扩展侧经 vscode.l10n 本地化后整份传给 webview, webview 不接触 vscode API.

/** 只需要 `vscode.l10n` 的 `t(message)`; 测试里可换成查表实现. */
export interface Translator {
	t(message: string): string;
}

export interface PreviewText {
	/** `{0}` 为文件名. */
	panelTitle: string;
	waiting: string;
	diagnostics: string;
	noDiagnostics: string;
	/** `{0}` `{1}` `{2}` 依次为错误, 警告, 提示的条数. */
	diagnosticCount: string;
	tabs: { schema: string; typescript: string; form: string };
	tabList: string;
	compileFailed: string;
	typescriptFailed: string;
	typescriptDiagnostics: string;
	formNote: string;
	copy: string;
	copied: string;
	copyFailed: string;
	/** `{0}` 为异常信息. */
	formCrashed: string;
	documentClosed: string;
	notOpened: string;
	serverUnavailable: string;
	notJotl: string;
	/** `{0}` 为未加载模块的组件名列表. */
	modulesNotLoaded: string;
	/** `{0}` 为加载模块的组件名列表. */
	modulesLoaded: string;
	severity: { error: string; warning: string; info: string };
}

// 每个 l10n.t 的参数必须是字面量: 它就是查中文 bundle 的 key, 拼出来的字符串查不到译文.
export function createPreviewText(l10n: Translator): PreviewText {
	return {
		panelTitle: l10n.t("Preview {0}"),
		waiting: l10n.t("Generating preview…"),
		diagnostics: l10n.t("Diagnostics"),
		noDiagnostics: l10n.t("No diagnostics"),
		diagnosticCount: l10n.t("{0} errors, {1} warnings, {2} infos"),
		tabs: { schema: "JSON Schema", typescript: "TS", form: l10n.t("Form") },
		tabList: l10n.t("Preview content"),
		compileFailed: l10n.t("There are errors; the compiled output appears once they are fixed."),
		typescriptFailed: l10n.t("TS conversion failed; see the diagnostics above."),
		typescriptDiagnostics: l10n.t("TS conversion"),
		formNote: l10n.t("The form is for preview only; changes are not written back to the file."),
		copy: l10n.t("Copy"),
		copied: l10n.t("Copied"),
		copyFailed: l10n.t("Copy failed"),
		formCrashed: l10n.t("Form failed to render: {0}"),
		documentClosed: l10n.t("The document was closed."),
		notOpened: l10n.t(
			"The language server has not received this document yet; edit it to regenerate the preview."
		),
		serverUnavailable: l10n.t(
			"The language server is unavailable; see the Jotl channel in the Output panel for details."
		),
		notJotl: l10n.t(
			"The active editor is not a Jotl file; open a .jotl file before running the preview."
		),
		modulesNotLoaded: l10n.t(
			"Extension widget modules are not loaded in the preview: {0}. These widgets use the fallback display; turn on the setting jotl.preview.loadWidgetModules to load them."
		),
		modulesLoaded: l10n.t("Extension widget modules loaded in the preview: {0}."),
		severity: { error: l10n.t("Error"), warning: l10n.t("Warning"), info: l10n.t("Info") },
	};
}

/** 按位置替换 `{0}` `{1}` …; 与 vscode.l10n.t 的占位语法一致. */
export function formatText(template: string, ...args: (string | number)[]): string {
	return template.replace(/\{(\d+)\}/g, (match, index: string) => {
		const value = args[Number(index)];
		return value === undefined ? match : String(value);
	});
}
