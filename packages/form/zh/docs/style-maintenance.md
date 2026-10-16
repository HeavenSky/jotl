# 重新生成与核对 style.css

[English](../../docs/style-maintenance.md) · **简体中文**

本页面向在本仓库中改动 widget 类名、`tailwind.css` 或 `theme.css` 的贡献者，说明如何重新生成预编译的 `style.css` 并在真实浏览器中核对。

## 改动后重新生成

```sh
pnpm --filter @jotl/form run build:css
```

该命令以 `style.entry.css` 为入口重新生成 `style.css`，不压缩。`test/package.test.ts` 会重新生成并与仓库中的 `style.css` 比对，忘了这一步时测试失败。

## 在浏览器中核对

jsdom 不计算样式，以下各项只能在真实浏览器中核对。

1. 在仓库根运行 `pnpm build`。
2. 在依赖 `@jotl/form` 的包（如 `apps/playground`）中运行 `node --input-type=module -e "console.log(import.meta.resolve('@jotl/form/style.css'))"`。预期输出 `packages/form/style.css` 的 `file://` 路径。
3. 在任一 React 19 + Vite 页面中 `import "@jotl/form/style.css"`，渲染一个同时含有字符串、数字、枚举、布尔、图片、对象分组、对象数组、可空字段、联合、字典、递归引用，以及 `[layout: 'tabs']` 与 `[layout: 'grid', columns: 3]` 对象的 schema，再按下表逐项核对。

| 操作 | 预期 |
|---|---|
| 打开页面 | 字段纵向排列，标签在控件上方，必填字段的标签后有红色 `*` |
| 用 Tab 依次聚焦输入框、下拉框、按钮 | 每个获得焦点的控件有蓝色外框 |
| 提交一个不合法的字段 | 该字段边框变红，下方出现红色错误文字 |
| 在 JSON 兜底 widget 中输入不完整的 JSON | 文本框下方出现红色提示，已输入的文本保留 |
| 把数组加到 `maxItems` | 「新增」按钮变淡，鼠标显示禁止样式 |
| 填入图片 URL | 预览图不超出容器宽度，高度不超过约 12rem |
| 把表单切到 `view` 与 `disabled` | 输入框背景变灰；`view` 下没有提交与数组操作按钮 |
| 在外层元素上设置 `--jotl-focus: red` | 焦点外框与主按钮变为红色 |
| 查看 `tabs` 布局的对象 | 标签横排，下方有分隔线；选中的标签加粗、为焦点色，并与下方内容连成一体；只显示它的字段 |
| 查看 `grid` 布局的对象 | 字段排成 3 列等宽栅格，窄屏下控件不溢出单元格 |
| 勾选可空字段的「置为空」 | 原 widget 消失，显示灰色斜体「空值」 |
| 展开递归字段 | 内容出现在按钮下方，左侧有竖线缩进 |
| 查看字典字段 | 每行左侧是固定宽度的键名框，中间是值，右侧是删除按钮；把键名改成已有的名字时框下出现红色提示 |
| 去掉 `style.css` 的引入后刷新 | widget 仍可输入与提交，只是失去上述排版 |
