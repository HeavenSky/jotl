# 迁移旧数据

[English](../../docs/migration.md) · **简体中文**

读完本页，你会知道 `migrate(schema, data, opts?)` 怎样把按旧 schema 保存的数据修正为符合新 schema。它只接受 `locale` 选项，其他约定见[调用约定](./api.md)。

```js
import { migrate } from "@jotl/data";

const schema = {
  type: "object",
  properties: { title: { type: "string" }, count: { type: "integer" } },
  required: ["title", "count"],
};
migrate(schema, { title: 12, count: "3", old: true }).value;
// { data: { title: "12", count: 3 }, changed: ["/title", "/count", "/old"] }
```

传入的数据不会被修改；每处改动的位置记入 `changed`。

## 删除与补充字段

- 对象声明了 `properties`，合并后的各节点都没有 `patternProperties` 或 `unevaluatedProperties`，且 `additionalProperties` 未写或为 `false` 时，删除未声明的字段。
- 否则，未声明的字段按 `additionalProperties` 或 `patternProperties` 的 schema 逐项迁移；没有对应 schema 的字段保持原样。
- 缺失的已声明属性只按显式默认值补上，与[默认数据](./default-data.md)的 `explicit` 策略相同。

## 类型转换

类型不符时，按 schema 中类型的顺序尝试转换，第一个成功的结果保留：

| 目标类型 | 可转换的值 |
|---|---|
| `string` | 数字与布尔 → `String(value)` |
| `number` | 数字、非空白的数字字符串 |
| `integer` | 同 `number`，再四舍五入 |
| `boolean` | 字符串 `"true"` 与 `"false"` |
| `array` | 任意非 `null` 值 → 单元素数组 |
| 任意非数组类型 | 单元素数组先取出该元素，再按上述规则转换 |

联合类型先按数据匹配分支；都不匹配时，依次尝试转换为各分支的类型。

## 无法保留的值

转换失败、不在枚举可选值中，或 schema 为 `false` 时，值无法保留，按以下顺序处理：

1. 有 `default` 时取默认值。
2. 否则，可选字段与数组元素删除。
3. 否则，必填字段取零值；没有零值时删除。

`migrate` 不修复 `maxItems`、`uniqueItems`、`maxLength` 等约束违规，迁移后请再调用 `validate`。
