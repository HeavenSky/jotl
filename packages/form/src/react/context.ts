// 表单实例上下文: 各节点共享的仓库, schema 文档, 注册表, 模式与回调; 以及订阅仓库的 hook.
import { createContext, useContext, useLayoutEffect, useReducer, useRef } from 'react';
import type { Diagnostic, JsonPointer, JsonSchema, Locale } from '@jotl/core';
import type { RenderMode } from '../core/index.js';
import type { FormStore } from './form-store.js';
import type { SchemaInfo } from './schema-access.js';
import type { DegradeEvent, ReactAdapters, ReactRegistry } from './types.js';

export interface FormContextValue {
  store: FormStore;
  document: JsonSchema;
  registry: ReactRegistry;
  adapters: ReactAdapters;
  mode: RenderMode;
  scene: string;
  maxDepth: number | undefined;
  formId: string;
  report(event: DegradeEvent): void;
  submit(): void;
  reset(): void;
  /** 新增数组元素, 字典条目, 切换分支时的新值. */
  createValue(info: SchemaInfo): unknown;
  /** 是否钻取渲染; false 时 path 恒为根. */
  drill: boolean;
  /** 不钻取时组合字段是否渲染为可折叠面板. */
  collapsible: boolean;
  /** 钻取渲染的当前页(数据路径), 已按数据收敛. */
  path: JsonPointer;
  /** 进入某一层; 受控时只经 onPathChange 通知. */
  navigate(path: JsonPointer): void;
  /** 订阅提交校验失败(折叠面板据此展开含错误的面板); 返回退订函数. */
  onSubmitFailed(listener: () => void): () => void;
  /** 表单级错误列表的定位: 钻取时切到错误所在页, 再聚焦对应字段. */
  goToError(error: Diagnostic): void;
  /** 界面语言, 取 JotlForm 的 locale, 未给时为创建表单时的全局语言. */
  locale: Locale;
}

export const FormContext = createContext<FormContextValue | null>(null);

export function useFormContext(): FormContextValue {
  const ctx = useContext(FormContext);
  if (ctx === null) throw new Error('Jotl 节点必须渲染在 JotlForm 之内');
  return ctx;
}

/**
 * 订阅外部数据源(兼容 React 16.8, 不用 useSyncExternalStore): 每次渲染按 getSnapshot 取值, 通知时结果变化(Object.is)才重渲染.
 * subscribe 变化时重新订阅; getSnapshot 可以每次渲染都是新函数.
 */
export function useExternalValue<T>(subscribe: (listener: () => void) => () => void, getSnapshot: () => T): T {
  const value = getSnapshot();
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const latest = useRef({ getSnapshot, value });
  latest.current = { getSnapshot, value };
  useLayoutEffect(() => {
    let active = true;
    const check = (): void => {
      // 数据源遍历的是通知前的监听者快照, 已退订的组件仍可能被调用一次.
      if (active && !Object.is(latest.current.getSnapshot(), latest.current.value)) forceRender();
    };
    const unsubscribe = subscribe(check);
    // 渲染到订阅之间的变更没有通知, 订阅后补读一次.
    check();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [subscribe]);
  return value;
}

/** 字段级订阅: selector 的结果不变(Object.is)时不重渲染. */
export function useStoreValue<T>(store: FormStore, selector: () => T): T {
  return useExternalValue(store.subscribe, selector);
}
