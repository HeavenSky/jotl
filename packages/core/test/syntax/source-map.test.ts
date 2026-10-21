// 源码映射: 每个 properties 字段与 $defs 条目都有 span, keyRange 指向键; 内部类型, 分支与枚举成员也有映射.
import {
	type JsonPointer,
	type JsonSchema,
	type SourceRange,
	appendPointer,
	isSchemaObject,
} from "../../src/schema/index.js";
import { describe, expect, it } from "vitest";
import { listFixtures, readFixture } from "../../../../test-utils/fixtures.js";
import { compile } from "../../src/syntax/index.js";
import { FILE } from "./helpers.js";

/** 编译器合成的属性: money bigint 的固定字段与可区分联合的区分字段, 源码中没有对应的键. */
function synthesized(schema: JsonSchema): boolean {
	if (!isSchemaObject(schema)) return false;
	const keys = Object.keys(schema).filter(k => k !== "type");
	return keys.length === 1 && keys[0] === "const" && typeof schema.const !== "object";
}

/** 收集 schema 中全部 `$defs` 条目与 `properties` 字段的指针及其键名. */
function keyedPointers(
	schema: JsonSchema,
	pointer: JsonPointer = "",
	out: [JsonPointer, string][] = []
): [JsonPointer, string][] {
	if (!isSchemaObject(schema)) return out;
	const special =
		isSchemaObject(schema.properties) &&
		isSchemaObject(schema.properties.type) &&
		["money", "bigint"].includes(schema.properties.type.const as string);
	for (const [keyword, value] of Object.entries(schema)) {
		if (
			(keyword === "$defs" || keyword === "properties") &&
			isSchemaObject(value) &&
			!(keyword === "properties" && special)
		) {
			for (const [name, sub] of Object.entries(value)) {
				if (keyword === "properties" && synthesized(sub as JsonSchema)) continue;
				const child = appendPointer(pointer, keyword, name);
				out.push([child, name]);
				keyedPointers(sub as JsonSchema, child, out);
			}
		} else if (["items", "additionalProperties", "contentSchema"].includes(keyword)) {
			keyedPointers(value as JsonSchema, appendPointer(pointer, keyword), out);
		} else if (
			["anyOf", "oneOf", "prefixItems", "allOf"].includes(keyword) &&
			Array.isArray(value)
		) {
			value.forEach((sub, i) => {
				keyedPointers(sub as JsonSchema, appendPointer(pointer, keyword, i), out);
			});
		}
	}
	return out;
}

function slice(text: string, range: SourceRange): string {
	return text.slice(range.start.offset, range.end.offset);
}

/** 键的原文转为键名: 引号字符串按 JSON5 解码(样例中不含转义). */
function keyName(raw: string): string {
	return /^['"]/.test(raw) ? raw.slice(1, -1) : raw;
}

describe("fixtures 的源码映射", () => {
	for (const name of listFixtures()) {
		const fixture = readFixture(name);
		if (!fixture.hasSchema || fixture.source === undefined) continue;
		it(`${name}: 字段与 $defs 条目都有 span, keyRange 指向键`, () => {
			const text = fixture.source!;
			const output = compile(text, `${name}/source.jotl`).value!;
			const pointers = keyedPointers(output.schema);
			expect(pointers.length).toBeGreaterThan(0);
			for (const [pointer, key] of pointers) {
				const span = output.sourceMap.get(pointer);
				expect(span, pointer).toBeDefined();
				expect(span!.keyRange, pointer).toBeDefined();
				expect(keyName(slice(text, span!.keyRange!)), pointer).toBe(key);
				expect(span!.range.start.offset).toBeLessThanOrEqual(span!.keyRange!.start.offset);
				expect(span!.range.end.offset).toBeGreaterThanOrEqual(span!.keyRange!.end.offset);
				expect(span!.range.file).toBe(`${name}/source.jotl`);
			}
		});
	}
});

describe("源码映射的范围", () => {
	const text = [
		"<root/>",
		"A(甲): [closed: true] {",
		"  'a b'?: array[array_item: 'string', widget: 'x']",
		"  m: map[map_item: 'B']",
		"  u: union[union_item: 'string|B']",
		"  e: enum{ x(叉) y }",
		"  d: union[discriminator: 'k'] { p(皮): B }",
		"}",
		"B: {}",
	].join("\n");
	const output = compile(text, FILE).value!;

	it("根指向根条目, 条目的 range 从键到内容末尾", () => {
		expect(slice(text, output.sourceMap.get("")!.range)).toBe(
			text.split("\n").slice(1, 8).join("\n")
		);
		expect(slice(text, output.sourceMap.get("/$defs/B")!.range)).toBe("B: {}");
		expect(slice(text, output.sourceMap.get("/$defs/B")!.keyRange!)).toBe("B");
	});

	it("字段 range 覆盖键到元数据末尾, 字符串键的 keyRange 含引号", () => {
		const span = output.sourceMap.get("/$defs/A/properties/a b")!;
		expect(slice(text, span.range)).toBe("'a b'?: array[array_item: 'string', widget: 'x']");
		expect(slice(text, span.keyRange!)).toBe("'a b'");
	});

	it("类型串中的名字指向类型串, 枚举成员与分支指向条目", () => {
		expect(slice(text, output.sourceMap.get("/$defs/A/properties/a b/items")!.range)).toBe(
			"'string'"
		);
		expect(
			slice(text, output.sourceMap.get("/$defs/A/properties/m/additionalProperties")!.range)
		).toBe("'B'");
		expect(slice(text, output.sourceMap.get("/$defs/A/properties/u/anyOf/1")!.range)).toBe(
			"'string|B'"
		);
		const member = output.sourceMap.get("/$defs/A/properties/e/oneOf/0")!;
		expect(slice(text, member.range)).toBe("x(叉)");
		expect(slice(text, member.keyRange!)).toBe("x");
		expect(slice(text, output.sourceMap.get("/$defs/A/properties/d/oneOf/0")!.range)).toBe(
			"p(皮): B"
		);
	});

	it("中文标签之后的列号按 UTF-16 计", () => {
		const span = output.sourceMap.get("/$defs/A/properties/e/oneOf/1")!;
		expect(span.range.start).toMatchObject({ line: 6, column: 17 });
	});
});
