# 更新日志

[English](../CHANGELOG.md) · **简体中文**

## v0.0.4 2026-11-06 统一条件格式

- **破坏性变更：** `root_if` 与 `node_if` 组合条件改用 `{op: 'and', conditions: [...]}`、`{op: 'or', conditions: [...]}` 和 `{op: 'not', condition: ...}`。请替换原来的 `{and: [...]}`、`{or: [...]}` 与 `{not: ...}` 对象；叶子表达式与路径字符串简写保持原有语法（[语法规范](https://github.com/HeavenSky/jotl/blob/HEAD/zh/docs/spec/jotl.md)）。
- **破坏性变更：** JSON Schema 的 `x-ui.visibleIf` 叶子改用 `left`、`op`、`right`，组合条件改用 `op` 搭配 `conditions` 或 `condition`。请将手写条件更新为新格式；由 `.jotl` 源码生成的 JSON Schema 重新编译即可（[契约](https://github.com/HeavenSky/jotl/blob/HEAD/zh/docs/spec/x-ui.md)）。
- `npm run check` 现在还检查 `contributes.configuration` 的默认值：每个设置项都声明与实际生效值一致的 `default`，object 型设置声明 `additionalProperties`，嵌套子键与 snippet 写出的默认值与父对象默认值保持一致。运行行为无变化。
- 预览入口行与折叠面板统一标题和摘要样式，字典行的简单值由键名提供标签。
- 子 schema 校验保留嵌套 `$id` 与 `$anchor` 的作用域，并正确定位名称中含字面量 `%` 序列的属性。
- 预览表单换数据时清除上一条记录的联合分支缓存，受控值回显时保留缓存。
- 库与 Playground 的升级步骤见[仓库更新日志](https://github.com/HeavenSky/jotl/blob/HEAD/zh/CHANGELOG.md)。

## v0.0.3 2026-10-22 更严格的格式校验

- **破坏性变更：** 表单校验的 `time`、`date-time`、`duration` 改按 RFC 3339：时区偏移必须带分钟（写 `+08:00`，不能写 `+08`），秒为 `:60` 只接受 UTC 23:59 的闰秒。`uuid` 不再接受 `urn:uuid:` 前缀，`hostname` 不再接受末尾的点。请改写数据与默认值中的这类取值；`time`、`date-time`、`uuid`、`hostname` 上不再合法的默认值会在编辑器中报 `JOTL1008`。
- **破坏性变更：** `value_format` 含无法读回的记号（`w` `W` `k` `kk` `gggg` `GGGG` `z` `S` `SS`，或与其他记号混排的 `X` / `x`）时报错误 `JOTL1053`。请改用 `YYYY` `MM` `DD` `HH` `mm` `ss` 等记号或时间戳；预览表单遇到这类格式不再出错。
- `variants` 场景中写的 `widget` 与字段上的一样检查：不适用的内置 widget 报 `JOTL1045`，该场景沿用字段的 widget；`jotl.config.json` 中 widget 声明的底层类型不接受字段类型时报 `JOTL1052`。
- 很长的类型别名链不再让语言服务停止工作，经由别名链的错误 `default` 照样报出。
- 新设置 `jotl.preview.allowModuleStyles`（默认关闭）允许预览中的 widget 模块加载 `https:` 样式表并在运行时插入样式，antd 就需要这样（[指南](https://github.com/HeavenSky/jotl/blob/HEAD/packages/vscode/zh/docs/widget-modules.md)）。
- `x-ui.widgets` 中的模块声明可以写 `level`，模块 widget 可以登记为布局或装饰器；`*.schema.json` 中的补全与校验认识这个新键。
- 预览表单的文本输入按字符计算 `maxLength`，emoji 不再提前拦截输入，只剩一个字符时输入或粘贴时除外。

## v0.0.2 2026-10-21 更严格的诊断

- 新增诊断：空的可辨识联合，时间戳 `value_format` 字段上的字符串约束，以及以 `$.` 开头的 `node_if` 路径（要从根读取请用 `root_if`）。
- 不带时区的 `datetime` 或 `format: 'time'` 默认值现在报 `JOTL1008`；表单校验本来就不接受这种值，两边从此一致。
- `default` 值现在也会按含 `YY` `M` `D` `H` `h` `hh` `m` `s` 的 `value_format` 格式串检查；`h` 与 `hh` 结合 `A` / `a` 一起解读。
- `item_meta` 写在 `array_item`、`map_item` 等之前时，其中的补全也能用了。
- 字段用了 `jotl.config.json` 中的 widget，而该 widget 声明的底层类型不接受字段的类型时，报警告 `JOTL1052`。
- 预览表单：`x-ui` widgets 中 widget 名为空时给出提示；只读数字字段获得焦点时保留千分位分隔符；widget 模块加载失败时按预览语言提示；元组的剩余元素可以移动和复制。
- 预览中的 TypeScript 声明：可空联合保留为 `(A | B) | null`；每个封闭对象都标注 `@closed`（`money` 与 `bigint` 的范围标注 `@decimalRange`），数组元素与可空对象标注在持有它的属性上；所有位置都有标识符标题的元组写成具名元组。这样转换回来得到的是同一份 schema。

## v0.0.1 2026-10-16 首个版本

- `.jotl` 文件支持语法高亮、带快速修复的诊断、补全、悬停、转到定义、查找所有引用和大纲；插件内置 Jotl 语言服务。
- `Jotl: 打开预览` 并排显示编译出的 JSON Schema、TypeScript 声明和表单，跟随颜色主题。
- `*.schema.json` 文件中的 `x-ui` 定义支持补全与校验。
- 项目 widget 可以登记在 `jotl.config.json` 中（与 `jotl` 命令行共用），也可以用设置 `jotl.registeredWidgets` 只登记名字（[指南](https://github.com/HeavenSky/jotl/blob/HEAD/packages/vscode/zh/docs/project-widgets.md)）。
- 打开 `jotl.preview.loadWidgetModules` 后，预览表单可以加载你的 React widget 模块；该设置默认关闭，在不受信任的工作区中忽略它的工作区取值（[指南](https://github.com/HeavenSky/jotl/blob/HEAD/packages/vscode/zh/docs/widget-modules.md)）。
- 插件界面、预览表单和语言服务的提示提供英文与简体中文，跟随 VS Code 的显示语言。
