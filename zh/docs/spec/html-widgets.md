# 原生 HTML 默认 widget

[English](../../../docs/spec/html-widgets.md) · **简体中文**

本页说明 `@jotl/form` 自带的默认 widget 用什么 HTML 元素实现、各自的行为，以及如何替换或复用它们。

`@jotl/form` 的默认 widget（`src/html/`）只用原生 HTML 标签实现全部 [内置 widget 名](x-ui.md#内置-widget-名)，宿主无需引入 CSS 框架，也不依赖渲染器（`src/react/`）；各层 props 见 [各层 widget props](x-ui.md#各层-widget-props)。
要替换某个默认 widget，在实例级注册表（`registry.extend()`）中登记同名 widget 即可，本级登记覆盖父级的同名项。

## widget 表

| widget 名 | 元素 | 要点 |
|---|---|---|
| `input` | `<input type="text">` | `maxLength` `pattern` 同步为原生属性 |
| `textarea` | `<textarea>` | - |
| `password` | `<input type="password">` | 只改变显示方式 |
| `url` / `email` | `<input type="url">` / `<input type="email">` | - |
| `date` `time` `datetime` | `<input type="date">` / `"time"` / `"datetime-local"` | 读写时用 dayjs 在原生值与存储格式（`x-valueFormat`，没有时取组件默认值 `YYYY-MM-DD` / `HH:mm:ss` / `iso`，与 `format: date` / `date-time` 一致；`HH:mm:ss` 不带时区，与 `format: time` 不一致）之间转换，使用本地时区；存量值不符合存储格式时显示原值文本框和提示，不改写数据；规则见 [Jotl 语法规范](jotl.md#日期与时间) |
| `color` | `<input type="color">` + 文本框 | 原生取色器只支持 `#rrggbb`，值不符合时只显示文本框 |
| `number` | `<input type="number">`；开启 `thousands` 时为 `<input type="text">`；integer 的 `inputmode` 为 `numeric`，其余为 `decimal` | 空串写回 `undefined`；按 `x-decimals` 设置 `step`（没有时为 `any`，integer 为 `1`）并在失焦时舍入；`minimum` `maximum` 同步为 `min` `max`；开启 `thousands` 时不设 `step` `min` `max`，只保留失焦舍入 |
| `range` | `<input type="range">` + 显示当前值的 `<output>` | `minimum` / `maximum` 作为 `min` / `max`（缺省时为 0 / 100）；`step` 跟随 `x-decimals`；`view` 与 `disabled` 模式下都禁用 |
| `money` | `<input type="text" inputmode="decimal">`（不允许小数位时为 `numeric`）+ 币种、单位 | 值为 `{type: "money", value, currency, unit?}`；币种与单位按 schema 的 `const` / `enum` 显示，只有一个可选值时为固定文字，多个时为下拉框；币种不受约束时为自动转大写的 3 位文本框，单位不受约束时不显示；输入金额时缺少的币种（和单位）自动填第一个可选值；失焦时补齐小数位 |
| `bigint` | `<input type="text" inputmode="numeric">` | 值为 `{type: "bigint", value}` |
| `switch` | `<input type="checkbox" role="switch">` | - |
| `checkbox` | boolean：一个 `<input type="checkbox">`；枚举数组：一组 | - |
| `radio` | 一组 `<input type="radio">` | 选项文字取 `title`，没有时取值本身 |
| `select` | `<select>`；枚举数组时带 `multiple` | 选填字段带空选项；必填字段只在没有值时带空选项 |
| `output` | `<output>` | 只读显示 |
| `image` | `<input type="url">` + `<img>` 预览 | 有 `adapters.upload` 时增加「上传图片」按钮（打开隐藏的 `<input type="file">`），把 `upload(file, { dataPath, schema })` 返回的 URL 写回；上传中显示状态并禁用按钮，失败时显示可读提示，只写回最后一次选择的结果 |
| `file` | `<input type="url">` | 同 `image`，但按钮文字为「上传文件」，没有预览 |
| `richtext` | `<textarea>` | 有 `adapters.richText` 时改用它；`richTextEditor` 是可以传入的最小编辑器，见 [富文本编辑器](#富文本编辑器) |
| `page` / `inline` | `<fieldset>` + `<legend>` | 两者共用同一实现；分组用嵌套的 `<fieldset>`；布局见 [对象布局](#对象布局)；钻取由 `@jotl/form` 处理；有 `additional` 时字段之后是「其他键」分组，见 [其他键](#其他键) |
| `list` | `<ol>` + 增加、删除、上移、下移按钮；渲染器提供 `duplicate` 时另有复制按钮 | 按 `canAdd` `canRemove` 禁用按钮（复制随 `canAdd`）；元素用 `renderChild(String(i))` 渲染 |
| `tuple` | `<ol>`，每个位置一项 | 第 i 项用 `renderChild(String(i))` 渲染；位置标签由外壳给出（`prefixItems` 该项的 `title`，否则为 `第 n 项`）；位置不能增删；`items` 为 `true` 或 schema 时，位置之后列出剩余元素（`rest`，第 i 项同样用 `renderChild(String(i))` 渲染，i 为实际下标），可以新增和删除，受 `minItems` / `maxItems` 与 `mode` 约束，位置没有填满时不能新增；`items` 为 `false` 或缺省时没有剩余区 |
| `nullable` `union` `kv` `tree` | 见 [复合 widget](#复合-widget) | - |
| `json` | 编辑态为 `<textarea>`（JSON），查看态为 `<pre>` | JSON 不合法时保留草稿并显示错误；schema 为 string 时值是 JSON 原文 |
| `field` | `<div>` + `<label>` + 必填标记（`<abbr>`）+ 帮助文本 + 错误 | 内层根元素是可关联 label 的控件时才写 `for`，复合 widget 经 `aria-labelledby` 引用该 label；错误元素的 `id` 供 `aria-describedby` 引用；有错误时控件（或组根元素）带 `aria-invalid` |
| `form` | `<form novalidate>`，`edit` 模式下带提交与重置按钮 | 只在 `edit` 模式下，提交时调用 `submit()`、重置时调用 `reset()`，并阻止默认行为；表单顶部列出 `errors`，有 `goToError` 时每条是一个按钮（可访问名称为错误消息加「跳到所在位置」，英文界面为「go to field」），点击时调用 `goToError(error)` |

- 千分位：`number` `money` `bigint` 聚焦时显示原值，失焦与只读时按 `thousands` 显示千分位（`money` 默认开启，其余默认关闭）；键入和粘贴时去掉 `,` `，`、空白和 `_`（`number` 只在开启 `thousands` 时去掉）；格式化用 `@jotl/form/core` 的 `formatThousands` / `stripThousands`。
- 选项用 `@jotl/form/core` 的 `enumOptions` 读取；字段标签由渲染器算好后经 `DecoratorProps.label` 传入（`title`，否则为键名）。

## 复合 widget

| widget 名 | 形态 | 行为 |
|---|---|---|
| `nullable` | 原 widget + 置空开关 | 开关调用 `setNull`；非空时用 `renderContent()` 渲染非空分支 |
| `union` | 左侧选择分支，右侧显示当前分支内容，空间不足时换行 | 只有一个分支时不显示选择器；否则分支选择默认是下拉框；`props.selector` 为 `"buttons"` 且分支不超过 4 个时改用分段按钮（一组 `<input type="radio">`，`role="radiogroup"`），分支更多时仍用下拉框；选项取 `branches[i].title`，选择时调用 `selectBranch(i)`；子表单用 `renderContent()` 渲染 |
| `kv` | 键值对列表 | 键名可以增加、删除、改名（`addEntry` `removeEntry` `renameEntry`），按 `canAdd` `canRemove` 禁用；值用 `renderChild` 渲染，相对路径是经 `escapePointerToken` 转义的键名 |
| `tree` | 可折叠的树，按需展开 | 展开状态由 `expanded` 与 `setExpanded` 控制；折叠时不调用 `renderContent()` |

- `union` widget 不自己改写数据：切换分支时由渲染器用新分支的默认数据替换当前值，并在同一表单实例内缓存各分支最后一次的值，切回时恢复；表单重置或整体换值时清空缓存。
- 可区分联合的当前分支由渲染器根据区分字段的值决定，widget 只读取 `activeBranch`。

## 富文本编辑器

把 `richTextEditor`（组件名为 `RichTextEditor`）作为 `adapters.richText` 传入后，`richtext` 改用不依赖第三方库的 `contenteditable` 编辑器；不传时仍是 `<textarea>`。

- 值是 HTML 字符串，内容为空时写回 `undefined`。工具栏（`role="toolbar"`）有粗体、斜体、链接、无序列表、有序列表，经 `document.execCommand` 执行；链接地址经 `prompt` 输入，只接受相对地址和 `http` `https` `mailto` `tel`。
- 写回与显示都经过 `sanitizeHtml` 白名单清洗：只保留 `p` `br` `div` `span` `b` `strong` `i` `em` `u` `s` `a` `ul` `ol` `li` `blockquote` `code` `pre` `h1`-`h4`；`a` 只保留安全的 `href` 和 `title`，其余属性（包括事件属性和 `style`）一律去掉；`script` `style` `iframe` 等连同内容一起丢弃，其他标签只保留文字。
- 编辑区为 `role="textbox"` `aria-multiline`，经 `aria-labelledby` 取外壳的标签；`view` 模式只读且不显示工具栏，`disabled` 模式不可编辑且工具栏禁用。

## 对象布局

`page` `inline` 按 `LayoutProps.layout` 排版；`fields` 中 `hidden` 为真的字段不显示。

| `layout` | 行为 |
|---|---|
| `stack` | 默认值；未分组字段在前，各分组依次用嵌套的 `<fieldset>` |
| `tabs` | 每个 `groups` 项一个标签页，未分组字段放在第一个标签页 |
| `grid` | 字段按 `columns` 列排布，默认 2 列 |

## 其他键

对象同时有 `properties` 和 schema 形式的 `additionalProperties` 时，渲染器经 `LayoutProps.additional` 给出不属于 `properties` 的键，`page` `inline` 在字段之后渲染「其他键」分组。该分组复用 `kv` 的键值编辑列表（`EntryEditor`）：键名可以增加、删除、改名，但不能取已声明的属性名；值用 `renderChild` 渲染，相对路径是经 `escapePointerToken` 转义的键名；数据仍写回同一个对象。`additionalProperties: true` 不显示该分组；有 `patternProperties` 时仍按 F7 整体用 `json`。

## 受控 widget 约束

- widget 一律无状态、受控：值只来自 `value`，变更只通过 `onChange`。
- 除上传状态、当前标签页这类不属于数据的界面状态外，唯一允许的局部状态是输入中尚不合法的草稿文本（如数字框里的 `-`、`json` 里未闭合的括号），一旦合法立即 `onChange`；例外是 `number` `money` `bigint` 用聚焦状态切换原值与千分位显示。
- `mode` 有三种：`edit` 可编辑，`view` 只读显示，`disabled` 禁用。
- 没有提供适配器时按上表的退化形态工作，不报错。

## 样式

- 元素同时带 `jotl-` 语义类名和 Tailwind CSS v4 工具类（前缀 `jt`，如 `jt:flex`）；语义类名是对外的覆盖与定位入口，工具类不作承诺。
- 不带 preflight；生成的样式规则都在 cascade layer 中（`theme` `components` `utilities`，另有 Tailwind 的 `properties`），宿主未分层的样式优先。
- 主题：设计变量经 `@theme inline` 接到 `--jotl-*` 变量（`--jotl-border` `--jotl-focus` `--jotl-error` `--jotl-muted` `--jotl-radius` `--jotl-gap` 等），在任意子树上覆盖这些变量即可换肤；默认值见 [`packages/form/theme.css`](../../../packages/form/theme.css)。
- 两种接入方式：
  - 不用 Tailwind 的宿主引入预编译的 `@jotl/form/style.css`；不引入时 widget 仍然可用。
  - Tailwind v4 宿主在一个独立的 CSS 入口中引入 `tailwindcss/theme.css`（`prefix(jt)`）和 `tailwindcss/utilities.css`（`source(none)`），再引入 `@jotl/form/tailwind.css`，写法见 [交给宿主的 Tailwind v4 构建编译](../../../packages/form/zh/docs/styling.md#交给宿主的-tailwind-v4-构建编译)，其中还要先声明层顺序。前缀只对这个入口生效，不能并入宿主自己的 `@import "tailwindcss"`。
- `style.css` 由 `pnpm run build:css` 生成；测试会重新生成并比对，文件过期时测试失败。
- widget 包另外导出 `styles`（各 widget 的工具类）和 `cn`（合并类名），供自定义 widget 复用同样的外观。

## 导出形态

- `htmlWidgets: WidgetRegistration<ComponentType>[]`：每个已实现的 widget 一条登记，`name` 与 `BUILTIN_WIDGETS` 的键一一对应，不带 `accepts`；各内置名接受的数据形态由 `@jotl/form/core` 的 `plan()` 检查，不接受时降级到该形态的默认 widget。
- `registerHtmlWidgets(registry)`：把 `htmlWidgets` 全部登记到给定的注册表。
