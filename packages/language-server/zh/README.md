# @jotl/language-server

[English](../README.md) · **简体中文**

包页与市场页只显示英文版。

让任何带 LSP 客户端的编辑器在编辑 Jotl 文件时获得实时诊断、补全、悬停与预览。

`@jotl/language-server` 是 [Jotl](../../../zh/README.md) 的语言服务（Language Server Protocol）；Jotl 是一门编译到 JSON Schema 2020-12 的简洁语言。它面向想在 VS Code 以外的编辑器里写 Jotl 的人，以及需要同样检查能力的工具作者。它与 [`jotl` 命令行](../../cli/zh/README.md)使用同一个编译器、读同一个 `jotl.config.json`，编辑器标出的问题正是构建时会拒绝的问题。每项能力也都是普通函数，不建 LSP 连接也能调用。

## 看编辑器收到的诊断

下面的脚本把一份带拼写错误和未知 widget 的 Jotl 文档交给 `getDiagnostics`，服务端推送 `textDocument/publishDiagnostics` 用的就是这个函数：

```js
// diagnose.mjs
import { getDiagnostics } from "@jotl/language-server";

const text = "Home: {\n  title: strng\n  logo: string[widget: 'uploader']\n}\n";
for (const d of getDiagnostics(text, "file:///home.jotl")) {
	console.log(d.range.start.line, d.range.start.character, d.code, d.message);
}
```

```console
$ node diagnose.mjs
1 9 JOTL1004 Unknown component `strng`
2 23 JOTL7001 widget `uploader` is not registered and will fall back when rendering
```

位置与 LSP 一致，从 0 起。消息语言默认为英文，先调用 `@jotl/core` 的 `setLocale("zh-CN")` 则输出中文。第三个参数传 `{ registeredWidgets: ["uploader"] }` 后，只剩拼写错误。

## 三步启动服务

需要 Node 22 或更高版本，以及能启动外部命令的 LSP 客户端。

1. 安装：

    ```sh
    pnpm add @jotl/language-server
    ```

2. 创建服务入口：

    ```sh
    echo 'import { startServer } from "@jotl/language-server"; startServer();' > jotl-server.mjs
    ```

3. 在编辑器的 LSP 客户端里，为 `*.jotl` 文件配置这条启动命令：

    ```sh
    node jotl-server.mjs --stdio
    ```

    服务端对 `initialize` 的响应中 `serverInfo.name` 为 `jotl-language-server`，文档一打开就推送诊断。也支持 `--node-ipc` 与 `--socket`。

## 能做什么

- **边写边报错，并给出快速修复。** 编译器诊断与 widget 未注册警告在最后一次编辑 200 毫秒后推送；把顶层字段包进根类型之类的修复以 code action 提供。
- 补全懂 Jotl：组件、本文件声明的类型、适用于当前组件的元数据键、符合字段数据形态的 `widget` 取值、`value_format`、条件 `op`，以及 `<root/>` / `<default/>` 标记。
- 看字段编译成什么：悬停显示编译后的 JSON 片段；顶层类型支持跳转定义、查找引用与大纲。
- 预览产物：`jotl/preview` 请求返回编译出的 JSON Schema、TS 声明及各自的诊断。
- 项目组件直接可用：服务端为每个文档找到所属的 `jotl.config.json`，文件变更后重新检查已打开的文档；`createXUiJsonSchema()` 为 JSON 语言服务提供 `*.schema.json` 中 `x-ui` 的 schema。

## 适用边界

在 VS Code 里请直接装 [Jotl 插件](../../vscode/zh/README.md)，它内置本服务并提供预览面板。服务端按单个文件工作，跳转定义与查找引用不跨文件。它不提供文档格式化，格式化用 [`jotl format`](../../cli/zh/README.md)。预览是自定义请求，通用 LSP 客户端要写几行客户端代码才能展示。

## 进一步阅读

- [使用指南](docs/README.md)：接入 LSP 客户端、初始化选项与设置、预览请求，以及直接调用各函数
- [Jotl 语法规范](../../../zh/docs/spec/jotl.md)与 [`x-ui` 规范](../../../zh/docs/spec/x-ui.md)

## 许可证

[MIT](../../../LICENSE)
