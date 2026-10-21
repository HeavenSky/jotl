// 源码位置与源码映射表的类型.
import type { JsonPointer } from "./json-pointer.js";

/** line 与 column 从 1 起, offset 从 0 起; column 与 offset 均按 UTF-16 代码单元计(与 LSP 一致). */
export interface SourcePosition {
	line: number;
	column: number;
	offset: number;
}

export interface SourceRange {
	file: string;
	start: SourcePosition;
	end: SourcePosition;
}

/** range 为整个字段或声明, keyRange 为键名. */
export interface SourceSpan {
	range: SourceRange;
	keyRange?: SourceRange;
}

/** 键为 schema 文档内的指针. */
export type SourceMap = ReadonlyMap<JsonPointer, SourceSpan>;
