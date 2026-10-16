# Jotl VS Code 插件开发

构建, 调试, 打包或发布 `packages/vscode` 时读本页; 对应 `packages/vscode` 的 `build.mjs`, `scripts/`, 与仓库根 `.github/workflows/vscode-release.yml`. 不进 vsix.

插件的工程骨架来自 vsc-ext 范式: `.template-shared` 记录 A 类骨架文件的基线 hash, `pnpm run check` 会核对它们未偏离; 本插件有意偏离的文件以 `!<路径>  <原因>` 行写在该清单里. NEVER 在本目录跑 `scripts/check-template.mjs --update`.

## 构建

以下命令在仓库根执行:

```sh
pnpm install
pnpm build
pnpm --filter ./packages/vscode run compile
```

- `pnpm build` 先生成各 workspace 包的 `dist/`; 插件构建从 `@jotl/language-server` `@jotl/form` 的 `dist/` 取代码, 缺少时 esbuild 报 `Could not resolve`.
- `compile` 是开发构建(不压缩, 带 sourcemap), `build` 是生产构建(压缩, 无 sourcemap), `watch` 持续构建.
- 产物在 `dist/`: `extension.cjs`(插件入口), `server.cjs`(语言服务进程, 不含 `typescript`), `preview.js`(预览 webview 脚本), `preview-form.css`(`@jotl/form/style.css` 的副本), `x-ui.schema.json`(由 `@jotl/language-server` 的 `createXUiJsonSchema` 生成). 改动 `src` 或任何被依赖的包之后都要重新构建.
- 同目录下 `tsc -b` 产出的 `dist/*.js` `*.d.ts` 只服务于项目引用与类型检查, 不进 vsix.

## 以开发模式加载插件

任选一种方式启动扩展开发宿主(Extension Development Host):

- 命令行: 在仓库根执行 `code --extensionDevelopmentPath="$PWD/packages/vscode" fixtures`.
- F5: 用 VS Code 打开仓库根, 选 "运行 Jotl 插件"; 或单独打开 `packages/vscode`, 选 "Run Extension"(会先跑 `compile`).

以调试方式启动时, 语言服务进程带 `--inspect=6009` 运行, 可用 Node 调试器附加到 `localhost:6009` 调试服务端.

## 本地化

- 清单文案(命令标题, 设置说明, 分类)在 `package.nls.json`(英文)与 `package.nls.zh-cn.json`(中文), 两份 key 必须一致.
- 运行时文案一律写成 `l10n.t("英文原文")`, 参数必须是字面量; 中文译文在 `l10n/bundle.l10n.zh-cn.json`, 以英文原文为 key. 预览 webview 不能调用 vscode API, 其文字由扩展侧在 `src/preview-text.ts` 的 `createPreviewText` 中本地化后写进 HTML 外壳.
- `pnpm run check` 校验以上一致性.

## 检查, 测试与打包

在 `packages/vscode` 下执行(先在仓库根 `pnpm build`):

```sh
pnpm run check       # 图标产物, 清单占位符, l10n, 骨架漂移
pnpm run typecheck
pnpm test
pnpm run package     # 生产构建 + 打 vsix 到 artifacts/ + 内容断言
```

- `package` 以预发布(`--pre-release`)打包; 转正式版时从 `package.json` 的 `package` 脚本去掉 `--pre-release`.
- vsix 内容由 `package.json` 的 `files` 白名单决定, 打包后再按清单推导的允许清单逐项断言; 新增随包产物时两边都要加(`scripts/package.mjs` 的 `RUNTIME_FILES`).
- README 中的相对链接由 vsce 改写为 `https://github.com/HeavenSky/jotl/blob/HEAD/packages/vscode/...`(基址来自 `repository.url` 与 `repository.directory`).
- 图标的唯一真源是 `scripts/icon-spec.mjs`; 改动后跑 `pnpm run gen:icon`, 不要手改 `media/icon.svg` 或 `media/icon.png`.
- 本地安装: `code --install-extension packages/vscode/artifacts/jotl-<版本>.vsix --force`.

## 发布

发布由仓库根的 `.github/workflows/vscode-release.yml` 完成, 推送 `vscode-v<版本>` 标签触发, 也可手动触发并填版本号:

1. 更新 `package.json` 的 `version` 与 `CHANGELOG.md`(标题格式 `## v<版本> <日期> [标题]`, 日期取 `date '+%Y-%m-%d'`).
2. 本地跑通上面四步.
3. `git tag vscode-v<版本> && git push origin vscode-v<版本>`; 标签版本必须等于 `package.json` 的 `version`.

工作流先在仓库根 `pnpm install --frozen-lockfile` 与 `pnpm build`, 再在本目录跑 check, typecheck, test, package, 创建 GitHub Release 并附 vsix; 仓库 Secrets 有 `VSCE_PAT` 时发布到 VS Code Marketplace, 有 `OVSX_PAT` 时发布到 Open VSX, 都用同一个 vsix(`--packagePath`), 不重新打包.

## 手工验证

在真实 VS Code 中回归验证的用例, 独立实例的安装启动, CDP 自动驱动与历次验证记录见 [VERIFY.md](./VERIFY.md).
