// schema/ 的诊断代码表(JOTL0xxx).
import { defineDiagnostics } from "./diagnostic.js";

export const SCHEMA_DIAGNOSTICS = {
	JOTL0001: {
		severity: "error",
		message: "JSON Pointer 不合法: {pointer}",
		en: "Invalid JSON Pointer: {pointer}",
	},
	JOTL0002: {
		severity: "error",
		message: "JSON Pointer 指向的位置不存在: {pointer}",
		en: "JSON Pointer target does not exist: {pointer}",
	},
} as const;

export const schemaDiagnostic = defineDiagnostics(SCHEMA_DIAGNOSTICS);
