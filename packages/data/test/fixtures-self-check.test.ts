// 样例自检: 用严格模式的 Ajv 2020 验证共享样例本身正确, 不经过 @jotl/data 的校验与错误转换.
import type { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { xUiMetaSchema, type JsonSchema } from "@jotl/core";
import { isSkipped, listFixtures, readFixture } from "../../../test-utils/fixtures.js";
import { SYNTAX_DIAGNOSTICS } from "../../core/src/syntax/diagnostics.js";
import { DATA_DIAGNOSTICS } from "../src/diagnostics.js";
import { createAjv as createDataAjv, enableJsonContent } from "../src/ajv-instance.js";

// x-decimals x-decimalRange 与 JSON 文本的断言语义没有独立实现, 借用 @jotl/data 的关键字; 其余仍由严格模式的 Ajv 独立判定.
function createAjv(): Ajv2020 {
	const ajv = createDataAjv({ allErrors: true, strict: true, strictTuples: false });
	enableJsonContent(ajv);
	return ajv;
}

/** 收集 schema 中全部 x-ui 值及其位置. */
function collectXUi(node: unknown, path: string, out: [string, unknown][]): void {
	if (Array.isArray(node)) {
		node.forEach((n, i) => {
			collectXUi(n, `${path}/${i}`, out);
		});
		return;
	}
	if (typeof node !== "object" || node === null) return;
	for (const [key, value] of Object.entries(node)) {
		if (key === "x-ui") out.push([path, value]);
		// const default examples 是数据, 不是 schema.
		else if (!["const", "default", "examples", "enum"].includes(key))
			collectXUi(value, `${path}/${key}`, out);
	}
}

const names = listFixtures();
const ajv = createAjv();
const validateXUi = ajv.compile(xUiMetaSchema);

describe("共享样例自检", () => {
	it("样例集非空且序号连续存在 001-017", () => {
		for (let i = 1; i <= 17; i++) {
			expect(names.some(n => n.startsWith(String(i).padStart(3, "0") + "-"))).toBe(true);
		}
	});

	for (const name of names) {
		describe(name, () => {
			const fixture = readFixture(name);

			it("meta 与必备文件齐全", () => {
				expect(fixture.meta.covers.length).toBeGreaterThan(0);
				expect(fixture.source).toBeDefined();
				if (fixture.diagnostics) {
					expect(fixture.hasSchema).toBe(false);
					for (const d of fixture.diagnostics)
						expect(Object.keys(SYNTAX_DIAGNOSTICS)).toContain(d.code);
					return;
				}
				expect(fixture.hasSchema).toBe(true);
				expect(fixture.hasDefaults).toBe(true);
				if (!isSkipped(fixture, "types.d.ts")) expect(fixture.types).toBeDefined();
				expect(fixture.valid.length).toBeGreaterThan(0);
				expect(fixture.invalid.length).toBeGreaterThan(0);
			});

			if (!fixture.hasSchema) return;
			const validate = ajv.compile(fixture.schema as JsonSchema & object);

			it("x-ui 符合 meta-schema", () => {
				const found: [string, unknown][] = [];
				collectXUi(fixture.schema, "", found);
				for (const [path, value] of found) {
					expect(
						validateXUi(value),
						`${path}: ${JSON.stringify(validateXUi.errors)}`
					).toBe(true);
				}
			});

			for (const c of fixture.valid) {
				it(`valid/${c.name} 通过`, () => {
					expect(validate(c.data), JSON.stringify(validate.errors)).toBe(true);
				});
			}

			for (const c of fixture.invalid) {
				it(`invalid/${c.name} 失败且期望错误合法`, () => {
					expect(validate(c.data)).toBe(false);
					expect(c.errors?.length).toBeGreaterThan(0);
					// 期望指针指向缺失或多出的字段本身, Ajv 报在父对象上, 这里换算到子字段.
					const instancePaths = (validate.errors ?? []).map(e => {
						if (e.keyword === "required")
							return `${e.instancePath}/${(e.params as { missingProperty: string }).missingProperty}`;
						if (e.keyword === "additionalProperties") {
							return `${e.instancePath}/${(e.params as { additionalProperty: string }).additionalProperty}`;
						}
						return e.instancePath;
					});
					for (const e of c.errors ?? []) {
						expect(Object.keys(DATA_DIAGNOSTICS)).toContain(e.code);
						expect(
							instancePaths,
							`期望指针 ${e.pointer} 应出现在 Ajv 的错误中`
						).toContain(e.pointer);
					}
				});
			}

			it("默认数据只含 schema 中的字段且通过校验时不出现类型错误", () => {
				const errors = validate(fixture.defaults) ? [] : (validate.errors ?? []);
				expect(errors.filter(e => e.keyword !== "required")).toEqual([]);
			});
		});
	}
});
