// 共享样例集: 编译结果与 schema.json 深度相等, 期望诊断按集合相等.
import { orderKeywords } from "../../src/schema/index.js";
import { describe, expect, it } from "vitest";
import { listFixtures, readFixture, sortByKey } from "../../../../test-utils/fixtures.js";
import { compile } from "../../src/syntax/index.js";

const fixtures = listFixtures().map(readFixture);

describe("fixtures 编译", () => {
	for (const fixture of fixtures.filter(f => f.hasSchema && f.source !== undefined)) {
		it(`${fixture.name} 的 schema.json 深度相等`, () => {
			const result = compile(fixture.source!, `${fixture.name}/source.jotl`);
			expect(result.diagnostics).toEqual([]);
			expect(result.value?.schema).toEqual(orderKeywords(fixture.schema as never));
			// meta.defaultExport 供不编译源码的包(ts)取默认导出名; 未写时默认导出即根.
			const recorded = (fixture.meta as { defaultExport?: string }).defaultExport;
			const rootRef = (fixture.schema as { $ref?: string }).$ref;
			expect(result.value?.defaultExport).toBe(recorded ?? rootRef?.slice("#/$defs/".length));
		});
	}
});

describe("fixtures 诊断", () => {
	for (const fixture of fixtures.filter(f => f.diagnostics !== undefined)) {
		it(`${fixture.name} 的 diagnostics.json 按集合相等`, () => {
			const result = compile(fixture.source!, `${fixture.name}/source.jotl`);
			const actual = result.diagnostics.map(d => ({
				code: d.code,
				line: d.location?.kind === "source" ? d.location.range.start.line : 0,
				column: d.location?.kind === "source" ? d.location.range.start.column : 0,
			}));
			expect(sortByKey(actual)).toEqual(sortByKey(fixture.diagnostics!));
			expect(result.value).toBeUndefined();
		});
	}
});
