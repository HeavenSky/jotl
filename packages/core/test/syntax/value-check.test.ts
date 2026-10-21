// 默认值检查器: 纯别名跳转不计层数, 真正的结构嵌套超过层数上限时按通过处理.
import type { JsonSchema, JsonSchemaObject } from "../../src/schema/index.js";
import { checkDefaultValue } from "../../src/syntax/value-check.js";
import { describe, expect, it } from "vitest";

/** A0 经 n 层别名到达 leaf; extra 为每个别名节点上附加的关键字. */
function aliasChain(
	n: number,
	leaf: JsonSchema,
	extra: JsonSchemaObject = {}
): Record<string, JsonSchema> {
	const defs: Record<string, JsonSchema> = { [`A${n}`]: leaf };
	for (let i = 0; i < n; i++) defs[`A${i}`] = { $ref: `#/$defs/A${i + 1}`, ...extra };
	return defs;
}

describe("别名链", () => {
	it("很长的纯别名链不截断, 写错的默认值照样报错", () => {
		for (const n of [1100, 5000, 20000]) {
			const defs = aliasChain(n, { type: "string" });
			expect(checkDefaultValue({ $ref: "#/$defs/A0", default: 5 }, 5, defs)).toBeDefined();
			expect(checkDefaultValue({ $ref: "#/$defs/A0" }, "x", defs)).toBeUndefined();
		}
	});

	it("别名节点带注解与未判定的 x- 扩展仍是纯别名", () => {
		const defs = aliasChain(
			5000,
			{ type: "string", maxLength: 1 },
			{ title: "t", description: "d", "x-ui": { widget: "input" } }
		);
		expect(checkDefaultValue({ $ref: "#/$defs/A0" }, "ab", defs)).toBeDefined();
		expect(checkDefaultValue({ $ref: "#/$defs/A0" }, "a", defs)).toBeUndefined();
	});

	it("`not` 下的长别名链可以完整判定", () => {
		const defs = aliasChain(5000, { type: "string" });
		expect(checkDefaultValue({ not: { $ref: "#/$defs/A0" } }, "x", defs)).toBeDefined();
		expect(checkDefaultValue({ not: { $ref: "#/$defs/A0" } }, 5, defs)).toBeUndefined();
	});

	it("纯别名环按通过处理", () => {
		const defs = { A: { $ref: "#/$defs/B" }, B: { $ref: "#/$defs/A" } };
		expect(checkDefaultValue({ $ref: "#/$defs/A" }, 5, defs)).toBeUndefined();
		const self = { A: { $ref: "#/$defs/A" } };
		expect(checkDefaultValue({ $ref: "#/$defs/A" }, 5, self)).toBeUndefined();
	});
});

describe("层数上限", () => {
	it("结构嵌套超过 1000 层时整体按通过处理", () => {
		const nest = (n: number) => {
			let schema: JsonSchemaObject = { type: "string" };
			let value: unknown = 5;
			for (let i = 0; i < n; i++) {
				schema = { type: "object", properties: { a: schema } };
				value = { a: value };
			}
			return [schema, value] as const;
		};
		expect(checkDefaultValue(...nest(900), {})).toBeDefined();
		expect(checkDefaultValue(...nest(1100), {})).toBeUndefined();
	});

	it("`$ref` 旁有校验关键字的节点不是纯别名, 跳转照常计层数", () => {
		expect(
			checkDefaultValue(
				{ $ref: "#/$defs/A0" },
				5,
				aliasChain(900, { type: "string" }, { minLength: 0 })
			)
		).toBeDefined();
		expect(
			checkDefaultValue(
				{ $ref: "#/$defs/A0" },
				5,
				aliasChain(1100, { type: "string" }, { minLength: 0 })
			)
		).toBeUndefined();
	});
});
