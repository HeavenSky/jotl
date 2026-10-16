# 迁移凤蝶 schema

[English](../../docs/fengdie-migration.md) · **简体中文**

本页讲怎样在代码里把凤蝶 schema（源码或 umo JSON）转成 Jotl 与 JSON Schema 2020-12，以及每种凤蝶类型和元数据迁移后的去向。前提是已按 [README](../README.md#快速开始) 装好 `@jotl/convert`；命令行里用 [`jotl` CLI](../../../cli/zh/README.md) 的 `jotl migrate-schema`。

## 迁移一份 schema

```ts
import { migrateFengdie } from "@jotl/convert";

const { jotl, schema, umo, diagnostics } = migrateFengdie(
  `Object(首页) {
    title(标题): String[maxLength: 20, required: true]
    start(开始): Date
  }`,
  "home.fengdie",
);
// jotl:
// Root(首页): {
//   title(标题): string[maxLength: 20]
//   start(开始)?: datetime[value_format: 'x']
// }
```

流程为：源码 → 与 toJson 同构的 umo JSON → JSON Schema 2020-12 → 由 `@jotl/core` 的 `print` 输出 Jotl。词法与文法以凤蝶编辑器实际使用的 umo-edit-sdk 0.0.8 为准（`parse/schema.l` `schema.yy`）。

## 决定迁移结果的四条口径

下文以 D1-D4 引用这四条。

- D1 `Date` 迁为毫秒时间戳整数（`datetime[value_format: 'x']`），凤蝶的存量数据无需转换即可通过校验。
- D2 第一层字段的 `group` 迁为根对象的 `x-ui.groups`，按 group 值渲染为分组。
- D3 没有对应 Jotl 写法的信息写入节点的 `x-fengdie`（机器可读，往返时保留），不写 `$comment`。
- D4 只有 `required: true` 的字段必填，其余按凤蝶语义选填。

## API

| 导出 | 作用 |
|---|---|
| `migrateFengdie(input, file?)` | `input` 为源码、umo JSON 文本（首个非空白字符为 `{`）或 umo JSON 对象；返回 `{ jotl?, schema?, umo?, diagnostics }`，有 error 时 `jotl` 为 `undefined`。`schema` 与 `jotl` 再编译的结果深度相等 |
| `fengdieToUmoJson(source, file?)` | 源码 → umo JSON，另返回 `origins`（节点到源码位置） |
| `umoJsonToSchema(umo, { origins?, file? })` | umo JSON → 未排序的 2020-12 文档；没有 `origins` 时，诊断位置为 umo JSON 中的指针 |
| `detectMigrateInput(text)` / `umoJsonFeature(json)` | 判定输入是凤蝶源码、umo JSON 还是常规 JSON Schema，并给出依据 |
| `MIGRATE_DIAGNOSTICS` | 凤蝶诊断代码表 |

## 解读诊断

- 词法与语法错误（`JOTL8001`-`JOTL8005`）与 jison 一样在第一个错误处停止。umo JSON 解析失败与结构不合法分别为 `JOTL8006` 与 `JOTL8007`。
- 其余问题都是 warning（`JOTL81xx`），不影响结果。只对真正丢失或改写的信息报 warning，无损保留在 `x-fengdie` 中的不报。
- 会让 umo-edit-sdk 的 toJson 抛错的写法，迁移时丢弃其元数据并报 `JOTL8118`。这类写法是给没有元数据表的类型写元数据，如 `Array<string>[...]`、`Component[...]` 与根上的 `OpenAction[...]`。

其他约定：

- 字符串与数组按 Jotl 默认允许为空；显式的 `minLength: 0` 等于不限，不写出。
- `x-fengdie` 在 Jotl 中写作 `x_fengdie`（D3）。结构信息占用 `type` `lottery` `public` `regExpFlags` 这几个键；同名的元数据改记为 `metaType` 等。

## 类型映射

| 凤蝶类型（umo `type`） | 2020-12 / Jotl | 说明 |
|---|---|---|
| `String`（及省略类型） `Text` `RichText` `URL` `Color` `File` `Image` `Number` `Boolean` | `string` `text` `richtext` `url` `color` `file` `image` `number` `boolean` | 未知类型名退回 `string`，报 `JOTL8111` |
| `Date` | `datetime[value_format: 'x']` | 凤蝶编辑器用日期时间选择器，数据是毫秒时间戳；schema 为 `{type: integer, minimum: -MAX_SAFE_INTEGER, maximum: MAX_SAFE_INTEGER, x-valueFormat: 'x', x-ui: {widget: 'datetime'}}` |
| `Enum` | `enum`；有说明时为 `oneOf` | `multiple: true` 为多选；2-5 项的单选写 `widget: 'radio'`，多选写 `widget: 'checkbox'`；没有成员时为字符串（`JOTL8114`） |
| `Array<string>` `Array<number>` | `array[array_item: 'string' / 'number']` | |
| `Object` `Action` `OpenAction` `Spm` | 对象 | `Spm` 固定为 `spma` `spmb` `spmc` 三个字符串 |
| `Array` | 对象数组 | |
| `Module` `ModuleArray` `命名空间.组件` `命名空间.组件[Array]` | 对象 / 对象数组 | `namespace` `component` `version` `url` `dist` 记入 `x-fengdie` |
| `Box` `Resource` `Plugin` `Animation` `Video` | 按 umo-edit-sdk mock 数据形态构造的对象，不封闭 | |
| `Component` | `string` | 组件实例 id |
| 根 `Lottery` / `public` | 对象 | `x-fengdie.lottery` / `x-fengdie.public`，不报 warning |
| `export a ... export b ...` | 各自成为 `$defs` 类型，第一条为根 | 不是大驼峰的名字按 `print` 的规则改名，报 `JOTL8117` |

`Component` `Box` `Resource` `Plugin` `Animation` `Video` `Action` `OpenAction` `Spm` `Module` `ModuleArray` 与命名空间类型的原类型名记入 `x-fengdie.type`。

## 元数据映射

| 凤蝶元数据 | 去向 |
|---|---|
| 说明 `(...)` / `description` | `title` / `description` |
| `default` `defaultValue` | `default`，按类型修正（`JOTL8107`），不满足约束时丢弃（`JOTL8108`）；同时出现时取 `default`（`JOTL8115`） |
| `minLength` `maxLength` | 字符串为 `minLength` `maxLength`；数组为 `minItems` `maxItems` |
| `min` `max` / `step` | `minimum` `maximum` / `x-ui.props.step` |
| `regExp` | `pattern`；`"/^https:/gi"` 去掉定界符；`i` 改写进 pattern（字母改为 `[hH]`，字符类补上另一种大小写），遇 Unicode 属性类、反向引用等无法安全改写时保持原样并报 `JOTL8119`；`g` 忽略；`m` `s` `u` `y` 报 `JOTL8120`；未生效的标志记入 `x-fengdie.regExpFlags` |
| `errorMsg` | `errorMessage` |
| `placeholder`，以及 `Image` 的 `width` `height` `maxWidth` `maxHeight` `aspectRatio` `maxSize` `setDefaultColorTo` | `x-ui.props` |
| `if: "$.路径"` | `x-ui.visibleIf`（Jotl 的 `root_if`）；其他写法记入 `x-fengdie` |
| `required: true` | 父对象的 `required`（D4） |
| 第一层字段的 `group` | 根对象的 `x-ui.groups`：`normal` General、`advance` Advanced、`developer` Developer、`operator` Operations（`zh-CN` 下为常规、高级、开发者、运营；D2）；更深层的记入 `x-fengdie` |
| `showKey` | `x-ui.summary`；不是元素字段时丢弃（`JOTL8106`） |
| 白名单内的其余项（`rule` `source` `searchType` `sourceType` `reuseable` `autoFetch` `entityType` `mappingRuleId` `defaultSourceType` `ucdp` `spmC` `spmD` `configId` `crossApp` `i18n` 等）与 `custom*` | `x-fengdie` 中的同名项，不报 warning（D3） |
| 白名单外 | 丢弃，报 `JOTL8105`（与 toJson 一致） |

各类型的元数据白名单是 [`src/migrate/fengdie/umo-types.ts`](../../src/migrate/fengdie/umo-types.ts) 的 `UMO_META_KEYS`，取自 umo-edit-sdk 的 `lib/types.js`。

## 已知限制

见根目录 [`TODO.md`](../../../../TODO.md) 的「确定不修」。
