# Jotl

[![VS Marketplace](https://vsmarketplacebadges.dev/version-short/jotl-lang.vscode-jotl.svg?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=jotl-lang.vscode-jotl)
[![Installs](https://vsmarketplacebadges.dev/installs-short/jotl-lang.vscode-jotl.svg)](https://marketplace.visualstudio.com/items?itemName=jotl-lang.vscode-jotl)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE.txt)

[English](./README.md) · **简体中文**

> 扩展市场页面只显示英文版说明, 不随显示语言切换; 插件本身(命令标题, 设置说明, 预览面板, 诊断, 悬停与补全)会跟随 VS Code 的显示语言.

为 [Jotl](https://github.com/jotl-lang/jotl) 的 `.jotl` 文件提供语言支持, 并实时预览编译出的 JSON Schema, TypeScript 声明与表单.

> 当前是预发布版本, 行为与设置仍可能调整.

## 功能

- `.jotl` 文件的**语法高亮**.
- **编辑时的实时诊断**与快速修复.
- **补全**: 组件名, 元数据键, `widget` 取值, 条件 `op`, 以及 `<root/>` `<default/>` 标记.
- **悬停**: 显示光标处字段的说明与编译片段.
- 顶层类型的**跳转定义**与**查找引用**, 以及文档**大纲**.
- **预览面板**(命令 `Jotl: 打开预览`, 编辑器标题栏也有按钮), 三个页签; 代码带语法着色, 面板与表单跟随当前颜色主题(浅色, 深色或高对比度):
  - **JSON Schema**: 编译出的 schema 与诊断;
  - **TS**: 生成的 TypeScript 声明与转换诊断;
  - **表单**: 按 schema 渲染的表单, 只用于预览, 其中的修改不会写回文件; 可加载扩展组件模块(见[扩展组件模块](#扩展组件模块)).
- **JSON Schema 文件中的 `x-ui` 校验**: 编辑 `*.schema.json` 中的 `x-ui` 时有补全与校验. 文件根写了 `$schema` 时不生效: VS Code 的 JSON 语言服务此时只按 `$schema` 的地址取 schema, 不再套用插件按文件名关联的 schema. 需要时可在编辑 `x-ui` 期间暂时删去根 `$schema`, 改完再加回(Jotl 生成的 schema 都带它), 或改在 `.jotl` 源文件中编辑.
- **项目配置**: 按文件读取 `jotl.config.json` 中登记的组件(见下文).

## 命令

| 命令 | 说明 |
| --- | --- |
| `Jotl: 打开预览` | 在当前 `.jotl` 编辑器旁打开预览, 随编辑与切换编辑器更新. |

## 设置

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| `jotl.registeredWidgets` | `[]` | 内置组件之外项目自行注册的组件名, 例如 `["headline", "tag-list", "ImagePicker"]`; 它们会出现在 `widget: '` 的补全中, 且不再报 `JOTL7001` 组件未注册警告; 其中的大驼峰名另作为扩展组件, 可写在组件位置(底层按 `string` 编译). |
| `jotl.preview.loadWidgetModules` | `false` | 在预览表单中加载扩展组件模块(见[扩展组件模块](#扩展组件模块)); 关闭时这些组件按降级方式显示, 预览顶部给出提示. 不受信任的工作区中忽略该设置的工作区取值, 仓库不能自行开启. |

修改设置后立即生效, 无需重新加载窗口: 语言服务会按新的组件名重新诊断已打开的文件, 预览随之重新加载.

## 项目配置

在项目中放一个 `jotl.config.json` 登记组件名及其底层类型; 每个 `.jotl` 文件使用从所在目录向上找到的最近一个(到 Git 顶层为止):

```json
{ "widgets": { "ImagePicker": "url", "tag-list": "array", "headline": "string" } }
```

底层类型写 JSON Schema 基本类型名, 无体的 Jotl 内置组件名或 schema 对象. 同名时以配置文件为准, `jotl.registeredWidgets` 只补充名字. 修改配置文件后立即重新诊断已打开的文件; 配置有误时在受影响的 `.jotl` 文件开头报 `JOTL7002`. 配置文件本身有补全与校验. `jotl` 命令行读取同一个文件.

## 扩展组件模块

组件可以指向一个 React 组件模块, 写在 `jotl.config.json` 中, 或写在 Jotl 文件根条目的 `widgets` 元数据中(同名时文件内的声明优先):

```json
{ "widgets": { "ImagePicker": { "base": "url", "module": "https://esm.sh/my-image-picker?external=react,react-dom", "export": "default" } } }
```

```jotl
Page: [widgets: {ImagePicker: {base: 'url', module: './widgets/image-picker.js'}}] {
  cover: ImagePicker
}
```

根条目中的模块声明编译进 schema 根的 `x-ui.widgets`. 预览默认不运行这些模块; 开启 `jotl.preview.loadWidgetModules` 后加载:

- `module` 写 `https:` 地址, 或相对声明所在文件的路径(`./` `../` 或绝对路径); 本地文件从工作区提供给预览.
- 模块须是 ES 模块, 其导出(`export`, 缺省 `default`)是符合 `@jotl/form` 组件契约的 React 组件.
- 预览与模块共用预览自带的 React: 模块中裸写的 `react` `react/jsx-runtime` `react-dom` `react-dom/client` 都解析到预览的那一份; 模块不要自带 React(用 esm.sh 时加 `?external=react,react-dom`).
- 模块加载失败时该字段显示错误与重试按钮, 表单其余部分照常工作.

## 界面语言

插件跟随 VS Code 的显示语言: 命令标题, 设置说明, 预览面板与其中的表单, 以及 Jotl 语言服务给出的诊断, 悬停与补全. 内置英文与简体中文; 中文显示语言使用简体中文, 其余使用英文. 切换显示语言后按 VS Code 的提示重启即可.

## 运行要求

VS Code 1.101 或更高版本. 语言服务已打包在插件内, 无需另外安装.

## 更新记录

见 [CHANGELOG.md](./CHANGELOG.md).

## 许可证

[MIT](./LICENSE.txt)
