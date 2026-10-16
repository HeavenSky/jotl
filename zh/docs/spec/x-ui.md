# x-ui 规范 v1 与 widget 契约

[English](../../../docs/spec/x-ui.md) · **简体中文**

本页规定 schema 中 `x-ui` 的写法、widget 的选择与降级规则，以及 widget 包要实现的契约。

`x-ui` 是 schema 节点上唯一的扩展关键字，可以写在任意节点上，也可以完全不写；不写时按内置规则自动选 widget。
类型定义是 `@jotl/core` 的 `XUi`（[`packages/core/src/schema/x-ui.ts`](../../../packages/core/src/schema/x-ui.ts)），widget 契约在 `@jotl/form/core`（[`packages/form/src/core/contracts.ts`](../../../packages/form/src/core/contracts.ts)），两者都与 UI 框架无关。

## 字段

| 字段 | 取值 | 语义 |
|---|---|---|
| `widget` | 非空字符串 | widget 名；内置名见 [内置 widget 名](#内置-widget-名) |
| `props` | 对象 | 透传给 widget 的参数，必须可 JSON 序列化 |
| `decorator` | 非空字符串或 `false` | 字段外壳的 widget 名；`false` 表示不要外壳 |
| `order` | 字符串数组 | 对象节点：子字段顺序，未列出的按原顺序排在后面 |
| `groups` | `{ title, fields }[]` | 对象节点：分组，未分组的字段排在最前 |
| `layout` | `"stack"` `"tabs"` `"grid"` | 对象节点的布局，默认 `stack`；`tabs` 时每个 `groups` 项一个标签页，未分组字段放在第一个标签页 |
| `columns` | 不小于 1 的整数 | `layout` 为 `grid` 时的列数，默认 2 |
| `hidden` | 布尔 | 隐藏该节点 |
| `visibleIf` | [显示条件](#显示条件) | 条件为假时不显示 |
| `summary` | 字段名 | 用于对象、元素为对象的数组和 map：入口行与面包屑显示该字段的值，见 [钻取渲染](#钻取渲染) |
| `thousands` | 布尔 | 用于 `number` `integer` `money` `bigint`：失焦与只读时按千分位显示；`money` 默认 `true`，其余默认 `false` |
| `variants` | 场景名 → 场景覆盖对象 | 按渲染场景覆盖；场景名由渲染器传入，默认 `"default"` |
| `rules` | [规则](#规则表)数组 | 只在根节点生效 |
| `version` | `1` | 只出现在根节点 |
| `widgets` | widget 名 → `{ base?, module, export? }` | 只出现在根节点：实现该 widget 的 ES 模块地址与导出名（缺省为 `default`）；`base` 是扩展组件的底层类型（类型名或 schema 对象，缺省为 `object`，只在声明了其他底层类型时出现），供 `print` 与编辑器还原该扩展组件，渲染器忽略它；本字段由 Jotl 根条目元数据 `widgets` 中的模块声明编译而来，渲染器可据此加载组件 |

场景覆盖对象和规则的 `ui` 只能包含 `widget` `props` `decorator` `order` `groups` `layout` `columns` `hidden` `visibleIf` `summary` `thousands`，不能包含 `variants` `rules` `version` `widgets`。

## 显示条件

```ts
type Leaf = { field: JsonPointer; base?: "node" };
type Condition =
  | Leaf & ({ eq: unknown } | { ne: unknown } | { in: unknown[] } | { notIn: unknown[] } | { truthy: boolean })
  | Leaf & ({ gt: number } | { gte: number } | { lt: number } | { lte: number })
  | { all: Condition[] } | { any: Condition[] } | { not: Condition };
```

- 叶子条件由 `field`、可选的 `base` 和恰好一个比较项组成。
- `field` 是 JSON Pointer：不写 `base` 时从数据根起算，`base: "node"` 时从当前节点所在的对象起算；其中的 `*` 取当前节点所在数组的对应下标。
- `gt` `gte` `lt` `lte` 只在两边都是数值时比较，否则为假。
- 比较按 JSON 值深度相等。`field` 指向的值不存在时，`eq` `in` `truthy: true` 为假，`ne` `notIn` `truthy: false` 为真；`truthy` 按 JavaScript 真值判断，空数组为真。
- 不可见字段保留数据，校验照常进行，其错误显示在表单级错误列表（`ViewProps.errors`）中。
- 求值函数是 `@jotl/form/core` 的 `evaluateCondition(cond, data, dataPath)`，`dataPath` 为当前节点的实际路径。

## 规则表

```ts
interface UiRule {
  match: { pointer?: string; type?: string; format?: string; enum?: boolean; widget?: string };
  ui: XUiVariant;
}
```

- `match` 中的各条件同时成立才算命中。
- `pointer` 匹配 schema 文档内的指针，`*` 匹配单个片段。
- `type` 要求节点的 `type` 恰好是这一个类型（`["string", "null"]` 不匹配 `"string"`）；`format` 匹配节点的同名关键字；`enum: true` 匹配枚举节点，`enum: false` 匹配非枚举节点。
- 带 `pointer` 的规则不匹配由 `type` 数组拆分合成的节点，因为它们与被拆分的节点共用指针。
- `widget` 匹配不计规则层时为该节点选出的 widget 名。
- 多条规则同时命中时按数组顺序依次合并，后者覆盖前者。

## 合并顺序

一个节点的有效 `x-ui` 由以下各层依次合并，后者覆盖前者：

1. 根 `rules` 中命中的规则
2. 被引用类型（`$defs`）上的 `x-ui`
3. 节点自身或引用处（与 `$ref` 同级）的 `x-ui`
4. 当前场景的 `variants[scene]`

- 对象做浅合并，`props` 再往下浅合并一层。
- `layout` `columns` `visibleIf` 等取合并后的值，写入渲染计划节点。

## widget 名候选与降级链

`widget` 不按浅合并覆盖：合并顺序中每一层给出的 `widget` 按优先级从高到低组成候选列表。

候选顺序（优先级从高到低）：节点处的场景变体 → 被引用类型的场景变体 → 节点自身或引用处 → 被引用类型 → 根规则表（数组中靠后的规则在前）；同名候选只保留最靠前的一项，场景变体的来源记为它所在的层。

- 候选列表之后依次接上注册表匹配器（`match` 返回值大于 0 的登记项，分值高的在前）、内置匹配规则，最后是兜底 widget `json`。
- `plan()` 按顺序取第一个可用的候选：widget 名未注册时记 F1 并跳到下一个；内置名不接受该数据形态（见下文 `builtinAccepts`），或登记项的 `accepts` 拒绝该形态时，记 F2 并跳到下一个。
- schema 用到渲染器不支持的特性（`JOTL5004`），或节点的 `$ref` 无法解析（`JOTL5005`）时，该节点用 `json`，记 F7。
- 选中的 widget 之后仍可用（已注册且通过形态检查）的候选写入 `RenderPlanNode.fallbackChain`，末尾是 `json`；选中的就是 `json` 时为空。渲染期 widget 报错（F4）时按这个顺序替换。
- 选中的 widget 属于 `view` `layout` `composite` 层且登记项带 `claims(schema)` 时，它返回的相对数据路径（如 `"img"`）上的子节点不进入渲染计划，由该 widget 自行渲染，经 `renderChild` 交还时再按需规划；返回 `"all"` 时不规划任何子节点。
- `RenderPlanNode.source` 记录选中 widget 的来源：`node` 节点自身或引用处，`ref` 被引用类型，`rule` 根规则表，`matcher` 注册表匹配器，`builtin` 内置匹配规则，`fallback` 兜底。
- 可空节点（`T | null`）上 `x-ui.widget` 指定的非 `nullable` 内置 widget 名，以及 `thousands` `summary`，描述的是内容：它们带给非空分支，不作为可空节点自身的候选，也不记 F2；其余 `x-ui`（如 `hidden`）作用于可空节点本身。

## 非法 x-ui

节点的 `x-ui` 不符合 meta-schema 时，该节点按没有 `x-ui` 处理，并在 `degraded` 中记录 F3；其他节点不受影响。

meta-schema 是 `@jotl/core` 导出的 `xUiMetaSchema`（[`packages/core/src/schema/x-ui-meta-schema.ts`](../../../packages/core/src/schema/x-ui-meta-schema.ts)），`$id` 为 `https://jotl.dev/schema/x-ui/v1`，供校验与编辑器补全使用。`@jotl/form/core` 不依赖 Ajv，判定 F3 时用按同一规则手写的结构检查 `checkXUi`。根节点的 `x-ui` 不合法时，根规则表一并失效。
meta-schema 比 TS 类型更严：它拒绝未知字段、`widget` `decorator` `summary` 中的空字符串、非整数或小于 1 的 `columns`，以及比较项多于一个的叶子条件。

## 内置 widget 名

`@jotl/form/core` 导出 `BUILTIN_WIDGETS`（名字 → 层级与优先级）和内置匹配规则；widget 包应为每个名字提供实现，没有实现的名字由 `plan()` 按 F1 降级。

| widget 名 | 层级 | 优先级 | 接受的形态 | 作为默认的形态 |
|---|---|---|---|---|
| `form` | view | P0 | 任意 | 根 |
| `field` | decorator | P0 | - | 字段外壳 |
| `page` | layout | P0 | object | object |
| `inline` | layout | P0 | object | - |
| `input` | field | P0 | string | string |
| `textarea` `password` | field | P0 | string | - |
| `richtext` | field | P1 | string | `contentMediaType: text/html` |
| `number` | field | P0 | number、integer | number、integer |
| `range` | field | P0 | 同时带 `minimum` 与 `maximum` 的 number、integer | - |
| `money` / `bigint` | field | P0 | money / bigint 对象（`properties.type.const` 为 `"money"` / `"bigint"`） | 同左 |
| `switch` | field | P0 | boolean | boolean |
| `checkbox` | field | P0 | boolean；枚举数组 | - |
| `select` | field | P0 | 枚举；枚举数组 | 选项不少于 2 个的枚举；枚举数组 |
| `radio` | field | P0 | 枚举 | - |
| `output` | field | P0 | 任意，只读显示 | `const`；只有一个选项的枚举；`type: "null"` |
| `date` `time` `datetime` | field | P0 | 对应 `format` 的 string；带 `x-valueFormat` 且没有 `format` 时为 string，存储格式是时间戳 `x` / `X` 时也可以是 integer（`time` 不接受） | 对应 `format`；带 `x-valueFormat` 时按 `x-ui.widget` 或格式内容 |
| `url` `email` `color` | field | P0 | 对应 `format` 的 string | 对应 `format` |
| `image` `file` | field | P0 | `format: uri` 的 string | - |
| `json` | field | P0 | 任意；string 时编辑 JSON 原文 | `{}`；`contentMediaType: application/json`；兜底 |
| `list` | composite | P0 | array；枚举数组 | array |
| `kv` | composite | P1 | map | map |
| `union` | composite | P1 | `oneOf` / `anyOf`；含至少两个非 null 类型的 `type` 数组 | 联合 |
| `nullable` | composite | P1 | 可空 | 可空 |
| `tree` | composite | P1 | 任意 | 递归引用 |
| `tuple` | composite | P2 | 元组 | 元组 |

- `format` 到 widget 名的映射是 `FORMAT_WIDGETS`。
- 内置 widget 名的形态检查统一由 `@jotl/form/core` 完成（`builtinAccepts`）：`widget` 指定的内置 widget 不接受该形态时，记 F2 并改用下一个候选，通常是该形态的默认 widget；界面上不提示，经 `onDegrade` 上报给开发者。

## 钻取渲染

`@jotl/form` 默认按页钻取；`JotlForm` 传 `drill={false}` 时退回各层在同一页展开。再加 `collapsible` 时，同页展开的组合字段（`page` 对象、`list`、`kv`、含对象分支的 `union`；`inline` 与 `tree` 除外）各包在一个可折叠面板里：标题行显示标题（数组元素为 `第 n 项`）、摘要（规则同入口行）和其下的错误数，第一层默认展开，更深的默认收起。

- 每层一页：当前页的标量字段直接编辑；不是页根的组合字段（`page` 对象、`list`、`kv`、`tree`、含对象分支的 `union`）显示为入口行，包含标签、摘要、其下的错误数和进入按钮。`inline` 对象在父页内展开；可空节点按其内容判断。
- 钻取时每页顶部都有面包屑（根页只有一层），页根对象自身的标题不再显示：字段显示 `title` 或键名，数组元素显示摘要或 `第 n 项`，map 的值显示键名。
- 摘要取 `x-ui.summary` 指定的字段值；没有指定时取第一个非空字符串字段（先按 schema 的属性顺序，再按数据的键顺序）；仍然没有时显示填写概况（`未填写`、`n 项`、`已填 n 项`）。数组元素的序号由列表显示，面包屑中没有摘要的数组元素显示 `第 n 项`。
- 当前页路径（JSON Pointer）由受控属性 `path` / `onPathChange` 给出，不传时由表单内部维护；路径中的数组下标越界（元素已被删除），或途经的 map 键已不存在（被删除或改名）时，退回该数组或 map 所在的层并通知 `onPathChange`；路径不合法时回到根。
- 提交时校验失败，跳到第一个错误路径上最深的一页。
- 面包屑与入口行的可选基础样式是 `@jotl/form/style.css`；面包屑单行显示，超宽时横向滚动。
- 按 JSON 类型区分的联合，分支没有 `title` 时，下拉框按表单语言显示类型名（中文为文本、数字、整数、是/否、列表、对象，`null` 为空）。

## 各层 widget props

`N` 是框架的节点类型，React 下为 `React.ReactNode`。完整类型见 [`packages/form/src/core/contracts.ts`](../../../packages/form/src/core/contracts.ts)。

| 接口 | 用于 | 在 `BaseProps` 之外的内容 |
|---|---|---|
| `BaseProps<N>` | 除外壳外的各层 | `id` 稳定 id，用于 label 的 `for` 与 `aria-describedby`；`schema`；`dataPath` 实际路径，数组下标为具体数字；`mode`；`props` 合并后的 `x-ui.props`；`adapters`；`renderChild(relativePath)` |
| `FieldProps<V, N>` | field 层 | `required`（是否为父对象的必填字段，根与数组元素为 false）`value` `onChange(value)` `onBlur()` `errors` `thousands` |
| `DecoratorProps<N>` | decorator 层（不继承 `BaseProps`） | `id` `label?` `description?` `required` `errors` `hidden` `children` |
| `LayoutProps<N>` | `page` `inline` | `fields`：`{ key, required, hidden, errorCount? }[]`，已按 `order` 排序，`hidden` 已计入 `visibleIf` 的求值结果，`errorCount` 是该字段及其子路径上当前显示的错误数（渲染器不提供时缺省）；`groups`；`layout`；`columns`；`additional?`：对象另有 schema 形式的 `additionalProperties` 时提供，是不属于 `properties` 的键的 `EntryEditing`（同 `MapProps` 的条目编辑部分） |
| `ArrayProps<N>` | `list` | `items`：`{ key, dataPath }[]`，`key` 是稳定的元素 key，不随排序改变；`canAdd` `canRemove` 由 `minItems` / `maxItems` 与 `mode` 算出；`add(index?)` `remove(index)` `move(from, to)`；`duplicate?(index)` 把该项深拷贝后插到它后面，受 `canAdd` 约束，渲染器不提供时 widget 不显示复制；`errors` 是数组层自身的错误（如数量越界） |
| `TupleProps<N>` | `tuple` | `items: { dataPath }[]`，即 `prefixItems` 各位置的实际路径；`errors` 是元组自身的错误；第 i 项用 `renderChild(String(i))` 渲染；`rest?` 只在 `items` 允许剩余元素时提供：`items: { key, index, dataPath }[]`、`canAdd` `canRemove` `add()` `remove(index)`，剩余元素按实际下标用 `renderChild(String(index))` 渲染 |
| `UnionProps<N>` | `union` | `branches: { title }[]` `activeBranch` `selectBranch(index)` `renderContent()`（渲染当前分支，数据路径与本节点相同）`errors`；内置 `union` 读取 `props.selector`：值为 `"buttons"` 且分支不超过 4 个时用分段按钮选择分支 |
| `NullableProps<N>` | `nullable` | `isNull` `setNull(isNull)` `renderContent()`（非空时渲染非空分支，数据路径与本节点相同）`errors` |
| `MapProps<N>` | `kv` | `entries: { key, name, dataPath }[]`，`key` 是条目的稳定 key，`name` 是字典键名；`canAdd` `canRemove`；`addEntry(name)` `removeEntry(name)` `renameEntry(from, to)`；`errors` |
| `TreeProps<N>` | `tree` | `expanded` `setExpanded(expanded)` `renderContent()` `errors`；折叠时不渲染内容 |
| `ViewProps<N>` | `form` | `submit()` `reset()` `children`；`errors`：不属于任何可见字段的错误（含钻取时不在当前页的）；`goToError?(error)`：定位 `errors` 中的一条，钻取时先切到所在页，再滚动到并聚焦字段（字段不可见时取最近的可见祖先），渲染器不提供时 widget 把错误显示为纯文本 |

- `renderChild(relativePath)` 的参数是相对数据路径，如 `"img"`、`"0"`、`"0/img"`；被渲染的子节点自身的 `x-ui` 照常生效。
- 渲染计划中，对象节点同时有 `properties` 与 schema 形式的 `additionalProperties` 时，属性子节点之后另有一个其余键的值模板（数据片段为 `*`，schema 位置为 `additionalProperties`）；元组节点每个 `prefixItems` 位置一个子节点，`items` 允许剩余元素时末尾另有一个剩余元素模板（数据片段为 `*`，schema 位置为 `items`）。
- `Adapters<N>` 是可插拔的外部能力，每项都可以不提供：`upload(file, ctx)` 上传后返回 URL，`ctx` 是 `UploadContext`（`dataPath` 实际路径，`schema` 字段的 schema）；`loadOptions(source)` 返回远程选项 `{ value, label }[]`；`richText(props)` 渲染富文本编辑器（可直接传入 `@jotl/form` 的 `richTextEditor`）。
- widget 一律是无状态的受控 widget：值只来自 `value`，变更只通过 `onChange`。
- 除上传状态、当前标签页这类不属于数据的界面状态外，唯一允许的局部状态是输入中尚不合法的草稿文本（如数字框里的 `-`、JSON 编辑器里未闭合的括号），一旦合法立即 `onChange`；例外是 `number` `money` `bigint` 用聚焦状态切换原值与千分位显示。

## 降级归属

| 编号 | 场景 | 由谁处理 |
|---|---|---|
| F1 F2 F3 F7 | widget 未注册、不匹配数据形态、`x-ui` 非法、schema 特性不支持或 `$ref` 无法解析 | `plan()`，记入 `degraded`；例外：外壳 widget 名未注册，以及注册表中没有 `json` 时，由 `@jotl/form` 在渲染期按 F1 处理 |
| F4 | widget 渲染报错 | `@jotl/form` 的错误边界，按 `fallbackChain` 依次替换 |
| F5 | 复合 widget 报错 | `@jotl/form`，拆开逐个渲染子节点 |
| F6 | 兜底 widget `json` | `@jotl/form` 的默认 widget 实现；渲染器另带最小兜底（`view` 模式为只读 `<pre>`，其余为 JSON `<textarea>`），保证没有 widget 包时也不白屏 |
| F8 | 数据与 schema 不符 | `@jotl/form`，保留原值，标记错误，该节点用 `json` |
| F9 | 懒加载失败 | `@jotl/form`，显示加载失败提示与重试按钮，同时像 F4 一样改用 `fallbackChain` 中的下一个 widget 渲染 |
