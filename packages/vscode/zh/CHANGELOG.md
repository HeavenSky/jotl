# 更新日志

[English](../CHANGELOG.md) · **简体中文**

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
