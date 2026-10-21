// 语法 v1 的数据校验扩展: x-decimals, x-decimalRange, JSON 文本(contentMediaType/contentSchema), money/bigint 默认值与 Mock.
import { describe, expect, it } from "vitest";
import { DEFAULT_DEFAULTS_OPTIONS, type JsonSchema } from "@jotl/core";
import { compareDecimal, countDecimals } from "../src/decimal.js";
import { createProduceContext, produce } from "../src/defaults.js";
import { getDefaults, mock, validate } from "../src/index.js";

function errors(schema: JsonSchema, data: unknown): [string, string | undefined, string][] {
	return validate(schema, data).diagnostics.map(d => [
		d.code,
		d.location?.kind === "pointer" ? d.location.pointer : undefined,
		d.message,
	]);
}

const money = (pattern: string, extra: Record<string, unknown> = {}): JsonSchema => ({
	type: "object",
	properties: {
		type: { const: "money" },
		value: { type: "string", pattern },
		currency: { enum: ["CNY", "USD"] },
		unit: { type: "string" },
	},
	required: ["type", "value", "currency"],
	additionalProperties: false,
	...extra,
});

const bigint = (extra: Record<string, unknown> = {}): JsonSchema => ({
	type: "object",
	properties: { type: { const: "bigint" }, value: { type: "string", pattern: "^-?\\d+$" } },
	required: ["type", "value"],
	additionalProperties: false,
	...extra,
});

describe("精确数字工具", () => {
	it("小数位按展开后的十进制计, 含指数形式", () => {
		expect([1, 1.5, 0.125, 1e-7, 1.5e-7, 1e21, -2.25].map(countDecimals)).toEqual([
			0, 1, 3, 7, 8, 0, 2,
		]);
	});

	it("字符串比较不经过 Number", () => {
		expect(compareDecimal("9007199254740993", "9007199254740992")).toBe(1);
		expect(compareDecimal("-0.10", "0")).toBe(-1);
		expect(compareDecimal("-0.00", "0")).toBe(0);
		expect(compareDecimal("010.50", "10.5")).toBe(0);
		expect(compareDecimal("-2", "-10")).toBe(1);
	});
});

describe("x-decimals", () => {
	const schema: JsonSchema = {
		type: "object",
		properties: { rate: { title: "费率", type: "number", "x-decimals": 2 } },
	};

	it("位数不超过上限时通过", () => {
		expect(errors(schema, { rate: 1.25 })).toEqual([]);
		expect(errors(schema, { rate: 3 })).toEqual([]);
	});

	it("超出位数报 JOTL4020, 指数形式同样检查", () => {
		expect(errors(schema, { rate: 1.255 })).toEqual([
			["JOTL4020", "/rate", "费率 的小数位数应不超过 2"],
		]);
		expect(errors(schema, { rate: 1e-7 }).map(e => e[0])).toEqual(["JOTL4020"]);
	});

	it("类型不符时只报类型", () => {
		expect(errors(schema, { rate: "1.255" }).map(e => e[0])).toEqual(["JOTL4001"]);
	});
});

describe("x-decimalRange", () => {
	const schema: JsonSchema = {
		type: "object",
		properties: {
			price: {
				title: "价格",
				...(money("^-?\\d+\\.\\d{2}$", {
					"x-decimalRange": { minimum: "0", exclusiveMaximum: "100.00" },
				}) as object),
			},
			big: bigint({ "x-decimalRange": { maximum: "9007199254740992" } }),
		},
	};

	it("范围内通过", () => {
		expect(
			errors(schema, {
				price: { type: "money", value: "99.99", currency: "CNY" },
				big: { type: "bigint", value: "9007199254740992" },
			})
		).toEqual([]);
	});

	it("越界报 JOTL4021, 指针落在 money/bigint 对象上, 按精确值比较", () => {
		expect(
			errors(schema, { price: { type: "money", value: "-0.01", currency: "CNY" } })
		).toEqual([["JOTL4021", "/price", "价格 的数值超出范围: 应不小于 0"]]);
		expect(
			errors(schema, { price: { type: "money", value: "100.00", currency: "CNY" } }).map(
				e => e[0]
			)
		).toEqual(["JOTL4021"]);
		expect(errors(schema, { big: { type: "bigint", value: "9007199254740993" } })).toEqual([
			["JOTL4021", "/big", "big 的数值超出范围: 应不大于 9007199254740992"],
		]);
	});

	it("value 不合法时只报 pattern", () => {
		expect(
			errors(schema, { price: { type: "money", value: "-1e3", currency: "CNY" } }).map(e => [
				e[0],
				e[1],
			])
		).toEqual([["JOTL4005", "/price/value"]]);
	});
});

describe("JSON 文本", () => {
	const schema: JsonSchema = {
		type: "object",
		properties: {
			raw: { title: "原始配置", type: "string", contentMediaType: "application/json" },
			conf: {
				type: "string",
				contentMediaType: "application/json",
				contentSchema: { $ref: "#/$defs/Conf" },
			},
		},
		$defs: {
			Conf: {
				type: "object",
				properties: {
					size: { type: "integer", minimum: 1 },
					tags: { type: "array", items: { type: "string" } },
				},
				required: ["size"],
			},
		},
	};

	it("可解析且符合 contentSchema 时通过", () => {
		expect(errors(schema, { raw: "[1, 2]", conf: '{"size": 3, "tags": ["a"]}' })).toEqual([]);
	});

	it("无法解析报 JOTL4022, 不再报 contentSchema", () => {
		expect(errors(schema, { raw: "{a:1}", conf: "{" })).toEqual([
			["JOTL4022", "/raw", "原始配置 不是有效的 JSON 文本"],
			["JOTL4022", "/conf", "conf 不是有效的 JSON 文本"],
		]);
	});

	it("不符合 contentSchema 时只在该字段报一条 JOTL4023", () => {
		expect(errors(schema, { conf: '{"size": 0, "tags": [1, 2]}' })).toEqual([
			["JOTL4023", "/conf", "conf 的 JSON 内容不符合结构要求"],
		]);
		expect(errors(schema, { conf: "{}" }).map(e => [e[0], e[1]])).toEqual([
			["JOTL4023", "/conf"],
		]);
	});

	it("其他 contentMediaType 只作注解", () => {
		expect(errors({ type: "string", contentMediaType: "text/html" }, "<p")).toEqual([]);
	});
});

describe("money/bigint 默认值", () => {
	const schema: JsonSchema = {
		type: "object",
		properties: {
			price: money("^-?\\d+\\.\\d{2}$"),
			yen: money("^-?\\d+$", {
				properties: {
					...(money("^-?\\d+$") as { properties: object }).properties,
					currency: { type: "string", pattern: "^[A-Z]{3}$" },
				},
			}),
			free: money("^-?\\d+(\\.\\d+)?$"),
			positive: bigint({ "x-decimalRange": { exclusiveMinimum: "0", minimum: "5" } }),
			count: bigint(),
			optional: bigint(),
		},
		required: ["price", "yen", "free", "positive", "count"],
	};

	it("必填时按 pattern 补齐小数位, 取首个币种, 满足范围", () => {
		const defaults = getDefaults(schema, { strategy: "required" }).value;
		expect(defaults).toEqual({
			price: { type: "money", value: "0.00", currency: "CNY" },
			yen: { type: "money", value: "0", currency: "CNY" },
			free: { type: "money", value: "0", currency: "CNY" },
			positive: { type: "bigint", value: "5" },
			count: { type: "bigint", value: "0" },
		});
		expect(validate(schema, defaults).diagnostics).toEqual([]);
	});

	it("只给开区间下界或上界时默认值仍在区间内", () => {
		const ranged: JsonSchema = {
			type: "object",
			properties: {
				above: money("^-?\\d+\\.\\d{2}$", {
					"x-decimalRange": { exclusiveMinimum: "0.5" },
				}),
				below: money("^-?\\d+(\\.\\d+)?$", {
					"x-decimalRange": { exclusiveMaximum: "-2.25" },
				}),
				count: bigint({ "x-decimalRange": { exclusiveMinimum: "0" } }),
			},
			required: ["above", "below", "count"],
		};
		const defaults = getDefaults(ranged, { strategy: "required" }).value;
		expect(defaults).toEqual({
			above: { type: "money", value: "1.50", currency: "CNY" },
			below: { type: "money", value: "-3.25", currency: "CNY" },
			count: { type: "bigint", value: "1" },
		});
		expect(validate(ranged, defaults).diagnostics).toEqual([]);
	});
});

describe("JSON 文本默认值", () => {
	it("按 contentSchema 的默认数据序列化, 无 contentSchema 时为 {}", () => {
		const schema: JsonSchema = {
			type: "object",
			properties: {
				conf: {
					type: "string",
					contentMediaType: "application/json",
					contentSchema: {
						type: "object",
						properties: { size: { type: "integer", minimum: 1 } },
						required: ["size"],
					},
				},
				list: {
					type: "string",
					contentMediaType: "application/json",
					contentSchema: { type: "array" },
				},
				raw: { type: "string", contentMediaType: "application/json" },
				preset: { type: "string", contentMediaType: "application/json", default: "[1]" },
			},
			required: ["conf", "list", "raw"],
		};
		const defaults = getDefaults(schema, { strategy: "required" }).value;
		expect(defaults).toEqual({ conf: '{"size":1}', list: "[]", raw: "{}", preset: "[1]" });
		expect(validate(schema, defaults).diagnostics).toEqual([]);
	});
});

describe("Mock", () => {
	const schema: JsonSchema = {
		type: "object",
		properties: {
			price: money("^-?\\d+\\.\\d{2}$", {
				"x-decimalRange": { minimum: "10.00", maximum: "20.00" },
			}),
			count: bigint({ "x-decimalRange": { exclusiveMinimum: "0" } }),
			rate: { type: "number", "x-decimals": 1, minimum: 0, maximum: 1 },
			exact: { type: "number", "x-decimals": 0 },
			conf: {
				type: "string",
				contentMediaType: "application/json",
				contentSchema: {
					type: "object",
					properties: { size: { type: "integer", minimum: 1 } },
					required: ["size"],
				},
			},
			raw: { type: "string", contentMediaType: "application/json" },
		},
		required: ["price", "count", "rate", "exact", "conf", "raw"],
	};

	it.each([1, 2, 3, 42, 2026])("seed %i 生成的数据通过校验", seed => {
		const result = mock(schema, { seed });
		expect(result.diagnostics).toEqual([]);
		expect(validate(schema, result.value).diagnostics).toEqual([]);
	});
});

describe("money/bigint 窄区间默认值", () => {
	it("开区间比 1 还窄且无闭端点时取区间内按小数位的合法值", () => {
		const narrow: JsonSchema = {
			type: "object",
			properties: {
				fixed: money("^-?\\d+\\.\\d{2}$", {
					"x-decimalRange": { exclusiveMinimum: "0", exclusiveMaximum: "0.5" },
				}),
				free: money("^-?\\d+(\\.\\d+)?$", {
					"x-decimalRange": { exclusiveMinimum: "0", exclusiveMaximum: "0.5" },
				}),
				tight: money("^-?\\d+(\\.\\d+)?$", {
					"x-decimalRange": { exclusiveMinimum: "1.23", exclusiveMaximum: "1.24" },
				}),
				negative: money("^-?\\d+\\.\\d{4}$", {
					"x-decimalRange": { exclusiveMinimum: "-0.002", exclusiveMaximum: "-0.001" },
				}),
				huge: bigint({
					"x-decimalRange": {
						exclusiveMinimum: "90071992547409930",
						exclusiveMaximum: "90071992547409933",
					},
				}),
			},
			required: ["fixed", "free", "tight", "huge"],
		};
		const defaults = getDefaults(narrow, { strategy: "all" }).value as Record<
			string,
			{ value: string }
		>;
		expect(defaults["fixed"]?.value).toBe("0.25");
		expect(defaults["free"]?.value).toBe("0.2");
		expect(defaults["tight"]?.value).toBe("1.235");
		expect(defaults["negative"]?.value).toBe("-0.0015");
		expect(defaults["huge"]?.value).toBe("90071992547409931");
		expect(validate(narrow, defaults).diagnostics).toEqual([]);
	});
});

describe("explicit 策略下的 JSON 文本默认值", () => {
	it("必须产出时按 contentSchema 递归补齐必填字段", () => {
		const schema: JsonSchema = {
			type: "string",
			contentMediaType: "application/json",
			contentSchema: {
				type: "object",
				properties: {
					size: { type: "integer", minimum: 1 },
					note: { type: "string" },
					inner: {
						type: "object",
						properties: {
							on: { type: "boolean" },
							tag: { type: "string", default: "x" },
						},
						required: ["on"],
					},
				},
				required: ["size", "inner"],
			},
		};
		// 公开入口在 explicit 下不会对无 default 的节点要求产出, 直接按必须产出调用 produce.
		const ctx = createProduceContext(schema, {
			...DEFAULT_DEFAULTS_OPTIONS,
			strategy: "explicit",
		});
		const produced = produce(ctx, schema, true, true);
		expect(produced).toEqual({ has: true, value: '{"size":1,"inner":{"on":false,"tag":"x"}}' });
		expect(validate(schema, produced.has ? produced.value : undefined).diagnostics).toEqual([]);
	});
});

describe("Mock 精确十进制区间", () => {
	const schema: JsonSchema = {
		type: "object",
		properties: {
			narrow: money("^-?\\d+\\.\\d{4}$", {
				"x-decimalRange": { exclusiveMinimum: "0.0001", exclusiveMaximum: "0.0004" },
			}),
			big: bigint({
				"x-decimalRange": {
					minimum: "123456789012345678901234567890",
					maximum: "123456789012345678901234567899",
				},
			}),
			wide: money("^-?\\d+\\.\\d{6}$", {
				"x-decimalRange": {
					minimum: "-99999999999.999999",
					exclusiveMaximum: "99999999999.999999",
				},
			}),
			upper: bigint({ "x-decimalRange": { exclusiveMaximum: "-9007199254740993" } }),
		},
		required: ["narrow", "big", "wide", "upper"],
	};

	it.each([1, 2, 3, 42, 2026])("seed %i 生成的数据通过校验", seed => {
		const result = mock(schema, { seed });
		expect(result.diagnostics).toEqual([]);
		expect(validate(schema, result.value).diagnostics).toEqual([]);
		const value = result.value as Record<string, { value: string }>;
		expect(["0.0002", "0.0003"]).toContain(value["narrow"]?.value);
		expect(value["big"]?.value).toMatch(/^12345678901234567890123456789\d$/);
	});
});
