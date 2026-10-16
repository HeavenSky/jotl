# @jotl/data

[English](./README.md) · **简体中文**

按 JSON Schema 生成默认数据, 补全, 校验, 迁移旧数据或生成 Mock 数据, 或需要核对这些函数的行为口径与 `JOTL4xxx` 诊断时读本页; 对应 `packages/data`.

`@jotl/data` 实现 `@jotl/core` 的数据能力接口 `DataApi`; 校验基于 Ajv 2020, 其余能力自行遍历 schema. `@jotl/form` 的默认值与校验, 以及 `jotl validate` `jotl defaults` 都经由本包.

## 安装

```sh
pnpm add @jotl/data
```

## 最小示例

```ts
import { fillDefaults, getDefaults, migrate, mock, validate } from "@jotl/data";

const schema = {
  type: "object",
  properties: {
    title: { type: "string", title: "标题", maxLength: 5, default: "首页" },
    count: { type: "integer", minimum: 1 },
    color: { type: "string", format: "color", errorMessage: "请填写十六进制颜色" },
    tags: { type: "array", minItems: 1, items: { type: "string" } },
  },
  required: ["title", "count"],
};

getDefaults(schema).value; // { title: "首页" }
getDefaults(schema, { strategy: "required" }).value; // { title: "首页", count: 1 }
getDefaults(schema, { strategy: "all" }).value; // { title: "首页", count: 1, color: "", tags: [""] }

fillDefaults(schema, { title: "自定义" }).value; // { data: { title: "自定义" }, filled: [] }

validate(schema, { title: 1, count: 0, color: "red" });
// value: { valid: false }
// diagnostics: JOTL4001 /title "标题 的类型应为字符串"
//              JOTL4003 /count "count 超出范围: 应不小于 1"
//              JOTL4009 /color "请填写十六进制颜色"

migrate(schema, { title: 12, count: "3", old: true }).value;
// { data: { title: "12", count: 3 }, changed: ["/title", "/count", "/old"] }

mock(schema, { seed: 1 }); // 同一 seed 每次结果相同

validate(schema, { title: 1, count: 0 }, { locale: "en" });
// diagnostics: JOTL4001 /title "标题 should be of type string"
//              JOTL4003 /count "count is out of range: should be at least 1"
```

## 公开 API

全部函数返回 `@jotl/core` 的 `Result`, 不抛异常, 不修改传入的 schema 与数据. 选项 `locale`(`"zh-CN" | "en"`, 类型 `LocaleOptions`)只决定本次调用产生的诊断与消息的语言; 缺省取 `@jotl/core` 的全局 `getLocale()`(默认 `en`).

| 导出 | 签名 | 说明 |
|---|---|---|
| `getDefaults` | `(schema, opts?: Partial<DefaultsOptions> & SubschemaOptions & LocaleOptions) => Result<unknown>` | 生成默认数据; `at` 见下 |
| `fillDefaults` | `(schema, data, opts?: Partial<DefaultsOptions> & LocaleOptions) => Result<{ data, filled: JsonPointer[] }>` | 在已有数据上补全, `filled` 为补上的位置 |
| `validate` | `(schema, data, opts?: SubschemaOptions & LocaleOptions) => Result<{ valid: boolean }>` | 校验, 错误为 `location.kind = "pointer"` 的诊断; `at` 见下 |
| `migrate` | `(schema, data, opts?: LocaleOptions) => Result<{ data, changed: JsonPointer[] }>` | 按新 schema 修正旧数据, `changed` 为改动的位置 |
| `mock` | `(schema, opts?: { seed?: number } & LocaleOptions) => Result<unknown>` | 生成满足 schema 的数据 |
| `dataApi` | `DataApi` | 以上五个函数的集合, 供按接口注入 |
| `DATA_DIAGNOSTICS` `dataDiagnostic` `DATA_TEXT` `DATA_TEXT_EN` `dataText()` `DataText` | | 代码表(带英文模板 `en`), 诊断工厂, 拼进消息的中文与英文片段(标签, 类型名等); `dataText()` 按当前全局语言取其中一份 |
| `COLOR_PATTERN` | `RegExp` | `color` 格式的正则 |
| `SubschemaOptions` | `{ at?: JsonPointer \| JsonSchema }` | 只对文档内的子 schema 求默认值或校验 |

`at` 为 JSON 指针时取文档中该处的子 schema; 为 schema 值时原样使用(例: 由文档节点合成的有效 schema). 两种形式中的引用都按整个文档解析, 规则与不带 `at` 时相同; 数据根落在子 schema 上: 校验错误的指针与标签相对子 schema, 根标签为 "数据"(`zh-CN`)或 "data"(`en`). 指针不存在或不指向 schema 时报 `JOTL4018`. 子 schema 自带的 `$id` `$schema` 在校验时忽略.

## 默认数据: getDefaults 与 fillDefaults

选项 `DefaultsOptions` 的默认值见 `@jotl/core` 的 `DEFAULT_DEFAULTS_OPTIONS`(`strategy: "explicit"`, `arrayItems: "minItems"`, `oneOf: "firstWithDefault"`, `maxDepth: 3`). 选项值非法时报 `JOTL4018`, `value` 为 `undefined`.

节点自身(或经 `$ref` `allOf` 合并的节点)有 `default` 时一律取 `default` 的拷贝; 没有时按策略:

| 节点 | `explicit` | `required` | `all` |
|---|---|---|---|
| 对象 | 只含能产出值的属性; 一个都没有时根为 `{}`, 非根省略 | 必填属性递归产出, 可选属性只取显式默认值; 可选对象因子字段的默认值而出现时, 它的必填字段也补上; 至少为 `{}` | 全部属性递归产出 |
| 数组 | 省略(即使元素有默认值) | 必填时生成 `minItems` 个元素, 元素无值时用零值 | 同 `required`, 可选数组也生成 |
| 标量 | 省略 | 必填时用零值 | 用零值 |

- 零值: 枚举与 `const` 取第一个可选值, 字符串 `""`, 数字与整数取 `minimum`(没有时为 `0`), 布尔 `false`, `null`, 对象 `{}`, 数组 `[]`. 零值不考虑 `format` `minLength` `pattern` 等约束, 结果不保证通过 `validate`.
- `arrayItems: "none"` 时需要生成的数组为空数组.
- `anyOf` / `oneOf`(带标签枚举除外): `oneOf: "firstWithDefault"` 取第一个能产出值的分支, 都不能时取第一个; `"first"` 总取第一个.
- `maxDepth` 是同一个 `$ref` 目标在当前路径上的展开次数上限, 不是数据嵌套层数: 达到上限后该引用不再展开, 节点按无值处理. 例: 必填的递归 `Node.child` 在默认值 `3` 下产出 `{ name, child: { name, child: { name } } }`.
- 无法解析的 `$ref` 报 `JOTL4016` warning, 该节点按无值处理.

`fillDefaults` 不覆盖已有值:

- 只为缺失的已声明属性产出值, 已有字段(含 `null` 与空串)原样保留并继续向下补全; 数组按现有元素逐个补全, 不增删元素.
- 缺失的整棵子树按策略产出, `filled` 只记子树根的指针.
- 联合类型按数据的类型与字段重合度选一个分支补全.
- `data` 为 `undefined` 时等同 `getDefaults`, `filled` 为 `[""]`(产出了值时).

## 校验: validate

- 使用 Ajv 2020 方言, `allErrors` 开启, 只按自有属性判断字段是否存在(字段名为 `constructor` 等原型属性名时缺失仍报必填).
- 格式: `ajv-formats` 的全部格式, 加自定义 `color`(CSS 十六进制颜色 `#rgb` `#rgba` `#rrggbb` `#rrggbbaa`, 正则为 `COLOR_PATTERN`). `x-ui` `x-deprecatedReason` `errorMessage` 是已知关键字, 其余 `x-` 开头的关键字按注解登记, 非 `x-` 开头的未知关键字使 schema 无法编译.
- 扩展校验: `x-decimals: n`(number/integer 的十进制小数位 ≤ n, 指数形式按展开计, 违反报 `JOTL4020`); `x-decimalRange`(money/bigint 对象上按精确十进制比较 `value`, 违反报 `JOTL4021`, 指向该对象; `value` 本身不合法只报 pattern); `contentMediaType: "application/json"` 的字符串须能 `JSON.parse`(`JOTL4022`), 有 `contentSchema` 时解析结果按它校验, 不符只在该字符串字段报一条 `JOTL4023`. `propertyNames`(map 的键名约束)不符报 `JOTL4024`, 指向该对象. `x-valueFormat`(日期组件的存储格式): dayjs 格式串按 `customParseFormat` 严格解析(含 `Z` 记号时接受任意偏移, 按原文偏移比对), `x` `X` 时间戳只要求整数, 别名 `iso` `iso-x` `utc` `utc-x` 接受任意合法 RFC 3339 date-time(与 `format: date-time` 同时出现时只由 format 报错); 不符报 `JOTL4025`, `errorMessage` 可按关键字 `x-valueFormat` 覆盖文案.
- 联合不符(`JOTL4012`)附带原因: 区分字段缺失或取值不在分支中时列出可选值; 否则按数据的 JSON 类型选出分支, 给出它的第一条错误(值本身的错误直接写成 `{label} {原因}`); 没有类型相符的分支时列出可选类型. 后两者只在 `validate` 中是断言, 官方测试集仍按注解测量.
- 默认数据与 Mock: 带 `x-valueFormat` 的字符串零值为本地 `2000-01-01 00:00:00` 按格式写出的值(时间戳整数仍为 `0`); 无 `x-valueFormat` 的 `format: date` `time` `date-time` 字符串零值为同一时刻的 `2000-01-01`, `00:00:00±HH:mm`, RFC 3339 带本地偏移; Mock 取 2000-2030 年间的随机时刻按格式写出.
- 默认数据与 Mock: money/bigint 对象(按 `properties.type.const` 识别)的 `value` 取满足 pattern 小数位与 `x-decimalRange` 的值(依次试 `"0"`, `minimum`, `maximum`, `exclusiveMinimum` + 1, `exclusiveMaximum` - 1, 补齐小数位), 无约束币种取 `CNY`; JSON 文本(`contentMediaType: "application/json"`)的零值为 `contentSchema` 默认数据的序列化, 无 `contentSchema` 时为 `"{}"`; Mock 为 JSON 文本按 `contentSchema` 生成后序列化.
- schema 无法编译(非 `x-` 开头的未知关键字, 无法解析的引用等)时返回 `JOTL4017`, `value` 为 `undefined`.
- 编译结果按 schema 对象身份缓存: 原地修改同一个 schema 对象后不会重新编译, 需要传入新对象.
- 诊断的 `pointer` 是数据中的 JSON Pointer; 缺少必填字段(`JOTL4002`)与不允许的字段(`JOTL4008`)指向该字段本身, 不指向父对象.
- 消息中的字段标签: 字段自身的 `title`; 没有时数组元素为 "父标签的第 N 项"(`en` 为 "item N of 父标签"), 其余为键名; 根为 "数据"(`en` 为 "data").

一处违反只报一条:

- 类型不符(`JOTL4001`)时不再报同一位置的其他约束.
- `anyOf` 全部分支失败只报 `JOTL4012`, `oneOf` 全部失败同样报 `JOTL4012`, 带标签枚举(`oneOf` 的 `const` 分支)不匹配只报 `JOTL4006`; 分支内部及更深处的错误都不报. 同一 `$defs` 在组合关键字之外被引用时, 外面的错误照常报告.
- `oneOf` 同时符合多个分支报 `JOTL4015`.
- `if` 自身的失败不报, 只报 `then` / `else` 中的具体错误.
- 代码, 指针与消息都相同的错误只保留一条.

`errorMessage` 自定义消息(Jotl 写法为元数据 `errorMessage: ...`, 如 `string[errorMessage: {maxLength: '最多 20 字'}]`, 见 `docs/spec/jotl.md`):

- 字符串形态替换该节点全部错误的消息; 对象形态以关键字名为键(如 `maxLength` `required`), 只替换同名关键字的错误, 其余保留默认文案.
- 查找顺序: 缺少必填字段时先看该字段自身的 schema, 再看声明 `required` 的父对象; 其余错误先看违反的关键字所在节点, 再看数据路径上的字段节点. 取第一个命中的.
- 文案可引用 `{label}` 等消息参数; 替换只改消息, 不改错误代码与指针.

## 迁移: migrate

用新 schema 修正旧数据; 不修改传入的数据, 每处改动的位置记入 `changed`.

- 删除未声明字段: 对象声明了 `properties`, 且合并后的各节点都没有 `patternProperties` `unevaluatedProperties`, `additionalProperties` 未写或为 `false` 时, 不在 `properties` 中的字段被删除. 否则未声明字段按 `additionalProperties` / `patternProperties` 的 schema 逐项迁移, 无对应 schema 的保持原样.
- 补字段: 缺失的已声明属性只按显式默认值补上(同 `explicit` 策略).
- 类型不符时按 schema 的类型顺序尝试转换, 成功即保留:

| 目标类型 | 可转换的值 |
|---|---|
| `string` | 数字, 布尔 → `String(value)` |
| `number` | 数字, 非空白的数字字符串 |
| `integer` | 同 `number`, 再四舍五入 |
| `boolean` | 字符串 `"true"` `"false"` |
| `array` | 任意非 `null` 值 → 单元素数组 |
| 任意非数组类型 | 单元素数组先取出该元素再按上述规则转换 |

- 无法保留的值(转换失败, 不在枚举可选值中, `false` schema): 有 `default` 时取默认值; 可选字段与数组元素删除; 必填字段取零值, 没有零值时删除.
- 联合类型先按数据匹配分支; 都不匹配时依次尝试转换为各分支的类型.
- 不修复 `maxItems` `uniqueItems` `maxLength` 等约束违规, 迁移后应再调用 `validate`.

## Mock: mock

- `seed` 相同则结果相同(32 位 mulberry32 伪随机); 省略时随机取种子. `seed` 不是有限数时报 `JOTL4018`.
- 生成后自动 `validate`, 校验错误降为 warning 附在 `diagnostics` 中.
- 同一 `$ref` 在路径上展开 3 次后只生成必需部分, 8 次后停止并报 `JOTL4019` warning; 可选的递归引用不会展开到上限.
- 无法生成满足 `pattern` 的字符串时报 `JOTL4019` warning.

## 诊断代码

代码表在 `packages/data/src/diagnostics.ts` 的 `DATA_DIAGNOSTICS`, 消息中的 `{label}` 为字段标签.

| 代码 | 级别 | 来源 | 含义 |
|---|---|---|---|
| `JOTL4001` | error | validate | 类型不符 |
| `JOTL4002` | error | validate | 缺少必填字段(含 `dependentRequired`) |
| `JOTL4003` | error | validate | 超出 `minimum` `maximum` `exclusiveMinimum` `exclusiveMaximum` |
| `JOTL4004` | error | validate | 字符串长度不符 `minLength` `maxLength` |
| `JOTL4005` | error | validate | 不匹配 `pattern` |
| `JOTL4006` | error | validate | 不在 `enum` 或带标签枚举的可选值中 |
| `JOTL4007` | error | validate | 数组项数不符 `minItems` `maxItems` |
| `JOTL4008` | error | validate | 不允许的字段(`additionalProperties` `unevaluatedProperties`) |
| `JOTL4009` | error | validate | 不符合 `format` |
| `JOTL4010` | error | validate | 不是 `multipleOf` 的倍数 |
| `JOTL4011` | error | validate | `uniqueItems` 下有重复项 |
| `JOTL4012` | error | validate | `anyOf` / `oneOf` 一个分支都不符合 |
| `JOTL4013` | error | validate | 不等于 `const` |
| `JOTL4014` | error | validate | 字段数不符 `minProperties` `maxProperties` |
| `JOTL4015` | error | validate | 同时符合 `oneOf` 的多个分支 |
| `JOTL4016` | warning | getDefaults, fillDefaults, migrate, mock | 无法解析的 `$ref`, 节点按无值处理 |
| `JOTL4017` | error | validate | schema 无法编译; Ajv 原文放在 `related` 中(指针为根) |
| `JOTL4018` | error | getDefaults, fillDefaults, validate, mock | 选项值非法(含 `at` 指针不存在或不指向 schema) |
| `JOTL4019` | warning | mock | 无法生成满足约束的数据(引用过深或 `pattern` 无法生成) |
| `JOTL4020` | error | validate | 小数位超过 `x-decimals` |
| `JOTL4021` | error | validate | money/bigint 的 `value` 超出 `x-decimalRange` |
| `JOTL4022` | error | validate | `contentMediaType: "application/json"` 的字符串不是合法 JSON |
| `JOTL4023` | error | validate | JSON 文本解析结果不符 `contentSchema` |
| `JOTL4024` | error | validate | 键名不符 `propertyNames` |
| `JOTL4025` | error | validate | 字符串不符 `x-valueFormat` 存储格式 |
| `JOTL4099` | error | validate | 其余校验失败: `not`, `false` schema, `contains`, `unevaluatedItems` 及未归类的关键字 |

## 已知限制

见根目录 `TODO.md` 的「确定不修」, 含引用解析范围, Ajv 与官方测试集的差异及 `migrate` 不修复的约束.
