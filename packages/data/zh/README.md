# @jotl/data

[English](../README.md) · **简体中文**

包页与市场页只显示英文版。

按 JSON Schema 2020-12 生成默认数据、校验、迁移和 Mock 数据，错误消息指明是哪个字段、错在哪里。

表单、配置或接口数据用 JSON Schema 描述时，`@jotl/data` 负责剩下的数据工作：填好初始数据、检查用户输入、修正按旧 schema 保存的数据、生成测试数据。`@jotl/form` 以及 `jotl validate`、`jotl defaults` 命令做这些事时都调用本包。

和直接调用 Ajv 相比，每处违反只产生一条诊断，带稳定的代码、指向数据的指针，以及用字段 `title` 拼出的英文或中文消息。`anyOf` / `oneOf` 分支失败不会刷出一长串错误；想自己措辞的消息用 `errorMessage` 替换。默认数据、迁移和 Mock 都在同一个包里，数据从生成到修正只需要这一个依赖。

## 一份 schema，四种用途

```js
import { getDefaults, migrate, validate } from '@jotl/data';

const schema = {
  type: 'object',
  properties: {
    title: { type: 'string', title: 'Title', maxLength: 5, default: 'Home' },
    count: { type: 'integer', minimum: 1 },
    color: { type: 'string', format: 'color', errorMessage: 'Use a hex color' },
  },
  required: ['title', 'count'],
};

console.log(getDefaults(schema, { strategy: 'required' }).value);
for (const d of validate(schema, { title: 1, count: 0, color: 'red' }).diagnostics) {
  console.log(d.code, d.location?.pointer, d.message);
}
console.log(migrate(schema, { title: 12, count: '3', old: true }).value);
```

输出：

```text
{ title: 'Home', count: 1 }
JOTL4001 /title Title should be of type string
JOTL4003 /count count is out of range: should be at least 1
JOTL4009 /color Use a hex color
{
  data: { title: '12', count: 3 },
  changed: [ '/title', '/count', '/old' ]
}
```

第四种用途是 `mock(schema, { seed: 1 })`：生成满足 schema 的数据，同一个 seed 每次结果相同。

## 校验第一个对象

本包只提供 ESM，所以脚本用 `.mjs` 扩展名。

1. 安装：

   ```sh
   pnpm add @jotl/data
   ```

2. 把下面的代码保存为 `check.mjs`：

   ```js
   import { validate } from '@jotl/data';

   const schema = {
     type: 'object',
     properties: { email: { type: 'string', title: 'Email', format: 'email' } },
     required: ['email'],
   };
   for (const d of validate(schema, { email: 'not-an-email' }).diagnostics) {
     console.log(d.code, d.location?.pointer, d.message);
   }
   ```

3. 运行，终端里会打印 `JOTL4009 /email Email is not a valid email address`：

   ```sh
   node check.mjs
   ```

## 你能得到什么

- **一处违反只报一条可读的错误。** 类型不符时不再报同一位置的其他错误，联合类型失败只报一条带原因的 `JOTL4012`，完全相同的错误会合并。
- 按需选择默认数据的范围：只取显式 `default`、补齐全部必填字段，或补齐全部字段；`fillDefaults` 在已有数据上补全，不覆盖任何值。
- 稳妥地迁移旧数据：删除未声明的字段，能转换的类型自动转换，每处改动都以指针列出。
- 可复现的 Mock 数据：带种子的生成器会遵守格式、`pattern` 和递归上限，并校验自己的输出。
- 不抛异常，不修改输入：每个函数都返回 `@jotl/core` 的 `{ value, diagnostics }`，消息语言跟随全局设置或按次调用的 `locale`。

## 什么时候该用别的工具

`@jotl/data` 只支持 JSON Schema 2020-12 方言，schema 里出现不以 `x-` 开头的未知关键字时报 `JOTL4017`。旧草案和 OpenAPI 的 schema 先用 [`@jotl/convert`](../../convert/zh/README.md) 升级。需要 Ajv 的原始错误对象或自定义关键字时，直接用 Ajv。

## 进一步阅读

- [使用指南](./docs/README.md)：调用约定、默认数据、校验、迁移、Mock 数据、诊断代码
- [`@jotl/core`](../../core/zh/README.md)：`Result`、诊断与数据能力接口
- [已知限制](./docs/known-limitations.md)：不支持的 format、Ajv 与官方测试集的差异、引用解析范围

## 许可证

MIT，见 [LICENSE](../../../LICENSE)。
