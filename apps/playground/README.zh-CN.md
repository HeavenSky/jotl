# @jotl/playground

[English](./README.md) · **简体中文**

在浏览器中启动, 构建或人工验收 Jotl Playground 时读本页; 对应 `apps/playground`.

## 启动与构建

在仓库根运行:

```sh
pnpm build                                   # 先构建各包的 dist, Playground 引用的是构建产物
pnpm --filter @jotl/playground dev           # 开发服务器, 终端会打印本地地址
pnpm --filter @jotl/playground run build     # 类型检查 + 生产构建, 产物在 apps/playground/dist
pnpm --filter @jotl/playground preview       # 本地预览生产构建
pnpm exec vitest run apps/playground         # 单测
```

- 改了 `packages/*` 的源码后要重新 `pnpm build`, 开发服务器才会读到新的 dist.
- 表单样式按 Tailwind 宿主方式接入: `src/jotl.css` 引入 `@jotl/form/tailwind.css`, 由 `@tailwindcss/vite` 编译(扫描各包 `src`, 不经过预编译的 `style.css`).
- 生产构建中若出现 `typescript 被打包进了 …` 的错误, 说明 `typescript` 编译器进入了产物, 需要先排查是否误从 `@jotl/convert/from-ts` 导入.
- 开发服务器不做摇树, 首次打开会加载完整的 `typescript` 包, 比生产构建慢; 生产产物不含它.
- 示例下拉的第一项 `v1-showcase` 是 `src/examples/showcase.jotl`(覆盖对象钻取, `inline`, `money` `bigint`, 两种 `union`, 枚举多选, 数组与字典, `root_if` `node_if`), 其后是构建时打包的 `fixtures/*/source.jotl`; 新增样例后重新构建或重启开发服务器即可出现.
- 当前源码保存在浏览器 `localStorage` 的 `jotl-playground:source` 键; 清除该键后刷新会回到默认示例 `v1-showcase`.

## 语言与扩展组件模块

- **语言**: 右上角切换中文/English, 首次按浏览器语言选择并记住; 诊断, 输出与表单文案随之切换.
- **扩展组件模块**: 在左侧 `jotl.config.json` 页签的 `widgets` 中写 `{ "base": "integer", "module": "./widgets/rating.js", "export": "default" }` 登记组件(默认已登记演示用的 `Stars`), 源码中 `score: Stars` 即可使用; 也可在根条目元数据中声明 `Form: [widgets: {Rating: {base: 'integer', module: './widgets/rating.js'}}] {...}`(见示例 `widget-module`), 预览上方会提示将加载并执行的模块地址. 相对地址按页面所在目录解析; 模块须是 ESM 的 React 组件, 满足 field 级 widget 契约(`value` `onChange` `onBlur` `props` 等), `import "react"` 与 `react/jsx-runtime` 经页面的 import map(`index.html`, 垫片在 `public/shims/`)取得 Playground 自身的 React. 模块加载失败时字段显示失败与重试.

## 手工验证

jsdom 不计算布局与样式, 以下各项只能在真实浏览器中核对. 在开发服务器或 `preview` 打开的页面中按顺序操作:

| 操作 | 预期 |
|---|---|
| 首次打开页面(或清除上述 `localStorage` 键后刷新) | 左侧编辑器是 `v1-showcase` 的源码, 行号与源码行逐行对齐; 右侧默认在 "表单预览", "联系方式" 在根页内展开, "搜索优化" "轮播图" 等显示为入口行 |
| 点击 "搜索优化" 入口行, 再点面包屑中的 "店铺" | 进入子页, 顶部出现面包屑; 点面包屑退回根页 |
| 在编辑器中把 `name(店名)` 改成 `name(全名)`, 停止输入 | 状态栏短暂出现 "等待编译…" 后消失; 表单中的字段标签变为 "全名" |
| 在表单中输入店名 | "当前表单数据" 实时显示输入的值 |
| 移动光标或用方向键 | 编辑器下方的 "行 X, 列 Y" 随之变化 |
| 把某个类型名改错(如 `string` 改成 `strng`) | 诊断列表出现错误, 对应行号变红; 右侧顶部出现黄色 "已过期" 提示, 预览保持修改前的结果且整体变淡 |
| 源码很长时滚动到底部再点击该诊断 | 编辑器滚动到出错行, 选中出错的词, 状态栏显示诊断给出的行列 |
| 修正错误 | 诊断列表显示 "没有诊断", "已过期" 提示消失 |
| 依次切换 "JSON Schema", "TS 输出", "降级调试" 页签, 再用方向键, `Home`, `End` 在页签间移动 | 分别显示格式化的 schema, 以生成头开始的 TS 声明, 每个节点的 widget, 来源与降级记录 |
| 在表单预览顶部把 "呈现" 切到 "折叠面板" | 入口行变为可折叠面板, 标题行显示标题与摘要, 第一层展开; "轮播图" 新增一项后该项面板标题为 "第 1 项" 加摘要, 可复制; 切回 "钻取" 恢复入口行 |
| 把 "初始数据" 切到 "Mock" | 表单重新挂载, "当前表单数据" 换成随机生成的数据 |
| 在 "Logo" 点 "上传图片" 选一张本地图片 | 短暂显示 "上传中…", 之后 URL 框写入 `blob:` 地址并显示预览(不发网络请求) |
| 进入某个文本区块的 "正文" | 富文本编辑区带格式工具栏, 选中文字后点粗体, 斜体, 链接, 列表生效, "当前表单数据" 中为 HTML |
| 在示例下拉中选择 `013-x-ui-basic` | 源码替换为该示例并立即编译; "降级调试" 中 `headline` 等未注册 widget 有降级记录 |
| 选择 `016-errors` | 诊断列表列出全部错误, 右侧保留上一个示例的结果并标注 "已过期" |
| 编辑任意内容后刷新页面 | 编辑器恢复刷新前的源码 |
| 在浏览器隐私模式或禁用站点存储后编辑 | 顶部出现 "浏览器禁止本地存储" 提示, 编辑与预览照常 |
| 把窗口宽度缩到 900px 以下 | 编辑区与输出区改为上下排列, 没有横向溢出 |
