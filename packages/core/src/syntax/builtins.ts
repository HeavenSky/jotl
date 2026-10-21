// 内置组件, 元数据键白名单与适用组件, 组件默认值与 money 币种表; 编译器, 打印器与语言服务共用.
import { isTimestampValueFormat, isValueFormatAlias } from "../schema/index.js";

/** 内置组件名(定稿 §5); 只在组件位置有含义. */
export const COMPONENT_NAMES = [
	"string",
	"text",
	"richtext",
	"number",
	"integer",
	"money",
	"bigint",
	"boolean",
	"enum",
	"date",
	"time",
	"datetime",
	"url",
	"email",
	"color",
	"image",
	"file",
	"object",
	"array",
	"map",
	"union",
	"any",
	"jsontext",
] as const;

export type ComponentName = (typeof COMPONENT_NAMES)[number];

const COMPONENT_SET: ReadonlySet<string> = new Set(COMPONENT_NAMES);

export function isComponentName(name: string): name is ComponentName {
	return COMPONENT_SET.has(name);
}

/** 保留给多文件的词, 写在组件位置报错. */
export const RESERVED_COMPONENT_WORDS: ReadonlySet<string> = new Set(["import", "export", "from"]);

/** 顶层类型名与扩展组件名: 大驼峰. */
export const TYPE_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;

export function isTypeName(name: string): boolean {
	return TYPE_NAME_RE.test(name);
}

/** 带 format 的字符串组件 → format; `date` `time` `datetime` 的形态由 `value_format` 决定, 见 `valueFormatSchema`. */
export const FORMAT_COMPONENTS: Readonly<Partial<Record<ComponentName, string>>> = {
	url: "uri",
	email: "email",
	color: "color",
	image: "uri",
	file: "uri",
};

/** 编译出的 schema 为字符串的组件. */
export const STRING_COMPONENTS: ReadonlySet<string> = new Set([
	"string",
	"text",
	"richtext",
	"date",
	"time",
	"datetime",
	"url",
	"email",
	"color",
	"image",
	"file",
	"jsontext",
]);

/** 组件自带的 `widget`; 与按数据形态选出的默认组件不同时写入 `x-ui.widget`(契约 C1). */
export const COMPONENT_WIDGETS: Readonly<Partial<Record<ComponentName, string>>> = {
	text: "textarea",
	image: "image",
	file: "file",
};

/** `thousands` 的默认值(定稿 §11): 与默认值不同时才写入 `x-ui.thousands`. */
export const THOUSANDS_DEFAULTS: Readonly<Partial<Record<ComponentName, boolean>>> = {
	number: false,
	integer: false,
	money: true,
	bigint: false,
};

export const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

/** 元数据可适用的对象: 内置组件名, `ref`(引用类型)与 `ext`(扩展组件). */
export type MetaTarget = ComponentName | "ref" | "ext";

export type MetaScope = "any" | readonly MetaTarget[];

export interface MetaKeyRule {
	/** 适用的组件; "any" 为任意组件(含引用与扩展组件). */
	targets: MetaScope;
	/** 只能写在根条目上. */
	rootOnly?: boolean;
}

const STRINGS: readonly MetaTarget[] = [...STRING_COMPONENTS] as ComponentName[];
const NUMERIC: readonly MetaTarget[] = ["number", "integer", "money", "bigint"];
const ITEMS: readonly MetaTarget[] = ["array", "enum", "ref"];
const PROPS: readonly MetaTarget[] = ["object", "map"];
/** 引用类型可带的元数据(定稿 §4 与假设 H2); `x_*` 与 `schema` 另行允许. */
const NOT_REF: readonly MetaTarget[] = [...COMPONENT_NAMES, "ext"];

/** 元数据键白名单(定稿 §10); `x_*` 自定义键不在表中, 另行判定. */
export const META_KEYS: Readonly<Record<string, MetaKeyRule>> = {
	description: { targets: "any" },
	default: { targets: "any" },
	examples: { targets: NOT_REF },
	deprecated: { targets: "any" },
	readOnly: { targets: "any" },
	writeOnly: { targets: NOT_REF },
	errorMessage: { targets: NOT_REF },
	comment: { targets: NOT_REF },
	minLength: { targets: STRINGS },
	maxLength: { targets: STRINGS },
	pattern: { targets: STRINGS },
	format: { targets: STRINGS },
	minimum: { targets: NUMERIC },
	maximum: { targets: NUMERIC },
	exclusiveMinimum: { targets: NUMERIC },
	exclusiveMaximum: { targets: NUMERIC },
	decimals: { targets: ["number", "money"] },
	minItems: { targets: ITEMS },
	maxItems: { targets: ITEMS },
	uniqueItems: { targets: ITEMS },
	minProperties: { targets: PROPS },
	maxProperties: { targets: PROPS },
	closed: { targets: ["object"] },
	nullable: { targets: "any" },
	multiple: { targets: ["enum", "ref"] },
	array_item: { targets: ["array"] },
	map_item: { targets: ["map"] },
	union_item: { targets: ["union"] },
	json_item: { targets: ["jsontext"] },
	item_meta: { targets: ["array", "map", "union", "jsontext"] },
	key_meta: { targets: ["map"] },
	discriminator: { targets: ["union"] },
	currency: { targets: ["money"] },
	unit: { targets: ["money"] },
	thousands: { targets: NUMERIC },
	value_format: { targets: ["date", "time", "datetime"] },
	widget: { targets: "any" },
	props: { targets: "any" },
	decorator: { targets: "any" },
	hidden: { targets: "any" },
	order: { targets: ["object"] },
	groups: { targets: ["object"] },
	layout: { targets: ["object"] },
	columns: { targets: ["object"] },
	summary: { targets: ["object", "array", "map", "ref"] },
	root_if: { targets: "any" },
	node_if: { targets: "any" },
	variants: { targets: "any" },
	rules: { targets: "any", rootOnly: true },
	id: { targets: "any", rootOnly: true },
	widgets: { targets: "any", rootOnly: true },
	schema: { targets: "any" },
};

/** 只能出现在文档根 `x-ui` 中的字段, 分别来自根条目的 `rules` `widgets` 与编译器写入的 `version`. */
export const ROOT_X_UI_KEYS: readonly string[] = ["version", "rules", "widgets"];

/** 元数据键名, 供补全使用; 不含 `x_*`. */
export const META_KEY_NAMES: readonly string[] = Object.keys(META_KEYS);

/** 元数据键 → 适用的组件; "any" 表示任意. */
export const META_KEY_TARGETS: Readonly<Record<string, MetaScope>> = Object.fromEntries(
	Object.entries(META_KEYS).map(([name, rule]) => [name, rule.targets])
);

/** 自定义元数据键 `x_*`: `x_` 后为小写字母, 数字与下划线组成的 snake 名. */
export const CUSTOM_META_KEY_RE = /^x_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

/** `x_biz_code` → `x-bizCode`. */
export function customMetaKeyword(key: string): string {
	const parts = key.slice(2).split("_");
	return `x-${parts[0]}${parts
		.slice(1)
		.map(p => p.charAt(0).toUpperCase() + p.slice(1))
		.join("")}`;
}

/** `x-bizCode` → `x_biz_code`; 不能还原为同一关键字时返回 undefined. */
export function customMetaKey(keyword: string): string | undefined {
	if (!keyword.startsWith("x-")) return undefined;
	const key = `x_${keyword.slice(2).replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)}`;
	return CUSTOM_META_KEY_RE.test(key) && customMetaKeyword(key) === keyword ? key : undefined;
}

/** 编译器自己生成的扩展关键字, `x_*` 不能写入. */
export const GENERATED_EXTENSION_KEYWORDS: ReadonlySet<string> = new Set([
	"x-ui",
	"x-deprecatedReason",
	"x-decimals",
	"x-decimalRange",
	"x-valueFormat",
]);

export function metaAppliesTo(key: string, target: MetaTarget): boolean {
	if (CUSTOM_META_KEY_RE.test(key)) return true;
	const rule = Object.hasOwn(META_KEYS, key) ? META_KEYS[key] : undefined;
	if (rule === undefined) return false;
	return rule.targets === "any" || rule.targets.includes(target);
}

/** `key_meta` 只接受的键. */
export const KEY_META_KEYS: readonly string[] = ["pattern", "minLength", "maxLength"];

/** `layout` 的取值, 必须与 `xUiMetaSchema` 中 `layout` 的枚举一致. */
export const LAYOUTS: readonly string[] = ["stack", "tabs", "grid"];

/** 条件叶子的 `op`(定稿 §12). */
export const CONDITION_OPS: readonly string[] = [
	"eq",
	"ne",
	"in",
	"not_in",
	"gt",
	"gte",
	"lt",
	"lte",
	"truthy",
	"falsy",
];

/** `errorMessage: {...}` 可用的键: `@jotl/data` 按这些关键字名报告错误并查找对应文案. */
export const ERROR_MESSAGE_KEYWORDS: ReadonlySet<string> = new Set([
	"type",
	"required",
	"dependentRequired",
	"const",
	"enum",
	"oneOf",
	"anyOf",
	"not",
	"format",
	"minLength",
	"maxLength",
	"pattern",
	"minimum",
	"maximum",
	"exclusiveMinimum",
	"exclusiveMaximum",
	"multipleOf",
	"minItems",
	"maxItems",
	"uniqueItems",
	"items",
	"contains",
	"unevaluatedItems",
	"minProperties",
	"maxProperties",
	"additionalProperties",
	"unevaluatedProperties",
	"propertyNames",
	"x-decimals",
	"x-decimalRange",
	"x-valueFormat",
	"contentSchema",
]);

/**
 * 日期组件按 `value_format` 编译出的数据形态(方案 V5); 打印器按同一规则反推, 两边必须一致.
 * `widget` 为 true 时必须写 `x-ui.widget`: 数据形态本身认不出组件.
 */
export function valueFormatSchema(
	component: "date" | "time" | "datetime",
	valueFormat: string
): { schema: Record<string, unknown>; widget: boolean } {
	if (component === "date" && valueFormat === "YYYY-MM-DD")
		return { schema: { type: "string", format: "date" }, widget: false };
	if (component === "datetime" && isValueFormatAlias(valueFormat)) {
		const schema: Record<string, unknown> = { type: "string", format: "date-time" };
		if (valueFormat !== "iso") schema["x-valueFormat"] = valueFormat;
		return { schema, widget: false };
	}
	if (isTimestampValueFormat(valueFormat)) {
		return {
			schema: {
				type: "integer",
				minimum: -MAX_SAFE_INTEGER,
				maximum: MAX_SAFE_INTEGER,
				"x-valueFormat": valueFormat,
			},
			widget: true,
		};
	}
	return { schema: { type: "string", "x-valueFormat": valueFormat }, widget: true };
}

/** ISO 4217 小数位数; 不在表中的币种按 "不限" 处理. */
export const CURRENCY_DIGITS: Readonly<Record<string, number>> = {
	AED: 2,
	AUD: 2,
	BHD: 3,
	BRL: 2,
	CAD: 2,
	CHF: 2,
	CLP: 0,
	CNY: 2,
	DKK: 2,
	EUR: 2,
	GBP: 2,
	HKD: 2,
	IDR: 2,
	ILS: 2,
	INR: 2,
	ISK: 0,
	JOD: 3,
	JPY: 0,
	KRW: 0,
	KWD: 3,
	MOP: 2,
	MXN: 2,
	MYR: 2,
	NOK: 2,
	NZD: 2,
	OMR: 3,
	PHP: 2,
	PLN: 2,
	RUB: 2,
	SAR: 2,
	SEK: 2,
	SGD: 2,
	THB: 2,
	TND: 3,
	TRY: 2,
	TWD: 2,
	UGX: 0,
	USD: 2,
	VND: 0,
	XAF: 0,
	XOF: 0,
	ZAR: 2,
};

/** 精确数字符串(定稿 §11). */
export const EXACT_DECIMAL_RE = /^-?\d+(\.\d+)?$/;
