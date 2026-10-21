// 诊断的文本格式化与输出到 stderr, 以及用法错误的表示.
import {
	type Diagnostic,
	type DiagnosticLocation,
	type JsonPointer,
	type SourceMap,
	type SourceRange,
	formatMessage,
	parentPointer,
} from "@jotl/core";
import type { CliIo } from "./io.js";
import { severityLabel, cliText } from "./messages.js";

/** 诊断所属的文件; sourceMap 存在时, 指向 schema 的指针诊断换算回源码位置. */
export interface DiagnosticOrigin {
	file: string;
	sourceMap?: SourceMap;
}

/** 用法错误: run 捕获后输出诊断与帮助提示, 退出码 2. */
export class UsageError extends Error {
	readonly diagnostic: Diagnostic;
	/** 出错的命令; 未进入命令时为 undefined. */
	readonly command: string | undefined;

	constructor(diagnostic: Diagnostic, command: string | undefined) {
		super(diagnostic.message);
		this.name = "UsageError";
		this.diagnostic = diagnostic;
		this.command = command;
	}
}

function rangeText(range: SourceRange, fallbackFile: string): string {
	return `${range.file === "" ? fallbackFile : range.file}:${range.start.line}:${range.start.column}`;
}

function mappedRange(pointer: JsonPointer, sourceMap: SourceMap): SourceRange | undefined {
	let current: JsonPointer | undefined = pointer;
	while (current !== undefined) {
		const span = sourceMap.get(current);
		if (span) return span.keyRange ?? span.range;
		current = parentPointer(current);
	}
	return undefined;
}

function locationText(location: DiagnosticLocation | undefined, origin: DiagnosticOrigin): string {
	if (location === undefined) return origin.file;
	if (location.kind === "source") return rangeText(location.range, origin.file);
	if (location.document === undefined && origin.sourceMap) {
		const range = mappedRange(location.pointer, origin.sourceMap);
		if (range) return rangeText(range, origin.file);
	}
	return `${location.document ?? origin.file}#${location.pointer}`;
}

/** 多行消息的后续行缩进两格, 保证每行开头的 `位置 代码` 只属于一条诊断. */
function indentLines(message: string): string {
	return message.replace(/\r?\n/g, "\n  ");
}

/** 一条诊断格式化为 `位置 代码 级别: 消息`, related 各占一行并缩进两格. */
export function formatDiagnostic(diagnostic: Diagnostic, origin: DiagnosticOrigin): string {
	const head = `${locationText(diagnostic.location, origin)} ${diagnostic.code} ${severityLabel(diagnostic.severity)}: ${indentLines(diagnostic.message)}`;
	const related = (diagnostic.related ?? []).map(
		r => `\n  ${locationText(r.location, origin)} ${indentLines(r.message)}`
	);
	return head + related.join("");
}

export interface Reporter {
	report(diagnostics: readonly Diagnostic[], origin: DiagnosticOrigin): void;
	readonly errorCount: number;
}

export function createReporter(io: CliIo): Reporter {
	let errorCount = 0;
	return {
		report(diagnostics, origin) {
			for (const d of diagnostics) {
				if (d.severity === "error") errorCount += 1;
				io.stderr(formatDiagnostic(d, origin) + "\n");
			}
		},
		get errorCount() {
			return errorCount;
		},
	};
}

/** 取 fs 错误的 code 转成当前语言的原因; 不暴露底层错误消息中的绝对路径. */
export function fsReason(error: unknown): string {
	const code =
		typeof error === "object" && error !== null && "code" in error
			? String(error.code)
			: "UNKNOWN";
	const t = cliText();
	return t.fsReasons[code] ?? formatMessage(t.fsUnknownReason, { code });
}
