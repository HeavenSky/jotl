// 把宿主的 React 与 JSX 运行时挂到 globalThis, 供 public/shims 下的 ESM 垫片导出; 远程扩展组件模块经 import map 拿到同一份 React, hooks 才能工作.
import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";

const host = globalThis as { __JOTL_REACT__?: unknown; __JOTL_JSX__?: unknown };
host.__JOTL_REACT__ = React;
host.__JOTL_JSX__ = JsxRuntime;
