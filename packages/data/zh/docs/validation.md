# 校验数据

[English](../../docs/validation.md) · **简体中文**

读完本页，你会知道 `validate` 检查什么、报哪些错误，以及怎样自己措辞错误消息。各函数共用的约定（含 `locale` 与 `at`）见[调用约定](./api.md)；每个代码的含义见[诊断代码](./diagnostic-codes.md)。

## 读懂校验错误

```js
import { validate } from "@jotl/data";

const schema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 3, errorMessage: { maxLength: "At most 3 characters" } },
    items: { type: "array", items: { type: "integer" } },
  },
  required: ["name"],
};
validate(schema, { name: "abcd", items: [1, "x"] });
// value: { valid: false }
// diagnostics: JOTL4004 /name    "At most 3 characters"
//              JOTL4001 /items/1 "item 2 of items should be of type integer"
validate(schema, {}).diagnostics; // JOTL4002 /name "Missing required field name"
```

- `location.pointer` 是数据中的 JSON Pointer。缺少必填字段（`JOTL4002`）与不允许的字段（`JOTL4008`）指向字段本身，不指向父对象。
- 消息中的字段标签：优先用字段自身的 `title`；没有时，数组元素写作「父标签的第 N 项」（`zh-CN`）或「item N of 父标签」（`en`），其余用键名。根为「数据」或「data」。

## 检查范围

- 校验器使用 Ajv 2020 方言并开启 `allErrors`。字段是否存在只看自有属性，所以字段名与原型属性同名（如 `constructor`）时，缺失仍报必填。
- 格式：`ajv-formats` 的全部格式，加上 `color`：CSS 十六进制颜色 `#rgb`、`#rgba`、`#rrggbb` 或 `#rrggbbaa`，正则为 `COLOR_PATTERN`。
- 关键字：`x-ui`、`x-deprecatedReason`、`errorMessage` 是已知关键字；其他以 `x-` 开头的关键字登记为注解。不以 `x-` 开头的未知关键字会让 schema 无法编译。

Jotl 的扩展关键字同样会检查：

- `x-decimals: n`：number 或 integer 最多 `n` 位小数，指数形式按展开后计。违反报 `JOTL4020`。
- money 与 bigint 对象上的 `x-decimalRange` 按精确十进制比较 `value`。违反时在该对象上报 `JOTL4021`；`value` 本身不合法时只报 pattern 错误。
- `contentMediaType: "application/json"` 的字符串必须能通过 `JSON.parse`（`JOTL4022`）。有 `contentSchema` 时，解析结果按它校验，不符时只在该字符串字段上报一条 `JOTL4023`。
- `propertyNames`（map 的键名约束）不符时在该对象上报 `JOTL4024`。
- `x-valueFormat`（日期组件的存储格式）：dayjs 格式串用 `customParseFormat` 严格解析；含 `Z` 记号时接受任意偏移，并按原文偏移比对。时间戳 `x`、`X` 只要求是整数。别名 `iso`、`iso-x`、`utc`、`utc-x` 接受任意合法的 RFC 3339 date-time；与 `format: date-time` 同时出现时只由 `format` 报错。不符报 `JOTL4025`，`errorMessage` 可以按关键字 `x-valueFormat` 覆盖文案。

schema 无法编译时（如有未知关键字或无法解析的引用），`validate` 返回 `JOTL4017`，`value` 为 `undefined`。

编译出的校验器按 schema 对象身份缓存。原地修改同一个 schema 对象不会触发重新编译，请传入新对象。

## 一个问题只报一条错误

- 类型不符（`JOTL4001`）时，不再报同一位置的其他约束。
- `anyOf` 全部分支失败或 `oneOf` 全部分支失败时只报 `JOTL4012`；带标签枚举（`oneOf` 的 `const` 分支）不匹配时只报 `JOTL4006`。分支内部的错误都不报。同一个 `$defs` 条目在组合关键字之外也被引用时，外面的错误照常报告。
- 同时符合 `oneOf` 的多个分支时报 `JOTL4015`。
- `if` 自身的失败不报，只报 `then` 或 `else` 中的具体错误。
- 代码、指针与消息都相同的错误只保留一条。

`JOTL4012` 附带原因：

- 区分字段缺失，或其取值不在各分支中时，列出可选值。
- 否则按数据的 JSON 类型选出分支，给出它的第一条错误；值本身的错误写成 `{label} {原因}`。
- 没有类型相符的分支时，列出可选类型。

后两种只在 `validate` 中是断言；官方测试集仍把它们当注解测量。

## 自己措辞错误消息

`errorMessage` 替换默认消息。在 Jotl 中写成元数据 `errorMessage: ...`，例如 `string[errorMessage: {maxLength: 'At most 20 characters'}]`，见 [Jotl 语法规范](../../../../zh/docs/spec/jotl.md#元数据键)。

- 字符串形态替换该节点全部错误的消息。
- 对象形态以关键字名为键（如 `maxLength`、`required`），只替换该关键字的错误，其余错误保留默认文案。
- 查找顺序：缺少必填字段时，先看该字段自身的 schema，再看声明 `required` 的父对象；其余错误先看违反的关键字所在节点，再看数据路径上的字段节点。取第一个命中的。
- 文案可以引用 `{label}` 等消息参数。替换只改消息，不改代码与指针。
