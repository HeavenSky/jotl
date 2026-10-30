// fengdie DSL schema 迁移到 Jotl: 源码按凤蝶编辑器文法解析为 fengdie JSON schema(或直接读入 fengdie JSON schema), 转为 JSON Schema 2020-12, 再打印为 Jotl.
import { type Diagnostic, type JsonSchemaObject, type Result, orderKeywords } from "@jotl/core";
import { print } from "@jotl/core";
import { migrateDiagnostic } from "./diagnostics.js";
import { parseFengdie } from "./parser.js";
import { fengdieJsonToSchema } from "./to-schema.js";
import { FengdieJsonBuilder, type FengdieJsonOrigins } from "./fengdie-json.js";
import type { FengdieJson } from "./fengdie-json-types.js";

export { MIGRATE_DIAGNOSTICS, type MigrateDiagnosticCode } from "./diagnostics.js";
export { isKnownFengdieJsonType, fengdieJsonToSchema, type FengdieJsonToSchemaOptions } from "./to-schema.js";
export type { FengdieJsonOrigin, FengdieJsonOrigins } from "./fengdie-json.js";
export type { FengdieJsonEnumItem, FengdieJson, FengdieJsonMetaValue, FengdieJsonNode } from "./fengdie-json-types.js";

export const DEFAULT_FENGDIE_FILE = "default.schema";

export interface FengdieJsonResult extends Result<FengdieJson> {
	/** fengdie JSON schema 节点到源码位置, 传给 `fengdieJsonToSchema` 可让诊断指向源码. */
	origins: FengdieJsonOrigins;
}

export interface MigrateFengdieResult {
	/** Jotl 源码; 有 error 时为 undefined. */
	jotl?: string;
	/** 规范化的 JSON Schema 2020-12 文档, 与 `jotl` 再经 `compile` 的结果深度相等. */
	schema?: JsonSchemaObject;
	/** 中间产物 fengdie JSON schema(与凤蝶编辑器 toJson 同构). */
	fengdieJson?: FengdieJson;
	diagnostics: Diagnostic[];
}

function byPosition(a: Diagnostic, b: Diagnostic): number {
	const offset = (d: Diagnostic) =>
		d.location?.kind === "source" ? d.location.range.start.offset : Number.MAX_SAFE_INTEGER;
	return offset(a) - offset(b);
}

/** fengdie DSL schema → fengdie JSON schema(toJson 的产物); 词法或语法错误时 value 为 undefined, 诊断只含第一个错误. */
export function parseFengdieJson(
	source: string,
	file: string = DEFAULT_FENGDIE_FILE
): FengdieJsonResult {
	const parsed = parseFengdie(source, file);
	const builder = new FengdieJsonBuilder();
	if (parsed.value === undefined)
		return { value: undefined, diagnostics: parsed.diagnostics, origins: builder.origins };
	const fengdieJson = builder.document(parsed.value);
	return { value: fengdieJson, diagnostics: builder.diagnostics, origins: builder.origins };
}

/**
 * 把 fengdie DSL schema 迁移为 Jotl. input 为源码, fengdie JSON schema 文本(首个非空白字符为 `{`)或已解析的 fengdie JSON schema 对象.
 * 不可转换项与被丢弃的元数据报 warning, 不影响结果.
 */
export function migrateFengdie(
	input: string | FengdieJson,
	file: string = DEFAULT_FENGDIE_FILE
): MigrateFengdieResult {
	let fengdieJson: FengdieJson;
	const diagnostics: Diagnostic[] = [];
	let origins: FengdieJsonOrigins | undefined;
	if (typeof input === "string" && !input.trimStart().startsWith("{")) {
		const built = parseFengdieJson(input, file);
		diagnostics.push(...built.diagnostics);
		if (built.value === undefined) return { diagnostics };
		fengdieJson = built.value;
		origins = built.origins;
	} else if (typeof input === "string") {
		try {
			fengdieJson = JSON.parse(input) as FengdieJson;
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
		fengdieJson = input;
	}
	const converted = fengdieJsonToSchema(fengdieJson, origins === undefined ? { file } : { origins, file });
	diagnostics.push(...converted.diagnostics);
	diagnostics.sort(byPosition);
	if (converted.value === undefined) return { fengdieJson, diagnostics };
	const schema = orderKeywords(converted.value) as JsonSchemaObject;
	const printed = print(schema);
	diagnostics.push(...printed.diagnostics);
	if (printed.value === undefined) return { fengdieJson, schema, diagnostics };
	return { jotl: printed.value, schema, fengdieJson, diagnostics };
}
