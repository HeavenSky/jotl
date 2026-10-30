// 测试辅助: 迁移一段 fengdie DSL schema, 取出诊断的代码与位置, 并核对迁移结果再编译后与期望 schema 深度相等.
import {
	type Diagnostic,
	JSON_SCHEMA_DIALECT,
	type JsonSchema,
	type JsonSchemaObject,
} from "@jotl/core";
import { compile } from "@jotl/core";
import { expect } from "vitest";
import { createAjv, enableJsonContent } from "../../../../data/src/ajv-instance.js";
import {
	type MigrateFengdieResult,
	type FengdieJson,
	migrateFengdie,
} from "../../../src/migrate/index.js";

export const FILE = "test.schema";

// 与 `@jotl/data` 的 validate 同配置; x- 扩展关键字由 validate 编译前按需登记, 直接用 createAjv 时要自己登记.
const ajv = createAjv();
enableJsonContent(ajv);
ajv.addKeyword({ keyword: "x-fengdie" });

export interface Located {
	code: string;
	line: number;
	column: number;
}

export function located(diagnostics: readonly Diagnostic[]): Located[] {
	return diagnostics.map(d => ({
		code: d.code,
		line: d.location?.kind === "source" ? d.location.range.start.line : 0,
		column: d.location?.kind === "source" ? d.location.range.start.column : 0,
	}));
}

export function codes(diagnostics: readonly Diagnostic[]): string[] {
	return diagnostics.map(d => d.code);
}

/** 迁移成功且 Jotl 再编译无诊断, 得到与迁移结果相同的 schema, 且该 schema 能被 `@jotl/data` 的 Ajv 编译; 返回迁移结果. */
export function roundTrip(
	input: string | FengdieJson
): MigrateFengdieResult & { jotl: string; schema: JsonSchemaObject } {
	const result = migrateFengdie(input, FILE);
	expect(result.jotl, JSON.stringify(result.diagnostics)).toBeDefined();
	const compiled = compile(result.jotl!, "migrated.jotl");
	expect(compiled.diagnostics, result.jotl).toEqual([]);
	expect(compiled.value!.schema, result.jotl).toStrictEqual(result.schema);
	expect(() => ajv.compile(result.schema!), result.jotl).not.toThrow();
	ajv.removeSchema(result.schema!);
	return result as MigrateFengdieResult & { jotl: string; schema: JsonSchemaObject };
}

/** 迁移结果与期望深度相等, 且往返一致. */
export function migrateTo(
	source: string,
	expected: JsonSchemaObject
): MigrateFengdieResult & { jotl: string } {
	const result = roundTrip(source);
	expect(result.schema).toStrictEqual(expected);
	return result;
}

/** 只有根类型 Root 的文档. */
export function rootDoc(root: JsonSchemaObject): JsonSchemaObject {
	return {
		$schema: JSON_SCHEMA_DIALECT,
		$ref: "#/$defs/Root",
		"x-ui": { version: 1 },
		$defs: { Root: root },
	};
}

/** 迁移 `Object(根) { x(X)<typeAndMeta> }`, 往返一致, 返回字段 x 的 schema, 根对象与诊断. */
export function field(typeAndMeta: string): {
	x: JsonSchema;
	root: JsonSchemaObject;
	diagnostics: Diagnostic[];
	jotl: string;
} {
	const result = roundTrip(`Object(根) { x(X)${typeAndMeta} }`);
	const root = result.schema.$defs!.Root as JsonSchemaObject;
	return { x: root.properties!.x!, root, diagnostics: result.diagnostics, jotl: result.jotl };
}
