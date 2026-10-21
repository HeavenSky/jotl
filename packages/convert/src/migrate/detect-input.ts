// 迁移输入的类型判定: 凤蝶源码, 凤蝶 toJson 产出的 umo JSON, 或常规 JSON Schema.
import { l10n } from "@jotl/core";
import { isKnownUmoType } from "./fengdie/to-schema.js";

export type MigrateInputKind = "fengdie" | "fengdie-json" | "json-schema";

export interface MigrateInputDetection {
	kind: MigrateInputKind;
	/** 判定依据, 面向使用者的短句, 语言取 `getLocale()`. */
	reason: string;
	/** kind 不是 fengdie 且 JSON 合法时为解析出的 JSON. */
	json?: unknown;
}

const JSON_SCHEMA_TYPES: ReadonlySet<string> = new Set([
	"string",
	"number",
	"integer",
	"boolean",
	"object",
	"array",
	"null",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 节点或其后代带 umo 特征时返回该特征的说明. */
function umoFeature(node: Record<string, unknown>, key: string | undefined): string | undefined {
	const type = node.type;
	if (typeof type !== "string") return undefined;
	if (key !== undefined && node.key === key)
		return l10n("字段带与属性名相同的 `key`", "a field has a `key` equal to its property name");
	if (!JSON_SCHEMA_TYPES.has(type) && isKnownUmoType(type))
		return l10n(`类型为凤蝶类型 \`${type}\``, `type is the Fengdie type \`${type}\``);
	if (
		type === "enum" &&
		Array.isArray(node.items) &&
		node.items.some(i => isRecord(i) && "label" in i && "value" in i)
	) {
		return l10n("枚举成员为 `{label, value}`", "enum members are `{label, value}`");
	}
	if (!isRecord(node.properties)) return undefined;
	for (const [name, child] of Object.entries(node.properties)) {
		if (!isRecord(child)) continue;
		const found = umoFeature(child, name);
		if (found !== undefined) return found;
	}
	return undefined;
}

/** JSON 是否是 umo JSON(单个 schema 或 export 多文档的 `{名字: schema}`); 是时返回判定依据. */
export function umoJsonFeature(value: unknown): string | undefined {
	if (!isRecord(value)) return undefined;
	if (typeof value.type === "string")
		return isRecord(value.properties) ? umoFeature(value, undefined) : undefined;
	const entries = Object.values(value);
	if (
		entries.length === 0 ||
		!entries.every(v => isRecord(v) && typeof v.type === "string" && isRecord(v.properties))
	)
		return undefined;
	for (const entry of entries) {
		const found = umoFeature(entry as Record<string, unknown>, undefined);
		if (found !== undefined) return found;
	}
	return undefined;
}

/**
 * 不以 `{` 或 `[` 开头 → 凤蝶源码(凤蝶源码总以关键字或注释开头); 否则按 JSON 解析: 带 umo 特征 → umo JSON, 其余 → 常规 JSON Schema.
 * JSON 语法错误时 kind 为 json-schema 且 json 为 undefined, 由调用方报告语法错误.
 */
export function detectMigrateInput(text: string): MigrateInputDetection {
	if (!/^\s*[{[]/.test(text))
		return {
			kind: "fengdie",
			reason: l10n(
				"不是 JSON 文本(不以 `{` 或 `[` 开头)",
				"not JSON text (does not start with `{` or `[`)"
			),
		};
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return {
			kind: "json-schema",
			reason: l10n(
				"以 `{` 或 `[` 开头, 但不是合法的 JSON",
				"starts with `{` or `[` but is not valid JSON"
			),
		};
	}
	const feature = umoJsonFeature(json);
	if (feature !== undefined) return { kind: "fengdie-json", reason: feature, json };
	return {
		kind: "json-schema",
		reason: l10n("是 JSON 且没有 umo JSON 特征", "is JSON without umo JSON features"),
		json,
	};
}
