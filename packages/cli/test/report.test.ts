// 诊断格式化的单元测试.
import type { Diagnostic, SourceMap, SourceSpan } from "@jotl/core";
import { describe, expect, it } from "vitest";
import { formatDiagnostic } from "../src/index.js";

const span = (line: number, column: number): SourceSpan => {
	const position = { line, column, offset: 0 };
	return { range: { file: "a.jotl", start: position, end: position } };
};

describe("formatDiagnostic", () => {
	const base: Diagnostic = { code: "JOTL2001", severity: "warning", message: "第一行\n第二行" };

	it("源码位置: 文件:行:列 代码 级别: 消息, 多行消息的后续行缩进", () => {
		const d: Diagnostic = { ...base, location: { kind: "source", range: span(3, 7).range } };
		expect(formatDiagnostic(d, { file: "b.jotl" })).toBe(
			"a.jotl:3:7 JOTL2001 警告: 第一行\n  第二行"
		);
	});

	it("指针位置: 有源码映射时换算到最近的已映射祖先, 优先键名位置", () => {
		const keySpan: SourceSpan = { ...span(2, 3), keyRange: span(2, 1).range };
		const sourceMap: SourceMap = new Map([
			["/$defs/A", span(1, 1)],
			["/$defs/A/properties/x", keySpan],
		]);
		const d: Diagnostic = {
			...base,
			message: "m",
			location: { kind: "pointer", pointer: "/$defs/A/properties/x/items" },
		};
		expect(formatDiagnostic(d, { file: "a.jotl", sourceMap })).toBe(
			"a.jotl:2:1 JOTL2001 警告: m"
		);
	});

	it("指针位置: 无源码映射或映射不到时为 文件#指针, document 优先", () => {
		const d: Diagnostic = {
			...base,
			severity: "error",
			message: "m",
			location: { kind: "pointer", pointer: "/a~1b" },
		};
		expect(formatDiagnostic(d, { file: "s.json" })).toBe("s.json#/a~1b JOTL2001 错误: m");
		expect(formatDiagnostic(d, { file: "s.json", sourceMap: new Map() })).toBe(
			"s.json#/a~1b JOTL2001 错误: m"
		);
		const withDocument: Diagnostic = {
			...d,
			location: { kind: "pointer", pointer: "", document: "other.json" },
		};
		expect(formatDiagnostic(withDocument, { file: "s.json" })).toBe(
			"other.json# JOTL2001 错误: m"
		);
	});

	it("无位置时只写文件; related 各占一行", () => {
		const d: Diagnostic = {
			...base,
			severity: "info",
			message: "m",
			related: [{ message: "r", location: { kind: "pointer", pointer: "/x" } }],
		};
		expect(formatDiagnostic(d, { file: "s.json" })).toBe(
			"s.json JOTL2001 提示: m\n  s.json#/x r"
		);
	});
});
