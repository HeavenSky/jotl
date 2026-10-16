# React 版本兼容

[English](../../docs/react-compat.md) · **简体中文**

`@jotl/form` 支持 React 16.8、17、18 与 19，宿主无需任何配置。本页说明版本范围与测试方式。

## 支持范围

```sh
pnpm add @jotl/form react react-dom
```

- `react` 是可选的 peer 依赖，范围为 `^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0`。
- 只用 `@jotl/form/core` 时完全不需要 React。
- [`@jotl/antd`](../../../antd/zh/README.md) 的范围更窄：React 18 或 19。

## 为什么旧版 React 也能用

- 本包用自带的 JSX 运行时 `@jotl/form/jsx-runtime` 编译 JSX，它直接调用 `React.createElement`。因此不依赖 React 16.14 起才有的 `react/jsx-runtime`，宿主构建也无需为此设置。
- 表单 id 不用 React 18 起才有的 `useId`；未传 `id` 属性的表单实例改取 `jotl-f<n>`。

## 运行兼容测试

在本仓库中，下面的命令依次在 React 16、17、18、19 下运行兼容测试，遇到第一个失败的版本即停止：

```sh
pnpm --filter @jotl/form run test:react-compat
```
