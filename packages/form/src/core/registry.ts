// 组件注册表(W1 W6): 按名字登记, 实例级注册表未找到时回落父级.
import type { Registry, WidgetRegistration } from './contracts.js';

class WidgetRegistry<C> implements Registry<C> {
  readonly #own = new Map<string, WidgetRegistration<C>>();
  readonly #parent: Registry<C> | undefined;

  constructor(parent?: Registry<C>) {
    this.#parent = parent;
  }

  register(registration: WidgetRegistration<C>): void {
    this.#own.set(registration.name, registration);
  }

  get(name: string): WidgetRegistration<C> | undefined {
    return this.#own.get(name) ?? this.#parent?.get(name);
  }

  extend(): Registry<C> {
    return new WidgetRegistry(this);
  }

  /** 本级登记在前(按登记顺序), 其后是父级中未被本级同名项覆盖的登记; 匹配器分值相同时排在前面的胜出. */
  list(): WidgetRegistration<C>[] {
    const inherited = (this.#parent?.list() ?? []).filter(r => !this.#own.has(r.name));
    return [...this.#own.values(), ...inherited];
  }
}

/** 创建注册表; 传入 parent 时等同于 parent.extend(). */
export function createRegistry<C = unknown>(
  registrations: readonly WidgetRegistration<C>[] = [],
  parent?: Registry<C>
): Registry<C> {
  const registry = new WidgetRegistry<C>(parent);
  for (const registration of registrations) registry.register(registration);
  return registry;
}
