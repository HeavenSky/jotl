# 登记项目 widget

[English](../../docs/project-widgets.md) · **简体中文**

读完本页，项目自己添加的 widget 在 `.jotl` 文件中会和内置 widget 一样得到补全与检查，底层类型由你指定。前提是已装好插件（见[快速开始](../README.md#三步打开实时预览)）。

## 在 `jotl.config.json` 中声明 widget

`jotl.config.json` 为每个 widget 指定名字和底层类型；`jotl` 命令行读取同一个文件，编辑器与构建的结果因此一致。

1. 在 `.jotl` 文件所在目录或任一上级目录新建 `jotl.config.json`：

   ```json
   { "widgets": { "ImagePicker": "url", "tag-list": "array", "headline": "string" } }
   ```

   配置文件本身有补全与校验；保存后，已打开的 `.jotl` 文件立即重新检查。

2. 在 `.jotl` 文件中使用这些 widget：

   ```jotl
   Article: {
     cover: ImagePicker
     title: string[widget: 'headline']
   }
   ```

   `cover` 按 `ImagePicker` 的底层类型编译；`headline` 不再报 widget 未注册警告 `JOTL7001`。

## 配置中能写什么

- **大驼峰名是扩展组件**：可以像 `cover: ImagePicker` 那样写在类型位置。其余名字只登记为 `widget` 名，底层类型不参与编译，但字段类型不被它接受时报警告 `JOTL1052`（如 `"headline": "string"` 时的 `count: integer[widget: 'headline']`）。`integer` 字段可以用 `number` 底层类型的 widget。
- 底层类型写 JSON Schema 基本类型名（`string`、`number`、`integer`、`boolean`、`array`、`object`）、不带体的 Jotl 内置组件名（`enum`、`union` 除外），或原样使用的 schema 对象。
- 带 `module` 键的对象同时声明一个 React 模块，见[在预览中加载 widget 模块](widget-modules.md)。
- 文件只有 `widgets` 和 `$schema` 两个键。不合法的项会被跳过，并在每个使用该配置的 `.jotl` 文件开头报 `JOTL7002`。

每个 `.jotl` 文件从所在目录向上查找，使用最近的一个 `jotl.config.json`，到含 `.git` 的目录或文件系统根为止。完整规则（包括扩展组件可带哪些约束键）见 [Jotl 语法规范](../../../../zh/docs/spec/jotl.md#条目)中的「扩展组件」。

## 用设置 `jotl.registeredWidgets` 只登记名字

只需要名字时用这个设置，例如表单宿主在运行时才注册的 widget。取值是字符串列表，默认 `[]`：

```json
{ "jotl.registeredWidgets": ["headline", "tag-list", "ImagePicker"] }
```

- 列出的名字出现在 `widget: '` 的补全中，不再报 `JOTL7001`。
- 大驼峰名还可以写在类型位置，按 `string` 编译。
- 设置中的名字不带类型，不会报 `JOTL1052`。
- 同一个名字两处都有时以 `jotl.config.json` 为准：设置只补充名字，不指定类型。

修改设置或配置文件后立即生效，无需重新加载窗口。
