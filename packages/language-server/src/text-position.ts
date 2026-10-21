// LSP 位置(行列从 0 起)与源码偏移, Jotl 源码范围(行列从 1 起)之间的换算.
import type { SourceRange } from "@jotl/core";
import type { Position, Range } from "vscode-languageserver";

/** 各行起始偏移; `\r\n` `\r` `\n` 都算换行, 与编译器和 LSP 一致. */
function lineStarts(text: string): number[] {
	const starts = [0];
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i);
		if (c === 0x0d) {
			if (text.charCodeAt(i + 1) === 0x0a) i++;
			starts.push(i + 1);
		} else if (c === 0x0a) {
			starts.push(i + 1);
		}
	}
	return starts;
}

/** 超出范围的行取文件首尾, 超出行长的列取该行换行符之前. */
export function offsetAt(text: string, position: Position): number {
	const starts = lineStarts(text);
	if (position.line < 0) return 0;
	if (position.line >= starts.length) return text.length;
	const start = starts[position.line]!;
	let end = position.line + 1 < starts.length ? starts[position.line + 1]! : text.length;
	while (end > start && (text[end - 1] === "\n" || text[end - 1] === "\r")) end--;
	return Math.min(start + Math.max(0, position.character), end);
}

export function positionAt(text: string, offset: number): Position {
	const starts = lineStarts(text);
	const clamped = Math.max(0, Math.min(offset, text.length));
	let lo = 0;
	let hi = starts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (starts[mid]! <= clamped) lo = mid;
		else hi = mid - 1;
	}
	return { line: lo, character: clamped - starts[lo]! };
}

export function toLspRange(range: SourceRange): Range {
	return {
		start: { line: range.start.line - 1, character: range.start.column - 1 },
		end: { line: range.end.line - 1, character: range.end.column - 1 },
	};
}

function comparePositions(a: Position, b: Position): number {
	return a.line - b.line || a.character - b.character;
}

/** 两个范围相交或相接时为 true; 空范围(光标)落在另一范围内或边界上也算. */
export function rangesTouch(a: Range, b: Range): boolean {
	return comparePositions(a.start, b.end) <= 0 && comparePositions(b.start, a.end) <= 0;
}
