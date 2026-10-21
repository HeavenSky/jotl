// 快速修复: 把编译器诊断附带的 fixes 转为 LSP code action.
import type { Diagnostic as JotlDiagnostic, DiagnosticFix } from "@jotl/core";
import { type CodeAction, CodeActionKind, type Range, type TextEdit } from "vscode-languageserver";
import { collectJotlDiagnostics, toLspDiagnostic } from "./document-diagnostics.js";
import type { LanguageServiceOptions } from "./options.js";
import { rangesTouch, toLspRange } from "./text-position.js";

function indentLines(text: string): string {
	return text.replace(/^(?=[^\r\n])/gm, "  ");
}

/** 编译器的 "包进 Root" 只插入首尾两段; 这里合成一处替换, 把包进去的条目缩进两格. */
function fixEdits(text: string, diagnostic: JotlDiagnostic, fix: DiagnosticFix): TextEdit[] {
	const [open, close] = fix.edits;
	if (
		diagnostic.code === "JOTL1036" &&
		fix.edits.length === 2 &&
		open !== undefined &&
		close !== undefined
	) {
		const body = text.slice(open.range.start.offset, close.range.end.offset);
		const range = toLspRange({ ...open.range, end: close.range.end });
		return [{ range, newText: open.newText + indentLines(body) + close.newText }];
	}
	return fix.edits.map(edit => ({ range: toLspRange(edit.range), newText: edit.newText }));
}

/** 返回与 range 相交的诊断上的全部修复. */
export function getCodeActions(
	text: string,
	uri: string,
	range: Range,
	options: LanguageServiceOptions = {}
): CodeAction[] {
	const actions: CodeAction[] = [];
	for (const diagnostic of collectJotlDiagnostics(text, uri, options)) {
		const fixes = diagnostic.fixes ?? [];
		if (fixes.length === 0) continue;
		const lspDiagnostic = toLspDiagnostic(diagnostic);
		if (!rangesTouch(lspDiagnostic.range, range)) continue;
		for (const fix of fixes) {
			const edits = fixEdits(text, diagnostic, fix);
			actions.push({
				title: fix.title,
				kind: CodeActionKind.QuickFix,
				diagnostics: [lspDiagnostic],
				isPreferred: fixes.length === 1,
				edit: { changes: { [uri]: edits } },
			});
		}
	}
	return actions;
}
