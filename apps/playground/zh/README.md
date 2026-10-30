# Jotl Playground

[English](../README.md) · **简体中文**

在浏览器里写 Jotl，边输入边看 JSON Schema、TypeScript 类型和可用的表单同步更新。

适合学习 Jotl、提交前试写 schema，或用单个源码文件复现问题。和用 CLI 编译再逐个打开产物相比，这里停止输入后自动重新编译，错误定位到源码行，表单预览由 `@jotl/form` 渲染，看到的就是最终用户看到的界面。Playground 是私有的 workspace 应用，不发布到 npm，需要在本仓库中运行。

## 一份源码，全部产物

在编辑器中输入：

```jotl
Shop: {
  name(Shop name): string[maxLength: 40]
  rating?: integer[minimum: 1, maximum: 5]
}
```

「TS 输出」页签显示：

```ts
// 由 Jotl 生成, 不要手改.

export interface Shop {
	/**
	 * @title Shop name
	 * @maxLength 40
	 */
	name: string;
	/**
	 * @asType integer
	 * @minimum 1
	 * @maximum 5
	 */
	rating?: number;
}

export default Shop;
```

「JSON Schema」页签显示编译出的 schema，「表单预览」渲染出必填的「Shop name」字段和可选的 `rating` 字段。

## 在本地运行

在仓库根目录运行：

```sh
pnpm install
pnpm build
pnpm --filter @jotl/playground dev
```

终端会打印本地地址。先跑 `pnpm build` 是因为 Playground 引用的是各包的 `dist`；改了 `packages/*` 的源码后要重新运行它。

## 能做什么

- **错误定位到具体行。** 错误出现在诊断列表中，对应行号变红；点击诊断会选中出错的词。源码有错时，输出保留上一次成功编译的结果，并标注「已过期」。
- **并排对照全部产物。** 「JSON Schema」「TS 输出」「表单预览」「降级调试」四个页签分别显示 schema、TS 声明、渲染出的表单，以及每个节点实际使用的 widget 和降级记录。
- **按用户视角试用表单。** 呈现方式可在层级与平铺之间切换，初始数据可选默认值或 Mock，「当前表单数据」实时更新。上传的图片只在浏览器内生成 `blob:` 地址，不发网络请求。
- **接入自己的 widget。** 在 `jotl.config.json` 页签登记一个 ESM 的 React 组件，例如 `{ "base": "integer", "module": "./widgets/rating.js", "export": "default" }`，源码中写 `score: Stars` 即可使用。细节见[加载自己的 widget 模块](#加载自己的-widget-模块)。
- **从可运行的示例起步。** 示例下拉的第一项是 `v1-showcase`（`src/examples/showcase.jotl`），其后是 `widget-module`、`fengdie-demo` 和全部 `fixtures/*/source.jotl`。源码保存在浏览器中，刷新后恢复；界面可在中文与 English 之间切换。
- **直接粘贴 fengdie DSL schema。** 凤蝶编辑器语法（`.schema`，及其 `toJson` 产物 fengdie JSON schema，`.json`）会在编译前迁移为 Jotl，见[粘贴 fengdie DSL schema](#粘贴-fengdie-dsl-schema)。

## 加载自己的 widget 模块

widget 模块是满足字段级 widget 契约（`value`、`onChange`、`onBlur`、`props` 等）的 ESM React 组件，有两处可以登记：

- 左侧 `jotl.config.json` 页签的 `widgets` 中。默认已登记演示用的 `Stars`（`./widgets/rating.js`）。
- 源码的根条目元数据中，例如 `Form: [widgets: {Rating: {base: 'integer', module: './widgets/rating.js'}}] {...}`（见示例 `widget-module`）。预览上方会列出将要加载并执行的模块地址。

相对地址按页面所在目录解析。模块中的 `import "react"` 与 `react/jsx-runtime` 经页面的 import map（`index.html`，垫片在 `public/shims/`）取得 Playground 自身的 React。模块加载失败时，字段显示错误和重试按钮。

## 粘贴 fengdie DSL schema

不用先手动转换：把 fengdie DSL schema（凤蝶编辑器语法，或其 `toJson` 产出的 fengdie JSON schema）直接粘进源码编辑器，Playground 会先迁移为 Jotl 再编译。JSON Schema、TS 输出和表单预览都来自迁移产物，看到的就是这份 fengdie DSL schema 会产出的表单。

- 迁移警告（`JOTL81xx`，例如字段重复）以「迁移」阶段列出，定位到粘贴源码的具体行列，点击即可在编辑器中选中。
- 凤蝶允许但 Jotl 无法表达的信息保留在 `x-fengdie` 中，表单与校验不使用它们；类型与元数据的映射规则见[迁移指南](../../packages/convert/zh/docs/fengdie-migration.md)。
- 普通 Jotl 源码的编译行为不变。只有顶层以凤蝶类型关键字开头（如 `Object(标题)`），或 JSON 带 fengdie JSON 特征时才走迁移；示例 `fengdie-demo` 是一个可运行的样例。

## 构建、预览与测试

在仓库根目录运行：

```sh
pnpm --filter @jotl/playground run build     # 类型检查 + 生产构建, 产物在 apps/playground/dist
pnpm --filter @jotl/playground preview       # 本地预览生产构建
pnpm exec vitest run apps/playground         # 单测
```

- 生产构建用相对路径引用资源，`dist` 部署到任意子路径都能打开。
- 表单样式按 Tailwind 宿主方式接入：`src/jotl.css` 引入 `@jotl/form/tailwind.css`，由 `@tailwindcss/vite` 编译，扫描各包的 `src`，不经过预编译的 `style.css`。
- 生产构建报错 `typescript 被打包进了 …` 时，说明 TypeScript 编译器进入了产物；先排查是否有代码从 `@jotl/convert/from-ts` 导入。
- 开发服务器不做摇树，首次打开会加载完整的 `typescript` 包，比生产构建慢；生产产物不含它。
- `fixtures/` 下新增的样例在构建时打包，重新构建或重启开发服务器后才出现在下拉中。
- 源码保存在 `localStorage` 的 `jotl-playground:source` 键中。清除该键后刷新，回到 `v1-showcase`。

## 不适合的场景

Playground 只在一个浏览器标签页里编辑一份源码，不读取项目文件，上传的图片也只以 `blob:` 地址存在于该页。要编译项目中的文件，用 [`jotl` 命令行](../../../packages/cli/zh/README.md)；要在编辑器里边写边看诊断，用 [VS Code 插件](../../../packages/vscode/zh/README.md)。

## 延伸阅读

- [人工验收](./docs/acceptance.md)：发布前需要在真实浏览器中核对的项目
- [Jotl 语言规范](../../../zh/docs/spec/jotl.md)与 [x-ui 规范](../../../zh/docs/spec/x-ui.md)
- [共享样例集](../../../fixtures/zh/README.md)：示例下拉中列出的样例

## 许可证

[MIT](../../../LICENSE)
