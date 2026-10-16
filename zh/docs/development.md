# 开发指南

[English](../../docs/development.md) · **简体中文**

读完本页，你能从全新克隆的仓库跑通构建与测试，并知道仓库各部分放在哪里。前提是 Node 22 及以上，pnpm 版本以根 [`package.json`](../../package.json) 的 `packageManager` 为准。只想使用 Jotl 而不参与开发，请从 [README](../README.md) 开始。

## 从全新克隆跑通构建与测试

以下命令都在仓库根运行。

1. 按 lockfile 安装依赖：

   ```sh
   pnpm install --frozen-lockfile
   ```

2. 把固定版本的官方 JSON-Schema-Test-Suite 下载到 `vendor/json-schema-test-suite/`（不入库）。`@jotl/convert` 与 `@jotl/data` 的测试依赖它，缺少时这些测试失败；已是固定版本时重跑脚本会跳过下载。

   ```sh
   bash scripts/fetch-json-schema-test-suite.sh
   ```

3. 构建全部包到各自的 `dist/`：

   ```sh
   pnpm build
   ```

4. 运行全部测试：

   ```sh
   pnpm test
   ```

## 命令

| 命令 | 作用 |
|---|---|
| `pnpm build` | `tsc -b`：构建全部包到各自的 `dist/` |
| `pnpm test` | 运行 `packages/*/test/` 与 `apps/*/test/` 下的全部用例 |
| `pnpm lint` | 用 Biome 做 lint |
| `pnpm check` | lint、构建、各包测试代码的类型检查（`typecheck:test`）、全部测试，最后生产构建 playground |
| `pnpm clean` | 清除构建产物 |
| `pnpm --filter @jotl/playground dev` | 启动 playground 开发服务器，需先 `pnpm build`。详见 [playground README](../../apps/playground/zh/README.md) |
| `pnpm --filter ./packages/vscode run package` | 把 VS Code 插件打包为 vsix，需先 `pnpm build`。详见 [`packages/vscode/DEVELOPMENT.md`](../../packages/vscode/DEVELOPMENT.md) |

## 各部分的位置

包目录名即去掉 `@jotl/` 前缀的包名。

| 包 | 目录 | 源码结构 |
|---|---|---|
| `@jotl/core` | `packages/core` | `src/schema/`：schema 与 `x-ui` 类型、`Result` 与诊断、JSON Pointer、数据能力接口；`src/syntax/`：Jotl 的解析、编译到 JSON Schema、打印回 Jotl 与格式化 |
| `@jotl/convert` | `packages/convert` | `src/ts/`：JSON Schema 与 TS 声明互转，TSDoc / ESLint 预设；`src/migrate/`：旧版 JSON Schema 与 OpenAPI 升级，凤蝶迁移。`tsToSchema` 依赖 `typescript`，从子路径 `@jotl/convert/from-ts` 导出 |
| `@jotl/data` | `packages/data` | 默认数据、校验、迁移与 Mock |
| `@jotl/form` | `packages/form` | `src/react/`：React 渲染器；`src/html/`：原生 HTML widget 与样式；`src/core/`：与框架无关的 `x-ui` 解析、widget 注册与渲染规划，以 `@jotl/form/core` 导出 |
| `@jotl/antd` | `packages/antd` | `@jotl/form` 的 Ant Design widget |
| `@jotl/language-server` | `packages/language-server` | 语言服务（LSP） |
| `vscode-jotl`（市场 ID `heavensky.vscode-jotl`） | `packages/vscode` | VS Code 插件及其预览面板 |
| `@jotl/cli` | `packages/cli` | 命令行 |
| `@jotl/playground` | `apps/playground` | 浏览器 playground |

其他目录：

| 目录 | 内容 |
|---|---|
| `docs/spec/` | 对外契约：[Jotl 语法](spec/jotl.md)、[`x-ui`](spec/x-ui.md)、[原生 HTML widget](spec/html-widgets.md)、[关键字对照](spec/keyword-mapping.md)；中文版在 `zh/docs/spec/` |
| `fixtures/` | 各包测试共用的样例与期望值，约定见 [fixtures/zh/README.md](../../fixtures/zh/README.md) |
| `test-utils/` | 测试读取样例的工具 |
| `scripts/` | 仓库脚本 |
| `vendor/` | JSON-Schema-Test-Suite 的下载位置，不入库 |

## 发布

推送标签即发布：`npm-v<版本>` 经 `.github/workflows/npm-release.yml` 发布 `packages/` 下全部公开包，`vscode-v<版本>` 经 `.github/workflows/vscode-release.yml` 发布插件。两者都会等标签所在提交的 CI 通过，并跳过 npm 上已有的版本，所以失败后重跑是安全的。

1. 把所有公开包 `packages/*/package.json` 的 `version` 改成同一个版本，提交并推送到 `main`。
2. 推送标签：

   ```sh
   git tag npm-v0.0.2 && git push origin npm-v0.0.2
   ```

npm 发布走 Trusted Publishing，仓库里不存 npm token。每个包需要登记一次信任关系，新包要先手动发布一次才能登记。一次性登记全部包：第一个包做 2FA 时勾选「5 分钟内跳过两步验证」，其余包不再确认：

```sh
for f in packages/*/package.json; do
  name=$(node -p "const p=require('./$f'); p.private ? '' : p.name")
  [ -n "$name" ] && npm trust github "$name" --repo HeavenSky/jotl --file npm-release.yml --allow-publish --yes && sleep 2
done
```

插件 workflow 需要 secret `VSCE_PAT`（VS Code Marketplace）与 `OVSX_PAT`（Open VSX），缺哪个就跳过哪个市场。

## 待解决事项

问题反馈与待办跟踪见 [GitHub Issues](https://github.com/HeavenSky/jotl/issues)。
