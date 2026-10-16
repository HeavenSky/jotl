# 生成默认数据

[English](../../docs/default-data.md) · **简体中文**

读完本页，你能用 `getDefaults` 按 schema 生成初始数据，用 `fillDefaults` 补全不完整的数据。各函数共用的约定（含 `locale` 与 `at`）见[调用约定](./api.md)。

## 选择策略

```js
import { getDefaults } from "@jotl/data";

const schema = {
  type: "object",
  properties: {
    title: { type: "string", maxLength: 5, default: "Home" },
    count: { type: "integer", minimum: 1 },
    color: { type: "string", format: "color" },
    tags: { type: "array", minItems: 1, items: { type: "string" } },
  },
  required: ["title", "count"],
};

getDefaults(schema).value; // { title: "Home" }
getDefaults(schema, { strategy: "required" }).value; // { title: "Home", count: 1 }
getDefaults(schema, { strategy: "all" }).value; // { title: "Home", count: 1, color: "", tags: [""] }
```

节点自身有 `default`，或经 `$ref`、`allOf` 合并的节点有 `default` 时，一律取它的拷贝。没有时按策略：

| 节点 | `explicit`（默认） | `required` | `all` |
|---|---|---|---|
| 对象 | 只含能产出值的属性；一个都没有时，根为 `{}`，其他对象省略 | 必填属性递归产出，可选属性只取显式默认值。可选对象因子字段有默认值而出现时，它的必填字段也补上。至少为 `{}` | 全部属性递归产出 |
| 数组 | 省略，即使元素有默认值 | 必填时生成 `minItems` 个元素，元素无值时用零值 | 同 `required`，可选数组也生成 |
| 标量 | 省略 | 必填时用零值 | 用零值 |

## 设置其他选项

选项类型是 `@jotl/core` 的 `DefaultsOptions`，默认值为 `DEFAULT_DEFAULTS_OPTIONS`：`strategy: "explicit"`、`arrayItems: "minItems"`、`oneOf: "firstWithDefault"`、`maxDepth: 3`。选项值不合法时报 `JOTL4018`，`value` 为 `undefined`。

- `arrayItems: "none"`：所有需要生成的数组都是空数组。
- `oneOf` 作用于 `anyOf` 与 `oneOf`，带标签枚举除外。`"firstWithDefault"` 取第一个能产出值的分支，都不能时取第一个分支；`"first"` 总取第一个分支。
- `maxDepth` 限制同一个 `$ref` 目标在当前路径上的展开次数，不是数据的嵌套层数。达到上限后该引用不再展开，节点按无值处理。例如必填的递归字段 `Node.child` 在默认值 `3` 下产出 `{ name, child: { name, child: { name } } }`。

无法解析的 `$ref` 报 `JOTL4016` warning，该节点按无值处理。

## 零值长什么样

没有默认值的必填字段用零值填充：

- 枚举与 `const`：第一个可选值。
- 字符串 `""`，数字与整数取 `minimum`（没有时为 `0`），布尔 `false`，`null`，对象 `{}`，数组 `[]`。
- 带 `x-valueFormat` 的字符串：本地时间 `2000-01-01 00:00:00` 按该格式写出；时间戳整数仍为 `0`。
- 无 `x-valueFormat` 的 `format: "date"`、`"time"`、`"date-time"` 字符串：同一时刻的 `2000-01-01`、`00:00:00±HH:mm`，或带本地偏移的 RFC 3339。
- money 与 bigint 对象（按 `properties.type.const` 识别）的 `value`：取满足 pattern 小数位与 `x-decimalRange` 的值，依次尝试 `"0"`、`minimum`、`maximum`、`exclusiveMinimum` + 1、`exclusiveMaximum` - 1，并补齐小数位。币种没有约束时取 `CNY`。
- JSON 文本（`contentMediaType: "application/json"`）：`contentSchema` 默认数据的序列化结果，没有 `contentSchema` 时为 `"{}"`。

除以上情况外，零值不考虑 `format`、`minLength`、`pattern` 等约束，结果不保证能通过 `validate`。

## 补全已有数据

`fillDefaults(schema, data, opts?)` 接受除 `at` 以外与 `getDefaults` 相同的选项，不覆盖任何已有值。

```js
import { fillDefaults } from "@jotl/data";

const schema = {
  type: "object",
  properties: { title: { type: "string", default: "Home" }, count: { type: "integer" } },
};
fillDefaults(schema, { count: 2 }).value; // { data: { count: 2, title: "Home" }, filled: ["/title"] }
```

- 只为缺失的已声明属性产出值。已有字段（含 `null` 与空串）原样保留，并继续向下补全。
- 数组按现有元素逐个补全，不增删元素。
- 缺失的整棵子树按策略整体产出，`filled` 只记子树根的指针。
- 联合类型按数据的类型与字段重合度选一个分支补全。
- `data` 为 `undefined` 时等同 `getDefaults`；产出了值时 `filled` 为 `[""]`。
