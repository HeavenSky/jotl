# 使用 schema 契约

[English](../../docs/schema-contract.md) · **简体中文**

读完本页，你会知道读写 Jotl schema 时该用哪些共享类型与工具函数：JSON Schema 文档、`x-ui` 关键字、日期存储格式和数据能力接口。`@jotl/core` 的这部分没有运行时依赖。

## 遍历 JSON Schema 文档

- `JsonSchema`、`JsonSchemaObject`、`JsonSchemaType`、`JsonValue` 描述 2020-12 文档；`JsonSchema` 含布尔 schema，`isSchemaObject` 把它收窄为对象形态。
- `JSON_SCHEMA_DIALECT` 的值是 `"https://json-schema.org/draft/2020-12/schema"`。
- `SUBSCHEMA_KEYWORDS` 列出存放子 schema 的关键字，按形态分三组：

    ```ts
    {
      single: ["additionalProperties", "items", "contains", "propertyNames", "not", "if", "then", "else", "unevaluatedItems", "unevaluatedProperties", "contentSchema"],
      array: ["prefixItems", "allOf", "anyOf", "oneOf"],
      map: ["properties", "patternProperties", "$defs", "dependentSchemas"],
    }
    ```

- `orderKeywords(schema)` 按 [Jotl 语法规范](../../../../zh/docs/spec/jotl.md#规范化规则)的规范化规则 7 重排关键字，递归处理子 schema，返回新对象。例如 `{ type: "string", title: "T", maxLength: 1 }` 变为 `{ title: "T", type: "string", maxLength: 1 }`。

## 读取与校验 x-ui

- `XUi` 及其子类型、`XUiWidgetModule`、`DEFAULT_SCENE`、`DEFAULT_GRID_COLUMNS`（从 `src/schema/x-ui.ts` 导出）是 `x-ui` 关键字的类型与默认值，语义见 [`x-ui` 规范](../../../../zh/docs/spec/x-ui.md)。
- `xUiMetaSchema` 是 `x-ui` 的 2020-12 meta-schema，禁止未知字段，用于校验和编辑器补全。

## 检查日期存储格式

`x-valueFormat` 让日期组件的值按自定义格式存储。下面这些导出让各包共用同一套规则：

- `DEFAULT_VALUE_FORMATS`：各组件的默认格式，`date` → `YYYY-MM-DD`，`time` → `HH:mm:ss`，`datetime` → `iso`。
- `VALUE_FORMAT_ALIASES`（`iso`、`iso-x`、`utc`、`utc-x`）及 `isValueFormatAlias`；`TIMESTAMP_VALUE_FORMATS`（`x`、`X`）及 `isTimestampValueFormat`。
- `valueFormatComponent(format)` 在没有 `x-ui.widget` 时推断组件（类型 `TemporalComponent`）：时间戳、别名，以及同时含日期与时间记号的格式为 `datetime`；只含时间记号为 `time`；其余为 `date`。例如 `valueFormatComponent("HH:mm")` 返回 `"time"`。

不想依赖 dayjs 时，用 `matchesValueFormat(format, value)`、`matchesValueFormatText(format, text)` 与 `isRfc3339DateTime(text)` 检查取值，结论与 `@jotl/data` 一致：

- 时间戳只要求是整数；别名按 RFC 3339 判断。
- 格式串严格逐位匹配，并校验日历日期：`matchesValueFormat("YYYY-MM-DD", "2024-02-30")` 为 `false`。
- 只支持 `YYYY MM DD HH mm ss SSS Z ZZ A a` 这些记号与 `[..]` 转义。含其他记号时，`matchesValueFormatText` 返回 `undefined`，`matchesValueFormat` 返回 `true`，表示不做判定。

## 实现或注入数据能力

`DataApi`、`GetDefaults`、`FillDefaults`、`Validate`、`Migrate`、`Mock`、`DefaultsOptions`、`MockOptions` 是数据能力接口的类型，你的代码可以依赖接口而不绑定具体的包。`DEFAULT_DEFAULTS_OPTIONS` 是默认选项：`strategy: "explicit"`、`arrayItems: "minItems"`、`oneOf: "firstWithDefault"`、`maxDepth: 3`。

标准实现是 `@jotl/data`，行为见 [`@jotl/data` 使用指南](../../../data/zh/docs/README.md)。
