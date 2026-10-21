# VS Code 插件实机验证

改动 `packages/vscode` 或 `packages/language-server`(以及被它们打包进去的 `@jotl/core` `@jotl/convert` `@jotl/form` 等)之后,
在真实 VS Code 中回归验证时读本页;
覆盖的代码路径是插件入口 `src/index.ts`(语言客户端, 配置同步, 预览命令),
语言服务 `@jotl/language-server`(诊断与防抖, 补全, 悬停, 跳转与引用, 大纲, 快速修复, 组件登记),
TextMate 语法 `syntaxes/jotl.tmLanguage.json`,
预览面板 `src/preview-*.ts` 与 webview `src/webview/`,
以及 `contributes.jsonValidation` 关联的 `x-ui` JSON Schema.

## 环境准备

以下命令都在仓库根执行.
独立实例使用自己的 user-data-dir 与 extensions-dir, 不影响日常使用的 VS Code 窗口与用户配置.

### 构建与打包

```sh
pnpm build
pnpm --filter ./packages/vscode run package
mkdir -p .ai-ctx/cache/vscode-verify/pack
cp "packages/vscode/artifacts/vscode-jotl-$(node -p "require('./packages/vscode/package.json').version").vsix" .ai-ctx/cache/vscode-verify/pack/jotl.vsix
```

- `package` 先跑 `vscode:prepublish` 生产构建, 构建只读各依赖包的 `dist/`, 所以先 `pnpm build`.
- 产物文件名随 `package.json` 的 `version` 变化; 打包流程与内容断言见 [DEVELOPMENT.md](./DEVELOPMENT.md).

### 安装与启动独立实例

```sh
C="$PWD/.ai-ctx/cache/vscode-verify"
CODE_CLI="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
mkdir -p "$C/user/User"
"$CODE_CLI" --user-data-dir "$C/user" --extensions-dir "$C/ext" --install-extension "$C/pack/jotl.vsix" --force
```

- 发布者 ID 与旧的本地包不同时(如旧的 `jotl-local.vscode-jotl`), 先 `--uninstall-extension jotl-local.vscode-jotl`, 否则两份插件同时激活.

首次启动前写入 `$C/user/User/settings.json`, 关掉欢迎页, 更新, 遥测与 AI 功能的干扰:

```json
{
  "workbench.startupEditor": "none",
  "security.workspace.trust.enabled": false,
  "update.mode": "none",
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false,
  "telemetry.telemetryLevel": "off",
  "chat.disableAIFeatures": true,
  "workbench.tips.enabled": false,
  "git.enabled": false,
  "window.restoreWindows": "none",
  "files.hotExit": "off",
  "workbench.colorTheme": "Default Dark Modern"
}
```

用 `open -g` 在后台启动, 不把窗口置前, 不抢键盘焦点:

```sh
open -g -n -a "Visual Studio Code" --args \
  --user-data-dir "$C/user" --extensions-dir "$C/ext" \
  --new-window --disable-workspace-trust --skip-welcome --skip-release-notes \
  --remote-debugging-port=9333 "$PWD"
sleep 8
curl -s http://127.0.0.1:9333/json/version
for pid in $(pgrep -f "Contents/MacOS/Code .*vscode-verify/user"); do
  [ "$(ps -o ppid= -p "$pid" | tr -d ' ')" = 1 ] && echo "$pid" > "$C/code.pid"
done
```

- `pgrep -f` 还会匹配到同一实例的 Helper 进程(参数里同样带 user-data-dir); 只记父进程为 1 的主进程, 结束它时 Helper 随之退出.

- 端口 9333 专用于该实例; 不要连 9222(那是日常调试 Chrome).
- 重装 vsix 后在实例内执行命令 "Developer: Reload Window"(经下方驱动脚本), 不要重启进程.
- 收尾: `kill -TERM "$(cat "$C/code.pid")"`, 只关自己启动的进程.

### 切换显示语言

- 实例的显示语言由启动参数 `--locale` 决定: 英文用 `--locale en`; 简体中文用 `--locale zh-cn`, 且须先在同一 extensions-dir 中装中文语言包:
  `"$CODE_CLI" --user-data-dir "$C/user" --extensions-dir "$C/ext" --install-extension MS-CEINTL.vscode-language-pack-zh-hans`.
- 换语言要先按 "收尾" 结束实例, 再用新的 `--locale` 以 `open -g` 启动; "Developer: Reload Window" 不会切换语言.
- 装完语言包后第一次以 `--locale zh-cn` 启动仍是英文: 实例启动时才登记语言包, 晚于显示语言的解析; 按 "收尾" 结束后再启动一次即为中文.

### 扩展组件模块素材

第 36 至 41 条使用 `.ai-ctx/cache/vscode-verify/modules/` 下的四个文件, 先在磁盘上建好:

- `jotl.config.json`: `{ "widgets": { "Color": { "base": "string", "module": "./widgets/color.js" } } }`
- `widgets/color.js`(经 `import "react"` 取预览的 React):

  ```js
  import React from 'react';
  export default function Color({ id, value, onChange }) {
    return React.createElement('input', {
      id,
      type: 'color',
      className: 'verify-color',
      value: typeof value === 'string' ? value : '#336699',
      onChange: e => onChange?.(e.target.value),
    });
  }
  ```

- `widgets/stars.js`(经 `react/jsx-runtime` 取预览的 React, 具名导出):

  ```js
  import { jsx } from 'react/jsx-runtime';
  export function Stars({ id, value, onChange }) {
    const n = typeof value === 'number' ? value : 0;
    return jsx('button', {
      id,
      type: 'button',
      className: 'verify-stars',
      onClick: () => onChange?.((n % 5) + 1),
      children: '★'.repeat(n) || '☆',
    });
  }
  ```

- `modules.jotl`:

  ```jotl
  Page: [widgets: {Stars: {base: 'integer', module: './widgets/stars.js', export: 'Stars'}}] {
    color(颜色): Color
    stars(评分): Stars
    name(名称): string
  }
  ```

### 用 CDP 自动驱动

驱动脚本是 `packages/vscode/scripts/verify-drive.mjs`, 依赖 `playwright-core`; 它不是仓库依赖, 装在缓存目录:

```sh
mkdir -p .ai-ctx/cache/vscode-verify/node && cd .ai-ctx/cache/vscode-verify/node \
  && echo '{"name":"verify-node","private":true}' > package.json && pnpm add playwright-core && cd -
export JOTL_VERIFY_SHOTS="$PWD/.ai-ctx/cache/sav_$(date '+%Y%m%d_%H%M%S')_vscode插件验证"
mkdir -p "$JOTL_VERIFY_SHOTS"
node packages/vscode/scripts/verify-drive.mjs -e "await h.openFile('fixtures/013-x-ui-basic/source.jotl'); log(await h.problems('未注册')); await h.shot('02-problems')"
node packages/vscode/scripts/verify-drive.mjs packages/vscode/scripts/verify-debounce.mjs
```

- 每次运行用 `chromium.connectOverCDP` 连接, 先开 `Emulation.setFocusEmulationEnabled`, 结束时只断开连接.
- 按键与鼠标都经 CDP 发送; NEVER 调用 `bringToFront`, 也 NEVER 用 `code` CLI 向该实例打开文件, 两者都会把窗口置前, 打断用户输入.
  需要打开缓存目录下的临时文件时同样用 `h.openFile`, 传绝对路径(`.ai-ctx/` 被 git 忽略, 相对路径搜不到), 文件先在磁盘上建好.
- 切换设置可直接改写 `$C/user/User/settings.json`, 实例会自动读入; 验证结束后删掉临时加入的设置项.
- `h` 提供的操作: `openFile` `command`(命令面板按标题执行) `goto`(Ctrl+G 定位) `find`(按文件内容求行列, 中日韩字符按 2 列算) `hoverAt` `suggest` `problems(filter)` `language` `editorText` `tokens` `focusGroup` `previewFrame`(预览 webview 的内容 frame) `shot`.
- 问题面板与建议列表都是虚拟滚动, 只能读到可见行: 读问题时传过滤词, 读建议时先键入前缀.
- 预览 webview 获得焦点后, 快捷键不再到达工作台; 先 `h.focusGroup(0)` 点回第一个编辑器组的标签.
- 改动 fixtures 的步骤做完后执行 "File: Revert File" 撤销; 需要自由编辑的内容放在 `.ai-ctx/cache/vscode-verify/` 下的临时文件里.

## 用例

第 1 至 26 条原为 README 中的手工验证步骤; 第 27 条起是新增用例; 第 34 至 41 条覆盖显示语言切换与扩展组件模块(素材见 "扩展组件模块素材").
"scratch" 指 `.ai-ctx/cache/vscode-verify/` 下的临时文件.

| 编号 | 文件/前置                                                                                                                    | 操作                                                                                                                                                                                              | 预期结果                                                                                                                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `fixtures/013-x-ui-basic/source.jotl`                                                                                        | 打开文件                                                                                                                                                                                          | 右下角语言模式显示 `Jotl`; 类型名, 内置组件, 标签, 元数据键, 字符串与注释有不同颜色(用 "Developer: Inspect Editor Tokens and Scopes" 看作用域)                                                                                                 |
| 2    | 同 1                                                                                                                         | 打开 "问题" 面板                                                                                                                                                                                  | 只有 `JOTL7001` 警告, 分别指向 `headline` `tag` `tag-list` `slider` `row` `table` `card` 这些未注册的组件名; 没有错误                                                                                                                          |
| 3    | `fixtures/016-errors/source.jotl`                                                                                            | 打开文件                                                                                                                                                                                          | "问题" 面板列出与同目录 `diagnostics.json` 相同代码与位置的错误, 波浪线落在对应记号上                                                                                                                                                          |
| 4    | 同 1                                                                                                                         | 把 `string` 改成 `strng`                                                                                                                                                                          | 不保存也立即出现 `JOTL1004 未知组件` 错误; 改回后错误消失                                                                                                                                                                                      |
| 5    | 新建 scratch `scratch.jotl`                                                                                                  | 输入 `title: string`; 光标放在 `title` 上按 `Cmd+.`                                                                                                                                               | `title` 下出现 `JOTL1036` 错误; 出现快速修复 "包进 `Root(根): {...}` 并标 `<root/>`", 应用后错误消失                                                                                                                                           |
| 6    | 同 5                                                                                                                         | 在 `Root` 体中输入 `name: `                                                                                                                                                                       | 自动弹出或按 `Ctrl+Space` 后出现内置组件名与本文件声明的类型名(如 `Root`)                                                                                                                                                                      |
| 7    | 同 5                                                                                                                         | 接着输入 `string[`                                                                                                                                                                                | 补全列出适用于 `string` 的元数据键(含 `maxLength` `pattern` `widget`, 不含 `minimum`); 把 `string` 换成 `integer` 后列出数值键                                                                                                                 |
| 8    | 同 5                                                                                                                         | 在 `[` 内输入 `root_if: {left: 'a', op: '`                                                                                                                                                        | 补全列出条件 op `eq` `ne` `in` 等                                                                                                                                                                                                              |
| 9    | 同 5                                                                                                                         | 在 `string[` 内输入 `widget: '`                                                                                                                                                                   | 补全列出 `input` `textarea` `password`, 选中后插入在引号内                                                                                                                                                                                     |
| 10   | 用户 `settings.json`                                                                                                         | 加入 `"jotl.registeredWidgets": ["headline"]`, 保存后回到步骤 1 的文件(不重新加载窗口)                                                                                                            | 指向 `headline` 的警告随即消失; 在 `widget: '` 中补全能看到 `headline`                                                                                                                                                                         |
| 11   | 任意                                                                                                                         | 命令面板执行 "Output: Show Output Channels", 选择 `Jotl`                                                                                                                                          | 没有语言服务崩溃或重启的报错                                                                                                                                                                                                                   |
| 12   | 同 1                                                                                                                         | 悬停 `title(标题)` 的键名 `title`                                                                                                                                                                 | 卡片标题为 "字段 `title` 标题", 下方是该字段编译后的 JSON 片段, 含 `"x-ui"` 中的 `widget` 与 `props`                                                                                                                                           |
| 13   | 同 1 与 scratch                                                                                                              | 悬停 `string`, `maxItems`, `<root/>`                                                                                                                                                              | 依次出现 "内置组件" 卡片(带编译结果), "元数据" 卡片(写明适用组件), "标识" 卡片                                                                                                                                                                 |
| 14   | `fixtures/010-named-types/source.jotl`                                                                                       | 悬停字段类型中的命名类型引用                                                                                                                                                                      | 卡片标题为 "类型 `名称`", 片段与同目录 `schema.json` 中 `$defs` 下的同名条目一致                                                                                                                                                               |
| 15   | 同 14                                                                                                                        | 在引用上按 `F12`; 再在声明名上按 `F12`                                                                                                                                                            | 光标跳到该类型的声明名; 在声明名上按 `F12` 时改为列出全部引用                                                                                                                                                                                  |
| 16   | 同 14; scratch `refs.jotl`(注释与字符串中含同名文字)                                                                         | 在声明名或引用上按 `Shift+F12`                                                                                                                                                                    | 引用面板列出该类型在本文件中的全部引用, 注释与字符串中的同名文字不在其中                                                                                                                                                                       |
| 17   | 同 1; `fixtures/006-nested-object/source.jotl`                                                                               | 打开 "大纲" 视图, 或按 `Cmd+Shift+O`                                                                                                                                                              | 每个顶层类型一项, 展开后是字段; 内联对象的字段逐层嵌套, 枚举列出成员; 带标签的项在名字后显示标签                                                                                                                                               |
| 18   | 同 1                                                                                                                         | 点编辑器标题栏的预览图标, 或执行 "Jotl: 打开预览"                                                                                                                                                 | 右侧打开标题为 "预览 <相对工作区的路径>" 的面板, 有 "JSON Schema" "TS" "表单" 三个页签; "JSON Schema" 页签列出 `JOTL7001` 警告与格式化的 JSON Schema                                                                                           |
| 19   | 同 18                                                                                                                        | 点 "TS" 页签                                                                                                                                                                                      | 显示以 `// 由 Jotl 生成, 不要手改.` 开头, 含 `export interface Ui` 的 TS 声明; 上方 "TS 转换" 没有 `JOTL2002` 警告(以当前实测为准, 现为 0 条)                                                                                                  |
| 20   | 同 18                                                                                                                        | 点 "表单" 页签                                                                                                                                                                                    | 用 `@jotl/form` 组件渲染出表单, 字段带标题与默认值, 可以输入; 编辑器中的源码不随之改变                                                                                                                                                         |
| 21   | 同 20                                                                                                                        | 在源码中把 `string` 改成 `strng`                                                                                                                                                                  | 约 0.2 秒内三个页签都改为 "存在错误, 修正后显示编译结果." 并列出 `JOTL1004`, 表单页签不是空白; 改回后表单重新出现                                                                                                                              |
| 22   | 同 18                                                                                                                        | 选中 "TS" 页签后, 在预览所在的编辑器组中切到别的标签页再切回预览; 再在另一组切到另一个 `.jotl` 文件                                                                                               | 仍停在 "TS" 页签; 切换文件后预览标题与内容切换到该文件                                                                                                                                                                                         |
| 23   | 同 20                                                                                                                        | 执行 "Developer: Open Webview Developer Tools" 查看 Console; 在 "表单" 页签中清空必填字段后移开焦点                                                                                               | Console 没有 Content Security Policy 违规, `EvalError` 或脚本, 样式加载失败的报错; 出现校验错误提示                                                                                                                                            |
| 24   | scratch `demo.schema.json`: `{ "type": "object", "properties": { "a": { "type": "string", "x-ui": { } } } }`                 | 在 `"x-ui": { }` 的花括号内按 `Ctrl+Space`                                                                                                                                                        | 补全列出 `widget` `props` `decorator` `hidden` `layout` 等 `x-ui` 字段                                                                                                                                                                         |
| 25   | 同 24                                                                                                                        | 在 `x-ui` 中写入 `"layout": "row"` 与 `"foo": 1`; 再改为 `"layout": "tabs"` 并删掉 `foo`                                                                                                          | `"row"` 处报不在枚举 `stack` `tabs` `grid` 中, `foo` 处报不允许的属性; 改正后问题消失                                                                                                                                                          |
| 26   | scratch `demo-dollar.schema.json`: 同 24 并在根对象首行加 `"$schema": "https://json-schema.org/draft/2020-12/schema"`        | 重复 24, 25                                                                                                                                                                                       | 记录型: 记录 `x-ui` 的补全与校验是否仍然生效(根带 `$schema` 时 JSON 语言服务按该地址取 schema, 插件关联的 schema 可能不再参与)                                                                                                                 |
| 27   | `fixtures/112-value-format/source.jotl`                                                                                      | 在 `day: date` 后输入 `[value_format: '`; 悬停第 4 行的 `value_format`; 做完 "File: Revert File"                                                                                                  | 补全列出常用格式(`YYYY-MM-DD` `YYYY/MM/DD` `YYYYMMDD`), 时间戳 `x` `X` 与别名 `iso` `iso-x` `utc` `utc-x`; 悬停是 "元数据 `value_format`" 卡片, 说明格式串, 时间戳与别名, 写明适用于 `date` `time` `datetime`                                  |
| 28   | `fixtures/111-markers-conditions/source.jotl`                                                                                | 打开预览, 点 "TS" 页签                                                                                                                                                                            | 默认导出 `export default Settings;`, `Settings` 的注释含 `@id https://jotl.dev/fixtures/111.json` 与 `@rules ...`; "TS 转换" 没有 `$id` 或 `x-ui.rules` 的 `JOTL2002` 警告                                                                     |
| 29   | scratch `diag.jotl` 中写 `img: image[format: 'email']`                                                                       | 打开问题面板或预览                                                                                                                                                                                | 出现 warning `JOTL1048`(`format` 覆盖了组件自带的格式 `uri`)                                                                                                                                                                                   |
| 30   | scratch `diag.jotl` 的类型元数据写 `groups: [{title: '外观', fields: ['theme', 'img']}, {title: '其他', fields: ['theme']}]` | 同 29                                                                                                                                                                                             | 出现 error `JOTL1017`(字段 `theme` 出现在多个分组中)                                                                                                                                                                                           |
| 31   | 用户 `settings.json` 已含第 10 条的设置                                                                                      | 删掉 `jotl.registeredWidgets` 并保存(不重新加载窗口)                                                                                                                                              | 步骤 1 的文件重新出现指向 `headline` 的 `JOTL7001` 警告                                                                                                                                                                                        |
| 32   | scratch `scratch.jotl`(第 5 条的结果, 至少 3 行)                                                                             | 执行 `verify-debounce.mjs`: 以约 50ms 间隔连续键入 `extraField: strng`                                                                                                                            | 键入过程中诊断不刷新, 最后一次按键后约 200ms 刷新一次; 键间隔稳定, 无卡顿                                                                                                                                                                      |
| 33   | scratch `variants.jotl`: `title: string[variants: {view: {widget: 'fancy-text'}, mobile: {widget: 'textarea'}}]`             | 打开问题面板                                                                                                                                                                                      | `fancy-text` 处出现 `JOTL7001` 警告, `textarea` 不报                                                                                                                                                                                           |
| 34   | 以 `--locale en` 启动; `fixtures/016-errors/source.jotl` 与 `fixtures/013-x-ui-basic/source.jotl`                            | 打开问题面板; 悬停 013 中的 `string`; 在 scratch 中触发 `string[` 补全; 打开 013 的预览, 切到 "Form" 页签                                                                                         | 诊断消息, 悬停卡片, 补全说明都是英文; 预览标题为 "Preview ...", 页签与提示为英文; 表单中的按钮, 占位与校验消息为英文                                                                                                                           |
| 35   | 装中文语言包后以 `--locale zh-cn` 启动; 文件同 34                                                                            | 重复 34                                                                                                                                                                                           | 同一处诊断, 悬停, 补全, 预览界面与表单文案都是简体中文(诊断代码与位置与 34 相同)                                                                                                                                                               |
| 36   | 用户设置不含 `jotl.preview.loadWidgetModules`; `modules/modules.jotl`                                                        | 打开文件与预览                                                                                                                                                                                    | 问题面板无 `JOTL1006`(`Color` 由配置登记); 预览标题下方提示 "预览未加载扩展组件模块: Color, Stars; ... 开启设置 jotl.preview.loadWidgetModules 后加载."; 表单页签中 `颜色` `评分` 按降级方式显示, `名称` 正常                                  |
| 37   | 同 36                                                                                                                        | 用户 `settings.json` 加入 `"jotl.preview.loadWidgetModules": true` 并保存(不重新加载窗口)                                                                                                         | 约 1 秒内预览重新加载, 提示改为 "预览加载的扩展组件模块: Color, Stars."; 表单页签中 `颜色` 是颜色选择框(`input.verify-color`), `评分` 是星号按钮(`button.verify-stars`), 点击星号后星数加一                                                    |
| 38   | 同 37                                                                                                                        | 执行 "Developer: Open Webview Developer Tools" 看 Console 与 Elements                                                                                                                             | 无 CSP 违规与模块加载错误; `<body>` 中预览脚本之前有带 nonce 的 `<script type="importmap">`, 其中 `react` `react/jsx-runtime` `react-dom` `react-dom/client` 指向 `dist/preview-shim-*.js`; 没有出现 "Invalid hook call" 一类多份 React 的报错 |
| 39   | 同 37                                                                                                                        | 把 `jotl.config.json` 中 `Color` 的 `module` 改成 `./widgets/missing.js` 并保存, 不动 `modules.jotl`; 再改回                                                                                      | 预览自动刷新, `颜色` 字段显示加载失败与重试按钮, 表单其余字段正常; 改回后恢复为颜色选择框                                                                                                                                                      |
| 40   | 同 37; 联网                                                                                                                  | 在 `modules.jotl` 的 `widgets` 中加入 `Hex: {base: 'string', module: 'https://esm.sh/react-colorful@5?external=react,react-dom', export: 'HexColorInput'}` 与字段 `hex: Hex`, 在框中输入 `ff8800` | `hex` 字段渲染为 react-colorful 的输入框(远程 https 模块经 import map 共用预览的 React), 输入后不报类型不符, Console 无 CSP 违规                                                                                                               |
| 41   | 同 37                                                                                                                        | 删掉 `jotl.preview.loadWidgetModules` 并保存                                                                                                                                                      | 预览重新加载, 回到 36 的提示与降级显示; Webview Developer Tools 中 CSP 的 `script-src` 只剩 nonce 与 `'unsafe-eval'`, 没有 import map                                                                                                          |

## 验证记录

### 20261014_173002 插件 vscode-jotl 0.1.0(本地打包 17:25), 仓库 HEAD 23057fd; 40 与配置 schema 随语言切换复验

- 环境: VS Code 1.141.0 独立实例(本页 "安装与启动独立实例"), CDP 端口 9345(9333 被其他实例占用, 驱动脚本设 `JOTL_VERIFY_CDP=http://127.0.0.1:9345`); 先 `--locale zh-cn` 执行 40 与中文悬停, 再 `--locale en` 执行英文悬停; 实例设置临时加 `"jotl.preview.loadWidgetModules": true`, 结束后还原.
- 截图在 `.ai-ctx/cache/sav_20261014_172507_vscode复验/`.
- 统计: 执行 40 与配置 schema 语言切换(本次追加, 不在用例表中); 均通过.
- 用例 40 原写法缺 `base: 'string'`, 底层类型按 object, 输入后 `hex` 报类型不符并改用 JSON 编辑; 补上后正常, 用例表已更正.

| 编号 | 结果 | 实际表现与证据(截图文件名)                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 40   | 通过 | 预览提示加载 `Color, Hex, Stars`; `hex` 渲染为 `HexColorInput`, 输入 `ff8800` 无报错; import map 带 nonce, CSP `script-src` 含 `https:`; webview Console 只有宿主的 `local-network-access` 警告, 无 CSP 违规与 Invalid hook call(先注入 `console.error` 与无 nonce 内联脚本做正例, 均能读到). `A40-form.png` `A40-hex-typed.png` `A40-typed-mismatch-nobase.png` `A40-hex-base-string.png` |
| L1   | 通过 | `jotl.config.json` 悬停 `widgets` 与 `Color`: zh-cn 下为中文说明("登记的扩展组件..." "模块声明: 底层类型 base..."), en 下为英文; `base` `module` 两份 schema 都无说明, 无卡片属预期. `B-zhcn-hover-widgets.png` `B-en-hover-widgets.png` `B-en-hover-Color.png` `B-zhcn-hover-module.png`                                                                                                  |

### 20261013_191433 插件 vscode-jotl 0.1.0(本地打包 19:10), 仓库 HEAD 15de8a1 + 未提交改动; 39 与配置文件补全复验

- 环境: VS Code 1.141.0 独立实例(本页 "安装与启动独立实例", `open -g` 后台启动, CDP 端口 9333, `--locale zh-cn`, 语言包已登记, 首次启动即为中文); 实例设置临时加 `"jotl.preview.loadWidgetModules": true`, 结束后删除; `code.pid` 按父进程为 1 只记到主进程.
- 修复: 语言客户端把 `jotl.config.json` 的文件事件攒 250ms 再发给语言服务, 预览自己监听同一文件 200ms 后就请求, 请求先于配置缓存清空到达, 读到旧配置; 现改为语言服务清空配置缓存后发 `jotl/configChanged` 通知, 预览收到后再请求.
- 截图在 `.ai-ctx/cache/sav_20261013_191128_配置预览复验/`.
- 统计: 执行 39 与配置文件补全(上次 C3 中的空对象补全); 均通过.

| 编号  | 结果 | 实际表现与证据(截图文件名)                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 39    | 通过 | 在编辑器中把 `module` 改成 `./widgets/missing.js` 并保存, 1 秒内 `颜色` 显示加载失败, 其余字段正常; 改回 `./widgets/color.js` 并保存, 1 秒内恢复为颜色选择框. 连续两轮一致; 直接写磁盘文件同样 1 秒内跟上. `R39-open.png` `R39-missing-1.png` `R39-restore-1.png` `R39-missing-2.png` `R39-restore-2.png`                                                                                                    |
| C3 补 | 通过 | `cfgproj/jotl.config.json` 中 `"Foo": {}` 的空对象内补全为 `base` `export` `module`(属性). 校验结论不变: `{}`, `{"type": "string"}`, `{"module": "./m.js", "export": "X"}` 不报; `{"module": "./m.js", "x": 1}` 报 "不允许属性 x", `{"module": ""}` 报最小长度, `"enum"` 报值不被接受. 配置 schema 说明文字仍只有英文(jsonValidation 用的是静态文件). `R2-config-suggest-empty.png` `R2-config-validate.png` |

### 20261013_184446 插件 vscode-jotl 0.1.0(本地打包 18:44), 仓库 HEAD 15de8a1 + 未提交改动; 用户验证项模拟

- 环境: VS Code 1.141.0 独立实例(本页 "安装与启动独立实例", `open -g` 后台启动, CDP 端口 9333), 中文语言包 `ms-ceintl.vscode-language-pack-zh-hans` 1.131 装在同一 extensions-dir; 先 `--locale zh-cn` 执行 35 至 41 与项目配置, 再 `--locale en` 执行 34; 受限模式一项临时把实例设置改为 `"security.workspace.trust.enabled": true` 并去掉 `--disable-workspace-trust`, 结束后还原.
- 安装语言包后第一次以 `--locale zh-cn` 启动仍为英文: 实例启动时才写 `languagepacks.json`, 晚于显示语言的解析; 结束实例再启动一次后生效.
- Webview 控制台的读法: `/json/list` 中 `type: iframe` 的 `vscode-webview://` 目标单独连 CDP, 开 `Runtime.enable` 与 `Log.enable` 回放已有消息(CSP 违规在 Log 的 `security` 来源); 用注入的 `console.error` 与无 nonce 内联脚本做过正例, 两者都能读到.
- 截图在 `.ai-ctx/cache/sav_20261013_184446_用户验证模拟/`.
- 统计: 执行 34 至 39, 41 与追加项 C3, C4, T5; 通过 9, 失败 1(39), 40 未执行(上次已通过). C3 C4 T5 是本次追加的项(项目配置, 扩展组件约束键与悬停, 受限模式), 不在用例表中.

| 编号 | 结果 | 实际表现与证据(截图文件名)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 34   | 通过 | 016 诊断英文("Unknown component `strng`" 等 15 条); 悬停 `string` 为 "Built-in component string ... Compiles to:"; `string[` 补全项说明为 "Metadata"; 预览 "Preview ...", 页签 `JSON Schema` `TS` `Form`, 表单 `Empty` `Select…` `Submit` `Reset`, 提交后 "Missing required field 标题". `34-en-problems.png` `34-en-hover.png` `34-en-suggest.png` `34-en-form-validate.png`                                                                                                                                                                                                                     |
| 35   | 通过 | 诊断代码与位置同 34, 文案中文("未知组件 `strng`" 等); 悬停 "内置组件 string ... 编译结果:"; 补全说明 "元数据"; 预览 "预览 ...", 页签 `JSON Schema` `TS` `表单`, 表单 `未填写` `请选择` `提交` `重置`, 提交后 "缺少必填字段 标题". 013 的 `JOTL7001` 现为 7 条(含 `item_meta` 内的 `tag` `slider` `row`), 上次第 2 条的失败已不复现. `35-zh-problems.png` `35-zh-hover.png` `35-zh-suggest.png` `35-zh-form.png` `35-zh-form-validate.png`                                                                                                                                                         |
| 36   | 通过 | 问题面板无 `JOTL1006`; 提示 "预览未加载扩展组件模块: Color, Stars; ..."; `颜色` `评分` 只有标题. `36-off.png`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 37   | 通过 | 写入设置后 6 秒内重新加载, 提示 "预览加载的扩展组件模块: Color, Stars."; `input.verify-color` 与 `button.verify-stars` 各 1 个, 点击 ☆ 变 ★. `37-on.png`                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 38   | 通过 | Webview 目标无 CSP 违规, 无 "Invalid hook call" 一类报错; 只有宿主自身的 `Unrecognized feature: 'local-network-access'` 警告与第 39 条 `missing.js` 的两条 404. import map 带 nonce, 4 个键 `react` `react/jsx-runtime` `react-dom` `react-dom/client` 指向 `dist/preview-shim-*.js`; 它位于 `<body>` 的第 2 个子元素(不在 `<head>` 中).                                                                                                                                                                                                                                                          |
| 39   | 失败 | 预览总是比 `jotl.config.json` 落后一次: 在编辑器中把 `module` 改成 `./widgets/missing.js` 并保存, 12 秒内 `颜色` 仍是颜色选择框; 再改回 `./widgets/color.js` 并保存, 预览反而显示 "组件加载失败" 与 "重试"(其余字段正常). 连续两轮现象一致; 直接写磁盘文件同样落后一次. 问题面板随配置即时更新, 只有预览滞后. `39-editor-missing-1.png` `39-editor-restore-1.png` `39-stale-preview.png`                                                                                                                                                                                                          |
| 41   | 通过 | 删掉设置后回到 36 的提示; CSP `script-src` 只剩 nonce 与 `'unsafe-eval'`, 没有 import map. `41-off.png`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| C3   | 通过 | scratch `cfgproj/`(`jotl.config.json` 登记 `ImagePicker: "url"` `headline: "string"`): `.jotl` 无诊断; 组件位置补全有 `ImagePicker`(扩展组件), `widget: '` 补全有 `headline` `ImagePicker` `Rating`(已登记 widget); 悬停 `ImagePicker` 显示 `{"type":"string","format":"uri"}`. 在编辑器中删去 `ImagePicker` 并保存, 1 秒内出现 `JOTL1006`, 加回后 1 秒内消失. 配置文件自身: 根补全 `$schema` `widgets`; 非法底层类型与多余根键报警告; 模块声明对象内已有 `module` 时补全 `base` `export`, 空对象 `{}` 内不提示这三个键(只有文本单词). 配置文件 schema 的说明文字在中文界面下仍为英文. `C3-*.png` |
| C4   | 通过 | 根条目 `widgets` 声明 `Rating: {base: 'integer', ...}`: `Rating[` 补全含 `minimum` `maximum` `exclusiveMinimum` `exclusiveMaximum`, 写 `maxLength` 报 "元数据 `maxLength` 不适用于组件 `Rating`"; 悬停 `Rating` 为 "扩展组件 Rating" 与 `{"type":"integer"}`. 带根 `$schema` 的 `*.schema.json` 中 `x-ui` 的 `"layout": "row"` 与 `"foo": 1` 不报; 删去 `$schema` 行后两处立即报警告(绕过办法一有效); 同样的错误写在 `.jotl` 中由编译器报 `JOTL1017` 与 `JOTL1011`(绕过办法二有效). `C4-*.png`                                                                                                    |
| T5   | 通过 | 启用工作区信任后打开 scratch `trustproj/`(`.vscode/settings.json` 写 `"jotl.preview.loadWidgetModules": true`), 实例直接进入受限模式: 预览提示 "预览未加载扩展组件模块", 无 `input.verify-color`; 在 "管理工作区信任" 中点 "信任" 后预览自动改为 "预览加载的扩展组件模块: Color, Stars." 并渲染颜色选择框. `T5-restricted.png` `T5-trusted.png`                                                                                                                                                                                                                                                   |

### 20261013_172033 插件 vscode-jotl 0.1.0(本地打包), 仓库 HEAD 853e6e8 + 未提交改动

- 环境: 同下方 20261013_124342 的独立实例, `--locale en`(未装中文语言包); 驱动方式 CDP(端口 9333) + `verify-drive.mjs`; 素材见 "扩展组件模块素材", 远程模块另用 `modules/remote.jotl`(`Hex: {module: 'https://esm.sh/react-colorful@5?external=react,react-dom', export: 'HexColorInput'}`).
- 截图在 `.ai-ctx/cache/sav_20261013_172033_vscode预览模块验证/`.
- 统计: 只执行 34(部分), 36, 37, 40, 41; 均通过. 35, 38, 39 未执行.

| 编号 | 结果       | 实际表现与证据(截图文件名)                                                                                                                                                                   |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 34   | 通过(部分) | 016 的诊断为英文(如 "Unknown component `strng`"); 预览标题 "Preview ...", 提示与表单文案(`Empty` `Select…` `Submit` `Reset`)为英文; 悬停与补全未单独检查. `34-en-problems.png`               |
| 36   | 通过       | 问题面板无 `JOTL1006`; 提示 "Extension widget modules are not loaded in the preview: Color, Stars. ..."; `颜色` `评分` 只有标题, `名称` 正常. `36-off.png`                                   |
| 37   | 通过       | 写入设置约 4 秒内预览重新加载, 提示 "Extension widget modules loaded in the preview: Color, Stars."; 出现 `input.verify-color` 与 `button.verify-stars`(☆), 点击后为 ★. `37-on.png`          |
| 40   | 通过       | `hex` 字段渲染为 react-colorful 的 `HexColorInput` 输入框. `40-remote.png`                                                                                                                   |
| 41   | 通过       | 删掉设置后回到 36 的提示; CSP `script-src` 只剩 nonce 与 `'unsafe-eval'`, 没有 import map(开启时为 `... 'unsafe-eval' 'self' https://*.vscode-cdn.net https:` 并有 import map). `41-off.png` |

### 20261013_124342 插件 vscode-jotl 0.0.1(本地打包), 仓库 HEAD 96e8a91 + 未提交改动

- 环境: VS Code 1.141.0(Electron 43), Default Dark Modern 主题, 工作区为仓库根; 驱动方式 CDP(端口 9333) + `verify-drive.mjs`.
- 被测产物: 12:25 按 "构建与打包" 生成的 vsix(`.ai-ctx/cache/vscode-verify/pack/jotl.vsix`); `@jotl/html` `@jotl/react` 用当时已有的 `dist/`.
  验证途中其他改动重写了 `scripts/bundle.mjs`(`typescript` 换成占位模块并压缩), 12:42 用新产物重新打包安装(`pack2/jotl.vsix`), 只做了冒烟(第 S 行).
- 本次实例用直接运行 `Contents/MacOS/Code` 启动, 并曾用 `code` CLI 向实例打开临时文件, 会抢走用户的键盘焦点; 本页的命令已改为 `open -g` 与 Quick Open, 新写法本次未实测.
- 截图在 `.ai-ctx/cache/sav_20261013_122551_vscode插件验证/`.
- 统计: 共 33 条, 通过 29, 偏差 3(1, 19, 23), 失败 1(2), 未执行 0; 新 bundle 冒烟 1 项通过.

| 编号 | 结果         | 实际表现与证据(截图文件名)                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 偏差         | 语言模式 `Jotl`; 各类记号作用域互不相同(`entity.name.type.alias` `support.type.builtin` `string.unquoted.label` `support.type.property-name` `variable.other.property`), 但在 Default Dark Modern 下类型名与内置组件同为 `#4EC9B0`, 标签与字符串同为 `#CE9178`, 字段名与元数据键同为 `#9CDCFE`; 属主题配色, 非语法缺陷. `01-highlight.png` `01-inspect-tokens.png`         |
| 2    | 失败         | 只有 4 条 `JOTL7001`: `headline` `tag-list` `table` `card`; `item_meta` 里的 `tag` `slider` `row` 没有报. 原因: `packages/language-server/src/widget-check.ts` 的 `widgetMembers` 只看顶层的 `widget` `decorator` 与 `variants`, 不进入 `item_meta`. 无错误. `02-problems-013.png`                                                                                         |
| 3    | 通过         | 15 条错误, 代码与行列和 `diagnostics.json` 逐条一致(2:9 至 24:14). `03-problems-016-max.png`                                                                                                                                                                                                                                                                               |
| 4    | 通过         | 未保存即出现 "未知组件 `strng`"; Revert 后恢复为 4 条警告. `04-strng-error.png`                                                                                                                                                                                                                                                                                            |
| 5    | 通过         | 出现顶层条目错误; `Cmd+.` 列出该快速修复, 应用后无错误. 包进的字段没有缩进(`title: string` 顶格). `05-quickfix.png`                                                                                                                                                                                                                                                        |
| 6    | 通过         | 输入 `name: ` 后不自动弹出; `Ctrl+Space` 列出内置组件, 键入 `R` 后有 `Root`(Class). `06-suggest-types.png`                                                                                                                                                                                                                                                                 |
| 7    | 通过         | `string[` 自动弹出, 含 `maxLength` `pattern` `widget`, 无 `minimum`; `integer[` 有 `minimum` `exclusiveMinimum` `maximum` `exclusiveMaximum`, 无 `maxLength`. `07-meta-string.png` `07-meta-integer.png`                                                                                                                                                                   |
| 8    | 通过         | 自动弹出 `eq` `falsy` `gt` `gte` `in` `lt` `lte` `ne` `not_in` `truthy`. `08-op.png`                                                                                                                                                                                                                                                                                       |
| 9    | 通过         | 自动弹出 `input` `password` `textarea`, 回车后为 `widget: 'input'`. `09-widget.png`                                                                                                                                                                                                                                                                                        |
| 10   | 通过         | 写入设置约 2 秒内 `headline` 警告消失(剩 3 条), 补全首项为 `headline`(已登记组件). `10-registered-problems.png` `10-registered-suggest.png`                                                                                                                                                                                                                                |
| 11   | 通过         | `Jotl` 输出通道为空; 扩展宿主日志只有激活记录, 无报错. `11-output.png`                                                                                                                                                                                                                                                                                                     |
| 12   | 通过         | "字段 title 标题", 片段含 `x-ui.widget: headline` 与 `props.size`. `12-hover-field.png`                                                                                                                                                                                                                                                                                    |
| 13   | 通过         | `string`: "内置组件 string" 带说明与编译结果; `maxItems`: "元数据 maxItems", 适用于 array enum 引用类型; `<root/>`: "标识 <root/>". `13-hover-builtin.png` `13-hover-meta.png` `13-hover-marker.png`                                                                                                                                                                       |
| 14   | 通过         | "类型 Page 页面", 片段与 `schema.json` 的 `$defs.Page` 一致. `14-hover-type.png`                                                                                                                                                                                                                                                                                           |
| 15   | 通过         | 引用上 `F12` 跳到 Ln 7, Col 1; 声明名上 `F12` 打开引用窥视, 3 项(含声明). `15-f12-decl.png`                                                                                                                                                                                                                                                                                |
| 16   | 通过         | 010 中 3 项(2:9, 3:11, 声明 7:1); `refs.jotl` 中注释 `// Page` 与字符串 `'Page 字符串'` 不在结果中. `16-references.png` `16-references-comments.png`                                                                                                                                                                                                                       |
| 17   | 通过         | `Cmd+Shift+O` 列出 `Ui`(struct)与字段, 枚举成员; 大纲视图中 006 逐层嵌套 `Page > meta 元信息 > seo SEO > keywords/robots > index`, 标签显示在名字后. `17-symbols.png` `17-outline.png` `17-outline-nested.png`                                                                                                                                                             |
| 18   | 通过         | 标题 "预览 fixtures/013-x-ui-basic/source.jotl"(工作区为仓库根), 三个页签齐全, JSON Schema 页签列出 `JOTL7001` 与格式化 schema. `18-preview.png`                                                                                                                                                                                                                           |
| 19   | 偏差         | 头注释与 `export interface Ui` 正确; "TS 转换" 为 3 条 `JOTL2002`(4:28, 5:63, 5:30, 均为数组元素 `x-ui`); 枚举成员 `description` 已转为 `@enumDescriptions`, 不再告警. `19-ts.png`                                                                                                                                                                                         |
| 20   | 通过         | 表单渲染出 标题* tags boxed legacy level* 与 "高级" 分组, 输入框可输入; 编辑器未变脏. `20-form.png`                                                                                                                                                                                                                                                                        |
| 21   | 通过         | 删字后约 233ms(含 20ms 轮询)三个页签都显示 "存在错误" 并列出 `JOTL1004 2:14`; Revert 后表单恢复. `21-error-form.png` `21-restored.png`                                                                                                                                                                                                                                     |
| 22   | 通过         | 切到 README.md 再切回仍是 TS 页签; 第一组切到 010 后预览标题与内容随之切换. `22-tab-kept.png` `22-follow-010.png`                                                                                                                                                                                                                                                          |
| 23   | 偏差         | Console 无 `EvalError`, 无脚本或样式加载失败; 有 1 条 CSP 违规: DevTools 拉取 `dist/preview.js.map` 被 `default-src 'none'` 拦截(只在打开 DevTools 时出现, 且 vsix 不含 `.map`). 清空 "标题" 后移开焦点不报错(`string` 默认允许空串), 而是出现 "缺少必填字段 level"; 校验链路工作, 但原预期 "该字段出现校验错误" 与语义不符. `23-webview-devtools.png` `23-validation.png` |
| 24   | 通过         | 补全含 `columns` `decorator` `groups` `hidden` `layout` `order` `props` `rules` `summary` `thousands` `variants` `version` `widget`. `24-xui-suggest.png`                                                                                                                                                                                                                  |
| 25   | 通过         | `"row"` 处 "Value is not accepted. Valid values: stack, tabs, grid", `foo` 处 "Property foo is not allowed"; 改正后无问题. `25-xui-validate.png` `25-xui-fixed.png`                                                                                                                                                                                                        |
| 26   | 通过(记录型) | 根带 `$schema` 后 `x-ui` 校验与补全都失效: 只报 JSON 语法错误, 补全只剩文本单词. `26-schema-validate.png` `26-schema-suggest.png`                                                                                                                                                                                                                                          |
| 27   | 通过         | 自动弹出 9 项: `iso` `iso-x` `utc` `utc-x` `X` `x` `YYYY-MM-DD` `YYYY/MM/DD` `YYYYMMDD`; 别名项说明为 "存储格式别名(RFC 3339)"; 悬停卡片说明格式串, 时间戳与 4 个别名, 适用于 date time datetime. `N1-value-format-suggest.png` `N1-value-format-hover.png`                                                                                                                |
| 28   | 通过         | "TS 转换: 没有诊断"; `Settings` 注释含 `@id https://jotl.dev/fixtures/111.json` 与 `@rules [{"match":{"type":"boolean"},"ui":{"widget":"checkbox"}}]`; `export default Settings;`. `N2-111-ts.png`                                                                                                                                                                         |
| 29   | 通过         | warning "`format` 覆盖了组件自带的格式 `uri`", 预览中代码为 `JOTL1048 3:22`. `N3-problems.png` `N3-preview-codes.png`                                                                                                                                                                                                                                                      |
| 30   | 通过         | error "字段 `theme` 出现在多个分组中或在分组中重复", 预览中代码为 `JOTL1017 1:20`. `N3-problems.png` `N3-preview-codes.png`                                                                                                                                                                                                                                                |
| 31   | 通过         | 删掉设置约 2 秒内 `headline` 警告恢复(4 条). `N4-config-removed.png`                                                                                                                                                                                                                                                                                                       |
| 32   | 通过         | 17 次按键间隔 44-87ms, 期间诊断不变; 最后一次按键后 214ms 刷新一次. `N4-debounce.png`                                                                                                                                                                                                                                                                                      |
| 33   | 通过         | 只有 `fancy-text` 处 "组件 `fancy-text` 未注册"(2:43), `textarea` 不报. `N5-variants-7001.png`                                                                                                                                                                                                                                                                             |
| S    | 通过         | 新 bundle(`server.cjs` 约 329 KB)冒烟: 013 的 4 条 `JOTL7001`, 字段悬停, 预览 TS 页签与 3 条 `JOTL2002` 均正常. `S-smoke-new-bundle.png`                                                                                                                                                                                                                                   |
