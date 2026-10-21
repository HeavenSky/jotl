# 用 `@jotl/form/core` 实现渲染器

[English](../../docs/core.md) · **简体中文**

本页说明如何用子路径 `@jotl/form/core` 为其他 UI 框架实现 Jotl 渲染器或 widget 包，或在工具（如语言服务）中查询某个 schema 节点用哪个 widget。它不依赖 React；只用这个子路径时，安装 `@jotl/form` 不必装 `react`。本包的 React 渲染器与默认 HTML widget 都建立在它之上。

## 规划一个 schema

```ts
import { BUILTIN_WIDGETS, createRegistry, evaluateCondition, plan } from '@jotl/form/core';

const schema = {
  type: 'object',
  properties: {
    title: { type: 'string', title: '标题', 'x-ui': { widget: 'headline' } },
    kind: { enum: ['a', 'b'] },
    extra: { type: 'string', 'x-ui': { visibleIf: { field: '/kind', eq: 'b' } } },
  },
  required: ['title'],
};

// 组件包通常为每个内置组件名登记一个实现; 这里用组件名本身占位.
const registry = createRegistry(
  Object.entries(BUILTIN_WIDGETS).map(([name, { level }]) => ({ name, level, component: name }))
);

const { value: root, diagnostics } = plan(schema, registry);
// root.widget === "form", 唯一子节点是数据根, widget 为 "page".
// /title: headline 未注册, 降级为 "input", degraded 为 [{ reason: "F1", from: "headline" }].
// diagnostics: [JOTL5001 warning].
// /kind: 枚举(选项不少于 2 个)默认为 "select"; x-ui.widget 写了该形态不接受的内置名(如 "switch")时按 F2 降级回 "select".

const extra = root!.children[0]!.children.find(c => c.dataPath === '/extra')!;
evaluateCondition(extra.visibleIf!, { kind: 'b' }, extra.dataPath); // true
```

- 渲染计划是与数据无关的模板树（`RenderPlanNode`）：数组下标写作 `*`，数组元素个数与联合类型的当前分支由你的渲染器按数据决定。
- 节点上的 `summary`（对象、数组、map）与 `thousands`（`number` `money` `bigint`；`money` 缺省为 `true`）取自合并后的 `x-ui`，供钻取入口行与数值 widget 使用。
- 取值、校验与默认值不在 `core` 内；本包的 React 渲染器用 `@jotl/data` 完成。
- widget 包应为 `BUILTIN_WIDGETS` 中的每个名字提供实现；各层收到的 props 见[编写 widget](widget-contract.md)。

## 找到需要的函数

签名见类型声明；下表说明各导出的用途。

| 导出                                                                                                        | 用途                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createRegistry(registrations?, parent?)`                                                                   | 创建注册表；传入 `parent` 时等同于 `parent.extend()`。`list()` 中本级登记在前，匹配器分值相同时排在前面的胜出                                                                                                                                                                              |
| `plan(schema, registry, options?)`                                                                          | 返回 `Result<RenderPlanNode>`。`schemaPointer` 为空（默认）时根节点是视图 widget `form`；指向子节点时从该节点开始规划，用于渲染期按需规划                                                                                                                                                  |
| `expand(node, schema, registry, ctx?)`                                                                      | 展开标记为 `lazy: true` 的节点，返回 `Result<RenderPlanNode>`。`ctx` 中的场景、模式与 `maxDepth` 优先，其次沿用同一进程内 `plan()` 生成该节点时的值，再次取默认值                                                                                                                          |
| `resolvePlanNode(node, schema)`                                                                             | 渲染计划节点的有效 schema（`ResolvedNode`），与 `plan()` 判定形态所用的一致，含按 `type` 数组拆出的分支与数组无 `items` 时的空元素 schema。节点被复制或序列化后按 `schemaPointer` 解析                                                                                                     |
| `resolveSchemaAt(schema, pointer)` `resolveSchema(document, schema, pointer?)`                              | 有效 schema：沿文档内 `$ref`（`#` 与 `#/...`）由远及近浅合并到引用处，并合并 `allOf` 成员。`origin` 给出每个关键字所在的 schema 位置，`unresolvedRef` 为无法解析的引用。`resolveSchemaAt` 按文档与指针缓存，指针不存在时返回空 schema                                                      |
| `evaluateCondition(cond, data, dataPath)`                                                                   | 按数据求 `visibleIf`。`dataPath` 为实际路径，条件中 `field` 的 `*` 取其中同一位置的片段；叶子带 `base: "node"` 时 `field` 从节点所在对象起算；`gt` `gte` `lt` `lte` 只比较数值                                                                                                             |
| `jsonEqual(a, b)`                                                                                           | 条件比较所用的 JSON 值深度相等                                                                                                                                                                                                                                                             |
| `resolveXUi(schema, schemaPointer?, options?)`                                                              | 返回 `Result<ResolvedXUi>`：某个位置合并后的 `x-ui`、各层候选 widget、命中的根 `rules`、选中的 widget 与降级。未传 `registry` 时按所有 widget 名均已注册计算。供语言服务与调试视图使用                                                                                                     |
| `checkXUi(value)`                                                                                           | 不依赖 Ajv 的 `x-ui` 结构校验，返回第一处问题或 `undefined`；规则与 `@jotl/core` 的 `xUiMetaSchema` 一致                                                                                                                                                                                   |
| `matchBuiltinWidget(schema, document?)`                                                                     | 只按 schema 形态求内置 widget 名，不看 `x-ui` 与注册表                                                                                                                                                                                                                                     |
| `builtinAccepts(name, schema, document?)`                                                                   | 内置 widget 名能否处理该数据形态；非内置名返回 `undefined`                                                                                                                                                                                                                                 |
| `BUILTIN_WIDGETS` `FORMAT_WIDGETS`                                                                          | 内置 widget 名及其层级，`format` 到 widget 名的映射                                                                                                                                                                                                                                        |
| `decimalKind(schema)` `RICH_TEXT_MEDIA_TYPE` `JSON_TEXT_MEDIA_TYPE` `splitBranch`                           | 形态识别：`money` / `bigint` 值对象，富文本与 JSON 文本字符串，`nullable` 与 `union` 按类型数组拆出的分支                                                                                                                                                                                  |
| `toBig(x)` `fromBig(b, template, decimals?)` `isDecimalValue` `EXACT_DECIMAL`                               | 精确十进制：数值、精确数字符串与 `money` / `bigint` 值对象和 `Big`（big.js）互转；不做单位换算                                                                                                                                                                                             |
| `valueFormatOf(schema, type)` `valueFormatWidget(format)`                                                   | 日期存储格式 `x-valueFormat`，只认无标准 `format` 的字符串与格式为 `x` 或 `X` 的整数。无 `x-ui.widget` 时按格式内容选 `date`、`time` 或 `datetime`（时间戳与别名为 `datetime`）；三者都接受这些形态，但 `time` 不接受时间戳。`valueFormatWidget` 即 `@jotl/core` 的 `valueFormatComponent` |
| `formatThousands(text)` `stripThousands(text)`                                                              | 千分位：只在精确数字符串的整数部分每 3 位插入 `,`；去掉 `,` `，` 空白与 `_`                                                                                                                                                                                                                |
| `enumOptions` `fieldLabel` `requiredKeys` `schemaTypes` `isBuiltinWidget`                                   | widget 包共用的 schema 读取工具                                                                                                                                                                                                                                                            |
| 类型 `Registry` `WidgetRegistration` `RenderPlanNode` `PlanOptions` `Adapters` `UploadContext` 及各层 props | widget 契约，定义在 [`src/core/contracts.ts`](../../src/core/contracts.ts)                                                                                                                                                                                                                 |

## 规划选项

`plan()` 与 `expand()` 接受 `PlanOptions`：

| 选项                   | 默认值                   | 含义                                                                                                                |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `scene`                | `"default"`              | 选择 `x-ui.variants` 中的场景                                                                                       |
| `mode`                 | `"edit"`                 | `"edit"` `"view"` `"disabled"`，写入解析上下文供匹配器使用                                                          |
| `schemaPointer`        | `""`                     | 规划起点；不存在或不是 schema 时报 `JOTL5102`                                                                       |
| `dataPath`             | `""`                     | 起点对应的模板数据路径                                                                                              |
| `depth` `parentWidget` | `0`，无                  | 从子节点开始规划时传入，与渲染器的上下文一致                                                                        |
| `maxDepth`             | `DEFAULT_MAX_DEPTH`（2） | 同一类型的递归引用在一条路径上最多展开的层数；超过时节点标 `lazy: true` 且不含子节点，显示时由渲染器调用 `expand()` |

## 处理降级与诊断

- 内置 widget 名按其接受的形态检查（[`x-ui` 规范](../../../../zh/docs/spec/x-ui.md#内置-widget-名)的内置 widget 名表）。`x-ui.widget` 写了该形态不接受的内置名时，按 F2 降级到该形态的默认 widget，如多选枚举写 `radio` 降为 `select`。登记项的 `accepts` 另外生效。可空节点（类型数组或 `anyOf` / `oneOf: [T, null]`）上的内置字段 widget 名作用于内容节点。
- `plan()` 期的降级记录在节点的 `degraded` 中，编号为 F1（未注册）、F2（形态不接受或被 `accepts` 拒绝）、F3（`x-ui` 非法）、F7（schema 特性不支持），每次降级同时产生一条 warning 诊断。F4 到 F9 发生在渲染期；各编号由谁处理见 [`x-ui` 规范](../../../../zh/docs/spec/x-ui.md#降级归属)。
- `fallbackChain` 是选中的 widget 之后的备选 widget 名，末尾总是 `json`；渲染器在 widget 报错时按序替换。
- 诊断代码为 `JOTL5xxx`：`JOTL5001` 到 `JOTL5005` 是降级 warning，`JOTL51xx` 是参数错误（此时 `value` 为 `undefined`）。代码表见 [`src/core/diagnostics.ts`](../../src/core/diagnostics.ts) 的 `UI_CORE_DIAGNOSTICS`，F3 的原因短语见同文件的 `XUI_ISSUE_REASONS`。
- 同一个 `x-ui` 被多处引用时，同一条诊断只报一次。
