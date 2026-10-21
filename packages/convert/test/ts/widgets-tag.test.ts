// 根 x-ui.widgets(扩展组件模块)经 @widgets 标签在 TS 互转中往返.
import { JSON_SCHEMA_DIALECT, type JsonSchemaObject } from "@jotl/core";
import { describe, expect, it } from "vitest";
import { schemaToTs } from "../../src/index.js";
import { tsToSchema } from "../../src/from-ts.js";

describe("@widgets", () => {
	const formSchema = (widgets: Record<string, unknown>): JsonSchemaObject =>
		({
			$schema: JSON_SCHEMA_DIALECT,
			$ref: "#/$defs/Form",
			"x-ui": { version: 1, widgets },
			$defs: {
				Form: {
					type: "object",
					properties: { score: { type: "integer", "x-ui": { widget: "Rating" } } },
					required: ["score"],
				},
			},
		}) as JsonSchemaObject;

	it("根 x-ui.widgets 写成根类型上的 @widgets 并读回", () => {
		const ts = schemaToTs(formSchema({ Rating: { base: "integer", module: "./r.js" } }));
		expect(ts.diagnostics).toEqual([]);
		expect(ts.value).toContain('@widgets `{"Rating":{"base":"integer","module":"./r.js"}}`');
		const back = tsToSchema(ts.value!);
		expect(back.diagnostics).toEqual([]);
		expect(back.value!["x-ui"]).toEqual({
			version: 1,
			widgets: { Rating: { base: "integer", module: "./r.js" } },
		});
	});

	it("base 为 schema 对象或缺省时原样往返", () => {
		const widgets = {
			Rating: { base: { type: "integer", maximum: 5 }, module: "r", export: "R" },
			Map: { module: "m" },
		};
		const back = tsToSchema(schemaToTs(formSchema(widgets)).value!);
		expect(back.diagnostics).toEqual([]);
		expect(back.value!["x-ui"]).toEqual({ version: 1, widgets });
	});

	it("非根声明上的 @widgets 报 JOTL2115", () => {
		const back = tsToSchema(
			"/** @root */\nexport interface A { b: B }\n/** @widgets `{}` */\nexport interface B { c: string }\n"
		);
		expect(back.diagnostics.map(d => d.code)).toContain("JOTL2115");
	});
});
