# 接入编辑器

[English](../../docs/editor-integration.md) · **简体中文**

读完本页，你能把 `@jotl/language-server` 接进任何 LSP 客户端：启动服务、传入选项、同步设置与 `jotl.config.json`，并请求预览。前提是已按[快速开始](../README.md)建好服务入口。VS Code 插件在 [`packages/vscode/src/index.ts`](../../../vscode/src/index.ts) 里完成了全部接线，可以直接参照。

## 启动服务

`startServer()` 创建连接、注册全部处理函数并开始监听。它按进程参数 `--node-ipc`、`--stdio` 或 `--socket` 选择传输方式，返回该连接。

```js
import { startServer } from "@jotl/language-server";

startServer();
```

已有连接时，调用 `createServer(connection, options?)` 注册处理函数，再自行调用 `connection.listen()`。`options.diagnosticsDelay` 设置防抖毫秒数（默认 `DIAGNOSTICS_DELAY`，即 200），`options.configHost`（`{ exists, readFile }`）替换读取 `jotl.config.json` 所用的文件系统。

## 服务端声明的能力

`initialize` 的响应声明以下能力，`serverInfo.name` 为 `jotl-language-server`：

| 能力                                                                                  | 取值                                                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `textDocumentSync`                                                                    | `openClose: true`，增量同步                                              |
| `completionProvider`                                                                  | 触发字符 `:` `[` `,` `'` `"` `<` `\|`（`COMPLETION_TRIGGER_CHARACTERS`） |
| `codeActionProvider`                                                                  | 类型 `quickfix`                                                          |
| `hoverProvider`、`definitionProvider`、`referencesProvider`、`documentSymbolProvider` | `true`                                                                   |

另有两条自定义消息：请求 `jotl/preview` 与通知 `jotl/configChanged`，见[展示预览](#展示预览)。

文档保存在内存中。打开时立即编译并推送诊断。改动后等待 `diagnosticsDelay`，只按最新文本推送一次。关闭时取消待推送的诊断并推送空列表。补全、悬停等请求总是使用最新文本。

## 传入初始化选项

在 `initializationOptions` 中传入以下字段，不合法的值被忽略。

| 字段                | 类型       | 含义                                                                                                                                                                     |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `registeredWidgets` | `string[]` | 项目自行登记的 widget 名。空串与非字符串被丢弃，重复项去重。大驼峰名同时作为扩展组件编译，底层类型为 `{ "type": "string" }`，`jotl.config.json` 给出其他类型时以配置为准 |
| `locale`            | `string`   | 诊断、悬停、补全说明与预览文字的语言标签                                                                                                                                 |

语言依次取 `initializationOptions.locale`、`initialize` 参数中的 `locale`，都没有时为 `en`。以 `zh` 开头的标签为中文，其余为英文。该设置作用于整个进程：它设置的是 `@jotl/core` 的全局语言。

不登记时，只有 `@jotl/form/core` 的内置 widget（`BUILTIN_WIDGETS`）算已知，也没有扩展组件。文件根条目元数据 `widgets` 声明的名字在本文件内视为已登记。

## 同步设置

**设置要放在 `jotl` 节下**：只有 `settings` 含 `jotl`（`CONFIGURATION_SECTION`）时，服务端才响应 `workspace/didChangeConfiguration`。

```json
{ "settings": { "jotl": { "registeredWidgets": ["headline"], "locale": "en" } } }
```

- `registeredWidgets` 整体替换原列表；`jotl` 节里不带它时，列表被清空。
- `locale` 在运行时切换语言。
- 两者任一变化后，全部已打开的文档重新诊断。

## 使用 jotl.config.json

对每个 `file:` 文档，服务端从文档所在目录开始向上找最近的 `jotl.config.json`，到含 `.git` 的目录或文件系统根为止。格式见 [Jotl 语法规范](../../../../zh/docs/spec/jotl.md#条目)「条目」一节中的扩展组件；[`jotl` 命令行](../../../cli/zh/README.md)读的是同一个文件。

- 文件中的名字并入 `registeredWidgets`，底层类型传给编译器。同名时以配置文件为准；设置中的名字作为补充，只出现在设置中的大驼峰名仍按 `string` 编译。
- 结果按目录缓存。客户端要监听 `**/jotl.config.json`，并经 `workspace/didChangeWatchedFiles` 转发变更：服务端随即清空缓存，重新诊断全部已打开的文档。
- 文件读不到、不是合法 JSON 或有不合法的项时，在用到它的每个文档开头报 `JOTL7002` 警告。不合法的项被忽略，其余照常生效。

## 展示预览

发送请求 `jotl/preview`（`PREVIEW_REQUEST_METHOD`），参数为 `{ textDocument: { uri } }`。服务端返回 `PreviewContent`；文档未打开时返回 `null`。

| 字段                    | 内容                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `schema`                | 编译出的 JSON Schema，两空格缩进的 JSON 文本；有错误级诊断时为 `undefined`                                |
| `typescript`            | TS 声明；编译或转换失败时为 `undefined`                                                                   |
| `diagnostics`           | 编译诊断与 widget 未注册警告，行列从 1 起                                                                 |
| `typescriptDiagnostics` | TS 转换诊断，已换算回源码位置；换算不到时只有 `pointer`                                                   |
| `configFile`、`modules` | 文档所属 `jotl.config.json` 的绝对路径及其中的模块声明；`module` 中的相对路径按 `configFile` 所在目录解析 |

服务端处理完 `jotl.config.json` 的变更后，发出无参数通知 `jotl/configChanged`（`PREVIEW_CONFIG_CHANGED_METHOD`）。收到后重新请求预览。不要为此自己监听该文件：那样会在服务端丢弃旧配置之前读到预览。

## 校验 JSON Schema 文件中的 x-ui

服务端只处理 Jotl 文档。要校验普通 JSON Schema 文件中的 `x-ui`，把两份生成的 schema 登记到你的 JSON 语言服务：

- `createXUiJsonSchema()` 返回 `$id` 为 `X_UI_JSON_SCHEMA_ID` 的 schema。它沿 2020-12 的全部子 schema 关键字递归，在每个节点上校验 `x-ui`。VS Code 插件把它关联到 `*.schema.json`。
- `createJotlConfigJsonSchema()`（转出自 `@jotl/core`）返回 `jotl.config.json`（`JOTL_CONFIG_FILE`）的 schema。

按文档根 `$schema` 选 schema 的 JSON 语言服务会忽略按文件名关联的 schema，因此声明了 `$schema` 的文件中 `x-ui` 校验不生效。

## 诊断代码

服务端在编译器诊断（`@jotl/core` 的 `JOTL1xxx`）之外加两种警告：

| 代码       | 含义                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JOTL7001` | 元数据 `widget` 或 `decorator`（含 `variants` 各场景覆盖中的）引用的 widget 既不是内置 widget，也不在 `registeredWidgets` 中，也不是文件根元数据 `widgets` 声明的名字，渲染时将降级 |
| `JOTL7002` | 文档所属的 `jotl.config.json` 有误；报在文档开头                                                                                                                                    |

所有诊断的 `source` 都是 `"jotl"`。

## 已知限制

- 跳转定义、查找引用与大纲只覆盖当前文件的顶层类型。
- `item_meta` 写在 `*_item` 之前时，其中的补全拿不到条目类型。把 `item_meta` 写在 `*_item` 之后即可按条目类型补全。
