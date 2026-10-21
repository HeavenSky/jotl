# 共享样例集

[English](../README.md) · **简体中文**

`fixtures/` 中的样例是各包测试共同比对的期望值，修改已有样例就是修改契约，各包都要同步跟进。本页说明样例的目录、比较口径与期望输出的约定；测试经 `test-utils/fixtures.ts` 读取样例。语法与契约以 [Jotl 规范](../../zh/docs/spec/jotl.md)和 [x-ui 规范](../../zh/docs/spec/x-ui.md)为准。

## 目录

```
fixtures/
  <三位序号>-<英文短名>/
    source.jotl          Jotl 源码
    schema.json          期望编译结果(规范化的 JSON Schema 2020-12)
    types.d.ts           期望 TS 输出
    defaults.json        期望默认数据(策略 explicit, 其余选项取默认)
    valid/*.json         应通过校验的数据
    invalid/*.json       应失败的数据; 同名 *.errors.json 为期望错误
    diagnostics.json     只在期望编译出错的样例中出现, 为期望诊断
    meta.json            { "covers": [功能项编号], "skip": [跳过的期望文件], "defaultExport": 默认导出类型名 }
```

新增样例按所属包取序号段：`1xx` core（语法），`2xx` convert（TS），`4xx` data，`5xx` form（core/），`7xx` form（html/）；`001`-`099` 为共享基础样例。

## 比较口径

| 文件 | 比较方式 |
|---|---|
| `schema.json` | 深度相等，不比较关键字顺序 |
| `types.d.ts` | 统一为 LF 后逐字相等 |
| `defaults.json` | 深度相等 |
| `*.errors.json` | 按集合相等比较 `{ code, pointer }`，不比较顺序与消息文字 |
| `diagnostics.json` | 按集合相等比较 `{ code, line, column }`；行列从 1 起，列按 UTF-16 代码单元计 |

## 期望错误的约定

- `pointer` 是数据中的 JSON Pointer。缺少必填字段时指向缺失的字段本身（如 `/name`），出现不允许的字段（`JOTL4008`）时指向多出的字段本身（如 `/zip`），都不指向父对象。
- 一处违反只报一条：带标签枚举（`oneOf` 的 `const` 分支）不匹配时只报 `JOTL4006`，不展开各分支的错误；`anyOf` 全部分支失败时只报 `JOTL4012`；类型不符时不再报同一节点上的其他约束。
- 各代码的含义定义在 `packages/data/src/diagnostics.ts`。
- `color` 格式为 CSS 十六进制颜色：`#rgb` `#rgba` `#rrggbb` `#rrggbbaa`。

## TS 输出格式

`types.d.ts` 由 schema 生成，JSDoc 标签的定义见 [`@jotl/convert` 标签协议](../../packages/convert/zh/docs/tag-protocol.md)。格式约定如下：

- 第一行是 `// 由 Jotl 生成, 不要手改.`，之后空一行；顶层声明之间空一行；文件以换行结尾。
- `$defs` 中的类型全部导出，按 `$defs` 顺序输出；对象为 `export interface`，其余为 `export type`。文件末尾写 `export default X;`，X 为源码的默认导出（`<default/>`），未写时为根 `$ref` 指向的类型。
- 默认导出与根不同时（只有带 `meta.defaultExport` 的样例），`types.d.ts` 按该名生成，根类型注释写 `@root`。`meta.defaultExport` 必须等于 `source.jotl` 编译出的 `defaultExport`，由 core 的语法样例测试核对；不编译源码的包（`@jotl/convert`）从 `meta.json` 读取它。
- 两空格缩进；内联对象与索引签名都展开为多行；属性顺序同 schema。
- 有描述或标签时写多行 JSDoc：描述各行在前，之后标签按规范化的关键字顺序排列。`type: integer` 写成 `@asType integer`，节点为枚举或常量时不写。
- 数组元素是枚举时，`@enumTitles` 写在数组属性上；数组元素的 `x-ui` 写成数组属性上的 `@itemWidget` / `@itemUi`。
- 可区分联合中以 `allOf` 引用的分支写成交叉类型 `X & { kind: "x" }`，分支的 `title` 写成联合节点上的 `@branchTitles`。
- `x-ui` 只有 `widget` 时写 `@widget 名字`，否则写 ``@ui `{...}` ``。
- 根 `$id` 与根 `x-ui.rules` 写在根类型注释的末尾：`@id URI`、``@rules `[...]` ``；有 `@root` 时它排在两者之前。

样例含有 `@jotl/convert` 无法表达的内容时，转换会丢弃这些内容并报 `JOTL2002`，此类样例用 `meta.skip` 跳过 `types.d.ts`：

- 元素级约束或注解：数组元素、`map` 值、联合分支、元组位置上的约束、`title` 与 `x-ui`（数组元素的 `x-ui`，以及能写成具名元组的元组位置 `title` 除外）：`007` `109` `110`。
- 联合分支上的 `additionalProperties: false`（`closed`；其他位置写成 `@closed`，数组元素与可空对象的上提到所在属性）：`109`。
- Jotl 扩展关键字 `x-decimals` 与 `contentSchema` `propertyNames`：`108` `110`。
