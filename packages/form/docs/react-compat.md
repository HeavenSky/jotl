# React version compatibility

**English** · [简体中文](../zh/docs/react-compat.md)

`@jotl/form` works with React 16.8, 17, 18 and 19 without any configuration in your app. This page explains the version range and how it is tested.

## Supported range

```sh
pnpm add @jotl/form react react-dom
```

- `react` is an optional peer dependency with the range `^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0`.
- Using only `@jotl/form/core` needs no React at all.
- [`@jotl/antd`](../../antd/README.md) has a narrower range: React 18 or 19.

## Why older React works

- The package compiles its JSX with its own runtime `@jotl/form/jsx-runtime`, which calls plain `React.createElement`. It does not need `react/jsx-runtime`, which only exists from React 16.14, and your build needs no setting for it.
- Form ids do not use `useId`, which only exists from React 18; each form instance without an `id` prop gets `jotl-f<n>` instead.

## Run the compatibility tests

In this repository, the following command runs the compatibility tests against React 16, 17, 18 and 19 in turn and stops at the first failing version:

```sh
pnpm --filter @jotl/form run test:react-compat
```
