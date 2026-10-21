# 在预览中加载 widget 模块

[English](../../docs/widget-modules.md) · **简体中文**

读完本页，预览表单会渲染你自己的 React widget 组件，而不是降级显示。前提是 widget 已登记底层类型（见[登记项目 widget](project-widgets.md)），并有一个导出该组件的 ES 模块。

## 开启模块加载

1. 让 widget 指向一个模块，写在 `jotl.config.json` 中：

   ```json
   {
     "widgets": {
       "ImagePicker": {
         "base": "url",
         "module": "https://esm.sh/my-image-picker?external=react,react-dom",
         "export": "default"
       }
     }
   }
   ```

   或写在文件根条目的 `widgets` 元数据中，同名时它优先于配置文件：

   ```jotl
   Page: [widgets: {ImagePicker: {base: 'url', module: './widgets/image-picker.js'}}] {
     cover: ImagePicker
   }
   ```

2. 在用户设置或工作区设置中把 `jotl.preview.loadWidgetModules` 设为 `true`：

   ```json
   { "jotl.preview.loadWidgetModules": true }
   ```

   预览立即重新加载，表单页签的 `cover` 字段渲染模块中的组件。

**这个设置默认关闭，因为加载模块就是在预览中运行它的代码。** 关闭时这些 widget 降级显示，预览顶部给出提示。在不受信任的工作区中，工作区取值会被忽略，仓库无法自行开启加载，只有用户设置生效。

## 编写预览能加载的模块

- `module` 写 `https:` 地址，或相对声明所在文件的路径（`./`、`../` 或绝对路径）。本地文件由工作区提供给预览。
- 模块须是 ES 模块，其导出（由 `export` 指定，缺省 `default`）是符合 [`@jotl/form`](../../../form/zh/README.md) widget 契约的 React 组件。
- 模块不要自带 React。预览与模块共用预览自带的 React：模块中裸写的 `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client` 都解析到预览的那一份。用 esm.sh 时在地址后加 `?external=react,react-dom`。
- 根条目中的模块声明编译进 schema 根的 `x-ui.widgets`，使用该 schema 的其他宿主也能加载；`jotl.config.json` 中的声明不写进 schema。

## 模块没有显示时

- **字段中显示 `组件加载失败` 和「重试」按钮。** 模块加载失败，或导出的不是组件。检查地址或路径以及 `export` 名，然后点「重试」；表单其余部分照常工作。
- **预览顶部显示 `预览未加载扩展组件模块: …`。** `jotl.preview.loadWidgetModules` 处于关闭状态，或工作区不受信任而设置只写在工作区中。在用户设置中开启，或信任该工作区。

## 预览加载不了的内容

预览的内容安全策略只允许从 `https:` 地址和本地文件加载模块，因此以下情形不可用：

- **`http:` 开发服务器上的模块。** 改用 `https:` 提供模块，或把它构建成工作区中的文件。
- **模块自带的样式表与它发出的 `fetch` 请求。** 组件样式写在 `style` prop 中，或复用 `@jotl/form` 导出的 `styles` 与 `cn`；数据经 schema 传入，不要自行请求。
- **工作区以外的本地依赖。** 把它们打包进模块文件。
- **未保存文档中的相对路径。** 先保存文件，让路径有目录可依。

Windows 盘符路径与 `file:` 地址会映射成预览地址，但尚未在 Windows 上测试。

同一策略放开了 `'unsafe-eval'`，因为表单的校验器要在运行时按 schema 编译校验函数，而 schema 随输入实时变化。脚本仍只能来自预览自身的标签，模块加载开启时另外放行本地文件与 `https:`。
