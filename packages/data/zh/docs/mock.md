# 生成 Mock 数据

[English](../../docs/mock.md) · **简体中文**

读完本页，你能用 `mock(schema, opts?)` 生成满足 schema 的测试数据。它接受 `seed` 与 `locale`，其他约定见[调用约定](./api.md)。

```js
import { mock } from "@jotl/data";

const schema = {
	type: "object",
	properties: {
		e: { type: "string", format: "email" },
		c: { type: "string", format: "color" },
		p: { type: "string", pattern: "^[A-Z]{3}-[0-9]{2}$" },
	},
	required: ["e", "c", "p"],
};
mock(schema, { seed: 2 }).value; // { e: "hnwqmj@example.com", c: "#1c36d9", p: "JZB-11" }
```

- `seed` 相同则结果相同（32 位 mulberry32 伪随机）。不传时随机取种子。`seed` 不是有限数时报 `JOTL4018`。
- 生成后自动校验；校验错误降为 warning，附在 `diagnostics` 中。
- 同一个 `$ref` 在路径上展开 3 次后只生成必需部分，8 次后停止并报 `JOTL4019` warning。可选的递归引用不会展开到上限。
- 无法生成满足 `pattern` 的字符串时报 `JOTL4019` warning。
- 日期：取 2000 到 2030 年间的随机时刻，按字段的格式写出。
- JSON 文本（`contentMediaType: "application/json"`）：按 `contentSchema` 生成数据后序列化。
- money 与 bigint 对象的 `value` 规则与[零值](./default-data.md#零值长什么样)相同。
