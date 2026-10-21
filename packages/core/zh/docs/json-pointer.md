# 使用 JSON Pointer

[English](../../docs/json-pointer.md) · **简体中文**

读完本页，你能读取、构造和匹配 JSON Pointer；Jotl 的源码映射、诊断位置和数据路径都用它表示。本页内容全部从 `@jotl/core` 导出，没有运行时依赖。

## 读取值

```ts
import { evaluatePointer, lookupPointer } from '@jotl/core';

const doc = { list: [{ 'a/b': 1 }] };
evaluatePointer(doc, '/list/0/a~1b'); // { value: 1, diagnostics: [] }
evaluatePointer(doc, '/list/1');
// { diagnostics: [{ code: "JOTL0002", severity: "error", message: "JSON Pointer target does not exist: /list/1" }] }
lookupPointer(doc, '/list/01'); // { found: false }
```

- `parsePointer` 与 `evaluatePointer` 返回 `Result`。指针不合法报 `JOTL0001`，位置不存在报 `JOTL0002`。
- `tryParsePointer`、`isPointer`、`lookupPointer` 不产生诊断。`lookupPointer` 返回 `{ found, value }`；数组片段只接受规范的十进制下标，对象只查自有属性。

## 构造指针

```ts
import { appendPointer, joinPointer, lastPointerToken, parentPointer } from '@jotl/core';

appendPointer('/list', 0, 'a/b'); // "/list/0/a~1b"
joinPointer('/a', '0/img'); // "/a/0/img"
parentPointer('/a/b'); // "/a"
lastPointerToken('/a/b~1c'); // "b/c"
```

- `formatPointer(tokens)` 与 `appendPointer(base, ...tokens)` 接受未转义的片段，并负责转义。
- `joinPointer(base, relative)` 拼接已转义的相对路径；传空串时返回 `base`。
- `escapePointerToken` 与 `unescapePointerToken` 转换单个片段。

## 用通配符匹配指针

`"*"` 片段（`POINTER_WILDCARD`）匹配任意单个片段，适合描述数组的每一项，例如逐行生效的规则。

```ts
import { fillWildcards, matchPointer } from '@jotl/core';

matchPointer('/list/*/x', '/list/3/x'); // true
fillWildcards('/list/*/x', [2]); // "/list/2/x"
fillWildcards('/l/*/x/*', [1]); // "/l/1/x/*"
```

`matchPointer(pattern, pointer)` 还要求两者片段数相同。`fillWildcards(template, indexes)` 依次把 `"*"` 替换为下标，下标不够时保留剩下的 `"*"`。
