# 排查 widget 降级

[English](../../docs/fallbacks.md) · **简体中文**

本页说明 widget 用不了时表单怎么处理，以及如何查看每个字段最终用了哪个 widget。表单不会白屏：每种失败都有替代。

## 表单替换什么、换成什么

- widget 渲染报错时，依次换用渲染计划中的备选 widget（F4）。复合 widget 报错时拆开，逐个子节点单独渲染（F5）。
- 数据类型与 schema 不符时保留原值，标记错误，并改用 JSON widget 编辑（F8）。
- 按需加载的 widget 加载失败时显示占位与重试按钮，同时按 F4 降级（F9）。
- 注册表中没有任何 widget 时，渲染器自带的 JSON 文本框兜底。
- 规划期决定的降级（F1 未注册、F2 形态不接受、F3 `x-ui` 非法、F7 schema 特性不支持）见[用 `@jotl/form/core` 实现渲染器](core.md#处理降级与诊断)。

## 记录每次降级

每次降级调用一次 `onDegrade(event)`。事件（`DegradeEvent`）含编号（F1 到 F9）、数据路径、schema 指针、原 widget 与替代者；F4 与 F9 另带原始错误。替代者不是 widget 名时，取 `DEGRADE_TARGETS` 中的一个：`split`、`minimal-json` 或 `none`。

## 显示调试视图

```tsx
const log = useDegradeLog();
<JotlForm schema={schema} onDegrade={log.onDegrade} />
<JotlDebug schema={schema} events={log.events} />
```

- `<JotlDebug schema registry events />` 列出每个节点选中的 widget、选择来源与降级记录。`registry`（以及 `scene`、`mode`、`maxDepth`）要与表单相同，否则结果不一致。
- `useDegradeLog()` 收集表单上报的事件，供 `JotlDebug` 显示。
- `locale` 决定 `JotlDebug` 的语言，缺省取 `getLocale()` 返回的全局语言。
