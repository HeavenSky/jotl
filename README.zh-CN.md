# Jotl

[English](./README.md) · **简体中文**

在本仓库安装, 构建或测试, 或要找某个包或契约文档在哪里时读本页; Jotl 是面向 JSON Schema 2020-12 的简洁编写语言及其 TS 工具链, 代码在 `packages/*` 与 `apps/*`.

## 包与目录

目录名与包名(去掉 `@jotl/` 前缀)一致. 浏览器中渲染表单只需 `core` `data` `form`; 其余为编写与工具链.

| 包名 | 目录 | 职责 | 说明 |
|---|---|---|---|
| `@jotl/core` | `packages/core` | 语言核心: schema 与 `x-ui` 类型, `Result` 与诊断, JSON Pointer, 数据能力接口(`src/schema/`); Jotl 的解析, 编译到 JSON Schema, 反向打印与格式化(`src/syntax/`) | [README](packages/core/README.zh-CN.md) |
| `@jotl/convert` | `packages/convert` | 与其他格式互转: JSON Schema 与 TS 声明(JSDoc 标签)互转, TSDoc / ESLint 预设(`src/ts/`); 旧版 JSON Schema 与 OpenAPI / Swagger Schema Object 升级到 2020-12, 凤蝶 schema 迁移为 Jotl(`src/migrate/`). 依赖 typescript 的 `tsToSchema` 在子路径 `@jotl/convert/from-ts` | [README](packages/convert/README.zh-CN.md) |
| `@jotl/data` | `packages/data` | 默认数据, 校验, 迁移与 Mock | [README](packages/data/README.zh-CN.md) |
| `@jotl/form` | `packages/form` | React 表单渲染器, 支持 React 16.8 至 19(`src/react/`), 原生 HTML 默认 widget 与样式(`src/html/`); 子路径 `@jotl/form/core` 为 `x-ui` 解析, widget 注册, 渲染计划与降级决策, 不依赖 UI 框架(`src/core/`) | [README](packages/form/README.zh-CN.md) |
| `@jotl/antd` | `packages/antd` | `@jotl/form` 的 Ant Design widget(antd 5 或 6, React 18 及以上): `createAntdRegistry({ dayjs })` 传给 `JotlForm`; 没有 antd 实现的 widget 回落到 HTML 默认组件 | [README](packages/antd/README.zh-CN.md) |
| `@jotl/language-server` | `packages/language-server` | Jotl 语言服务(LSP) | [README](packages/language-server/README.zh-CN.md) |
| `vscode-jotl`(市场 ID `jotl-lang.vscode-jotl`) | `packages/vscode` | VS Code 插件, 含预览面板 | [README](packages/vscode/README.zh-cn.md) |
| `jotl` | `packages/cli` | 命令行 | [README](packages/cli/README.zh-CN.md) |
| `@jotl/playground` | `apps/playground` | 浏览器中在线编辑与预览 | [README](apps/playground/README.zh-CN.md) |

### 旧包名对照

2026-10 由 12 个包合并为 8 个; 旧包均未发布过. 旧名到新入口:

| 旧包名(旧目录) | 新入口 | 新源码位置 |
|---|---|---|
| `@jotl/schema`(`packages/schema`) | `@jotl/core` | `packages/core/src/schema/` |
| `@jotl/syntax`(`packages/syntax`) | `@jotl/core` | `packages/core/src/syntax/` |
| `@jotl/ts`(`packages/ts`) | `@jotl/convert`; `tsToSchema` 改为 `@jotl/convert/from-ts` | `packages/convert/src/ts/` |
| `@jotl/ts/eslint`, `@jotl/ts/tsdoc.json` | `@jotl/convert/eslint`, `@jotl/convert/tsdoc.json` | `packages/convert/src/ts/eslint.ts`, `packages/convert/tsdoc.json` |
| `@jotl/migrate`(`packages/migrate`) | `@jotl/convert` | `packages/convert/src/migrate/` |
| `@jotl/ui-core`(`packages/ui-core`) | `@jotl/form/core` | `packages/form/src/core/` |
| `@jotl/html`(`packages/html`) | `@jotl/form` | `packages/form/src/html/` |
| `@jotl/react`(`packages/react`) | `@jotl/form` | `packages/form/src/react/` |
| `@jotl/html/style.css` + `@jotl/react/style.css` | `@jotl/form/style.css`(合并为一份) | `packages/form/style.css` |
| `@jotl/html/tailwind.css` + `@jotl/react/tailwind.css`, `@jotl/html/theme.css` | `@jotl/form/tailwind.css`, `@jotl/form/theme.css` | `packages/form/` |
| `@jotl/lsp`(`packages/lsp`) | `@jotl/language-server` | `packages/language-server/` |
| `@jotl/data`, `jotl`, `vscode-jotl`, `@jotl/playground` | 不变 | 不变 |

诊断代码段(`JOTL0xxx`-`JOTL8xxx`)与各导出名不变.

其他目录:

| 目录 | 内容 |
|---|---|
| `docs/spec/` | 对外契约: Jotl 语法(`jotl.md`), `x-ui`(`x-ui.md`), 原生 widget(`html-widgets.md`), 三种写法的关键字对照(`keyword-mapping.md`) |
| `fixtures/` | 各包共用的样例与期望值, 约定见 [fixtures/README.zh-CN.md](fixtures/README.zh-CN.md) |
| `test-utils/` | 测试读取样例的工具 |
| `scripts/` | 仓库脚本 |
| `vendor/` | 官方 JSON-Schema-Test-Suite 的下载位置, 不入库 |

尚未解决的问题, 待确认与后置事项见 [TODO.md](TODO.md).

## 语言

面向使用者的文字(诊断消息, 生成文字, 表单 widget 文案, 语言服务的悬停与补全, 命令行输出)有英文(`en`, 默认)与中文(`zh-CN`)两种. 代码中用 `@jotl/core` 的 `setLocale` 设置(全局); `@jotl/data` 的函数与 `JotlForm` 另有按次 / 按表单的 `locale` 选项; 命令行用 `--lang` 或环境变量 `JOTL_LANG` `LC_ALL` `LC_MESSAGES` `LANG`; 语言服务从初始化选项读取 `locale`. 详见各包 README.

## 命令

在仓库根运行:

| 命令 | 作用 |
|---|---|
| `pnpm install --frozen-lockfile` | 按 lockfile 安装依赖 |
| `bash scripts/fetch-json-schema-test-suite.sh` | 下载固定版本的官方 JSON-Schema-Test-Suite 到 `vendor/`; `@jotl/convert` 与 `@jotl/data` 的测试依赖它, 缺少时这些测试失败 |
| `pnpm build` | `tsc -b` 构建全部包到各自的 `dist/` |
| `pnpm test` | 运行 `packages/*/test/` 与 `apps/*/test/` 下的全部用例 |
| `pnpm check` | 构建, 各包测试代码的类型检查(`typecheck:test`), 全部测试, 再生产构建 playground |
| `pnpm clean` | 清除构建产物 |
| `pnpm --filter ./packages/vscode run package` | 打包 VS Code 插件为 vsix, 需先 `pnpm build`; 详见 `packages/vscode/DEVELOPMENT.md` |
| `pnpm --filter @jotl/playground dev` | 启动 playground 开发服务器, 需先 `pnpm build` |

要求 Node 22 及以上, pnpm 版本见根 `package.json` 的 `packageManager`.
