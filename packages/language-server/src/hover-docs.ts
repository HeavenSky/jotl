// 悬停文案(E4): 内置组件, 元数据键与标识记号的说明, 以及悬停卡片上的固定文字, 中英两套.
import { getLocale } from "@jotl/core";

/** 键必须等于 `COMPONENT_NAMES`(测试核对). */
export const COMPONENT_DOCS: Readonly<Record<string, string>> = {
	string: "单行字符串, 默认允许空串, 要求非空时写 `minLength: 1`. `widget`: `input`(默认) `textarea` `password`.",
	text: "多行文本: 数据同 `string`, 默认 widget 为 `textarea`.",
	richtext:
		"富文本, 内容为 HTML(`contentMediaType: text/html`); 无富文本适配器时退化为 textarea.",
	number: "数值, 可为小数; `decimals` 限定小数位(`x-decimals`). `widget`: `number`(默认) `range`.",
	integer: "整数, 默认范围 `±MAX_SAFE_INTEGER`. `widget`: `number`(默认) `range`.",
	money: "金额对象 `{ type: 'money', value, currency, unit? }`, `value` 为精确数字串; `currency` `unit` `decimals` 控制币种, 单位与小数位, 范围写字符串(`minimum: '0'`).",
	bigint: "大整数对象 `{ type: 'bigint', value }`, `value` 为整数字符串; 范围写字符串.",
	boolean: "布尔值. `widget`: `switch`(默认) `checkbox`.",
	enum: "枚举: `enum{ a(甲) b(乙) }`; 标识符成员的值为同名字符串, 数字, 布尔与引号字符串按字面量取值; 有标签或说明时编译为 `oneOf`, 单成员为 `const`. `multiple: true` 为多选数组. `widget`: 单选 `select` `radio`, 多选 `select` `checkbox`.",
	date: "日期, 存储格式由 `value_format` 决定, 默认 `YYYY-MM-DD`(`format: date`), 形如 `2024-01-31`.",
	time: "时间, 存储格式由 `value_format` 决定, 默认 `HH:mm:ss`(不带时区), 形如 `08:00:00`; 不能用时间戳.",
	datetime:
		"日期时间, 存储格式由 `value_format` 决定, 默认 `iso`(`format: date-time`), 形如 `2024-01-31T08:00:00+08:00`.",
	url: "URL 字符串(`format: uri`).",
	email: "电子邮件字符串(`format: email`).",
	color: "颜色字符串(`format: color`), 形如 `#1677ff`.",
	image: "图片地址(`format: uri`). `widget`: `image`(默认, 上传 + 预览) `input`.",
	file: "文件地址(`format: uri`). `widget`: `file`(默认, 上传) `input`.",
	object: "对象, 体内写字段; 省略组件写 `key: {...}` 也是对象. `widget`: `page`(默认, 层级) `inline` `json`.",
	array: "数组, 默认允许空数组, 要求非空时写 `minItems: 1`. `array_item: '类型串'` 指定元素类型, `array_item: 'tuple'` 为元组, 不写时体为元素对象的字段. `widget`: `list` `json`.",
	map: "键值映射(`additionalProperties`). `map_item: '类型串'` 指定值类型, 不写时体为值对象的字段; `key_meta` 约束键. `widget`: `kv` `json`.",
	union: "联合: `union[discriminator: 'kind']{ 分支值(标题): {...} }` 为可区分联合(`oneOf`); `union[union_item: 'number|string']` 按 JSON 类型区分(`anyOf`).",
	any: "任意 JSON 值, 编译为空 schema `{}`.",
	jsontext:
		"JSON 文本字符串(`contentMediaType: application/json`); 写体或 `json_item` 时解析后按其校验.",
};

/** 键必须等于 `META_KEY_NAMES`(测试核对). */
export const META_KEY_DOCS: Readonly<Record<string, string>> = {
	description: "说明, 编译为 `description`; 枚举成员也可写 `[description: '...']`.",
	default: "默认值, 编译为 `default`; 编译期按约束校验.",
	examples: "示例值数组, 编译为 `examples`.",
	deprecated: "`true` 或原因字符串: 编译为 `deprecated: true`, 原因写入 `x-deprecatedReason`.",
	readOnly: "只读, 编译为 `readOnly`.",
	writeOnly: "只写, 编译为 `writeOnly`.",
	errorMessage: "错误文案: 字符串替换全部错误消息, `{maxLength: '...'}` 按关键字替换.",
	comment: "给维护者看的注释, 编译为 `$comment`.",
	minLength: "字符串的最小长度(含); 不写时允许空串, 写 1 要求非空.",
	maxLength: "字符串的最大长度(含).",
	pattern: "字符串必须匹配的正则表达式(ECMA-262).",
	format: "字符串格式, 例如 `'email'` `'uri'`.",
	minimum: "最小值(含); `money` `bigint` 上写精确数字字符串.",
	maximum: "最大值(含); `money` `bigint` 上写精确数字字符串.",
	exclusiveMinimum: "最小值(不含); `money` `bigint` 上写精确数字字符串.",
	exclusiveMaximum: "最大值(不含); `money` `bigint` 上写精确数字字符串.",
	decimals: "小数位数(非负整数), 编译为 `x-decimals`; `money` 上覆盖币种默认位数.",
	minItems: "数组或多选的最少项数; 不写时允许为空(元组取必填位置数), 写 1 要求非空.",
	maxItems: "数组或多选的最多项数.",
	uniqueItems: "数组各项互不相同.",
	minProperties: "对象或 map 的最少键数.",
	maxProperties: "对象或 map 的最多键数.",
	closed: "禁止额外字段, 编译为 `additionalProperties: false`.",
	nullable: "允许为 `null`; 渲染时有置空开关.",
	multiple: "枚举多选: 值为成员值数组, 自动 `uniqueItems`.",
	array_item: "数组元素的类型串(`'string'` `'Banner'` `'number|string'`), 或 `'tuple'` 表示元组.",
	map_item: "map 值的类型串.",
	union_item: "按 JSON 类型区分的联合的类型串, 至少两个名字.",
	json_item: "`jsontext` 解析后内容的类型串.",
	item_meta: "内部类型的元数据; 类型串含多个名字时按名字分键 `{string: {...}}`.",
	key_meta: "map 键的约束, 只接受 `pattern` `minLength` `maxLength`, 编译为 `propertyNames`.",
	discriminator: "可区分联合的区分字段名; 分支键为该字段的取值.",
	currency: "币种: `'CNY'` 固定, `['CNY', 'USD']` 可选(首个为默认).",
	unit: "金额单位: `'fen'` 固定, `['yuan', 'fen']` 可选; 只校验为字符串.",
	value_format:
		"`date` `time` `datetime` 的存储格式, 编译为 `x-valueFormat`(默认格式不写): dayjs 格式串(`'YYYYMMDD'` `'HH:mm'`, 不含时区的按本地时区), " +
		"`'x'` 毫秒 / `'X'` 秒时间戳(值为整数, `time` 不可用), 或别名 `'iso'`(`2026-10-13T09:30:15+08:00`) `'iso-x'`(带毫秒) `'utc'`(`2026-10-13T01:30:15Z`) `'utc-x'`(带毫秒); " +
		"别名读取时接受任意 RFC 3339 日期时间, 写回时按别名统一.",
	thousands:
		"是否显示千分位, 写入 `x-ui.thousands`; `money` 默认开, `number` `integer` `bigint` 默认关.",
	widget: "渲染 widget, 在该组件的 widget 候选中选择, 另外任意组件可选 `json` `output`, 字符串类组件的 widget 互通; 不是默认值时写入 `x-ui.widget`. 不接受该数据形态时降级为默认并报 warning.",
	props: "widget 参数对象, 写入 `x-ui.props`.",
	decorator: "字段外壳 widget 名, 或 `false` 不要外壳, 写入 `x-ui.decorator`.",
	hidden: "不渲染该节点, 写入 `x-ui.hidden`.",
	order: "对象字段的显示顺序(字段名数组), 写入 `x-ui.order`.",
	groups: "字段分组 `[{title, fields}]`, 写入 `x-ui.groups`.",
	layout: "对象字段布局 `'stack' | 'tabs' | 'grid'`, 写入 `x-ui.layout`.",
	columns: "栅格列数, 只能与 `layout: 'grid'` 一起写.",
	summary:
		"入口行与列表项的摘要字段名, 写入 `x-ui.summary`; 用于对象, 或元素为对象的 `array` / `map`.",
	root_if:
		"显示条件, 路径从数据根起: `{left: 'mode', op: 'eq', right: 'dark'}`, `{and: [...]}` `{or: [...]}` `{not: ...}`, 或直接写路径字符串.",
	node_if: "显示条件, 路径从字段所在对象起; 写法同 `root_if`.",
	variants: "场景名 → x-ui 覆盖对象, 写入 `x-ui.variants`.",
	rules: "规则数组 `[{match, ui}]`, 写入根 `x-ui.rules`; `ui` 中的条件写 `root_if` / `node_if`; 只能写在根条目上.",
	id: "根 schema 的 `$id`(URI); 只能写在根条目上.",
	schema: "原样合并的 JSON Schema 片段, 用于 Jotl 不覆盖的关键字; 与生成结果冲突时以它为准并报 warning.",
	widgets:
		"本文件的扩展组件声明 `{ 名字: 声明 }`, 声明为底层类型名, schema 对象或模块 `{ base?, module, export? }`(`base` 缺省 object); " +
		"大驼峰名可作组件使用, 同名时覆盖 `jotl.config.json`; 模块声明写入根 `x-ui.widgets`; 只能写在根条目上.",
};

export const MARKER_DOCS: Readonly<Record<string, string>> = {
	root: "`<root/>`: 标记紧随其后的顶层类型为根, 编译为根 schema 的 `$ref`; 不写时跟随 `<default/>`, 两个都不写时第一条为根.",
	default:
		"`<default/>`: 标记紧随其后的顶层类型为默认导出(TS 输出的 `export default`), 不影响 JSON Schema; 不写时跟随根.",
};

export const HOVER_TEXT = {
	component: "内置组件",
	extension: "扩展组件",
	extensionDoc: "扩展组件, 数据按底层 schema 编译",
	metaKey: "元数据",
	marker: "标识",
	declaration: "类型",
	field: "字段",
	appliesTo: "适用于",
	anyTarget: "任意组件",
	refTarget: "引用类型",
	extTarget: "扩展组件",
	extConstraintTarget: "及底层类型匹配的扩展组件",
	rootOnly: "只能写在根条目上",
	compilesTo: "编译结果",
	compileFailed: "文件存在错误, 修正后显示编译结果.",
	truncated: "片段较长, 只显示前 {shown} 行(共 {total} 行).",
} as const;

/** 英文版, 键与中文版一致(测试核对). */
export const COMPONENT_DOCS_EN: Readonly<Record<string, string>> = {
	string: "Single-line string; empty string is allowed by default, write `minLength: 1` to require non-empty. `widget`: `input` (default) `textarea` `password`.",
	text: "Multi-line text: same data as `string`, default widget is `textarea`.",
	richtext:
		"Rich text, content is HTML (`contentMediaType: text/html`); falls back to textarea without a rich text adapter.",
	number: "Number, may be decimal; `decimals` limits decimal places (`x-decimals`). `widget`: `number` (default) `range`.",
	integer: "Integer, default range `±MAX_SAFE_INTEGER`. `widget`: `number` (default) `range`.",
	money: "Money object `{ type: 'money', value, currency, unit? }`, `value` is an exact numeric string; `currency` `unit` `decimals` control currency, unit and decimal places, bounds are strings (`minimum: '0'`).",
	bigint: "Big integer object `{ type: 'bigint', value }`, `value` is an integer string; bounds are strings.",
	boolean: "Boolean. `widget`: `switch` (default) `checkbox`.",
	enum: "Enum: `enum{ a(A) b(B) }`; identifier members take the same-named string as value, numbers, booleans and quoted strings are literal values; compiles to `oneOf` when members have labels or descriptions, a single member compiles to `const`. `multiple: true` makes a multi-select array. `widget`: single `select` `radio`, multiple `select` `checkbox`.",
	date: "Date, storage format set by `value_format`, default `YYYY-MM-DD` (`format: date`), e.g. `2024-01-31`.",
	time: "Time, storage format set by `value_format`, default `HH:mm:ss` (no time zone), e.g. `08:00:00`; timestamps are not allowed.",
	datetime:
		"Date-time, storage format set by `value_format`, default `iso` (`format: date-time`), e.g. `2024-01-31T08:00:00+08:00`.",
	url: "URL string (`format: uri`).",
	email: "Email string (`format: email`).",
	color: "Color string (`format: color`), e.g. `#1677ff`.",
	image: "Image URL (`format: uri`). `widget`: `image` (default, upload + preview) `input`.",
	file: "File URL (`format: uri`). `widget`: `file` (default, upload) `input`.",
	object: "Object, fields go in the body; `key: {...}` without a component is also an object. `widget`: `page` (default, nested) `inline` `json`.",
	array: "Array, empty array is allowed by default, write `minItems: 1` to require non-empty. `array_item: 'type string'` sets the item type, `array_item: 'tuple'` makes a tuple; otherwise the body holds the fields of the item object. `widget`: `list` `json`.",
	map: "Key-value map (`additionalProperties`). `map_item: 'type string'` sets the value type; otherwise the body holds the fields of the value object; `key_meta` constrains keys. `widget`: `kv` `json`.",
	union: "Union: `union[discriminator: 'kind']{ branchValue(title): {...} }` is a discriminated union (`oneOf`); `union[union_item: 'number|string']` distinguishes by JSON type (`anyOf`).",
	any: "Any JSON value, compiles to the empty schema `{}`.",
	jsontext:
		"JSON text string (`contentMediaType: application/json`); with a body or `json_item`, the parsed content is validated against it.",
};

/** 英文版, 键与中文版一致(测试核对). */
export const META_KEY_DOCS_EN: Readonly<Record<string, string>> = {
	description:
		"Description, compiles to `description`; enum members can also write `[description: '...']`.",
	default: "Default value, compiles to `default`; validated against constraints at compile time.",
	examples: "Array of example values, compiles to `examples`.",
	deprecated:
		"`true` or a reason string: compiles to `deprecated: true`, the reason goes to `x-deprecatedReason`.",
	readOnly: "Read-only, compiles to `readOnly`.",
	writeOnly: "Write-only, compiles to `writeOnly`.",
	errorMessage:
		"Error text: a string replaces all error messages, `{maxLength: '...'}` replaces per keyword.",
	comment: "Note for maintainers, compiles to `$comment`.",
	minLength:
		"Minimum string length (inclusive); empty string is allowed when omitted, 1 requires non-empty.",
	maxLength: "Maximum string length (inclusive).",
	pattern: "Regular expression the string must match (ECMA-262).",
	format: "String format, e.g. `'email'` `'uri'`.",
	minimum: "Minimum (inclusive); exact numeric string on `money` `bigint`.",
	maximum: "Maximum (inclusive); exact numeric string on `money` `bigint`.",
	exclusiveMinimum: "Minimum (exclusive); exact numeric string on `money` `bigint`.",
	exclusiveMaximum: "Maximum (exclusive); exact numeric string on `money` `bigint`.",
	decimals:
		"Decimal places (non-negative integer), compiles to `x-decimals`; overrides the currency default on `money`.",
	minItems:
		"Minimum number of items of an array or multi-select; empty allowed when omitted (tuples use the required positions), 1 requires non-empty.",
	maxItems: "Maximum number of items of an array or multi-select.",
	uniqueItems: "Array items must be distinct.",
	minProperties: "Minimum number of keys of an object or map.",
	maxProperties: "Maximum number of keys of an object or map.",
	closed: "Disallow extra fields, compiles to `additionalProperties: false`.",
	nullable: "Allow `null`; the form shows a clear toggle.",
	multiple:
		"Enum multi-select: the value is an array of member values, `uniqueItems` is implied.",
	array_item:
		"Type string of array items (`'string'` `'Banner'` `'number|string'`), or `'tuple'` for a tuple.",
	map_item: "Type string of map values.",
	union_item: "Type string of a union distinguished by JSON type, at least two names.",
	json_item: "Type string of the parsed content of `jsontext`.",
	item_meta:
		"Metadata of the inner type; when the type string has several names, key it by name `{string: {...}}`.",
	key_meta:
		"Constraints on map keys, only `pattern` `minLength` `maxLength`, compiles to `propertyNames`.",
	discriminator: "Discriminator field name of a discriminated union; branch keys are its values.",
	currency: "Currency: `'CNY'` fixed, `['CNY', 'USD']` selectable (the first is default).",
	unit: "Money unit: `'fen'` fixed, `['yuan', 'fen']` selectable; only validated as a string.",
	value_format:
		"Storage format of `date` `time` `datetime`, compiles to `x-valueFormat` (omitted for the default): a dayjs format string (`'YYYYMMDD'` `'HH:mm'`, local time zone when it has no zone), " +
		"`'x'` milliseconds / `'X'` seconds timestamp (integer value, not for `time`), or the aliases `'iso'` (`2026-10-13T09:30:15+08:00`) `'iso-x'` (with milliseconds) `'utc'` (`2026-10-13T01:30:15Z`) `'utc-x'` (with milliseconds); " +
		"aliases accept any RFC 3339 date-time when reading and normalize to the alias when writing.",
	thousands:
		"Whether to show thousands separators, written to `x-ui.thousands`; on by default for `money`, off for `number` `integer` `bigint`.",
	widget: "Rendering widget, chosen from the component's widget candidates; any component may also use `json` `output`, and string components share widgets; written to `x-ui.widget` when not the default. Falls back to the default with a warning when it does not accept the data shape.",
	props: "Widget props object, written to `x-ui.props`.",
	decorator: "Field wrapper widget name, or `false` for no wrapper, written to `x-ui.decorator`.",
	hidden: "Do not render this node, written to `x-ui.hidden`.",
	order: "Display order of object fields (array of field names), written to `x-ui.order`.",
	groups: "Field groups `[{title, fields}]`, written to `x-ui.groups`.",
	layout: "Object field layout `'stack' | 'tabs' | 'grid'`, written to `x-ui.layout`.",
	columns: "Grid column count, only together with `layout: 'grid'`.",
	summary:
		"Summary field name for entry rows and list items, written to `x-ui.summary`; for objects, or `array` / `map` whose items are objects.",
	root_if:
		"Visibility condition, paths from the data root: `{left: 'mode', op: 'eq', right: 'dark'}`, `{and: [...]}` `{or: [...]}` `{not: ...}`, or a bare path string.",
	node_if:
		"Visibility condition, paths from the object containing the field; same syntax as `root_if`.",
	variants: "Scene name → x-ui override object, written to `x-ui.variants`.",
	rules: "Rule array `[{match, ui}]`, written to the root `x-ui.rules`; conditions in `ui` use `root_if` / `node_if`; root entry only.",
	id: "`$id` (URI) of the root schema; root entry only.",
	schema: "JSON Schema fragment merged as-is, for keywords Jotl does not cover; it wins over generated output on conflict, with a warning.",
	widgets:
		"Extension component declarations of this file `{ name: declaration }`, where a declaration is a base type name, a schema object or a module `{ base?, module, export? }` (`base` defaults to object); " +
		"PascalCase names can be used as components and override `jotl.config.json` entries of the same name; module declarations are written to the root `x-ui.widgets`; root entry only.",
};

export const MARKER_DOCS_EN: Readonly<Record<string, string>> = {
	root: "`<root/>`: marks the following top-level type as the root, compiled to the root schema's `$ref`; when omitted it follows `<default/>`, and when both are omitted the first entry is the root.",
	default:
		"`<default/>`: marks the following top-level type as the default export (`export default` in TS output), no effect on JSON Schema; when omitted it follows the root.",
};

export const HOVER_TEXT_EN: Readonly<Record<keyof typeof HOVER_TEXT, string>> = {
	component: "Built-in component",
	extension: "Extension component",
	extensionDoc: "Extension component, its data compiles as the base schema",
	metaKey: "Metadata",
	marker: "Marker",
	declaration: "Type",
	field: "Field",
	appliesTo: "Applies to",
	anyTarget: "any component",
	refTarget: "type reference",
	extTarget: "extension component",
	extConstraintTarget: "and extension components with a matching base type",
	rootOnly: "Root entry only",
	compilesTo: "Compiles to",
	compileFailed: "The file has errors; fix them to see the compiled output.",
	truncated: "Long fragment, showing the first {shown} lines ({total} in total).",
};

/** 按当前语言取悬停文案. */
export function hoverDocs() {
	return getLocale() === "en"
		? {
				components: COMPONENT_DOCS_EN,
				metaKeys: META_KEY_DOCS_EN,
				markers: MARKER_DOCS_EN,
				text: HOVER_TEXT_EN,
			}
		: {
				components: COMPONENT_DOCS,
				metaKeys: META_KEY_DOCS,
				markers: MARKER_DOCS,
				text: HOVER_TEXT as Readonly<Record<keyof typeof HOVER_TEXT, string>>,
			};
}
