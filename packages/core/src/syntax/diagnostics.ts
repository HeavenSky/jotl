// syntax/ 的诊断代码表(JOTL1xxx); 代码一旦发布不复用, 删除的代码留空位.
import { type Diagnostic, defineDiagnostics, formatMessage, getLocale } from "../schema/index.js";

export const SYNTAX_DIAGNOSTICS = {
	JOTL1001: { severity: "error", message: "非法字符 `{char}`", en: "Invalid character `{char}`" },
	JOTL1002: {
		severity: "error",
		message: "此处应为{expected}, 实际是 `{actual}`",
		en: "Expected {expected} here, found `{actual}`",
	},
	JOTL1003: {
		severity: "error",
		message: "缺少右括号 `{bracket}`",
		en: "Missing closing bracket `{bracket}`",
	},
	JOTL1004: { severity: "error", message: "未知组件 `{name}`", en: "Unknown component `{name}`" },
	JOTL1005: { severity: "error", message: "重复的键 `{name}`", en: "Duplicate key `{name}`" },
	JOTL1006: {
		severity: "error",
		message: "`{name}` 既不是本文件声明的类型, 也不是已登记的扩展组件",
		en: "`{name}` is neither a type declared in this file nor a registered extension component",
	},
	JOTL1007: {
		severity: "error",
		message: "元数据 `{key}` 不适用于组件 `{component}`",
		en: "Metadata `{key}` does not apply to component `{component}`",
	},
	JOTL1008: {
		severity: "error",
		message: "默认值违反约束: {reason}",
		en: "Default value violates constraints: {reason}",
	},
	JOTL1011: {
		severity: "error",
		message: "未知元数据键 `{name}`",
		en: "Unknown metadata key `{name}`",
	},
	JOTL1012: {
		severity: "error",
		message: "元数据 `{name}` 不能用在这里: {reason}",
		en: "Metadata `{name}` cannot be used here: {reason}",
	},
	JOTL1014: {
		severity: "error",
		message: "`{name}` 保留给多文件 import, 暂不支持",
		en: "`{name}` is reserved for multi-file import and not supported yet",
	},
	JOTL1015: {
		severity: "error",
		message: "重复的类型名 `{name}`",
		en: "Duplicate type name `{name}`",
	},
	JOTL1016: {
		severity: "warning",
		message: "`schema` 覆盖了已生成的关键字 `{keyword}`",
		en: "`schema` overrides the generated keyword `{keyword}`",
	},
	JOTL1017: { severity: "error", message: "x-ui 不合法: {reason}", en: "Invalid x-ui: {reason}" },
	JOTL1018: { severity: "error", message: "字符串缺少结束引号", en: "Unterminated string" },
	JOTL1019: {
		severity: "error",
		message: "块注释缺少结束标记 `*/`",
		en: "Unterminated block comment, missing `*/`",
	},
	JOTL1020: {
		severity: "error",
		message: "元数据取值不合法: {reason}",
		en: "Invalid metadata value: {reason}",
	},
	JOTL1022: {
		severity: "error",
		message: "字符串内容不合法: {reason}",
		en: "Invalid string content: {reason}",
	},
	JOTL1023: {
		severity: "error",
		message: "数字 `{text}` 的写法不合法",
		en: "Invalid number literal `{text}`",
	},
	JOTL1024: {
		severity: "error",
		message: "重复的枚举值 `{value}`",
		en: "Duplicate enum value `{value}`",
	},
	JOTL1025: {
		severity: "error",
		message: "枚举至少需要一个成员",
		en: "An enum needs at least one member",
	},
	JOTL1026: { severity: "error", message: "标签不能为空", en: "Label cannot be empty" },
	JOTL1028: {
		severity: "error",
		message: "类型名 `{name}` 与扩展组件重名",
		en: "Type name `{name}` conflicts with an extension component",
	},
	JOTL1029: {
		severity: "error",
		message: "嵌套层数超过上限 {max}",
		en: "Nesting depth exceeds the limit of {max}",
	},
	JOTL1030: {
		severity: "error",
		message: "要打印的输入不是 JSON Schema: 应为对象或布尔值",
		en: "Input to print is not a JSON Schema: expected an object or a boolean",
	},
	JOTL1031: {
		severity: "error",
		message: "位置 `{path}` 的值不是合法的 JSON",
		en: "Value at `{path}` is not valid JSON",
	},
	JOTL1032: {
		severity: "warning",
		message: "关键字 `{keyword}` 无法用 Jotl 表达, 已忽略",
		en: "Keyword `{keyword}` cannot be expressed in Jotl and was ignored",
	},
	JOTL1033: {
		severity: "warning",
		message: "布尔 schema 无法直接表达, 已按等价的对象形式打印",
		en: "Boolean schema cannot be expressed directly; printed as the equivalent object form",
	},
	JOTL1034: {
		severity: "warning",
		message: "`{name}` 不能用作 Jotl 类型名, 已改为 `{newName}`",
		en: "`{name}` cannot be used as a Jotl type name; renamed to `{newName}`",
	},
	JOTL1035: {
		severity: "error",
		message: "根类型名 `{name}` 不合法: 应为大驼峰标识符",
		en: "Invalid root type name `{name}`: expected an UpperCamelCase identifier",
	},
	JOTL1036: {
		severity: "error",
		message: "顶层只能声明类型, 类型名应为大驼峰; 根的属性写进根类型的体里",
		en: "Only types can be declared at the top level and type names must be UpperCamelCase; put root properties in the body of the root type",
	},
	JOTL1037: {
		severity: "error",
		message: "顶层类型不能写 `?`",
		en: "Top-level types cannot have `?`",
	},
	JOTL1038: {
		severity: "error",
		message: "标识 `{marker}` 只能写在顶层条目之前",
		en: "Marker `{marker}` can only appear before a top-level entry",
	},
	JOTL1039: {
		severity: "error",
		message: "标识 `{marker}` 在文件中只能出现一次",
		en: "Marker `{marker}` can only appear once per file",
	},
	JOTL1040: {
		severity: "error",
		message: "键后有内容时必须写 `:`",
		en: "A `:` is required when content follows the key",
	},
	JOTL1041: {
		severity: "error",
		message: "组件 `{component}` 在此写法下不能带体",
		en: "Component `{component}` cannot have a body in this form",
	},
	JOTL1042: {
		severity: "error",
		message: "类型串 `{text}` 不合法: {reason}",
		en: "Invalid type string `{text}`: {reason}",
	},
	JOTL1043: {
		severity: "error",
		message:
			"按 JSON 类型区分的联合中有多个 {type} 分支; 请改用可区分联合 `union[discriminator: ...]`",
		en: "Union distinguished by JSON type has multiple {type} branches; use a discriminated union `union[discriminator: ...]` instead",
	},
	JOTL1044: {
		severity: "error",
		message: "引用类型 `{name}` 不能带体; 要改结构请另声明类型",
		en: "Reference type `{name}` cannot have a body; declare a new type to change its structure",
	},
	JOTL1045: {
		severity: "warning",
		message: "widget `{widget}` 不接受该数据形态, 已降级为默认 widget",
		en: "widget `{widget}` does not accept this data shape; fell back to the default widget",
	},
	JOTL1046: {
		severity: "error",
		message: "体中的条目不合法: {reason}",
		en: "Invalid entry in body: {reason}",
	},
	JOTL1047: {
		severity: "error",
		message: "组件 `{component}` 的写法不完整: {reason}",
		en: "Incomplete use of component `{component}`: {reason}",
	},
	JOTL1048: {
		severity: "warning",
		message: "`format` 覆盖了组件自带的格式 `{format}`",
		en: "`format` overrides the component's own format `{format}`",
	},
	JOTL1049: {
		severity: "warning",
		message: "`summary` 只对元素为对象的 `array` / `map` 生效, 此处元素不是对象",
		en: "`summary` only applies to `array` / `map` whose elements are objects; elements here are not objects",
	},
	JOTL1050: {
		severity: "warning",
		message: "`schema` 写入的 x-ui 不合法, 已原样写入: {reason}",
		en: "x-ui written by `schema` is invalid and was kept as is: {reason}",
	},
	JOTL1051: {
		severity: "warning",
		message: "`defaultExport` 指定的 `{name}` 不是 `$defs` 的键, 已忽略",
		en: "`{name}` given as `defaultExport` is not a key of `$defs` and was ignored",
	},
	JOTL1052: {
		severity: "warning",
		message: "widget `{widget}` 声明的底层类型 `{base}` 与字段类型 `{type}` 不兼容",
		en: "widget `{widget}` is declared with base type `{base}`, which is incompatible with field type `{type}`",
	},
	JOTL1053: {
		severity: "error",
		message:
			"`value_format` 中的记号 `{token}` 无法按格式往返: dayjs 不能用它解析回取值, 运行期跳过该格式的校验",
		en: "Token `{token}` in `value_format` cannot round-trip: dayjs cannot parse values back with it, and runtime validation skips this format",
	},
} as const;

export type SyntaxDiagnosticCode = keyof typeof SYNTAX_DIAGNOSTICS;

export const syntaxDiagnostic = defineDiagnostics(SYNTAX_DIAGNOSTICS);

/** JOTL1002 的 `{expected}` 与 `{actual}` 取值. */
export const SYNTAX_EXPECTED = {
	entry: "条目(类型名或字段键)",
	content: "组件, 元数据 `[...]` 或体 `{...}`",
	value: "值",
	objectKey: "键",
	colon: "`:`",
	separator: "`,` 或 `{closer}`",
	closeBrace: "`}`",
	endOfFile: "文件结尾",
} as const;

export const SYNTAX_EXPECTED_EN: Readonly<Record<keyof typeof SYNTAX_EXPECTED, string>> = {
	entry: "an entry (type name or field key)",
	content: "a component, metadata `[...]` or a body `{...}`",
	value: "a value",
	objectKey: "a key",
	colon: "`:`",
	separator: "`,` or `{closer}`",
	closeBrace: "`}`",
	endOfFile: "end of file",
};

/** 按当前语言取 JOTL1002 的 `{expected}` / `{actual}` 文案. */
export function syntaxExpected(
	key: keyof typeof SYNTAX_EXPECTED,
	params?: Readonly<Record<string, string | number>>
): string {
	return formatMessage(
		getLocale() === "en" ? SYNTAX_EXPECTED_EN[key] : SYNTAX_EXPECTED[key],
		params
	);
}

/** 各代码 `{reason}` 参数的文案模板. */
export const SYNTAX_REASONS = {
	expectString: "`{name}` 应为字符串",
	expectNonEmptyString: "`{name}` 应为非空字符串",
	expectStringOrFalse: "`{name}` 应为字符串或 `false`",
	expectStringArray: "`{name}` 应为字符串数组",
	expectArray: "`{name}` 应为数组",
	expectObject: "`{name}` 应为对象",
	expectTrueOrString: "`{name}` 应为 `true` 或原因字符串",
	nonNegativeInteger: "`{name}` 应为非负整数",
	number: "`{name}` 应为数字",
	boolean: "`{name}` 应为 `true` 或 `false`",
	decimalString: "`{name}` 应为精确数字字符串, 如 `'0'` `'12.5'`",
	currency: "`currency` 应为 ISO 4217 币种代码或其非空数组",
	unit: "`unit` 应为非空字符串或其非空数组",
	invalidPattern: "`pattern` 不是合法的正则表达式",
	timeTimestamp: "`time` 的 `value_format` 不能是时间戳 `x` `X`",
	rangeConflict: "`{min}` 大于 `{max}`",
	invalidEscape: "转义序列 `{escape}` 不合法",
	controlCharacter: "字符串中不能直接出现控制字符, 请写成转义序列",
	typeMismatch: "类型应为 {expected}",
	keywordViolation: "不满足 `{keyword}: {limit}`",
	notInEnum: "取值不在可选值中",
	missingRequired: "缺少必填字段 `{name}`",
	additionalProperty: "不允许出现字段 `{name}`",
	noMatchingBranch: "不匹配任何可选类型",
	multipleMatchingBranches: "同时匹配多个可选类型",
	matchesNot: "满足了 `not` 排除的 schema",
	duplicateItems: "数组元素重复",
	invalidJsonText: "不是合法的 JSON 文本",
	atPath: "位置 `{path}`: {detail}",
	rootOnly: "只能写在根条目上",
	closedOnly: "只能用于对象体",
	reservedSchemaKeyword: "`schema` 不能写入 `{keyword}`",
	reservedCustomKey: "`{name}` 对应的关键字由编译器生成, 不能自定义",
	needsMultiple: "只能与 `multiple: true` 一起写",
	multipleNeedsEnum: "`multiple` 只能用于枚举或指向枚举的类型",
	invalidFileId: "`id` 应为非空且不含 `#` 与空白的 URI",
	expectStringOrObject: "`errorMessage` 应为字符串或对象",
	emptyErrorMessage: "错误文案不能为空",
	emptyErrorMessageMap: "按关键字映射的错误文案至少要有一项",
	unknownErrorKeyword: "`{name}` 不是会产生校验错误的关键字",
	errorMessageValue: "关键字 `{name}` 的错误文案应为非空字符串",
	emptyWidget: "widget 名不能为空",
	emptyDecorator: "外壳 widget 名不能为空; 不要外壳时写 `false`",
	unknownOrderField: "`order` 中的字段 `{name}` 不存在",
	duplicateOrderField: "`order` 中的字段 `{name}` 重复",
	unknownGroupField: "分组 `{group}` 中的字段 `{name}` 不存在",
	duplicateGroupField: "字段 `{name}` 出现在多个分组中或在分组中重复",
	invalidGroups: "`groups` 应为 `[{title, fields}]`",
	unknownSummaryField: "`summary` 中的字段 `{name}` 不存在",
	invalidLayout: "`layout` 应为 `stack` `tabs` `grid` 之一",
	columnsNeedGrid: "`columns` 只能与 `layout: 'grid'` 一起写",
	invalidColumns: "`columns` 应为不小于 1 的整数",
	invalidCondition: "条件不合法: {detail}",
	invalidPath: "路径 `{path}` 不合法",
	nodePathRootPrefix: "`node_if` 的路径相对当前节点, 不能以 `$.` 开头; 从根取值请用 `root_if`",
	invalidRules: "`rules` 不合法: {detail}",
	emptyScene: "场景名不能为空",
	invalidVariant: "场景 `{scene}` 的覆盖对象不合法: {detail}",
	variantObjectOnly: "场景 `{scene}` 中的 `{key}` 只能用于对象",
	unknownVariantOrderField: "场景 `{scene}` 的 `order` 中的字段 `{name}` 不存在或重复",
	unknownVariantGroupField: "场景 `{scene}` 的分组 `{group}` 中的字段 `{name}` 不存在",
	emptyTypeString: "名字不能为空",
	nullInTypeString: "不能含 `null`, 可空请写 `nullable: true`",
	enumInTypeString: "不能含 `enum`, 多选请写 `multiple: true`",
	tupleInTypeString: "`tuple` 只能单独写在 `array_item` 中",
	duplicateTypeName: "名字 `{name}` 重复",
	unionNeedsTwo: "`union_item` 至少需要两个名字",
	itemMetaKey: "`item_meta` 的键 `{name}` 不在类型串中",
	itemMetaShape: "类型串含多个名字时 `item_meta` 应按名字分键",
	keyMetaKey: "`key_meta` 只接受 `pattern` `minLength` `maxLength`",
	unionMode: "需要 `discriminator`(可区分联合)或 `union_item`(按 JSON 类型区分)之一",
	unionBothModes: "`discriminator` 与 `union_item` 不能同时写",
	unionNoBranch: "可区分联合至少需要一个分支",
	itemMetaNeedsType: "只能与类型串或体一起写",
	enumMemberForm: "枚举成员不能写 `?` 或 `:`; 说明写在成员后的 `[description: ...]`",
	enumMemberMeta: "枚举成员的元数据只能含 `description`",
	enumNullMember:
		"枚举成员不能是 `null`; 可空请写 `nullable: true`, 字符串 `\"null\"` 请写 `'null'`",
	numberKey: "数字键只能是非负整数",
	starKey: "`*` 只能用作元组的其余元素或普通字段键",
	tuplePosition: "元组位置应从 `0` 起连续编号, 实际是 `{key}`",
	tupleStar: "元组只能有一个 `*`, 且不能写 `?`",
	tupleOptional: "`?` 只能写在末尾连续的位置上",
	tupleNoBody: "`array_item: 'tuple'` 需要位置条目体",
	branchForm: "union 分支不能写 `?`, 且必须写 `:` 与对象体或对象类型引用",
	branchDiscriminator: "分支里不写区分字段 `{name}`, 它由编译器补上",
	branchNotObject: "分支 `{name}` 的内容应为对象体或对象类型引用",
	duplicateBranch: "分支值 `{value}` 重复",
	missingContent: "`:` 后缺少内容",
	widgetsNotObject: "`widgets` 应为对象: 名字 → 底层类型或模块声明",
	widgetBadType:
		"`{name}` 的底层类型必须是 JSON Schema 基本类型名, 无体的 Jotl 内置组件名, schema 对象或模块声明 `{base?, module, export?}`",
	widgetUnknownType:
		"`{name}` 的底层类型 `{type}` 不是 JSON Schema 基本类型名或无体的 Jotl 内置组件名",
	widgetBase: "`{name}` 的 `base` 应为底层类型名或 schema 对象",
	widgetModule: "`{name}` 的 `module` 应为非空字符串",
	widgetExport: "`{name}` 的 `export` 应为非空字符串",
	widgetModuleKey: "`{name}` 的模块声明只能含 `base` `module` `export`, 不能有 `{key}`",
} as const;

export type SyntaxReason = keyof typeof SYNTAX_REASONS;

export const SYNTAX_REASONS_EN: Readonly<Record<SyntaxReason, string>> = {
	expectString: "`{name}` must be a string",
	expectNonEmptyString: "`{name}` must be a non-empty string",
	expectStringOrFalse: "`{name}` must be a string or `false`",
	expectStringArray: "`{name}` must be an array of strings",
	expectArray: "`{name}` must be an array",
	expectObject: "`{name}` must be an object",
	expectTrueOrString: "`{name}` must be `true` or a reason string",
	nonNegativeInteger: "`{name}` must be a non-negative integer",
	number: "`{name}` must be a number",
	boolean: "`{name}` must be `true` or `false`",
	decimalString: "`{name}` must be an exact decimal string, such as `'0'` `'12.5'`",
	currency: "`currency` must be an ISO 4217 currency code or a non-empty array of them",
	unit: "`unit` must be a non-empty string or a non-empty array of them",
	invalidPattern: "`pattern` is not a valid regular expression",
	timeTimestamp: "`value_format` of `time` cannot be a timestamp `x` `X`",
	rangeConflict: "`{min}` is greater than `{max}`",
	invalidEscape: "Invalid escape sequence `{escape}`",
	controlCharacter:
		"Control characters cannot appear directly in strings; use an escape sequence",
	typeMismatch: "type must be {expected}",
	keywordViolation: "does not satisfy `{keyword}: {limit}`",
	notInEnum: "value is not one of the allowed values",
	missingRequired: "missing required field `{name}`",
	additionalProperty: "field `{name}` is not allowed",
	noMatchingBranch: "matches none of the alternatives",
	multipleMatchingBranches: "matches more than one alternative",
	matchesNot: "matches the schema excluded by `not`",
	duplicateItems: "array items are not unique",
	invalidJsonText: "not valid JSON text",
	atPath: "at `{path}`: {detail}",
	rootOnly: "only allowed on the root entry",
	closedOnly: "only allowed on object bodies",
	reservedSchemaKeyword: "`schema` cannot write `{keyword}`",
	reservedCustomKey:
		"the keyword for `{name}` is generated by the compiler and cannot be customized",
	needsMultiple: "only allowed together with `multiple: true`",
	multipleNeedsEnum: "`multiple` only applies to enums or types referring to an enum",
	invalidFileId: "`id` must be a non-empty URI without `#` or whitespace",
	expectStringOrObject: "`errorMessage` must be a string or an object",
	emptyErrorMessage: "error message cannot be empty",
	emptyErrorMessageMap: "an error message map needs at least one entry",
	unknownErrorKeyword: "`{name}` is not a keyword that produces validation errors",
	errorMessageValue: "error message for keyword `{name}` must be a non-empty string",
	emptyWidget: "widget name cannot be empty",
	emptyDecorator: "decorator widget name cannot be empty; write `false` for no decorator",
	unknownOrderField: "field `{name}` in `order` does not exist",
	duplicateOrderField: "field `{name}` is repeated in `order`",
	unknownGroupField: "field `{name}` in group `{group}` does not exist",
	duplicateGroupField: "field `{name}` appears in more than one group or is repeated in a group",
	invalidGroups: "`groups` must be `[{title, fields}]`",
	unknownSummaryField: "field `{name}` in `summary` does not exist",
	invalidLayout: "`layout` must be one of `stack` `tabs` `grid`",
	columnsNeedGrid: "`columns` is only allowed together with `layout: 'grid'`",
	invalidColumns: "`columns` must be an integer not less than 1",
	invalidCondition: "invalid condition: {detail}",
	invalidPath: "invalid path `{path}`",
	nodePathRootPrefix:
		"paths in `node_if` are relative to the current node and cannot start with `$.`; use `root_if` to read from the root",
	invalidRules: "invalid `rules`: {detail}",
	emptyScene: "scene name cannot be empty",
	invalidVariant: "invalid override object for scene `{scene}`: {detail}",
	variantObjectOnly: "`{key}` in scene `{scene}` only applies to objects",
	unknownVariantOrderField:
		"field `{name}` in `order` of scene `{scene}` does not exist or is repeated",
	unknownVariantGroupField: "field `{name}` in group `{group}` of scene `{scene}` does not exist",
	emptyTypeString: "names cannot be empty",
	nullInTypeString: "cannot contain `null`; write `nullable: true` for nullable values",
	enumInTypeString: "cannot contain `enum`; write `multiple: true` for multi-select",
	tupleInTypeString: "`tuple` can only appear alone in `array_item`",
	duplicateTypeName: "name `{name}` is repeated",
	unionNeedsTwo: "`union_item` needs at least two names",
	itemMetaKey: "key `{name}` of `item_meta` is not in the type string",
	itemMetaShape: "when the type string has several names, `item_meta` must be keyed by name",
	keyMetaKey: "`key_meta` only accepts `pattern` `minLength` `maxLength`",
	unionMode:
		"needs either `discriminator` (discriminated union) or `union_item` (distinguished by JSON type)",
	unionBothModes: "`discriminator` and `union_item` cannot be used together",
	unionNoBranch: "a discriminated union needs at least one branch",
	itemMetaNeedsType: "only allowed together with a type string or a body",
	enumMemberForm:
		"enum members cannot have `?` or `:`; write descriptions as `[description: ...]` after the member",
	enumMemberMeta: "enum member metadata can only contain `description`",
	enumNullMember:
		"enum members cannot be `null`; write `nullable: true` for nullable values, or `'null'` for the string \"null\"",
	numberKey: "numeric keys must be non-negative integers",
	starKey: "`*` can only be used as the rest element of a tuple or as a normal field key",
	tuplePosition: "tuple positions must be numbered consecutively from `0`, found `{key}`",
	tupleStar: "a tuple can have only one `*`, and it cannot have `?`",
	tupleOptional: "`?` can only appear on trailing consecutive positions",
	tupleNoBody: "`array_item: 'tuple'` needs a body of position entries",
	branchForm:
		"union branches cannot have `?` and must have `:` followed by an object body or an object type reference",
	branchDiscriminator:
		"do not write the discriminator field `{name}` in branches; the compiler adds it",
	branchNotObject:
		"content of branch `{name}` must be an object body or an object type reference",
	duplicateBranch: "duplicate branch value `{value}`",
	missingContent: "missing content after `:`",
	widgetsNotObject: "`widgets` must be an object: name → base type or module declaration",
	widgetBadType:
		"base type of `{name}` must be a JSON Schema primitive type name, a body-less Jotl built-in component name, a schema object, or a module declaration `{base?, module, export?}`",
	widgetUnknownType:
		"base type `{type}` of `{name}` is not a JSON Schema primitive type name or a body-less Jotl built-in component name",
	widgetBase: "`base` of `{name}` must be a base type name or a schema object",
	widgetModule: "`module` of `{name}` must be a non-empty string",
	widgetExport: "`export` of `{name}` must be a non-empty string",
	widgetModuleKey:
		"module declaration of `{name}` can only contain `base` `module` `export`, not `{key}`",
};

/** 按当前语言取 `{reason}` 文案. */
export function syntaxReason(
	key: SyntaxReason,
	params?: Readonly<Record<string, string | number>>
): string {
	return formatMessage(
		getLocale() === "en" ? SYNTAX_REASONS_EN[key] : SYNTAX_REASONS[key],
		params
	);
}

/** 修复建议的标题. */
export const SYNTAX_FIX_TITLES = {
	escapeBackslash: "改为 `\\\\`",
	wrapInRoot: "包进 `Root(根): {...}` 并标 `<root/>`",
} as const;

export const SYNTAX_FIX_TITLES_EN: Readonly<Record<keyof typeof SYNTAX_FIX_TITLES, string>> = {
	escapeBackslash: "Change to `\\\\`",
	wrapInRoot: "Wrap in `Root: {...}` and mark `<root/>`",
};

/** 按当前语言取修复建议的标题. */
export function syntaxFixTitle(key: keyof typeof SYNTAX_FIX_TITLES): string {
	return getLocale() === "en" ? SYNTAX_FIX_TITLES_EN[key] : SYNTAX_FIX_TITLES[key];
}

/** 诊断按源码位置排序的比较函数; 无源码位置的排在最后. */
export function byPosition(a: Diagnostic, b: Diagnostic): number {
	const offset = (d: Diagnostic) =>
		d.location?.kind === "source" ? d.location.range.start.offset : Number.MAX_SAFE_INTEGER;
	return offset(a) - offset(b);
}
