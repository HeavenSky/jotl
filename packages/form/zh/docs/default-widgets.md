# 默认 HTML widget

[English](../../docs/default-widgets.md) · **简体中文**

本页说明每个默认 widget 渲染成什么、如何处理输入，打开表单之前就能预判它的样子。完整的 widget 表见[原生 HTML 默认 widget 规范](../../../../zh/docs/spec/html-widgets.md)。

默认 widget 用原生 HTML 标签实现 `@jotl/form/core` 的全部内置 widget 名。它们是无状态受控 widget，外观由带 `jt:` 前缀的 Tailwind CSS v4 工具类表达；宿主不必使用 Tailwind（见[表单样式](styling.md)）。界面文案（按钮、占位、提示）有中英两套，按表单的 `locale` 取用；本页引用中文文案。

## 标量 widget

- **图片与文件**：`image`、`file` 只有传入 `adapters.upload` 时才出现「上传图片」/「上传文件」按钮，否则只有 URL 输入框。上传中显示状态，失败显示可读提示。
- **富文本**：`richtext` 只有传入 `adapters.richText` 时才渲染编辑器，否则是多行文本框。传入本包的 `richTextEditor` 即得到 `contenteditable` 最小编辑器（粗体、斜体、链接、列表），值经 `sanitizeHtml` 白名单清洗。
- **金额与大整数**：`money`、`bigint` 用文本框（`inputmode` 为 `decimal` / `numeric`），值为 `{ type, value, ... }` 对象。聚焦时显示原值，失焦与只读时按千分位显示（`money` 默认开启，由 `x-ui.thousands` 控制）。键入时去掉 `,` `，` 空格和 `_`，不合法时保留草稿并提示。`money` 失焦时补齐定长小数位，币种与单位按 schema 的 `const` / `enum` 显示为文字或下拉框。
- **数字**：`number` 按 `x-decimals` 设 `step`，失焦时舍入；开启千分位后改用文本框。
- **布尔与枚举**：`switch` 是带 `role="switch"` 的勾选框。`checkbox` 用于布尔时是单个勾选框，用于枚举数组时是一组勾选框。`select` 用于枚举数组时是多选下拉框。
- **JSON 文本**：`json` 用于字符串 schema（`contentMediaType: application/json`）时编辑原文，值仍是字符串，只要求能解析。

## 日期与时间

`date`、`time`、`datetime` 使用原生 `date`、`time`、`datetime-local` 控件，按本地时区显示。

- 读写按节点的存储格式 `x-valueFormat`：dayjs 格式串，`x` / `X` 表示毫秒 / 秒时间戳，或别名 `iso`、`iso-x`、`utc`、`utc-x`。没有时取 widget 默认：`date` 为 `YYYY-MM-DD`，`time` 为 `HH:mm:ss`，`datetime` 为 `iso`。
- 别名读取时接受任意 RFC 3339 date-time，写回时统一为该别名。`date` 选值存当天本地零点，`time` 选值存今天的该时刻。
- 存储格式含 `ss`，或为别名、时间戳时，控件显示到秒（`step=1`）；自定义格式含 `SSS` 时显示到毫秒（`step=0.001`）。
- 存量值不合存储格式时改用文本框原样显示并提示，不改写数据；只有键入能按存储格式解析的文本才写回。

## 复合 widget 与对象布局

| widget 或布局 | 使用者看到的形态 | 交互约定 |
|---|---|---|
| `list` | 每项一行并带序号，有「上移」「下移」「复制」「删除」按钮，另有「新增」 | 「复制」只在渲染器提供 `duplicate` 时出现；到 `maxItems` 时「新增」与「复制」禁用 |
| `nullable` | 「置为空」勾选框加原 widget | 勾选后值为 `null`，只显示「空值」；只有 `edit` 模式可切换 |
| `union` | 「类型」下拉框加当前分支的子表单 | 只有一个分支时不显示下拉框；切换分支后的数据由渲染器给出；`x-ui.props.selector` 为 `"buttons"` 且分支不超过 4 个时改为分段按钮 |
| `kv` | 键名输入框、值、删除按钮组成的列表，末尾有「新增」 | 新条目取 `key1` `key2` 这类未占用的键名；键名清空或与其他条目重复时只提示，不改数据 |
| `tuple` | 按位置排列的各项，标签取该项 `title` 或 `第 n 项` | 各位置不能增删。`items` 为 `true` 或 schema 时，额外元素排在各位置之后，有「新增」，每个额外元素有「上移」「下移」「复制」「删除」；只在额外元素之间移动，不会移进各位置，到 `maxItems` 时「新增」与「复制」禁用；其他情况下额外元素不显示，数据原样保留 |
| `page` / `inline` 加其他键 | 对象另有 schema 形式的 `additionalProperties` 时，字段之后出现「其他键」分组 | 同 `kv`：键名可增、删、改名，但不能取已声明的属性名 |
| `tree` | 「展开」/「收起」按钮加内容 | 折叠时不渲染内容；`view` 模式可展开，`disabled` 模式不可 |
| `page` / `inline` 加 `layout: "tabs"` | 每个分组一个标签页，未分组字段在第一页 | 切换标签页不改数据；方向键、`Home`、`End` 在标签间移动；没有分组时按 `stack` 排版；`disabled` 模式不可切换；每个标签显示该页字段的错误数 |
| `page` / `inline` 加 `layout: "grid"` | 字段按 `columns` 列排布，默认 2 列 | 每个分组各成一个栅格；列数经内联的 `--jotl-columns` 设定，引入 `style.css` 后才生效 |

`page` 与 `inline` 是同一个对象 widget：它只排版当前层，钻取（分页、入口行、面包屑）由渲染器完成，见[浏览嵌套数据](drill-down.md)。

## 形态检查

默认登记项不带 `accepts`。各内置名接受的数据形态由 `@jotl/form/core` 的 `plan()` 检查，形态不接受的名字降级到该形态的默认 widget（F2），见[排查 widget 降级](fallbacks.md)。

## 无障碍

- 对象、数组与上述复合 widget 的根元素经 `aria-labelledby` 引用外壳标签，读屏与 `getByLabelText` 能按字段标签找到它们。
- 外壳在渲染后判定 `<label>` 是否带 `for`：只有内层根元素是可被 label 关联的控件（非 hidden 的 `input`、`select`、`textarea` 等）时才带。复合 widget 外的 `<label>` 不带 `for`。
- `nullable` 与 `union` 内部的内容控件（id 以 `+` 结尾，没有自己的外壳）经 `aria-labelledby` 取外围字段的标签；`json` 在 `view` 模式下的 `<pre>` 同样如此关联标签。
