# @jotl/core

[English](../README.md) · **简体中文**

包页与市场页只显示英文版。

把 Jotl 编译成 JSON Schema 2020-12，也能把 schema 打印回 Jotl，诊断精确到行和列。

Jotl 是一门编写 JSON Schema 2020-12 的简洁语言。`@jotl/core` 是它的编译器，也是所有 Jotl 包共用的契约：做编辑器、构建步骤，或在 Web 应用运行时把 Jotl 源码转成 schema，都从这个包开始。

和手写 JSON 相比，一个字段连同标签、约束和默认值只占一行，输出中的每个节点都能映射回源码范围。和代码优先的 schema 库相比，输出是普通的 JSON 数据，可以直接存储、比对，交给任何支持 2020-12 的工具；已有的 schema 也能用 `print` 转回 Jotl。本包没有运行时依赖，不用任何 Node API，同一份代码可以直接在浏览器里跑。

## 三行源码，换来一份规范化的 schema

```ts
import { compile } from '@jotl/core';

const result = compile(
  `User: {
  name(Name): string[maxLength: 20]
  role?: enum[default: 'user']{ admin(Admin) user(User) }
}`,
  'user.jotl'
);
console.log(JSON.stringify(result.value?.schema, null, 2));
```

输出（已压缩空白）：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$ref": "#/$defs/User",
  "x-ui": { "version": 1 },
  "$defs": {
    "User": {
      "type": "object",
      "properties": {
        "name": { "title": "Name", "type": "string", "maxLength": 20 },
        "role": {
          "type": "string",
          "oneOf": [
            { "title": "Admin", "const": "admin" },
            { "title": "User", "const": "user" }
          ],
          "default": "user"
        }
      },
      "required": ["name"]
    }
  }
}
```

写错也不会抛异常。`compile("A: strng", "a.jotl")` 返回 `value: undefined`，外加一条可以直接显示在编辑器里的诊断：

```json
{
  "code": "JOTL1004",
  "severity": "error",
  "message": "Unknown component `strng`",
  "location": {
    "kind": "source",
    "range": {
      "file": "a.jotl",
      "start": { "line": 1, "column": 4, "offset": 3 },
      "end": { "line": 1, "column": 9, "offset": 8 }
    }
  }
}
```

## 编译第一个文件

本包只提供 ESM，所以脚本用 `.mjs` 扩展名。

1. 安装：

   ```sh
   pnpm add @jotl/core
   ```

2. 把下面的代码保存为 `compile.mjs`：

   ```js
   import { compile } from '@jotl/core';

   const result = compile('Todo: {\n  title: string\n  done?: boolean\n}', 'todo.jotl');
   console.log(JSON.stringify(result.value?.schema ?? result.diagnostics, null, 2));
   ```

3. 运行，终端里会打印出 JSON Schema：

   ```sh
   node compile.mjs
   ```

## 你能得到什么

- **带源码映射的 schema。** `compile` 返回规范化的 2020-12 文档、从每个 schema 指针到源码范围的映射、AST，以及默认导出的类型名。
- JSON Schema 与 Jotl 互转：`print` 把任意 2020-12 schema 写成规范形 Jotl，`format` 重新排版源码且保留全部注释。
- 错误是数据，不是异常：每个函数都返回 `{ value, diagnostics }`；每条诊断有稳定的 `JOTL` 代码，位置的行从 1 起、列按 UTF-16 计（与 LSP 一致），消息可选英文或中文。
- 整条工具链共用一份契约：JSON Schema 与 `x-ui` 的类型、`x-ui` 的 meta-schema、JSON Pointer 工具，以及 `@jotl/data` 实现的数据能力接口。
- 扩展组件：可以按调用、按文件或经 `jotl.config.json` 登记自定义组件，模块声明会编译进 schema。

## 什么时候该用别的包

`@jotl/core` 不读文件，也不校验数据。在终端编译文件用 [`jotl` 命令行](../../cli/zh/README.md)；校验数据或生成默认值用 [`@jotl/data`](../../data/zh/README.md)；渲染表单用 [`@jotl/form`](../../form/zh/README.md)。`print` 只接受 JSON Schema 2020-12，旧草案和 OpenAPI 的 schema 先用 [`@jotl/convert`](../../convert/zh/README.md) 升级。

## 进一步阅读

- [使用指南](./docs/README.md)：编译与打印、扩展组件、诊断与语言、JSON Pointer、schema 类型
- [Jotl 语法规范](../../../zh/docs/spec/jotl.md)与 [`x-ui` 规范](../../../zh/docs/spec/x-ui.md)
- [已知限制](./docs/known-limitations.md)：打印往返、深度上限、编译期检查的日期格式

## 许可证

MIT，见 [LICENSE](../../../LICENSE)。
