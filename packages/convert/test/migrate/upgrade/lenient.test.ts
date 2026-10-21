import { JSON_SCHEMA_DIALECT } from "@jotl/core";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { upgradeMessage } from "../../../src/migrate/upgrade/diagnostics.js";
import {
	type ConflictPolicy,
	DEFAULT_UPGRADE_OPTIONS,
	upgradeSchema,
} from "../../../src/migrate/upgrade/index.js";
import { codes, find, pointerOf } from "./helpers.js";

const D4 = "http://json-schema.org/draft-04/schema#";
const D7 = "http://json-schema.org/draft-07/schema#";
const D2019 = "https://json-schema.org/draft/2019-09/schema";

function compile(schema: unknown): (data: unknown) => boolean {
	const validate = new Ajv2020({ strict: false }).compile(schema as object);
	return data => validate(data);
}

describe("默认值(D14)", () => {
	it("acceptNewerKeywords: true, onConflict: error", () => {
		expect(DEFAULT_UPGRADE_OPTIONS).toEqual({ acceptNewerKeywords: true, onConflict: "error" });
	});
});

describe("冲突表: 无冲突的行", () => {
	it("行 1: draft-07 中的 $defs prefixItems dependentRequired dependentSchemas unevaluatedProperties $anchor 宽松接受", () => {
		const input = {
			$schema: D7,
			$anchor: "root",
			prefixItems: [{ type: "string" }],
			dependentRequired: { a: ["b"] },
			dependentSchemas: { c: { required: ["d"] } },
			unevaluatedProperties: false,
			$defs: { s: { type: "string" } },
		};
		const result = upgradeSchema(input);
		expect(result.value?.schema).toEqual({ ...input, $schema: JSON_SCHEMA_DIALECT });
		const warnings = result.diagnostics.filter(d => d.code === "JOTL3201");
		expect(warnings.map(pointerOf).sort()).toEqual([
			"/$anchor",
			"/$defs",
			"/dependentRequired",
			"/dependentSchemas",
			"/prefixItems",
			"/unevaluatedProperties",
		]);
		expect(warnings.every(d => d.severity === "warning")).toBe(true);
	});

	it("行 1: acceptNewerKeywords 关闭时按声明版本忽略并移除($defs 作为引用容器保留)", () => {
		const result = upgradeSchema(
			{
				$schema: D7,
				prefixItems: [{ type: "string" }],
				unevaluatedProperties: false,
				$defs: { s: {} },
			},
			{ acceptNewerKeywords: false }
		);
		expect(result.value?.schema).toEqual({ $schema: JSON_SCHEMA_DIALECT, $defs: { s: {} } });
		expect(codes(result.diagnostics).filter(c => c === "JOTL3202")).toHaveLength(2);
	});

	it("行 2: draft-04 中的 const if/then/else contains propertyNames 宽松接受", () => {
		const input = {
			$schema: D4,
			const: 1,
			if: { type: "integer" },
			then: { minimum: 0 },
			else: { maximum: 0 },
			contains: { type: "string" },
			propertyNames: { maxLength: 3 },
		};
		const result = upgradeSchema(input);
		expect(result.value?.schema).toEqual({ ...input, $schema: JSON_SCHEMA_DIALECT });
		expect(codes(result.diagnostics).filter(c => c === "JOTL3201")).toHaveLength(6);
	});

	it("行 3: exclusiveMaximum 按值的类型区分新旧写法", () => {
		const numericInDraft4 = upgradeSchema({ $schema: D4, exclusiveMaximum: 5 });
		expect(numericInDraft4.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			exclusiveMaximum: 5,
		});
		expect(codes(numericInDraft4.diagnostics)).toContain("JOTL3201");
		const booleanInDraft7 = upgradeSchema({ $schema: D7, maximum: 5, exclusiveMaximum: true });
		expect(booleanInDraft7.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			exclusiveMaximum: 5,
		});
		expect(find(booleanInDraft7.diagnostics, "JOTL3203")?.severity).toBe("warning");
	});

	it("行 4: definitions 与 $defs 名称不重复时合并", () => {
		const result = upgradeSchema({
			$schema: D7,
			definitions: { a: { type: "string" } },
			$defs: { b: { type: "number" } },
		});
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			$defs: { b: { type: "number" }, a: { type: "string" } },
		});
	});

	it("行 7: dependencies 拆分后与 dependentRequired / dependentSchemas 无同名字段时合并", () => {
		const result = upgradeSchema({
			$schema: D7,
			dependencies: { a: ["b"], c: { required: ["d"] } },
			dependentRequired: { x: ["y"] },
			dependentSchemas: { z: { minProperties: 1 } },
		});
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			dependentRequired: { x: ["y"], a: ["b"] },
			dependentSchemas: { z: { minProperties: 1 }, c: { required: ["d"] } },
		});
	});

	it("行 8: id 与 $id 相同时不冲突", () => {
		const result = upgradeSchema({
			$schema: D4,
			id: "http://x.test/a.json",
			$id: "http://x.test/a.json",
		});
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			$id: "http://x.test/a.json",
		});
	});
});

interface ConflictCase {
	row: string;
	code: string;
	input: Record<string, unknown>;
	pointer: string;
	declared: unknown;
	latest: unknown;
}

const CONFLICTS: ConflictCase[] = [
	{
		row: "行 4: definitions 与 $defs 同名",
		code: "JOTL3301",
		input: {
			$schema: D7,
			definitions: { a: { type: "string" } },
			$defs: { a: { type: "number" } },
		},
		pointer: "/definitions/a",
		declared: { $schema: JSON_SCHEMA_DIALECT, $defs: { a: { type: "string" } } },
		latest: { $schema: JSON_SCHEMA_DIALECT, $defs: { a: { type: "number" } } },
	},
	{
		row: "行 5: 数组形式的 items 与 prefixItems 同时存在",
		code: "JOTL3302",
		input: {
			$schema: D7,
			items: [{ type: "string" }],
			additionalItems: false,
			prefixItems: [{ type: "number" }],
		},
		pointer: "/items",
		declared: { $schema: JSON_SCHEMA_DIALECT, prefixItems: [{ type: "string" }], items: false },
		latest: { $schema: JSON_SCHEMA_DIALECT, prefixItems: [{ type: "number" }] },
	},
	{
		row: "行 6: draft-07 中 $ref 旁有其他关键字",
		code: "JOTL3303",
		input: {
			$schema: D7,
			properties: { a: { $ref: "#/definitions/s", maxLength: 2, title: "A" } },
			definitions: { s: { type: "string" } },
		},
		pointer: "/properties/a/$ref",
		declared: {
			$schema: JSON_SCHEMA_DIALECT,
			properties: { a: { $ref: "#/$defs/s", title: "A" } },
			$defs: { s: { type: "string" } },
		},
		latest: {
			$schema: JSON_SCHEMA_DIALECT,
			properties: { a: { $ref: "#/$defs/s", title: "A", maxLength: 2 } },
			$defs: { s: { type: "string" } },
		},
	},
	{
		row: "行 7: dependencies 与 dependentRequired 同名",
		code: "JOTL3304",
		input: { $schema: D7, dependencies: { a: ["b"] }, dependentRequired: { a: ["c"] } },
		pointer: "/dependencies/a",
		declared: { $schema: JSON_SCHEMA_DIALECT, dependentRequired: { a: ["b"] } },
		latest: { $schema: JSON_SCHEMA_DIALECT, dependentRequired: { a: ["c"] } },
	},
	{
		row: "行 7: dependencies 与 dependentSchemas 同名",
		code: "JOTL3304",
		input: {
			$schema: D7,
			dependencies: { a: { required: ["b"] } },
			dependentSchemas: { a: { required: ["c"] } },
		},
		pointer: "/dependencies/a",
		declared: { $schema: JSON_SCHEMA_DIALECT, dependentSchemas: { a: { required: ["b"] } } },
		latest: { $schema: JSON_SCHEMA_DIALECT, dependentSchemas: { a: { required: ["c"] } } },
	},
	{
		row: "行 8: id 与 $id 值不同",
		code: "JOTL3305",
		input: { $schema: D4, id: "http://x.test/old.json", $id: "http://x.test/new.json" },
		pointer: "/id",
		declared: { $schema: JSON_SCHEMA_DIALECT, $id: "http://x.test/old.json" },
		latest: { $schema: JSON_SCHEMA_DIALECT, $id: "http://x.test/new.json" },
	},
];

describe.each(CONFLICTS)("冲突表 $row", ({ code, input, pointer, declared, latest }) => {
	it("onConflict: error 报错终止", () => {
		const result = upgradeSchema(input, { onConflict: "error" });
		expect(result.value).toBeUndefined();
		const diagnostic = find(result.diagnostics, code);
		expect(diagnostic?.severity).toBe("error");
		expect(pointerOf(diagnostic)).toBe(pointer);
	});

	it.each([
		["preferDeclared", "JOTL3351"],
		["preferLatest", "JOTL3352"],
	] as const)("onConflict: %s 按对应语义处理并警告", (policy: ConflictPolicy, resolution) => {
		const result = upgradeSchema(input, { onConflict: policy });
		expect(result.value?.schema).toEqual(policy === "preferDeclared" ? declared : latest);
		const diagnostic = find(result.diagnostics, code);
		expect(diagnostic?.severity).toBe("warning");
		expect(pointerOf(diagnostic)).toBe(pointer);
		const declaredVersion = input.$schema === D4 ? "draft-04" : "draft-07";
		expect(diagnostic?.related?.[0]?.message).toBe(
			upgradeMessage(resolution, { declared: declaredVersion })
		);
	});
});

describe("冲突策略改变校验结果", () => {
	it("$ref 旁的 maxLength: preferDeclared 忽略, preferLatest 生效", () => {
		const input = {
			$schema: D7,
			properties: { a: { $ref: "#/definitions/s", maxLength: 2 } },
			definitions: { s: { type: "string" } },
		};
		const data = { a: "long" };
		expect(
			compile(upgradeSchema(input, { onConflict: "preferDeclared" }).value?.schema)(data)
		).toBe(true);
		expect(
			compile(upgradeSchema(input, { onConflict: "preferLatest" }).value?.schema)(data)
		).toBe(false);
	});
});

describe("高版本文档中的旧版关键字", () => {
	it("2019-09 中的 definitions 按 $defs 处理, 同名时声明版本以 $defs 为准", () => {
		const result = upgradeSchema(
			{
				$schema: D2019,
				definitions: { a: { type: "string" }, b: {} },
				$defs: { a: { type: "number" } },
				$ref: "#/definitions/b",
			},
			{ onConflict: "preferDeclared" }
		);
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			$ref: "#/$defs/b",
			$defs: { a: { type: "number" }, b: {} },
		});
		expect(codes(result.diagnostics)).toEqual(expect.arrayContaining(["JOTL3204", "JOTL3301"]));
	});
});

describe("V12: 无 $schema 时取旧版特征对应的最低版本, 其余高版本关键字走宽松模式", () => {
	it("definitions(旧版特征) + const 与 $defs(高版本关键字)", () => {
		const result = upgradeSchema({
			definitions: { a: { const: 1 } },
			$defs: { b: { type: "string" } },
			properties: { a: { $ref: "#/definitions/a" } },
		});
		expect(result.value?.version).toBe("draft-04");
		expect(result.value?.versionSource).toBe("inferred");
		expect(result.value?.schema).toEqual({
			$schema: JSON_SCHEMA_DIALECT,
			properties: { a: { $ref: "#/$defs/a" } },
			$defs: { b: { type: "string" }, a: { const: 1 } },
		});
		const lenient = result.diagnostics.filter(d => d.code === "JOTL3201");
		expect(lenient.map(pointerOf).sort()).toEqual(["/$defs", "/definitions/a/const"]);
	});
});
