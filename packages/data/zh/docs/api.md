# 调用约定

[English](../../docs/api.md) · **简体中文**

本页说明 `@jotl/data` 每个函数都遵守的约定：返回什么、用哪种语言、怎样只处理文档的一部分。前提是已按[快速开始](../README.md#校验第一个对象)装好 `@jotl/data`。

## 函数与返回值

每个函数都返回 `@jotl/core` 的 `Result`，不抛异常，也不修改传入的 schema 与数据。`Result` 的读法见[处理结果与诊断](../../../core/zh/docs/diagnostics.md)。

| 函数                                | `value` 的内容                                        | 指南                              |
| ----------------------------------- | ----------------------------------------------------- | --------------------------------- |
| `getDefaults(schema, opts?)`        | 默认数据                                              | [生成默认数据](./default-data.md) |
| `fillDefaults(schema, data, opts?)` | `{ data, filled }`：补全后的数据与补上的位置          | [生成默认数据](./default-data.md) |
| `validate(schema, data, opts?)`     | `{ valid }`；错误是 `location.kind: "pointer"` 的诊断 | [校验数据](./validation.md)       |
| `migrate(schema, data, opts?)`      | `{ data, changed }`：修正后的数据与改动的位置         | [迁移旧数据](./migration.md)      |
| `mock(schema, opts?)`               | 满足 schema 的数据                                    | [生成 Mock 数据](./mock.md)       |

`dataApi` 把这五个函数打包成 `@jotl/core` 的 `DataApi`，供以参数接收实现的代码使用。

其他导出：

- `DATA_DIAGNOSTICS` 与 `dataDiagnostic`：代码表（带英文模板 `en`）及其诊断工厂。
- `DATA_TEXT`、`DATA_TEXT_EN`、`dataText()` 与类型 `DataText`：拼进消息的中文与英文片段，如标签、类型名；`dataText()` 按当前全局语言取其中一份。
- `COLOR_PATTERN`：`color` 格式的正则。

## 设置语言

选项 `locale`（`"zh-CN"` 或 `"en"`，类型 `LocaleOptions`）只决定本次调用产生的诊断与消息的语言。不传时取 `@jotl/core` 的全局 `getLocale()`，默认 `en`。

```js
import { validate } from "@jotl/data";

const schema = { type: "object", properties: { title: { type: "string", title: "Title" } } };
validate(schema, { title: 1 }, { locale: "zh-CN" }).diagnostics[0].message; // "Title 的类型应为字符串"
```

## 只处理文档的一部分

`getDefaults` 与 `validate` 接受选项 `at`（类型 `SubschemaOptions`，即 `{ at?: JsonPointer | JsonSchema }`），只针对大文档中的某个子 schema 求默认值或校验。

```js
import { getDefaults, validate } from "@jotl/data";

const doc = {
	$defs: {
		Address: {
			type: "object",
			properties: {
				city: { type: "string", title: "City", default: "Paris" },
				zip: { type: "string", pattern: "^[0-9]{5}$" },
			},
			required: ["city"],
		},
	},
};
getDefaults(doc, { at: "/$defs/Address" }).value; // { city: "Paris" }
validate(doc, { city: 1, zip: "x" }, { at: "/$defs/Address" }).diagnostics.map(
	d => d.location.pointer
); // ["/city", "/zip"]
```

- 传 JSON 指针时取文档中该处的子 schema；传 schema 值时原样使用，例如你由文档节点合成的有效 schema。
- 两种形式中的引用都按整个文档解析，规则与不带 `at` 时相同。
- 数据根落在子 schema 上：校验错误的指针与标签都相对于它，根标签为「数据」（`zh-CN`）或「data」（`en`）。
- 指针不存在或不指向 schema 时报 `JOTL4018`。
- 子 schema 自带的 `$id` 与 `$schema` 在校验时忽略。
