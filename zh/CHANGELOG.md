# 更新日志

[English](../CHANGELOG.md) · **简体中文**

## [0.0.4] - 2026-11-06

- 在 `0.0.x` 版本线重新发布 [0.1.0](#010---2026-11-05) 的变更。从 `0.0.3` 升级时，请按下方破坏性变更中的步骤迁移。

## [0.1.0] - 2026-11-05

### 破坏性变更

- Jotl 的 `root_if` 与 `node_if` 组合条件改用 `{op: 'and', conditions: [...]}`、`{op: 'or', conditions: [...]}` 和 `{op: 'not', condition: ...}`。请替换原来的 `{and: [...]}`、`{or: [...]}` 与 `{not: ...}` 对象；叶子表达式与路径字符串简写保持原有语法（[语法规范](https://github.com/HeavenSky/jotl/blob/HEAD/zh/docs/spec/jotl.md)）。
- JSON Schema 的 `x-ui.visibleIf` 叶子改用 `{left: 'kind', op: 'eq', right: 'b'}`，原写法为 `{field: '/kind', eq: 'b'}`。请把 JSON Pointer 路径转换为 lodash 路径，把比较名与值分别放入 `op` 和 `right`，并把 `all`、`any`、`not` 组合改为上面的 `op` 对象；相对节点取值的叶子保留 `base: 'node'`（[契约](https://github.com/HeavenSky/jotl/blob/HEAD/zh/docs/spec/x-ui.md)）。
- `JotlForm` 的 `drill` 属性改名为 `nested`。请将 `drill={false}` 替换为 `nested={false}`，需要在同一页显示折叠面板时保留 `collapsible`（[指南](https://github.com/HeavenSky/jotl/blob/HEAD/packages/form/zh/docs/nested.md)）。
- 凤蝶转换的公共 API 统一采用 `fengdie` 命名。请将 `fengdieToUmoJson`、`umoJsonToSchema`、`isKnownUmoType`、`umoJsonFeature` 分别替换为 `parseFengdieJson`、`fengdieJsonToSchema`、`isKnownFengdieJsonType`、`fengdieJsonFeature`；通过 `migrateFengdie(...).fengdieJson` 读取中间产物，替代 `.umo`。`UmoJson` 改为 `FengdieJson`，`UmoToSchemaOptions` 改为 `FengdieJsonToSchemaOptions`，`FengdieUmoResult` 改为 `FengdieJsonResult`，其余 `Umo*` 类型改为 `FengdieJson*`；默认源码文件名改为 `default.schema`（[API](https://github.com/HeavenSky/jotl/blob/HEAD/packages/convert/zh/docs/fengdie-migration.md)）。

### 新增

- Playground 可以粘贴 fengdie DSL schema 与凤蝶 `toJson` 产物，预览迁移后的表单，并在「迁移后 Jotl」页签复制生成的源码（[指南](https://github.com/HeavenSky/jotl/blob/HEAD/apps/playground/zh/README.md)）。

### 变更

- 凤蝶 `if` 表达式中可以转换为 `visibleIf` 的写法，改为相对字段所在对象读取路径，与凤蝶编辑器的求值上下文一致。请重新运行迁移，生成相对节点的条件（[支持的表达式](https://github.com/HeavenSky/jotl/blob/HEAD/packages/convert/zh/docs/fengdie-migration.md)）。
- 表单入口行与折叠面板统一标题和摘要样式；Ant Design 表单的标题与间距采用相同的呈现方式。

### 修复

- 数据迁移选择联合分支时保留公共字段与约束，按判别字段的值选分支，普通枚举字段失效时只修正该字段，保留对象其余数据。默认值生成与迁移会组合应用于同一属性或数组元素的多处声明。
- 子 schema 校验保留嵌套 `$id` 与 `$anchor` 的作用域，并正确定位名称中含字面量 `%` 序列的属性。
- 表单换数据时清除上一条记录的联合分支缓存，受控值回显时保留缓存。
- Playground 中名为 `Object`、`String` 或其他凤蝶关键字的 Jotl 类型，正确进入 Jotl 编译流程。
