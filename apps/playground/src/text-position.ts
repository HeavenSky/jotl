// 文本偏移与行列互换, 口径与 @jotl/core 的 SourcePosition 相同.
import type { LineColumn } from "./compile.js";

export function lineCount(text: string): number {
	let count = 1;
	for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) count += 1;
	return count;
}

export function positionAt(text: string, offset: number): LineColumn {
	const clamped = Math.max(0, Math.min(offset, text.length));
	const before = text.slice(0, clamped);
	const lineStart = before.lastIndexOf("\n") + 1;
	return { line: lineCount(before), column: clamped - lineStart + 1 };
}

/** 超出文本的行或列被收拢到最近的合法位置, 源码在诊断产生后被改短时仍能定位. */
export function offsetAt(text: string, position: LineColumn): number {
	let lineStart = 0;
	for (let line = 1; line < position.line; line += 1) {
		const next = text.indexOf("\n", lineStart);
		if (next === -1) return text.length;
		lineStart = next + 1;
	}
	const lineEnd = text.indexOf("\n", lineStart);
	const end = lineEnd === -1 ? text.length : lineEnd;
	return Math.min(lineStart + Math.max(0, position.column - 1), end);
}
