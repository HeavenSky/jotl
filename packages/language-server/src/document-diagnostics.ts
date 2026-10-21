// 文档诊断(E2): 编译器诊断加组件注册检查, 转为 LSP 诊断.
import type { Diagnostic as JotlDiagnostic, Severity } from "@jotl/core";
import { compile, parse } from "@jotl/core";
import {
	type Diagnostic,
	DiagnosticSeverity,
	type DiagnosticRelatedInformation,
	type Range,
} from "vscode-languageserver";
import { DIAGNOSTIC_SOURCE } from "./diagnostics.js";
import { compileOptions, type LanguageServiceOptions } from "./options.js";
import { toLspRange } from "./text-position.js";
import { fileWidgetNames } from "./symbol-index.js";
import { checkWidgets } from "./widget-check.js";

const SEVERITIES: Readonly<Record<Severity, DiagnosticSeverity>> = {
	error: DiagnosticSeverity.Error,
	warning: DiagnosticSeverity.Warning,
	info: DiagnosticSeverity.Information,
};

const FILE_START: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

export function collectJotlDiagnostics(
	text: string,
	uri: string,
	options: LanguageServiceOptions = {}
): JotlDiagnostic[] {
	const result = compile(text, uri, compileOptions(options));
	const compiled = result.diagnostics;
	const ast = result.value?.ast ?? parse(text, uri).value;
	const widgets =
		ast === undefined
			? []
			: checkWidgets(
					ast,
					new Set([...(options.registeredWidgets ?? []), ...fileWidgetNames(ast)])
				);
	if (widgets.length === 0) return compiled;
	const offset = (d: JotlDiagnostic) =>
		d.location?.kind === "source" ? d.location.range.start.offset : Number.MAX_SAFE_INTEGER;
	return [...compiled, ...widgets].sort((a, b) => offset(a) - offset(b));
}

export function toLspDiagnostic(diagnostic: JotlDiagnostic): Diagnostic {
	const result: Diagnostic = {
		range:
			diagnostic.location?.kind === "source"
				? toLspRange(diagnostic.location.range)
				: FILE_START,
		severity: SEVERITIES[diagnostic.severity],
		code: diagnostic.code,
		source: DIAGNOSTIC_SOURCE,
		message: diagnostic.message,
	};
	const related: DiagnosticRelatedInformation[] = [];
	for (const item of diagnostic.related ?? []) {
		if (item.location.kind !== "source") continue;
		related.push({
			location: { uri: item.location.range.file, range: toLspRange(item.location.range) },
			message: item.message,
		});
	}
	if (related.length > 0) result.relatedInformation = related;
	return result;
}

export function getDiagnostics(
	text: string,
	uri: string,
	options: LanguageServiceOptions = {}
): Diagnostic[] {
	return collectJotlDiagnostics(text, uri, options).map(toLspDiagnostic);
}
