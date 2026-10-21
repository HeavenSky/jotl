// 凤蝶 schema 迁移到 Jotl: 源码按 umo-edit-sdk 文法解析为 umo JSON(或直接读入 umo JSON), 转为 JSON Schema 2020-12, 再打印为 Jotl.
import { type Diagnostic, type JsonSchemaObject, type Result, orderKeywords } from "@jotl/core";
import { print } from "@jotl/core";
import { migrateDiagnostic } from "./diagnostics.js";
import { parseFengdie } from "./parser.js";
import { umoJsonToSchema } from "./to-schema.js";
import { UmoBuilder, type UmoOrigins } from "./umo-json.js";
import type { UmoJson } from "./umo-types.js";

export { MIGRATE_DIAGNOSTICS, type MigrateDiagnosticCode } from "./diagnostics.js";
export { isKnownUmoType, umoJsonToSchema, type UmoToSchemaOptions } from "./to-schema.js";
export type { UmoOrigin, UmoOrigins } from "./umo-json.js";
export type { UmoEnumItem, UmoJson, UmoMetaValue, UmoNode } from "./umo-types.js";

export const DEFAULT_FENGDIE_FILE = "schema.fengdie";

export interface FengdieUmoResult extends Result<UmoJson> {
	/** umo JSON 节点到源码位置, 传给 `umoJsonToSchema` 可让诊断指向源码. */
	origins: UmoOrigins;
}

export interface MigrateFengdieResult {
	/** Jotl 源码; 有 error 时为 undefined. */
	jotl?: string;
	/** 规范化的 JSON Schema 2020-12 文档, 与 `jotl` 再经 `compile` 的结果深度相等. */
	schema?: JsonSchemaObject;
	/** 中间产物 umo JSON(与 umo-edit-sdk toJson 同构). */
	umo?: UmoJson;
	diagnostics: Diagnostic[];
}

function byPosition(a: Diagnostic, b: Diagnostic): number {
	const offset = (d: Diagnostic) =>
		d.location?.kind === "source" ? d.location.range.start.offset : Number.MAX_SAFE_INTEGER;
	return offset(a) - offset(b);
}

/** 凤蝶 schema 源码 → umo JSON(toJson 的产物); 词法或语法错误时 value 为 undefined, 诊断只含第一个错误. */
export function fengdieToUmoJson(
	source: string,
	file: string = DEFAULT_FENGDIE_FILE
): FengdieUmoResult {
	const parsed = parseFengdie(source, file);
	const builder = new UmoBuilder();
	if (parsed.value === undefined)
		return { value: undefined, diagnostics: parsed.diagnostics, origins: builder.origins };
	const umo = builder.document(parsed.value);
	return { value: umo, diagnostics: builder.diagnostics, origins: builder.origins };
}

/**
 * 把凤蝶 schema 迁移为 Jotl. input 为源码, umo JSON 文本(首个非空白字符为 `{`)或已解析的 umo JSON 对象.
 * 不可转换项与被丢弃的元数据报 warning, 不影响结果.
 */
export function migrateFengdie(
	input: string | UmoJson,
	file: string = DEFAULT_FENGDIE_FILE
): MigrateFengdieResult {
	let umo: UmoJson;
	const diagnostics: Diagnostic[] = [];
	let origins: UmoOrigins | undefined;
	if (typeof input === "string" && !input.trimStart().startsWith("{")) {
		const built = fengdieToUmoJson(input, file);
		diagnostics.push(...built.diagnostics);
		if (built.value === undefined) return { diagnostics };
		umo = built.value;
		origins = built.origins;
	} else if (typeof input === "string") {
		try {
			umo = JSON.parse(input) as UmoJson;
		} catch (error) {
			return {
				diagnostics: [
					migrateDiagnostic(
						"JOTL8006",
						{ reason: (error as Error).message },
						{ location: { kind: "pointer", pointer: "", document: file } }
					),
				],
			};
		}
	} else {
		umo = input;
	}
	const converted = umoJsonToSchema(umo, origins === undefined ? { file } : { origins, file });
	diagnostics.push(...converted.diagnostics);
	diagnostics.sort(byPosition);
	if (converted.value === undefined) return { umo, diagnostics };
	const schema = orderKeywords(converted.value) as JsonSchemaObject;
	const printed = print(schema);
	diagnostics.push(...printed.diagnostics);
	if (printed.value === undefined) return { umo, schema, diagnostics };
	return { jotl: printed.value, schema, umo, diagnostics };
}
