# Jotl

[English](../README.md) · **简体中文**

用 Jotl 写 JSON Schema 2020-12，就像写类型定义一样紧凑；同一份源码能编译出标准 schema、TypeScript 声明，还能直接渲染成表单。它面向用 JSON Schema 维护数据契约或配置表单、又不想再手改层层嵌套 JSON 的团队。每个字段一行，写明类型、标题、约束、默认值与 UI 提示；`required`、枚举标签和 `$defs` 由编译器生成。和 Zod、TypeBox 这类在代码里定义 schema 的库不同，Jotl 源码是独立文件，不写 TypeScript 的人也能改，而且可以双向转换：已有的 JSON Schema 能打印回 Jotl。

## 五行源码，编译出标准 JSON Schema

把下面内容存为 `home.jotl`：

```jotl
Home: {
  title(Title): string[default: 'Welcome', maxLength: 20]
  mode(Mode): enum[default: 'light']{ light(Light) dark(Dark) }
  tags?: array[array_item: 'string', maxItems: 5]
}
```

`jotl compile home.jotl` 输出：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$ref": "#/$defs/Home",
  "x-ui": {
    "version": 1
  },
  "$defs": {
    "Home": {
      "type": "object",
      "properties": {
        "title": {
          "title": "Title",
          "type": "string",
          "maxLength": 20,
          "default": "Welcome"
        },
        "mode": {
          "title": "Mode",
          "type": "string",
          "oneOf": [
            {
              "title": "Light",
              "const": "light"
            },
            {
              "title": "Dark",
              "const": "dark"
            }
          ],
          "default": "light"
        },
        "tags": {
          "type": "array",
          "maxItems": 5,
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "title",
        "mode"
      ]
    }
  }
}
```

输出是标准的 2020-12。唯一的扩展是 `x-ui` 关键字，用来携带表单布局与 widget 提示。

## 编译第一个 schema

需要 Node 22 及以上。

```sh
pnpm add -D jotl
pnpm exec jotl compile home.jotl --out home.schema.json
pnpm exec jotl compile home.jotl --to ts --out home.d.ts
```

第一条安装命令行工具，第二条写出上面的 JSON Schema，第三条写出对应的 TypeScript 声明。全部命令与选项见 [CLI README](../packages/cli/zh/README.md)。

## 一份源码能得到什么

- **schema、类型与表单保持一致**：编译为 JSON Schema 2020-12 或 TS 声明，再用 `@jotl/form` 把 schema 渲染成 React 表单，也可换用 Ant Design widget。
- **已有 schema 可以直接接入**：把 2020-12 JSON Schema 打印回 Jotl，在 JSON Schema 与 TS 声明之间互转，把旧版 JSON Schema、OpenAPI 3.0 / Swagger 2.0 Schema Object 与凤蝶 schema 升级过来。
- **数据工具适用于任意 2020-12 schema**：默认数据、校验、旧数据迁移与 Mock，可在代码中调用，也可用 `jotl validate` 和 `jotl defaults`。
- **边写边有编辑器支持**：VS Code 插件提供带快速修复的诊断、补全、悬停、跳转定义，以及 schema、TS 与表单的实时预览。
- **报错能直接定位**：每条诊断都带固定的 `JOTL` 代码，并指向行列或 JSON Pointer，消息有中英文两种。

## 按需选包

浏览器中渲染表单只需要 `@jotl/core`、`@jotl/data` 和 `@jotl/form`，其余包用于编写与工具链。

| 包 | 用途 |
|---|---|
| [`@jotl/core`](../packages/core/zh/README.md) | 解析、编译、格式化与打印 Jotl；共用的 schema 类型、诊断与 JSON Pointer 工具 |
| [`@jotl/convert`](../packages/convert/zh/README.md) | JSON Schema 与 TS 声明互转；升级旧版 JSON Schema 与 OpenAPI；迁移凤蝶 schema |
| [`@jotl/data`](../packages/data/zh/README.md) | 面向 JSON Schema 2020-12 的默认数据、校验、迁移与 Mock |
| [`@jotl/form`](../packages/form/zh/README.md) | React 表单渲染器（React 16.8 至 19），自带原生 HTML widget；与框架无关的渲染规划在 `@jotl/form/core` |
| [`@jotl/antd`](../packages/antd/zh/README.md) | `@jotl/form` 的 Ant Design widget（antd 5 或 6，React 18 及以上） |
| [`@jotl/language-server`](../packages/language-server/zh/README.md) | `.jotl` 文件的语言服务（LSP） |
| [`vscode-jotl`](../packages/vscode/zh/README.md) | 带实时预览的 VS Code 插件 |
| [`jotl`](../packages/cli/zh/README.md) | 命令行：编译、转换、检查、校验、默认数据、迁移与格式化 |
| [`@jotl/playground`](../apps/playground/zh/README.md) | 在浏览器中编辑 Jotl 并预览表单，从本仓库本地启动 |

面向使用者的文字有英文（`en`，默认）与中文（`zh-CN`）两种。代码中用 `@jotl/core` 的 `setLocale` 设置，命令行用 `--lang`；各包的其他选项见各自 README。

## 不适合的场景

Jotl 只输出 JSON Schema 2020-12；下游需要 draft-07 或更早版本的输出时，Jotl 给不了。类型只存在于 TypeScript 代码、从不离开代码时，Zod、TypeBox 这类代码优先的库能让一切留在同一种语言里。表单渲染器只支持 React；其他 UI 框架需要基于 `@jotl/form/core` 自行实现渲染器。

## 延伸阅读

- [文档索引](docs/README.md)：每类任务该读哪一页
- 规范：[Jotl 语法](docs/spec/jotl.md)、[`x-ui`](docs/spec/x-ui.md)、[原生 HTML widget](docs/spec/html-widgets.md)、[关键字对照](docs/spec/keyword-mapping.md)
- [开发指南](docs/development.md)：构建、测试与仓库结构
- 各包 README 见上表；编辑器插件见 [vscode-jotl](../packages/vscode/zh/README.md)

## 许可证

[MIT](../LICENSE)
