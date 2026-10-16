# 原生 HTML 默认 widget

实现或替换默认 widget 时读本页; 对应 `packages/form`

`@jotl/form` 的默认 widget(`src/html/`)只用原生 HTML 标签实现 [内置 widget 名](x-ui.md#内置-widget-名), 不依赖 CSS 框架与渲染器(`src/react/`); 各层 props 见 [各层 widget props](x-ui.md#各层-widget-props).
替换默认 widget: 在实例级注册表(`registry.extend()`)中登记同名 widget, 本级登记覆盖父级同名项.

## widget 表

| widget 名 | 元素 | 要点 |
|---|---|---|
| `input` | `<input type="text">` | `maxLength` `pattern` 同步为原生属性 |
| `textarea` | `<textarea>` | - |
| `password` | `<input type="password">` | 只改变显示 |
| `url` / `email` | `<input type="url">` / `<input type="email">` | - |
| `date` `time` `datetime` | `<input type="date">` / `"time"` / `"datetime-local"` | 读写时用 dayjs 在原生值与存储格式(`x-valueFormat`, 没有时按 `format`)之间转换, 本地时区; 存量值不符合存储格式时显示原值文本框与提示, 不改写数据; 规则见 [Jotl 语法规范](jotl.md#日期与时间) |
| `color` | `<input type="color">` + 文本框 | 原生取色器只支持 `#rrggbb`, 值不符合时只显示文本框 |
| `number` | `<input type="number">`; 开了 `thousands` 时 `<input type="text" inputmode="decimal">` | 空串写回 `undefined`; 按 `x-decimals` 设 `step` 并在失焦时舍入, integer 为 `step=1`; `minimum` `maximum` 同步 |
| `range` | `<input type="range">` | - |
| `money` | `<input type="text" inputmode="decimal">` + 币种, 单位选择 | 值为 `{type: "money", value, currency, unit?}`; 币种与单位按 schema 的 `const` / `enum` 显示为固定文字或下拉; 失焦补齐小数位 |
| `bigint` | `<input type="text" inputmode="numeric">` | 值为 `{type: "bigint", value}` |
| `switch` | `<input type="checkbox" role="switch">` | - |
| `checkbox` | boolean: 一个 `<input type="checkbox">`; 枚举数组: 一组 | - |
| `radio` | 一组 `<input type="radio">` | 选项文字取 `title`, 无则取值 |
| `select` | `<select>`; 枚举数组时 `multiple` | 可选字段带空选项; 必填字段只在没有值时带空选项 |
| `output` | `<output>` | 只读显示 |
| `image` | `<input type="url">` + `<img>` 预览 | 有 `adapters.upload` 时增加 "上传图片" 按钮(打开隐藏的 `<input type="file">`), 以 `upload(file, { dataPath, schema })` 返回的 URL 写回; 上传中显示状态并禁用按钮, 失败显示可读提示, 只写回最后一次选择的结果 |
| `file` | `<input type="url">` | 同 `image`, 按钮文字为 "上传文件", 没有预览 |
| `richtext` | `<textarea>` | 有 `adapters.richText` 时改用它; `richTextEditor` 是可传入的最小编辑器, 见 [富文本编辑器](#富文本编辑器) |
| `page` / `inline` | `<fieldset>` + `<legend>` | 两者共用; 分组用嵌套 `<fieldset>`; 布局见 [对象布局](#对象布局); 钻取由 `@jotl/form` 处理; 有 `additional` 时字段之后是 "其他键" 分组, 见 [其他键](#其他键) |
| `list` | `<ol>` + 增加, 删除, 上移, 下移按钮; 渲染器提供 `duplicate` 时另有复制 | 按 `canAdd` `canRemove` 禁用按钮(复制随 `canAdd`); 元素用 `renderChild(String(i))` |
| `tuple` | `<ol>`, 每个位置一项 | 第 i 项用 `renderChild(String(i))`; 位置标签由外壳给出(`prefixItems` 该项的 `title`, 否则 `第 n 项`); 位置不增删; `items` 为 `true` 或 schema 时, 位置之后列出剩余元素(`rest`, 第 i 项同样用 `renderChild(String(i))`, i 为实际下标), 带新增与删除, 受 `minItems` / `maxItems` 与 `mode` 约束, 位置未填满时不能新增; `items` 为 `false` 或缺省时无剩余区 |
| `nullable` `union` `kv` `tree` | 见 [复合 widget](#复合-widget) | - |
| `json` | 编辑态 `<textarea>`(JSON), 查看态 `<pre>` | JSON 不合法时保留草稿并显示错误; schema 为 string 时值是 JSON 原文 |
| `field` | `<div>` + `<label for>` + 必填标记 + 帮助文本 + 错误 | 错误元素的 `id` 供 `aria-describedby`; 有错误时字段带 `aria-invalid` |
| `form` | `<form>` | 提交时调用 `submit()` 并阻止默认行为; 页顶列出 `errors`, 有 `goToError` 时每条为按钮(可访问名称为错误消息加 "跳到所在位置" / "go to field"), 点击调用 `goToError(error)` |

- 千分位: `number` `money` `bigint` 在聚焦时显示原值, 失焦与只读时按 `thousands` 显示千分位; 键入与粘贴时去掉 `,` `，` 空格 `_`; 格式化用 `@jotl/form/core` 的 `formatThousands` / `stripThousands`.
- 选项读取用 `@jotl/form/core` 的 `enumOptions`; 字段标签由渲染器算好后经 `DecoratorProps.label` 传入(`title`, 否则键名).

## 复合 widget

| widget 名 | 形态 | 行为 |
|---|---|---|
| `nullable` | 原 widget + 置空开关 | 开关调用 `setNull`; 非空时用 `renderContent()` 渲染非空分支 |
| `union` | 左侧分支选择 + 右侧当前分支内容, 空间不足时换行 | 分支选择默认为下拉; `props.selector` 为 `"buttons"` 且分支不超过 4 个时为分段按钮(一组 `<input type="radio">`, `role="radiogroup"`), 分支更多时仍用下拉; 选项取 `branches[i].title`, 选择时调用 `selectBranch(i)`; 子表单用 `renderContent()` 渲染 |
| `kv` | 键值对列表 | 键名可增, 删, 改名(`addEntry` `removeEntry` `renameEntry`), 按 `canAdd` `canRemove` 禁用; 值用 `renderChild` 渲染, 相对路径为经 `escapePointerToken` 转义的键名 |
| `tree` | 可折叠的树, 按需展开 | 展开状态由 `expanded` 与 `setExpanded` 控制; 折叠时不调用 `renderContent()` |

- `union` widget 不自行改写数据: 切换分支时由渲染器用新分支的默认数据替换当前值, 并在同一表单实例内缓存各分支最后一次的值, 切回时恢复.
- 可区分联合的当前分支由渲染器按区分字段的值决定, widget 只读 `activeBranch`.

## 富文本编辑器

`richTextEditor`(组件为 `RichTextEditor`)作为 `adapters.richText` 传入后, `richtext` 改为不依赖第三方库的 `contenteditable` 编辑器; 默认仍是 `<textarea>`.

- 值为 HTML 字符串, 内容为空时写回 `undefined`; 工具栏(`role="toolbar"`)有粗体, 斜体, 链接, 无序列表, 有序列表, 经 `document.execCommand` 执行; 链接地址经 `prompt` 输入, 只接受相对地址与 `http` `https` `mailto` `tel`.
- 写回与显示都经 `sanitizeHtml` 白名单清洗: 只保留 `p` `br` `div` `span` `b` `strong` `i` `em` `u` `s` `a` `ul` `ol` `li` `blockquote` `code` `pre` `h1`-`h4`, `a` 只保留安全的 `href` 与 `title`, 其余属性(含事件属性与 `style`)一律去掉; `script` `style` `iframe` 等连同内容丢弃, 其他标签只保留文字.
- 编辑区为 `role="textbox"` `aria-multiline`, 经 `aria-labelledby` 取外壳标签; `view` 只读且不显示工具栏, `disabled` 不可编辑且工具栏禁用.

## 对象布局

`page` `inline` 按 `LayoutProps.layout` 排版; `fields` 中 `hidden` 为真的字段不显示.

| `layout` | 行为 |
|---|---|
| `stack` | 默认; 未分组字段在前, 各分组依次用嵌套 `<fieldset>` |
| `tabs` | 每个 `groups` 项一个标签页, 未分组字段放第一个标签页 |
| `grid` | 字段按 `columns` 列排布, 默认 2 列 |

## 其他键

对象同时有 `properties` 与 schema 形式的 `additionalProperties` 时, 渲染器经 `LayoutProps.additional` 给出不属于 `properties` 的键; `page` `inline` 在字段之后渲染 "其他键" 分组, 复用 `kv` 的键值编辑列表(`EntryEditor`): 键名可增, 删, 改名, 不能取已声明的属性名; 值用 `renderChild` 渲染, 相对路径为经 `escapePointerToken` 转义的键名; 数据仍写回同一对象. `additionalProperties: true` 不显示该分组; `patternProperties` 仍按 F7 整体用 `json`.

## 受控 widget 约束

- widget 一律无状态受控: 值只来自 `value`, 变更只通过 `onChange`.
- 唯一允许的局部状态是输入中尚不合法的草稿文本(如数字框中的 `-`, `json` 中未闭合的括号), 合法后立即 `onChange`; 例外: `number` `money` `bigint` 用聚焦状态切换原值与千分位显示.
- 三种 `mode`: `edit` 可编辑, `view` 只读显示, `disabled` 禁用.
- 适配器缺省时按上表的退化形态工作, 不报错.

## 样式

- 元素同时带 `jotl-` 语义类名与 Tailwind CSS v4 工具类(前缀 `jt`, 如 `jt:flex`); 语义类名是对外的覆盖与定位入口, 工具类不作承诺.
- 不带 preflight; 生成的规则都在 `theme` `components` `utilities` 三个 cascade layer 中, 宿主未分层的样式优先.
- 主题: 设计变量经 `@theme inline` 接到 `--jotl-*` 变量(`--jotl-border` `--jotl-focus` `--jotl-error` `--jotl-muted` `--jotl-radius` `--jotl-gap` 等), 在任意子树上覆盖这些变量即可换肤; 默认值见 `packages/form/theme.css`.
- 两种接入:
  - 不用 Tailwind 的宿主引入预编译的 `@jotl/form/style.css`; 不引入时 widget 仍可用.
  - Tailwind v4 宿主在一个独立的 CSS 入口中引入 `tailwindcss/theme.css`(`prefix(jt)`)与 `tailwindcss/utilities.css`(`source(none)`), 再引入 `@jotl/form/tailwind.css`; 写法见 `packages/form/README.md`. 前缀只对这个入口生效, 不能并入宿主自己的 `@import "tailwindcss"`.
- `style.css` 由 `pnpm run build:css` 生成, 测试会重新生成并比对, 过期时失败.
- widget 包另导出 `styles`(各 widget 的工具类)与 `cn`(合并类名), 供自定义 widget 复用同一外观.

## 导出形态

- `htmlWidgets: WidgetRegistration<ComponentType>[]`: 每个已实现 widget 一条登记, `name` 与 `BUILTIN_WIDGETS` 的键一一对应, 不带 `accepts`; 各内置名接受的数据形态由 `@jotl/form/core` 的 `plan()` 检查, 不接受时降级到该形态的默认 widget.
- `registerHtmlWidgets(registry)`: 把 `htmlWidgets` 全部登记到给定注册表.
