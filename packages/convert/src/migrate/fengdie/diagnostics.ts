// 凤蝶迁移的诊断代码表(JOTL8xxx)与诊断参数中的记号名.
import { defineDiagnostics, getLocale, l10n } from "@jotl/core";

export const MIGRATE_DIAGNOSTICS = {
	JOTL8001: {
		severity: "error",
		message: "fengdie DSL schema 词法错误: 无法识别的文本 `{text}`",
		en: "fengdie DSL schema lexical error: unrecognized text `{text}`",
	},
	JOTL8002: {
		severity: "error",
		message: "fengdie DSL schema 语法错误: 此处应为 {expected}, 实际是 {actual}",
		en: "fengdie DSL schema syntax error: expected {expected} here, got {actual}",
	},
	JOTL8003: {
		severity: "error",
		message: "fengdie DSL schema 块注释缺少结束标记 `*/`",
		en: "fengdie DSL schema block comment is missing the closing `*/`",
	},
	JOTL8004: {
		severity: "error",
		message: "fengdie DSL schema 元数据字符串缺少结束引号",
		en: "fengdie DSL schema metadata string is missing the closing quote",
	},
	JOTL8005: {
		severity: "error",
		message: "fengdie DSL schema 说明缺少右括号 `)`",
		en: "fengdie DSL schema description is missing the closing parenthesis `)`",
	},
	JOTL8006: {
		severity: "error",
		message: "fengdie JSON schema 无法解析: {reason}",
		en: "Cannot parse fengdie JSON schema: {reason}",
	},
	JOTL8007: {
		severity: "error",
		message: "fengdie JSON schema 结构不合法: {reason}",
		en: "Invalid fengdie JSON schema structure: {reason}",
	},

	JOTL8105: {
		severity: "warning",
		message: "凤蝶元数据 `{key}` 不适用于类型 `{type}`(凤蝶编辑器同样丢弃), 已丢弃",
		en: "Fengdie metadata `{key}` does not apply to type `{type}` (the Fengdie editor drops it too); dropped",
	},
	JOTL8106: {
		severity: "warning",
		message: "凤蝶元数据 `{key}` 的取值不合法: {reason}, 已丢弃",
		en: "Invalid value for Fengdie metadata `{key}`: {reason}; dropped",
	},
	JOTL8107: {
		severity: "warning",
		message: "默认值 {value} 与类型 `{type}` 不符, 已转换为 {converted}",
		en: "Default value {value} does not match type `{type}`; converted to {converted}",
	},
	JOTL8108: {
		severity: "warning",
		message: "默认值 {value} 不满足类型 `{type}` 或其约束, 已丢弃",
		en: "Default value {value} does not satisfy type `{type}` or its constraints; dropped",
	},
	JOTL8109: {
		severity: "warning",
		message: "重复的字段 `{name}`: 按凤蝶规则后者覆盖前者, 位置取第一次出现处",
		en: "Duplicate field `{name}`: the later one overrides the earlier per Fengdie rules; position taken from the first occurrence",
	},
	JOTL8110: {
		severity: "warning",
		message: "重复的元数据 `{key}`: 按凤蝶规则后者覆盖前者",
		en: "Duplicate metadata `{key}`: the later one overrides the earlier per Fengdie rules",
	},
	JOTL8111: {
		severity: "warning",
		message: "未知的凤蝶类型 `{type}`, 按凤蝶规则视为 `string`",
		en: "Unknown Fengdie type `{type}`; treated as `string` per Fengdie rules",
	},
	JOTL8112: {
		severity: "warning",
		message: "枚举成员 `{name}` 上的{part}不属于枚举语义(凤蝶编辑器同样忽略), 已丢弃",
		en: "Enum member `{name}` has {part}, which has no enum semantics (the Fengdie editor ignores it too); dropped",
	},
	JOTL8113: {
		severity: "warning",
		message: "重复的枚举值 `{value}`, 已保留第一次出现的成员",
		en: "Duplicate enum value `{value}`; kept the first member",
	},
	JOTL8114: {
		severity: "warning",
		message: "枚举没有成员(成员可能由 `source` 元数据在运行时提供), 已迁移为字符串",
		en: "Enum has no members (they may be supplied at runtime by the `source` metadata); migrated as string",
	},
	JOTL8115: {
		severity: "warning",
		message: "`default` 与 `defaultValue` 同时出现, 已采用 `default`",
		en: "Both `default` and `defaultValue` are present; using `default`",
	},
	JOTL8116: {
		severity: "warning",
		message: "重复的导出名 `{name}`: 按凤蝶规则后者覆盖前者",
		en: "Duplicate export name `{name}`: the later one overrides the earlier per Fengdie rules",
	},
	JOTL8117: {
		severity: "warning",
		message: "导出名 `{name}` 不能用作 Jotl 类型名, 已改为 `{newName}`",
		en: "Export name `{name}` cannot be used as a Jotl type name; renamed to `{newName}`",
	},
	JOTL8118: {
		severity: "warning",
		message:
			"类型 `{type}` 没有元数据表(凤蝶编辑器的 toJson 在此处抛错), 元数据 `{key}` 已丢弃",
		en: "Type `{type}` has no metadata table (the Fengdie editor's toJson throws here); metadata `{key}` dropped",
	},
	JOTL8119: {
		severity: "warning",
		message:
			"正则标志 `{flag}` 无法安全改写进 pattern(Unicode 属性类, 反向引用, 内联修饰符, 不带 u 时以补充平面字符为端点的区间等), pattern 保持原样, 标志记入 x-fengdie.regExpFlags, 校验时区分大小写",
		en: "Regex flag `{flag}` cannot be safely rewritten into pattern (Unicode property classes, back-references, inline modifiers, or without u, ranges with a supplementary-plane endpoint); pattern kept as is, flag recorded in x-fengdie.regExpFlags, validation is case-sensitive",
	},
	JOTL8120: {
		severity: "warning",
		message:
			"正则标志 `{flag}` 在 pattern 中没有对应写法, 已记入 x-fengdie.regExpFlags, 校验时不生效",
		en: "Regex flag `{flag}` has no equivalent in pattern; recorded in x-fengdie.regExpFlags and not applied during validation",
	},
	JOTL8121: {
		severity: "warning",
		message:
			"凤蝶文档有多个导出, 而 Jotl 文件必须有根: 已取第一个导出 `{name}` 为根, 其余导出 {others} 保留为同一文件中的命名类型($defs)",
		en: "The Fengdie document has several exports, but a Jotl file must have a root: the first export `{name}` is used as the root, and the other exports {others} are kept as named types ($defs) in the same file",
	},
} as const;

export type MigrateDiagnosticCode = keyof typeof MIGRATE_DIAGNOSTICS;

export const migrateDiagnostic = defineDiagnostics(MIGRATE_DIAGNOSTICS);

/** JOTL8002 的 `{expected}` 与 `{actual}` 取值, 键为记号种类. */
export const TOKEN_LABELS = {
	LOTTERY: "`Lottery`",
	ARRAY: "`Array`",
	OBJECT: "`Object`",
	OPEN_ACTION: "`OpenAction`",
	ACTION: "`Action`",
	ENUM: "`Enum`",
	PUBLIC: "`public`",
	EXPORT: "`export`",
	SPM: "`Spm`",
	COLON: "`:`",
	START: "`{`",
	END: "`}`",
	TYPESTRING: "`<类型>`",
	METASTART: "`[`",
	METAEND: "`]`",
	METAVALUE_BOOL: "布尔值",
	METAVALUE_NUMBER: "数字",
	METAVALUE_STRING: "字符串",
	VAR: "名字",
	DOT: "`.`",
	STRING: "说明 `(...)`",
	EOF: "文件结尾",
} as const;

const TOKEN_LABELS_EN: Readonly<Record<keyof typeof TOKEN_LABELS, string>> = {
	...TOKEN_LABELS,
	TYPESTRING: "`<type>`",
	METAVALUE_BOOL: "boolean",
	METAVALUE_NUMBER: "number",
	METAVALUE_STRING: "string",
	VAR: "name",
	STRING: "description `(...)`",
	EOF: "end of file",
};

export function tokenLabel(kind: keyof typeof TOKEN_LABELS): string {
	return (getLocale() === "en" ? TOKEN_LABELS_EN : TOKEN_LABELS)[kind];
}

/** 拼接多个期望记号时的分隔符与 `{actual}` 的写法. */
export const EXPECTED_SEPARATOR = " 或 ";

export function expectedSeparator(): string {
	return l10n(EXPECTED_SEPARATOR, " or ");
}
export const ACTUAL_TEMPLATE = "`{text}`";

/** JOTL8106 与 JOTL8007 的 `{reason}` 取值. */
export const META_REASONS = {
	nonNegativeInteger: "应为非负整数",
	number: "应为数字",
	boolean: "应为布尔值",
	nonEmptyString: "应为非空字符串",
	invalidPattern: "不是合法的正则表达式",
	notAField: "不是数组元素的字段名",
	notObject: "应为对象",
	noType: "缺少字符串 `type`",
} as const;

const META_REASONS_EN: Readonly<Record<keyof typeof META_REASONS, string>> = {
	nonNegativeInteger: "should be a non-negative integer",
	number: "should be a number",
	boolean: "should be a boolean",
	nonEmptyString: "should be a non-empty string",
	invalidPattern: "is not a valid regular expression",
	notAField: "is not a field name of the array items",
	notObject: "should be an object",
	noType: "missing string `type`",
};

export function metaReason(key: keyof typeof META_REASONS): string {
	return (getLocale() === "en" ? META_REASONS_EN : META_REASONS)[key];
}

/** JOTL8112 的 `{part}` 取值. */
export const ENUM_MEMBER_PARTS = { type: "类型或子字段", meta: "元数据" } as const;

const ENUM_MEMBER_PARTS_EN: Readonly<Record<keyof typeof ENUM_MEMBER_PARTS, string>> = {
	type: "a type or child fields",
	meta: "metadata",
};

export function enumMemberPart(key: keyof typeof ENUM_MEMBER_PARTS): string {
	return (getLocale() === "en" ? ENUM_MEMBER_PARTS_EN : ENUM_MEMBER_PARTS)[key];
}
