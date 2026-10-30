// fengdie JSON schema 的类型与凤蝶编辑器 0.0.8 的数据表: 支持的类型(`lib/types.js` supported), 各类型的元数据白名单, 自定义元数据规则.
import { getLocale } from "@jotl/core";

export type FengdieJsonMetaValue = string | number | boolean;

export interface FengdieJsonEnumItem {
	label: string;
	value: string;
}

/** toJson 产出的节点; 根节点没有 key, 可带 lottery / public; 枚举带 items, 对象与数组带 properties. */
export interface FengdieJsonNode {
	key?: string;
	type: string;
	description: string;
	properties?: Record<string, FengdieJsonNode>;
	items?: FengdieJsonEnumItem[];
	meta?: Record<string, FengdieJsonMetaValue>;
	lottery?: boolean;
	public?: boolean;
}

/** 单个 schema, 或 `export` 多文档时的 `{名字: schema}`. */
export type FengdieJson = FengdieJsonNode | Record<string, FengdieJsonNode>;

/** 小写比较; 不在表中的叶子类型按 `string` 处理. */
export const FENGDIE_JSON_TYPES: ReadonlySet<string> = new Set([
	"string",
	"image",
	"number",
	"date",
	"url",
	"boolean",
	"richtext",
	"text",
	"color",
	"enum",
	"component",
	"box",
	"file",
	"resource",
	"plugin",
	"action",
	"openaction",
	"arraystring",
	"arraynumber",
	"animation",
	"video",
]);

export const FENGDIE_JSON_DEFAULT_TYPE = "string";

/** 各类型允许的元数据; 键按类型原文(区分大小写)查找, 查不到时 toJson 抛错. */
export const FENGDIE_JSON_META_KEYS: Readonly<Record<string, readonly string[]>> = {
	array: [
		"minLength",
		"maxLength",
		"rule",
		"sourceType",
		"reuseable",
		"showKey",
		"if",
		"autoFetch",
		"entityType",
		"mappingRuleId",
		"defaultSourceType",
		"group",
		"ucdp",
		"spmC",
		"spmD",
		"description",
	],
	object: [
		"rule",
		"reuseable",
		"if",
		"autoFetch",
		"entityType",
		"mappingRuleId",
		"defaultSourceType",
		"group",
		"configId",
		"crossApp",
		"ucdp",
		"spmC",
		"spmD",
		"description",
	],
	string: [
		"minLength",
		"maxLength",
		"regExp",
		"errorMsg",
		"rule",
		"default",
		"defaultValue",
		"description",
		"if",
		"placeholder",
		"group",
		"i18n",
		"required",
	],
	image: [
		"width",
		"height",
		"maxWidth",
		"maxHeight",
		"regExp",
		"errorMsg",
		"rule",
		"default",
		"defaultValue",
		"group",
		"setDefaultColorTo",
		"description",
		"if",
		"maxSize",
		"aspectRatio",
		"i18n",
		"required",
	],
	number: [
		"step",
		"min",
		"max",
		"rule",
		"default",
		"defaultValue",
		"description",
		"if",
		"group",
		"i18n",
		"required",
	],
	boolean: ["rule", "default", "defaultValue", "description", "if", "group", "i18n", "required"],
	url: [
		"regExp",
		"errorMsg",
		"rule",
		"default",
		"defaultValue",
		"description",
		"if",
		"placeholder",
		"group",
		"i18n",
		"required",
	],
	text: [
		"regExp",
		"errorMsg",
		"rule",
		"default",
		"defaultValue",
		"description",
		"if",
		"placeholder",
		"group",
		"i18n",
		"required",
	],
	richtext: [
		"rule",
		"default",
		"defaultValue",
		"description",
		"if",
		"placeholder",
		"group",
		"i18n",
		"required",
	],
	color: ["rule", "default", "defaultValue", "description", "if", "group", "i18n", "required"],
	enum: [
		"rule",
		"default",
		"defaultValue",
		"description",
		"source",
		"if",
		"multiple",
		"searchType",
		"group",
		"i18n",
		"required",
	],
	box: ["group", "required"],
	file: ["rule", "default", "defaultValue", "description", "if", "group", "i18n", "required"],
	date: ["rule", "default", "defaultValue", "description", "if", "group", "i18n", "required"],
	resource: ["default", "defaultValue", "description", "if", "type", "group", "required"],
	plugin: ["type", "description", "if", "default", "defaultValue", "group", "required"],
	module: ["namespace", "component", "version", "url", "group", "required", "dist"],
	modulearray: ["namespace", "component", "version", "url", "group", "required", "dist"],
	animation: ["targetType", "width", "height", "description", "if", "group", "i18n", "required"],
	video: ["maxSize", "maxDuration", "height", "description", "if", "group", "i18n", "required"],
	action: ["if", "group", "required"],
	openAction: ["if", "group", "required"],
};

/** 白名单外仍保留的自定义元数据. */
export const FENGDIE_JSON_CUSTOM_META_RE = /^custom[A-Z](\S*)$/;

/** toJson 给带元数据的 module / modulearray 补上的 `dist`. */
export const FENGDIE_JSON_MODULE_DIST = "https://alipay.com";

export function fengdieJsonMetaKeys(type: string): readonly string[] | undefined {
	return Object.hasOwn(FENGDIE_JSON_META_KEYS, type) ? FENGDIE_JSON_META_KEYS[type] : undefined;
}

/** 第一层字段 `group` 的取值与分组标题. */
export const FENGDIE_JSON_GROUP_TITLES: Readonly<Record<string, string>> = {
	normal: "常规",
	advance: "高级",
	developer: "开发者",
	operator: "运营",
};

const FENGDIE_JSON_GROUP_TITLES_EN: Readonly<Record<string, string>> = {
	normal: "General",
	advance: "Advanced",
	developer: "Developer",
	operator: "Operations",
};

/** 分组标题按当前语言取; 未知分组原样返回. */
export function fengdieJsonGroupTitle(group: string): string {
	const titles = getLocale() === "en" ? FENGDIE_JSON_GROUP_TITLES_EN : FENGDIE_JSON_GROUP_TITLES;
	return Object.hasOwn(titles, group) ? titles[group]! : group;
}
