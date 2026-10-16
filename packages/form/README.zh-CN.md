# @jotl/form

[English](./README.md) · **简体中文**

在 React 应用中按 JSON Schema(含 `x-ui`)渲染表单, 替换或扩展 Jotl 表单 widget, 选择样式接入方式或改动样式后重新生成与人工核对, 或为其他 UI 框架实现渲染器, 在工具中查询某个 schema 节点最终用哪个 widget 时读本页; 对应 `packages/form`.

`@jotl/form` 由三部分组成:

- 主入口 `@jotl/form`: React 渲染器(`src/react/`)与原生 HTML 默认 widget(`src/html/`). 渲染器按渲染计划渲染表单, 默认使用原生 HTML widget; 默认数据与校验来自 `@jotl/data`.
- 子路径 `@jotl/form/core`(`src/core/`): 解析与合并 `x-ui`, 管理 widget 注册表, 由 schema 算出与数据无关的渲染计划(`RenderPlanNode` 模板树), 并在规划期做降级决策; 不依赖任何 UI 框架, 也不读写数据.
- 样式: 预编译的 `@jotl/form/style.css`, 以及供 Tailwind v4 宿主自行编译的 `@jotl/form/tailwind.css` 与 `@jotl/form/theme.css`.

字段, 合并顺序, widget 名候选, 渲染计划与各层 props 的契约见 `docs/spec/x-ui.md`; 默认 widget 表与各 widget 的行为约定见 `docs/spec/html-widgets.md`; 本页不重复.

## 安装

```sh
pnpm add @jotl/form react react-dom
```

`react` 是可选的 peer 依赖, 支持 `^16.8.0 || ^17 || ^18 || ^19`; 只用 `@jotl/form/core` 时不需要安装 React. 本包用自带的 JSX 运行时 `@jotl/form/jsx-runtime`(即 `React.createElement`)编译, 不依赖 React 16.14 起才有的 `react/jsx-runtime`, 宿主无需为此配置. `pnpm --filter @jotl/form run test:react-compat` 依次在 React 16, 17, 18, 19 下运行兼容测试.

## 最小示例

```tsx
import { useRef } from "react";
import { JotlForm, type JotlFormHandle } from "@jotl/form";
import "@jotl/form/style.css";

const schema = {
  type: "object",
  properties: { title: { type: "string", title: "标题", maxLength: 20 } },
  required: ["title"],
};

export function Page() {
  const form = useRef<JotlFormHandle>(null);
  return <JotlForm ref={form} schema={schema} defaultValue={{}} onSubmit={(value) => console.log(value)} />;
}
```

- 非受控传 `defaultValue`; 受控传 `value` 与 `onChange`, 父组件不采纳改动时表单恢复为 `value`.
- `schema` 按内容比较: 每次渲染新建内容相同的对象不影响表单. 非受控时内容变化会按新 schema 重新初始化数据(`defaultValue` 补默认值, 或按 `initialData`), 清掉触碰与错误, 并经 `onChange` 通知一次; 受控时数据只来自 `value`.
- 初始值缺失的字段按 schema 的 `default` 补全; 受控模式下补全结果经 `onChange` 回报一次.
- 实例 API 经 `ref` 暴露: `getValues()` `setValues(value)` `validate()` `reset()` `submit()`.
- `validateOn` 取 `"change"` `"blur"`(默认) `"submit"`, 表示最早的校验时机; 提交总会校验, 校验过一次之后每次改动都重新校验. 提交或调用 `validate()` 之前, 只显示已触碰字段的错误.
- `mode` 取 `"edit"`(默认) `"view"` `"disabled"`; `scene` 选择 `x-ui.variants` 中的场景.
- `locale`(`"zh-CN"` `"en"`)决定 widget 界面文案与校验消息的语言; 缺省取 `@jotl/core` 的全局 `getLocale()`(默认 `en`). 自定义 widget 中用 `useLocale()` 取表单语言, `useL10n()` 返回 `(zh, en) => string`; 两者读 `LocaleContext`, 在表单外回落到全局语言.
- `initialData="mock"` 时, 未传 `value` 与 `defaultValue` 的表单用 `@jotl/data` 的 `mock()` 生成初始数据(`mockSeed` 固定随机种子), `reset()` 回到这份数据; 默认 `"defaults"` 按 schema 默认值. 新增数组元素等仍按默认值.
- 数组每项除上移, 下移, 删除外还可复制: 深拷贝后插入其后, 到 `maxItems` 时禁用.

## 钻取渲染

表单默认每层一页: 当前层的标量字段直接编辑; 组合字段(对象, 数组, 字典, 有对象分支的联合, 递归节点)显示为入口行, 点击进入下一层; 顶部面包屑由各层标签组成, 点上一级退回.

```tsx
const [path, setPath] = useState("");
<JotlForm schema={schema} path={path} onPathChange={setPath} />;
```

- `path` 是当前页的数据路径(JSON Pointer), 可同步到宿主路由; 不传时表单内部维护, 初始为根 `""`; 传入后受控, 进入与退回只经 `onPathChange` 通知.
- `x-ui.widget: "inline"` 的对象在父页内展开; 数组页与字典页中标量元素直接编辑, 组合元素为入口行.
- 入口行显示标签, 摘要与其下的错误数. 摘要取 `x-ui.summary` 指定的字段(数组, 字典上的 `summary` 作用于元素), 不写时取第一个非空字符串字段, 数组元素再没有时显示 `第 n 项`; 面包屑中数组元素同样取摘要或序号, 字典值取键名.
- 提交校验失败时跳到第一个错误所在的层; 当前所在的数组元素或字典键被删除(字典键改名同样)时退回数组或字典所在的层; 两者都经 `onPathChange` 通知.
- 不在当前页的错误除了显示在页顶的表单级列表, 面包屑的上层还标出其下(且不在下一层)的错误数, 点击该层后由入口行指明位置. 点击表单级列表中的一条错误切到它所在的页, 再滚动到并聚焦该字段; 不钻取时直接聚焦, 字段被隐藏时聚焦最近的可见上层.
- `drill={false}` 时各层在同一页展开, 不显示入口行与面包屑, 忽略 `path`; 再传 `collapsible` 时对象(`inline` 除外), 数组, 字典与含对象分支的联合各包在可折叠面板中, 标题行显示标题(数组元素为 `第 n 项`), 摘要与其下错误数, 第一层默认展开.

## 替换 widget

```tsx
import { createDefaultRegistry } from "@jotl/form";

// 每次渲染新建注册表时, 登记内容(含父级)逐项浅相等则沿用上一次的, 不重新规划; 在组件外创建一次可省去比较.
const registry = createDefaultRegistry().extend();
registry.register({ name: "switch", level: "field", component: MySwitch });

<JotlForm schema={schema} registry={registry} adapters={{ upload: uploadToCdn }} />;
```

- 同名登记覆盖默认 widget, 本级覆盖父级, 未覆盖的 widget 仍用默认的原生 HTML widget; `adapters` 原样传给每个 widget.
- 登记项带 `load` 时按需加载 widget: 加载前渲染 `component` 作为占位, 失败时显示重试并改用下一个候选 widget.
- `adapters` 按各键浅比较, `registry` 按登记内容浅比较, 内容不变的新对象不让表单重渲染或重新规划; 每次渲染新建的函数(如内联箭头函数)算作变化.

## 扩展组件模块

在 Jotl 中带模块声明的扩展组件(根条目元数据 `widgets`, 见 `@jotl/core` 的 README)编译进 schema 根 `x-ui.widgets`(名字 → `{ module, export? }`). 传 `schemaModules` 时 `JotlForm` 把这些声明登记到本表单自己的注册表(同名覆盖)并按需加载:

```tsx
// 编译自: Form: [widgets: {ImagePicker: {base: 'url', module: 'https://esm.sh/image-picker'}}] { cover: ImagePicker }
<JotlForm schema={schema} locale="en" schemaModules />;

// 自定义加载, 或为相对模块地址(./ ../ /)指定基准
<JotlForm schema={schema} schemaModules={{ baseUrl: "https://cdn.example.com/widgets/", importer: (url) => import(/* @vite-ignore */ url) }} />;
```

- `schemaModules` 默认 `false`; `true` 用动态 `import()` 加载; 传对象时作为选项 `{ importer?, baseUrl? }`.
- 模块的导出(`export`, 缺省 `default`)须是满足 widget 契约的 React 组件: 按 `field` 级登记, 接收 `@jotl/form/core` 的 `FieldProps`(`value` `onChange` `onBlur` `errors` `id` `schema` `mode` `props` 等), 接管整个值. 加载失败或导出不是组件时按 F9 显示失败与重试.
- 第三方组件通常不遵守这一契约: 会把未知 props 原样写到 DOM 上(`schema` `adapters` 等成为属性), 且使用自己的属性名(如 `HexColorInput` 读 `color` 而非 `value`). 应导出一层薄包装, 把 `FieldProps` 映射为该组件的 props, 不要让模块直接指向第三方组件.
- 浏览器中远程模块须与宿主共用同一份 React: 用 import map 或等效手段把模块中的 `react`(模块用到 `react/jsx-runtime` 时也包括它)指向宿主的同一个 React 实例; 否则两份 React 并存, hooks 会失效.
- 不用 `JotlForm` 时: `schemaWidgetModules(schema)` 从根 `x-ui.widgets` 读出模块声明(不合法的项跳过), `moduleWidgetRegistrations(modules, { importer?, baseUrl? })` 把名字 → `{ module, export?, level? }` 转为带 `load` 的登记项, 登记到自己的注册表; 模块声明来自 `jotl.config.json`(`@jotl/core` 的 `readJotlConfig(...).config.modules`)时, `baseUrl` 传配置文件的位置.

## 降级与调试

- widget 渲染报错时依次换用渲染计划中的备选 widget, 复合 widget 报错时拆开为逐个子节点渲染; 数据类型与 schema 不符时保留原值, 标记错误并改用 JSON 编辑.
- 注册表中没有任何 widget 时, 渲染器自带的 JSON 文本框兜底, 不会白屏.
- 每次降级调用一次 `onDegrade(event)`, 事件含编号(F1-F9), 数据路径, schema 指针, 原 widget 与替代 widget.
- `<JotlDebug schema registry events />` 列出每个节点选中的 widget, 来源与降级记录; `useDegradeLog()` 收集表单上报的事件供它显示; `locale` 决定其文案语言, 缺省取全局语言.

```tsx
const log = useDegradeLog();
<JotlForm schema={schema} onDegrade={log.onDegrade} />
<JotlDebug schema={schema} events={log.events} />
```

## 节点 id

外壳与内层 widget 使用同一个 id, 由表单 `id` 与数据路径组成, 可用 `nodeId(formId, dataPath)` 求出; 未传 `id` 时每个表单实例取 `jotl-f<n>`(`n` 按实例递增; 不用 React 18 起才有的 `useId`).

## 默认 HTML widget

默认 widget 用原生 HTML 标签实现 `@jotl/form/core` 的内置 widget 名, 全部为无状态受控 widget; 外观由带 `jt:` 前缀的 Tailwind CSS v4 工具类表达, 宿主不必使用 Tailwind. `createDefaultRegistry()` 已登记它们; 不用本包的 React 渲染器时, 可把它们登记到自己的注册表:

```ts
import { registerHtmlWidgets } from "@jotl/form";

// registry: 任一实现 @jotl/form/core `Registry` 接口的注册表.
registerHtmlWidgets(registry);

// 替换单个默认组件: 在实例级注册表登记同名组件, 本级覆盖父级.
const local = registry.extend();
local.register({ name: "input", level: "field", component: MyTextInput });
```

- widget 的界面文案(按钮, 占位, 提示)有中英两套, 按表单的 `locale` 取用; 下文引用的是中文文案.
- 图片与文件 widget 只有在传入 `adapters.upload` 时才出现 "上传图片" / "上传文件" 按钮, 否则只有 URL 输入; 上传中显示状态, 失败显示可读提示.
- 富文本 `richtext` 只有在传入 `adapters.richText` 时才渲染富文本编辑器, 否则是多行文本框; 传入本包的 `richTextEditor` 即得到 `contenteditable` 最小编辑器(粗体, 斜体, 链接, 列表, 值经 `sanitizeHtml` 白名单清洗), 见 `docs/spec/html-widgets.md` 的 "富文本编辑器".
- `list` 每项的 "复制" 只在渲染器提供 `duplicate` 时出现.
- 登记项不带 `accepts`: 各内置名接受的数据形态由 `@jotl/form/core` 的 `plan()` 检查, 不接受时降级到该形态的默认 widget.
- `page` 与 `inline` 是同一个对象 widget; 钻取(每层一页, 入口行, 面包屑)由渲染器完成, widget 只排版当前层.
- `money` `bigint` 用文本框(`inputmode` 为 `decimal` / `numeric`), 值为 `{ type, value, ... }` 对象; 聚焦显示原值, 失焦与只读按千分位显示(`money` 默认开, 由 `FieldProps.thousands` 控制); 键入时去掉 `,` `，` 空格 `_`, 不合法时保留草稿并提示; `money` 失焦补齐定长小数位, 币种与单位按 schema 的 `const` / `enum` 显示为文字或下拉框.
- `number` 按 `x-decimals` 设 `step` 并在失焦时舍入; 开了千分位时改用文本框. `switch` 是 `role="switch"` 的勾选框; `checkbox` 用于布尔是单个勾选框, 用于枚举数组是一组; `select` 用于枚举数组是多选下拉框.
- `date` `time` `datetime` 用原生 `date` `time` `datetime-local` 控件, 按本地时区显示; 读写按节点的存储格式 `x-valueFormat`(dayjs 格式串, `x` `X` 毫秒 / 秒时间戳, 别名 `iso` `iso-x` `utc` `utc-x`), 没有时取 widget 默认(`date` 为 `YYYY-MM-DD`, `time` 为 `HH:mm:ss`, `datetime` 为 `iso`). 别名读取接受任意 RFC 3339 date-time, 写回时按别名统一; `date` 选值取当天本地零点, `time` 取今天的该时刻. 存储格式含秒(`ss`)或为别名与时间戳时控件显示到秒(`step=1`), 自定义格式含毫秒(`SSS`)时显示到毫秒(`step=0.001`). 存量值不合存储格式时改用文本框原样显示并提示, 不改写数据, 键入能按存储格式解析的文本才写回.
- `json` 用于字符串 schema(`contentMediaType: application/json`)时编辑原文, 值仍是字符串, 只要求能解析.

### 复合 widget 与对象布局

| widget 或布局 | 使用者看到的形态 | 交互约定 |
|---|---|---|
| `nullable` | "置为空" 勾选框 + 原 widget | 勾选后值为 `null`, 只显示 "空值"; 只有 `edit` 模式可切换 |
| `union` | "类型" 下拉框 + 当前分支的子表单 | 只有一个分支时不显示下拉框; 切换分支后的数据由渲染器给出; `x-ui.props.selector` 为 `"buttons"` 且分支不超过 4 个时改为分段按钮 |
| `kv` | 键名输入框 + 值 + 删除按钮的列表, 末尾 "增加" | 新条目键名为 `key1` `key2` 这类未占用的名字; 键名清空或与其他条目重复时只提示, 不改数据 |
| `tuple` | 按位置排列的各项, 标签取该项 `title` 或 `第 n 项` | 不能增删元素; `items` 允许的额外元素不显示, 数据原样保留 |
| `page` / `inline` + 其他键 | 对象另有 schema 形式的 `additionalProperties` 时, 字段之后的 "其他键" 分组 | 同 `kv`: 键名可增, 删, 改名, 不能取已声明的属性名 |
| `tree` | "展开" / "收起" 按钮 + 内容 | 折叠时不渲染内容; `view` 模式可展开, `disabled` 模式不可 |
| `page` / `inline` + `layout: "tabs"` | 每个分组一个标签页, 未分组字段在第一页 | 切换标签页不改数据; 方向键, `Home`, `End` 在标签间移动; 没有分组时按 `stack` 排版; `disabled` 模式不可切换; 标签上显示该页字段的错误数(取自 `LayoutField.errorCount`) |
| `page` / `inline` + `layout: "grid"` | 字段按 `columns` 列排布, 默认 2 列 | 分组各自成一个栅格; 列宽经内联的 `--jotl-columns` 设定, 需要引入 `style.css` 才生效 |

- 对象, 数组与上述复合 widget 的根元素经 `aria-labelledby` 引用外壳标签, 读屏与 `getByLabelText` 能按字段标签找到它们. 外壳在渲染后判定: 内层根元素是可被 label 关联的控件(非 hidden 的 `input`, `select`, `textarea` 等)时 `<label>` 才带 `for`, 复合 widget 外的 `<label>` 不输出 `for`.
- 可空与联合内部的内容控件(id 以 `+` 结尾, 没有自己的外壳)经 `aria-labelledby` 取外围字段的标签; `json` 查看态的 `<pre>` 同样经 `aria-labelledby` 关联标签.

## 样式接入

样式是可选的; 不引入时 widget 照常工作, 只是没有基础排版(含钻取渲染的面包屑与入口行).

widget 同时输出 `jotl-` 语义类名(供外部覆盖与测试定位)和 `jt:` 前缀的 Tailwind 工具类(表达外观). 生成的 CSS 全部在 cascade layer(`theme` `components` `utilities`)中, 不含 preflight; 宿主未分层的样式天然优先, 直接写 `.jotl-input { ... }` 即可覆盖.

颜色与间距可在任意外层元素上覆盖 `--jotl-gap` `--jotl-radius` `--jotl-border` `--jotl-divider` `--jotl-focus` `--jotl-focus-hover` `--jotl-focus-ring` `--jotl-error` `--jotl-text` `--jotl-muted` `--jotl-surface` `--jotl-disabled-bg` `--jotl-disabled-text` `--jotl-switch-off` `--jotl-option-hover` `--jotl-option-selected` 换肤.

**预编译(宿主不用 Tailwind)**: 引入 `@jotl/form/style.css`.

**Tailwind v4 宿主自行编译**: 新建一个独立的 CSS 入口(不要并入宿主自己的 `@import "tailwindcss"` 入口, 前缀 `jt` 只对这个入口生效), 由宿主的 Tailwind 构建(如 `@tailwindcss/vite`)处理; 写法可参照 `apps/playground/src/jotl.css`:

```css
/* jotl.css */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme) prefix(jt);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@import "@jotl/form/tailwind.css";
```

- `tailwind.css` 用 `@source` 扫描随包发布的 `src`, `source(none)` 关掉对宿主项目的自动扫描, 只生成 widget 用到的工具类.
- 设计变量(`theme.css`, 经 `@theme inline` 接到 `--jotl-*`)也可以单独 `@import "@jotl/form/theme.css"` 给宿主的 `jt:` 工具类使用, 如 `jt:text-muted` `jt:border-border` `jt:rounded-base`.

**改动样式后重新生成**: widget 类名或 `tailwind.css` `theme.css` 变化后, 运行 `pnpm --filter @jotl/form run build:css` 重新生成 `style.css`(入口为 `style.entry.css`, 不压缩); `test/package.test.ts` 比对重新生成的结果与仓库中的 `style.css`, 忘了重新生成时测试失败.

## style.css 手工验证

jsdom 不计算样式, 以下各项只能在真实浏览器中核对.

1. 在仓库根运行 `pnpm build`.
2. 在依赖 `@jotl/form` 的包目录(如 `apps/playground`)运行 `node --input-type=module -e "console.log(import.meta.resolve('@jotl/form/style.css'))"`, 预期输出 `packages/form/style.css` 的 `file://` 路径.
3. 在任一 React 19 + Vite 页面中 `import "@jotl/form/style.css"`, 用 Jotl 渲染一个同时含有字符串, 数字, 枚举, 布尔, 图片, 对象分组, 对象数组, 可空字段, 联合, 字典, 递归引用, 以及 `[layout: 'tabs']` 与 `[layout: 'grid', columns: 3]` 对象的 schema, 按下表逐项核对.

| 操作 | 预期 |
|---|---|
| 打开页面 | 字段纵向排列, 标签在控件上方, 必填字段的标签后有红色 `*` |
| 用 Tab 依次聚焦输入框, 下拉框, 按钮 | 每个获得焦点的控件有蓝色外框 |
| 提交一个不合法的字段 | 该字段边框变红, 下方出现红色错误文字 |
| 在 JSON 兜底 widget 中输入不完整的 JSON | 文本框下方出现红色提示, 已输入的文本不被清空 |
| 数组达到 `maxItems` | "增加" 按钮变淡且鼠标为禁止样式 |
| 填入图片 URL | 预览图不超出容器宽度, 高度不超过约 12rem |
| 把表单切到 `view` 与 `disabled` | 输入框背景变灰; `view` 下没有提交与数组操作按钮 |
| 在页面外层设置 `--jotl-focus: red` | 焦点外框与主按钮变为红色 |
| 查看 `tabs` 布局的对象 | 标签横排, 下方有分隔线; 选中的标签加粗, 文字为焦点色, 与下方内容连成一体; 只显示选中页的字段 |
| 查看 `grid` 布局的对象 | 字段排成 3 列等宽栅格, 窄屏下控件不溢出单元格 |
| 勾选可空字段的 "置为空" | 原 widget 消失, 显示灰色斜体 "空值" |
| 展开递归字段 | 内容在按钮下方, 左侧有竖线缩进 |
| 查看字典字段 | 每行左侧是固定宽度的键名框, 中间是值, 右侧是删除按钮; 把键名改成已有的名字时框下出现红色提示 |
| 去掉 `style.css` 的引入后刷新 | widget 仍可输入与提交, 只是失去上述排版 |

## @jotl/form/core

为其他 UI 框架实现 Jotl 渲染器或 widget 包, 或在工具(如语言服务)中查询 widget 时使用本子路径; 它不依赖 React. 本包的 React 渲染器与默认 HTML widget 都建立在它之上.

```ts
import { BUILTIN_WIDGETS, createRegistry, evaluateCondition, plan } from "@jotl/form/core";

const schema = {
  type: "object",
  properties: {
    title: { type: "string", title: "标题", "x-ui": { widget: "headline" } },
    kind: { enum: ["a", "b"] },
    extra: { type: "string", "x-ui": { visibleIf: { field: "/kind", eq: "b" } } },
  },
  required: ["title"],
};

// 组件包通常为每个内置组件名登记一个实现; 这里用组件名本身占位.
const registry = createRegistry(
  Object.entries(BUILTIN_WIDGETS).map(([name, { level }]) => ({ name, level, component: name })),
);

const { value: root, diagnostics } = plan(schema, registry);
// root.widget === "form", 唯一子节点是数据根, widget 为 "page".
// /title: headline 未注册, 降级为 "input", degraded 为 [{ reason: "F1", from: "headline" }].
// diagnostics: [JOTL5001 warning].
// /kind: 枚举(选项不少于 2 个)默认为 "select"; x-ui.widget 写了该形态不接受的内置名(如 "switch")时按 F2 降级回 "select".

const extra = root!.children[0]!.children.find((c) => c.dataPath === "/extra")!;
evaluateCondition(extra.visibleIf!, { kind: "b" }, extra.dataPath); // true
```

- 渲染计划是模板树: 数组下标写作 `*`, 数组元素个数与联合类型的当前分支由渲染器按数据决定.
- 节点上的 `summary`(对象, 数组, map)与 `thousands`(number money bigint; money 缺省 `true`)取自合并后的 `x-ui`, 供渲染器的钻取入口行与数值 widget 使用.
- widget 的取值, 校验与默认值不在 `core` 内; 本包的 React 渲染器用 `@jotl/data` 完成.

### 公开 API

| 导出 | 用途 |
|---|---|
| `createRegistry(registrations?, parent?)` | 创建注册表; 传入 `parent` 时等同于 `parent.extend()`. `list()` 中本级登记在前, 匹配器分值相同时排在前面的胜出 |
| `plan(schema, registry, options?)` | 返回 `Result<RenderPlanNode>`. `schemaPointer` 为空(默认)时根节点是视图 widget `form`; 指向子节点时直接从该节点开始, 用于渲染期按需规划 |
| `expand(node, schema, registry, ctx?)` | 展开 `lazy: true` 的节点, 返回 `Result<RenderPlanNode>`; `ctx` 中的场景, 模式与 `maxDepth` 优先, 其次沿用同一进程内 `plan()` 生成该节点时的值, 否则取默认值 |
| `resolvePlanNode(node, schema)` | 渲染计划节点的有效 schema(`ResolvedNode`), 与 `plan()` 判定形态所用的一致: 含按 `type` 数组拆出的分支与数组无 `items` 时的元素模板(空 schema); 节点被复制或序列化后按 `schemaPointer` 解析 |
| `resolveSchemaAt(schema, pointer)` `resolveSchema(document, schema, pointer?)` | 有效 schema: 沿文档内 `$ref`("#" 与 "#/...")由远及近浅合并到引用处, 合并 `allOf` 成员; `origin` 给出每个关键字所在的 schema 位置, `unresolvedRef` 为无法解析的引用. `resolveSchemaAt` 按文档与指针缓存, 指针不存在时为空 schema |
| `evaluateCondition(cond, data, dataPath)` | 按数据求 `visibleIf`; `dataPath` 为实际路径, 条件中 `field` 的 `*` 取其中同一位置的片段; 叶子带 `base: "node"` 时 `field` 从当前节点所在对象起算; `gt` `gte` `lt` `lte` 只比较数值 |
| `jsonEqual(a, b)` | 条件比较所用的 JSON 值深度相等 |
| `resolveXUi(schema, schemaPointer?, options?)` | 查询某个位置合并后的 `x-ui`, 各层候选 widget, 命中的根 `rules`, 选中的 widget 与降级, 返回 `Result<ResolvedXUi>`; 未传 `registry` 时按 "所有 widget 名均已注册" 计算. 供语言服务与调试视图使用 |
| `checkXUi(value)` | 不依赖 Ajv 的 `x-ui` 结构校验, 返回第一处问题或 `undefined`; 规则与 `@jotl/core` 的 `xUiMetaSchema` 一致 |
| `matchBuiltinWidget(schema, document?)` | 只按 schema 形态求内置 widget 名, 不看 `x-ui` 与注册表 |
| `builtinAccepts(name, schema, document?)` | 内置 widget 名能否处理该数据形态(`docs/spec/x-ui.md` 内置 widget 名表中的接受形态); 非内置名返回 `undefined` |
| `BUILTIN_WIDGETS` 及 `FORMAT_WIDGETS` | 内置 widget 名与层级, `format` 到 widget 名的映射; widget 包应为 `BUILTIN_WIDGETS` 中的每个名字提供实现 |
| `decimalKind(schema)` `RICH_TEXT_MEDIA_TYPE` `JSON_TEXT_MEDIA_TYPE` `splitBranch` | 形态识别: money / bigint 值对象, 富文本与 JSON 文本字符串, 可空与联合按类型数组拆出的分支 |
| `toBig(x)` `fromBig(b, template, decimals?)` `isDecimalValue` `EXACT_DECIMAL` | 精确十进制: 数值, 精确数字符串与 money / bigint 值对象和 `Big`(big.js)互转; 不做单位换算 |
| `valueFormatOf(schema, type)` `valueFormatWidget(format)` | 日期 widget 的存储格式 `x-valueFormat`: 只认无标准 `format` 的字符串与格式为 `x` `X` 的整数; 无 `x-ui.widget` 时按格式内容选 `date` `time` `datetime`(时间戳与别名为 `datetime`; `valueFormatWidget` 即 `@jotl/core` 的 `valueFormatComponent`), 三者都接受这些形态, `time` 不接受时间戳 |
| `formatThousands(text)` `stripThousands(text)` | 千分位: 只对精确数字符串的整数部分每 3 位插 `,`; 去掉 `,` `，` 空白 `_` |
| `enumOptions` `fieldLabel` `requiredKeys` `schemaTypes` `isBuiltinWidget` | widget 包共用的 schema 读取工具 |
| 类型 `Registry` `WidgetRegistration` `RenderPlanNode` `PlanOptions` `Adapters` `UploadContext` 及各层 props | widget 契约, 定义在 `src/core/contracts.ts`; `Adapters.upload(file, ctx)` 的 `ctx` 为发起上传的字段(`UploadContext`), `ArrayProps.duplicate` 为可选的复制元素能力 |

`plan()` 与 `expand()` 的选项(`PlanOptions`):

| 选项 | 默认值 | 含义 |
|---|---|---|
| `scene` | `"default"` | 选择 `x-ui.variants` 中的场景 |
| `mode` | `"edit"` | `"edit"` `"view"` `"disabled"`, 写入解析上下文供匹配器使用 |
| `schemaPointer` | `""` | 规划起点; 不存在或不是 schema 时报 `JOTL5102` |
| `dataPath` | `""` | 起点对应的模板数据路径 |
| `depth` `parentWidget` | `0`, 无 | 从子节点开始规划时传入, 与渲染器的上下文一致 |
| `maxDepth` | `DEFAULT_MAX_DEPTH`(2) | 同一类型的递归引用在一条路径上最多展开的层数, 超过时节点标 `lazy: true` 且不含子节点, 渲染期再调 `expand()` |

### 规划期降级与诊断

- 内置 widget 名的数据形态按 `docs/spec/x-ui.md` 的内置 widget 名表检查: `x-ui.widget` 写了该形态不接受的内置名时按 F2 降级到该形态的默认 widget(如多选枚举写 `radio` 降为 `select`); 注册项的 `accepts` 另外生效. 可空节点(类型数组或 `anyOf` / `oneOf: [T, null]`)上的内置字段 widget 名作用于内容节点.
- `plan()` 期的降级记录在节点的 `degraded` 中, 编号为 F1(未注册) F2(形态不接受或 `accepts` 拒绝) F3(`x-ui` 非法) F7(schema 特性不支持); 每次降级同时产生一条 warning 诊断. F4-F9 属渲染期, 归属见 `docs/spec/x-ui.md` 的 "降级归属".
- `fallbackChain` 是选中的 widget 之后的备选 widget 名, 末尾总是 `json`; 渲染器在 widget 报错时按序替换.
- 诊断代码段为 `JOTL5xxx`: `JOTL5001`-`JOTL5005` 是降级 warning, `JOTL51xx` 是参数错误(此时 `value` 为 `undefined`). 代码表见 `src/core/diagnostics.ts` 的 `UI_CORE_DIAGNOSTICS`, F3 的原因短语见同文件的 `XUI_ISSUE_REASONS`.
- 同一个 `x-ui` 被多处引用时, 同一条诊断只报一次.

## 已知限制

见根目录 `TODO.md` 的 "确定不修".
