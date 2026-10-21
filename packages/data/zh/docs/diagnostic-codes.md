# 诊断代码

[English](../../docs/diagnostic-codes.md) · **简体中文**

本页列出 `@jotl/data` 报告的全部 `JOTL4xxx` 代码，以及各自的级别、来源函数与含义。代码表是 `packages/data/src/diagnostics.ts` 的 `DATA_DIAGNOSTICS`；消息中的 `{label}` 是字段标签，规则见[校验数据](./validation.md#读懂校验错误)。

| 代码       | 级别    | 来源                                      | 含义                                                                                 |
| ---------- | ------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `JOTL4001` | error   | validate                                  | 类型不符                                                                             |
| `JOTL4002` | error   | validate                                  | 缺少必填字段（含 `dependentRequired`）                                               |
| `JOTL4003` | error   | validate                                  | 超出 `minimum`、`maximum`、`exclusiveMinimum` 或 `exclusiveMaximum`                  |
| `JOTL4004` | error   | validate                                  | 字符串长度不符 `minLength` 或 `maxLength`                                            |
| `JOTL4005` | error   | validate                                  | 不匹配 `pattern`                                                                     |
| `JOTL4006` | error   | validate                                  | 不在 `enum` 或带标签枚举的可选值中                                                   |
| `JOTL4007` | error   | validate                                  | 数组项数不符 `minItems` 或 `maxItems`                                                |
| `JOTL4008` | error   | validate                                  | 不允许的字段（`additionalProperties`、`unevaluatedProperties`）                      |
| `JOTL4009` | error   | validate                                  | 不符合 `format`                                                                      |
| `JOTL4010` | error   | validate                                  | 不是 `multipleOf` 的倍数                                                             |
| `JOTL4011` | error   | validate                                  | `uniqueItems` 下有重复项                                                             |
| `JOTL4012` | error   | validate                                  | `anyOf` / `oneOf` 没有一个分支符合                                                   |
| `JOTL4013` | error   | validate                                  | 不等于 `const`                                                                       |
| `JOTL4014` | error   | validate                                  | 字段数不符 `minProperties` 或 `maxProperties`                                        |
| `JOTL4015` | error   | validate                                  | 同时符合 `oneOf` 的多个分支                                                          |
| `JOTL4016` | warning | getDefaults、fillDefaults、migrate、mock  | 无法解析的 `$ref`，节点按无值处理                                                    |
| `JOTL4017` | error   | validate                                  | schema 无法编译；Ajv 原文放在 `related` 中，指针为根                                 |
| `JOTL4018` | error   | getDefaults、fillDefaults、validate、mock | 选项值不合法，含 `at` 指针不存在或不指向 schema                                      |
| `JOTL4019` | warning | mock                                      | 无法生成满足约束的数据（引用过深或 `pattern` 无法生成）                              |
| `JOTL4020` | error   | validate                                  | 小数位超过 `x-decimals`                                                              |
| `JOTL4021` | error   | validate                                  | money 或 bigint 对象的 `value` 超出 `x-decimalRange`                                 |
| `JOTL4022` | error   | validate                                  | `contentMediaType: "application/json"` 的字符串不是合法 JSON                         |
| `JOTL4023` | error   | validate                                  | JSON 文本的解析结果不符 `contentSchema`                                              |
| `JOTL4024` | error   | validate                                  | 键名不符 `propertyNames`                                                             |
| `JOTL4025` | error   | validate                                  | 字符串不符 `x-valueFormat` 存储格式                                                  |
| `JOTL4099` | error   | validate                                  | 其余校验失败：`not`、`false` schema、`contains`、`unevaluatedItems` 及未归类的关键字 |
