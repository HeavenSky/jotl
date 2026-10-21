// 懒加载组件(W7, D35): 按登记项缓存 load() 的结果, 供多个节点与表单实例共享, 失败后可重试(F9).
import { useCallback, useEffect } from "react";
import type { Locale } from "@jotl/core";
import { useLocale } from "../locale-context.js";
import { useExternalValue } from "./context.js";
import type { WidgetRegistration } from "../core/index.js";
import type { ReactWidgetComponent } from "./types.js";

export type LoadState =
  | { status: "static" }
  | { status: "loading" }
  | { status: "loaded"; component: ReactWidgetComponent }
  | { status: "failed"; error: unknown };

interface Entry {
  state: LoadState;
  listeners: Set<() => void>;
  started: boolean;
}

const STATIC: LoadState = { status: "static" };
const entries = new WeakMap<WidgetRegistration<ReactWidgetComponent>, Entry>();

function entryOf(registration: WidgetRegistration<ReactWidgetComponent>): Entry {
  let entry = entries.get(registration);
  if (entry === undefined) {
    entry = { state: { status: "loading" }, listeners: new Set(), started: false };
    entries.set(registration, entry);
  }
  return entry;
}

function settle(entry: Entry, state: LoadState): void {
  entry.state = state;
  for (const listener of [...entry.listeners]) listener();
}

function start(registration: WidgetRegistration<ReactWidgetComponent>, entry: Entry, locale: Locale): void {
  const load = registration.load;
  if (load === undefined || entry.started) return;
  entry.started = true;
  if (entry.state.status !== "loading") settle(entry, { status: "loading" });
  let pending: Promise<ReactWidgetComponent>;
  try {
    pending = load({ locale });
  } catch (error) {
    settle(entry, { status: "failed", error });
    return;
  }
  pending.then(
    (component) => settle(entry, { status: "loaded", component }),
    (error: unknown) => settle(entry, { status: "failed", error }),
  );
}

const noop = () => () => {};

export interface LoadedComponent {
  state: LoadState;
  retry(): void;
}

/** 没有 load 的登记项为 static; 有 load 时首次挂载后开始加载. */
export function useLoadedComponent(registration: WidgetRegistration<ReactWidgetComponent> | undefined): LoadedComponent {
  const lazy = registration?.load !== undefined ? registration : undefined;
  const locale = useLocale();
  const subscribe = useCallback(
    (listener: () => void) => {
      if (lazy === undefined) return () => {};
      const entry = entryOf(lazy);
      entry.listeners.add(listener);
      return () => entry.listeners.delete(listener);
    },
    [lazy],
  );
  const state = useExternalValue(lazy === undefined ? noop : subscribe, () => (lazy === undefined ? STATIC : entryOf(lazy).state));
  useEffect(() => {
    if (lazy !== undefined) start(lazy, entryOf(lazy), locale);
  }, [lazy, locale]);
  const retry = useCallback(() => {
    if (lazy === undefined) return;
    const entry = entryOf(lazy);
    entry.started = false;
    start(lazy, entry, locale);
  }, [lazy, locale]);
  return { state, retry };
}
