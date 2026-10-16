// 表单状态仓库: 根数据的不可变更新与字段级订阅, 数组与字典条目的稳定 key, 联合分支的选择与缓存, 触碰记录, 校验与错误分发.
import { formatPointer, tryParsePointer, type Diagnostic, type JsonPointer } from "@jotl/core";

export type ValidateTrigger = "change" | "blur" | "submit";

export interface ValidationResult {
  valid: boolean;
  errors: Diagnostic[];
}

/** 已挂载的节点; 错误按数据路径分发给负责该路径的节点. */
export interface OwnerInfo {
  path: JsonPointer;
  /** 嵌套层数; 同一路径上有多个节点(联合与其分支内容)时取最深的可显示节点. */
  depth: number;
  /** 节点能把错误显示出来(有外壳, 或组件自带错误显示). */
  displays: boolean;
  /** 节点接管整个子树(json, 自定义复合组件, 树): 子路径上没有节点负责的错误归它. */
  takeover: boolean;
  /** 联合节点把 "不符合任何一种可选结构" 细化为当前分支内的错误. */
  refine?: { current: ((diagnostic: Diagnostic) => Diagnostic[] | undefined) | undefined };
}

export interface StoreOptions {
  initial: unknown;
  validate: (value: unknown) => ValidationResult;
  validateOn: ValidateTrigger;
}

const EMPTY: Diagnostic[] = [];
const INDEX = /^(0|[1-9]\d*)$/;

export function pointerOf(diagnostic: Diagnostic): JsonPointer {
  return diagnostic.location?.kind === "pointer" ? diagnostic.location.pointer : "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 键来自用户数据: 直接赋值 obj["__proto__"] 会改原型而不是写字段. */
function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

function copyObject(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) setOwn(out, key, value);
  return out;
}

/** 沿路径不可变地写入; 值为 undefined 时删除对象字段; 路径上缺少的容器按下一片段是否为下标补数组或对象. */
function setIn(root: unknown, tokens: readonly string[], value: unknown): unknown {
  if (tokens.length === 0) return value;
  const [head, ...rest] = tokens as [string, ...string[]];
  const container = Array.isArray(root) || isPlainObject(root) ? root : INDEX.test(head) ? [] : {};
  const child = Array.isArray(container) ? container[Number(head)] : (container as Record<string, unknown>)[head];
  const next = setIn(Object.hasOwn(container, head) ? child : undefined, rest, value);
  if (Array.isArray(container)) {
    if (!INDEX.test(head)) return container;
    const copy = [...container];
    copy[Number(head)] = next;
    return copy;
  }
  const copy = copyObject(container);
  if (next === undefined && rest.length === 0) delete copy[head];
  else setOwn(copy, head, next);
  return copy;
}

function sameDiagnostics(a: readonly Diagnostic[], b: readonly Diagnostic[]): boolean {
  return a.length === b.length && a.every((d, i) => d.code === b[i]!.code && d.message === b[i]!.message && pointerOf(d) === pointerOf(b[i]!));
}

/** 祖先路径, 由近及远, 含根 "". */
function ancestors(path: JsonPointer): JsonPointer[] {
  const tokens = tryParsePointer(path) ?? [];
  const out: JsonPointer[] = [];
  for (let k = tokens.length - 1; k >= 0; k--) out.push(formatPointer(tokens.slice(0, k)));
  return out;
}

/** 把以 arrayPath 下标开头的路径按 mapIndex 改写; mapIndex 返回 undefined 表示该元素已删除. */
function remapPath(path: JsonPointer, arrayPath: JsonPointer, mapIndex: (index: number) => number | undefined): JsonPointer | null {
  const prefix = `${arrayPath}/`;
  if (!path.startsWith(prefix)) return path;
  const rest = path.slice(prefix.length);
  const slash = rest.indexOf("/");
  const token = slash === -1 ? rest : rest.slice(0, slash);
  if (!INDEX.test(token)) return path;
  const next = mapIndex(Number(token));
  if (next === undefined) return null;
  return `${prefix}${next}${slash === -1 ? "" : rest.slice(slash)}`;
}

function remapMap<V>(map: Map<JsonPointer, V>, arrayPath: JsonPointer, mapIndex: (index: number) => number | undefined): Map<JsonPointer, V> {
  const out = new Map<JsonPointer, V>();
  for (const [path, value] of map) {
    const next = remapPath(path, arrayPath, mapIndex);
    if (next !== null) out.set(next, value);
  }
  return out;
}

export class FormStore {
  #value: unknown;
  #initial: unknown;
  #options: StoreOptions;
  #listeners = new Set<() => void>();
  #tokenCache = new Map<JsonPointer, string[] | undefined>();
  #nextKey = 0;
  #itemKeys = new Map<JsonPointer, string[]>();
  #entryKeys = new Map<JsonPointer, Map<string, string>>();
  #selections = new Map<JsonPointer, number>();
  #branchCache = new Map<JsonPointer, Map<number | "content", unknown>>();
  #expanded = new Map<JsonPointer, boolean>();
  #touched = new Map<JsonPointer, true>();
  #revealAll = false;
  #validated = false;
  #errors: Diagnostic[] = EMPTY;
  #owners = new Map<string, OwnerInfo>();
  #ownerErrors = new Map<string, Diagnostic[]>();
  #formErrors: Diagnostic[] = EMPTY;
  /** 值由表单内部改动时调用(不含外部写入). */
  onChange: ((value: unknown) => void) | undefined;
  onValidate: ((result: ValidationResult) => void) | undefined;

  constructor(options: StoreOptions) {
    this.#options = options;
    this.#value = options.initial;
    this.#initial = options.initial;
  }

  configure(options: Omit<StoreOptions, "initial">): void {
    this.#options = { ...this.#options, ...options };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  #notify(): void {
    for (const listener of [...this.#listeners]) listener();
  }

  #tokens(path: JsonPointer): string[] | undefined {
    if (!this.#tokenCache.has(path)) this.#tokenCache.set(path, tryParsePointer(path));
    return this.#tokenCache.get(path);
  }

  get value(): unknown {
    return this.#value;
  }

  get initial(): unknown {
    return this.#initial;
  }

  /** 路径不存在时为 undefined. */
  getAt(path: JsonPointer): unknown {
    const tokens = this.#tokens(path);
    if (tokens === undefined) return undefined;
    let current = this.#value;
    for (const token of tokens) {
      if (Array.isArray(current)) {
        if (!INDEX.test(token)) return undefined;
        current = current[Number(token)];
      } else if (isPlainObject(current) && Object.hasOwn(current, token)) {
        current = current[token];
      } else {
        return undefined;
      }
    }
    return current;
  }


  #commit(next: unknown, touched: JsonPointer | undefined): void {
    this.#value = next;
    if (touched !== undefined) this.#touch(touched);
    if (this.#options.validateOn === "change" || this.#validated) this.#runValidation();
    else if (touched !== undefined) this.#distribute();
    this.#notify();
    this.onChange?.(next);
  }

  /** 表单内部改动: 记为已触碰, 按校验时机校验, 通知 onChange. */
  change(path: JsonPointer, value: unknown): void {
    const tokens = this.#tokens(path);
    if (tokens === undefined) return;
    this.#commit(setIn(this.#value, tokens, value), path);
  }

  /** 外部写入(受控值变化, setValues): 不触发 onChange, 清除分支选择. */
  replace(value: unknown): void {
    if (value === this.#value) return;
    this.#value = value;
    this.#selections.clear();
    if (this.#validated) this.#runValidation();
    this.#notify();
  }

  /** 实例 API 的 setValues: 同 replace, 并通知 onChange. */
  setValues(value: unknown): void {
    this.replace(value);
    this.onChange?.(value);
  }

  reset(initial: unknown = this.#initial): void {
    this.#resetState(initial);
    this.#notify();
    this.onChange?.(initial);
  }

  /** schema 变化后换一份初始数据: 同 reset 并清掉条目 key 与展开状态, 但不通知订阅者与 onChange(在渲染期调用), 提交后再调 refresh(). */
  reinitialize(initial: unknown): void {
    this.#itemKeys.clear();
    this.#entryKeys.clear();
    this.#expanded.clear();
    this.#resetState(initial);
  }

  /** 通知订阅者按当前状态重读. */
  refresh(): void {
    this.#notify();
  }

  #resetState(initial: unknown): void {
    this.#initial = initial;
    this.#value = initial;
    this.#selections.clear();
    this.#branchCache.clear();
    this.#touched.clear();
    this.#revealAll = false;
    this.#validated = false;
    this.#errors = EMPTY;
    this.#distribute();
  }


  #remapAll(arrayPath: JsonPointer, mapIndex: (index: number) => number | undefined): void {
    this.#itemKeys = remapMap(this.#itemKeys, arrayPath, mapIndex);
    this.#entryKeys = remapMap(this.#entryKeys, arrayPath, mapIndex);
    this.#selections = remapMap(this.#selections, arrayPath, mapIndex);
    this.#branchCache = remapMap(this.#branchCache, arrayPath, mapIndex);
    this.#expanded = remapMap(this.#expanded, arrayPath, mapIndex);
    this.#touched = remapMap(this.#touched, arrayPath, mapIndex);
  }

  #array(path: JsonPointer): unknown[] {
    const current = this.getAt(path);
    return Array.isArray(current) ? current : [];
  }

  #newKey(): string {
    return `k${this.#nextKey++}`;
  }

  /** 元素的稳定 key, 随增删排序移动, 不随下标变化. */
  itemKeys(path: JsonPointer): string[] {
    const length = this.#array(path).length;
    const existing = this.#itemKeys.get(path);
    if (existing !== undefined && existing.length === length) return existing;
    const keys = (existing ?? []).slice(0, length);
    while (keys.length < length) keys.push(this.#newKey());
    this.#itemKeys.set(path, keys);
    return keys;
  }

  insertItem(path: JsonPointer, index: number, item: unknown): void {
    const items = this.#array(path);
    const at = Math.max(0, Math.min(index, items.length));
    const keys = [...this.itemKeys(path)];
    this.#remapAll(path, (i) => (i >= at ? i + 1 : i));
    keys.splice(at, 0, this.#newKey());
    this.#itemKeys.set(path, keys);
    const next = [...items];
    next.splice(at, 0, item);
    this.#commit(setIn(this.#value, this.#tokens(path) ?? [], next), path);
  }

  removeItem(path: JsonPointer, index: number): void {
    const items = this.#array(path);
    if (index < 0 || index >= items.length) return;
    const keys = [...this.itemKeys(path)];
    this.#remapAll(path, (i) => (i === index ? undefined : i > index ? i - 1 : i));
    keys.splice(index, 1);
    this.#itemKeys.set(path, keys);
    const next = items.filter((_, i) => i !== index);
    this.#commit(setIn(this.#value, this.#tokens(path) ?? [], next), path);
  }

  moveItem(path: JsonPointer, from: number, to: number): void {
    const items = this.#array(path);
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const order = items.map((_, i) => i);
    order.splice(to, 0, order.splice(from, 1)[0]!);
    const newIndexOf = new Map(order.map((oldIndex, newIndex) => [oldIndex, newIndex]));
    const keys = this.itemKeys(path);
    this.#remapAll(path, (i) => newIndexOf.get(i));
    this.#itemKeys.set(path, order.map((i) => keys[i]!));
    const next = order.map((i) => items[i]);
    this.#commit(setIn(this.#value, this.#tokens(path) ?? [], next), path);
  }


  /** 字典条目的稳定 key; 改名时沿用原 key. */
  entryKey(path: JsonPointer, name: string): string {
    let keys = this.#entryKeys.get(path);
    if (keys === undefined) {
      keys = new Map();
      this.#entryKeys.set(path, keys);
    }
    let key = keys.get(name);
    if (key === undefined) {
      key = this.#newKey();
      keys.set(name, key);
    }
    return key;
  }

  setEntries(path: JsonPointer, next: Record<string, unknown>, rename?: { from: string; to: string }): void {
    if (rename !== undefined) {
      const keys = this.#entryKeys.get(path);
      const key = keys?.get(rename.from);
      if (keys !== undefined && key !== undefined) {
        keys.delete(rename.from);
        keys.set(rename.to, key);
      }
    }
    this.#commit(setIn(this.#value, this.#tokens(path) ?? [], next), path);
  }


  selection(path: JsonPointer): number | undefined {
    return this.#selections.get(path);
  }

  /** D45: 记下离开的分支的值, 切到目标分支; 目标分支有缓存时恢复缓存值. */
  switchBranch(path: JsonPointer, from: number, to: number, createValue: () => unknown): void {
    let cache = this.#branchCache.get(path);
    if (cache === undefined) {
      cache = new Map();
      this.#branchCache.set(path, cache);
    }
    cache.set(from, this.getAt(path));
    const next = cache.has(to) ? cache.get(to) : createValue();
    this.#selections.set(path, to);
    this.change(path, next);
  }

  /** 可空节点置空前记下当前值, 取消置空时恢复. */
  setNull(path: JsonPointer, isNull: boolean, createValue: () => unknown): void {
    let cache = this.#branchCache.get(path);
    if (cache === undefined) {
      cache = new Map();
      this.#branchCache.set(path, cache);
    }
    if (isNull) {
      const current = this.getAt(path);
      if (current !== null && current !== undefined) cache.set("content", current);
      this.change(path, null);
    } else {
      this.change(path, cache.has("content") ? cache.get("content") : createValue());
    }
  }

  expanded(path: JsonPointer): boolean {
    return this.#expanded.get(path) ?? false;
  }

  setExpanded(path: JsonPointer, expanded: boolean): void {
    if (this.expanded(path) === expanded) return;
    this.#expanded.set(path, expanded);
    this.#notify();
  }


  #touch(path: JsonPointer): void {
    if (this.#touched.has(path)) return;
    this.#touched.set(path, true);
  }

  blur(path: JsonPointer): void {
    const wasTouched = this.#touched.has(path);
    this.#touch(path);
    if (this.#options.validateOn !== "submit" || this.#validated) {
      this.#runValidation();
      this.#notify();
    } else if (!wasTouched) {
      this.#distribute();
    }
  }


  #runValidation(): ValidationResult {
    const result = this.#options.validate(this.#value);
    this.#validated = true;
    this.#errors = result.errors;
    this.#distribute();
    this.onValidate?.(result);
    return result;
  }

  /** 校验整个表单并显示全部错误. */
  validate(): ValidationResult {
    this.#revealAll = true;
    const result = this.#runValidation();
    this.#notify();
    return result;
  }

  registerOwner(id: string, info: OwnerInfo): void {
    this.#owners.set(id, info);
    if (this.#errors.length > 0) this.#distributeAndNotify();
  }

  unregisterOwner(id: string): void {
    if (!this.#owners.delete(id)) return;
    if (this.#errors.length > 0 || this.#ownerErrors.has(id)) this.#distributeAndNotify();
  }

  errorsOf(ownerId: string): Diagnostic[] {
    return this.#ownerErrors.get(ownerId) ?? EMPTY;
  }

  /** 已分给各节点显示的错误中, 位于 path 及其子路径上的条数. */
  errorCountUnder(path: JsonPointer): number {
    const prefix = `${path}/`;
    let count = 0;
    for (const list of this.#ownerErrors.values()) {
      for (const d of list) {
        const pointer = pointerOf(d);
        if (pointer === path || pointer.startsWith(prefix)) count++;
      }
    }
    return count;
  }

  get formErrors(): Diagnostic[] {
    return this.#formErrors;
  }

  #distributeAndNotify(): void {
    if (this.#distribute()) this.#notify();
  }

  /**
   * 提交前只显示已触碰字段的错误(联合错误按细化后的路径判断): 路径本身已触碰, 或位于已触碰且接管子树的节点之下;
   * 祖先对象与数组, 兄弟字段, 新增条目内的错误等到提交后才显示.
   * 每条可见错误交给负责其路径的节点: 同路径上最深的可显示节点, 否则最近的接管子树的祖先, 否则表单级列表; 负责节点不能显示时同时进表单级列表.
   */
  #distribute(): boolean {
    const byPath = new Map<JsonPointer, [string, OwnerInfo][]>();
    for (const entry of this.#owners) {
      const list = byPath.get(entry[1].path);
      if (list === undefined) byPath.set(entry[1].path, [entry]);
      else list.push(entry);
    }
    const next = new Map<string, Diagnostic[]>();
    const form: Diagnostic[] = [];
    const deepest = (list: [string, OwnerInfo][]): [string, OwnerInfo] | undefined =>
      list.reduce<[string, OwnerInfo] | undefined>((best, entry) => (best === undefined || entry[1].depth > best[1].depth ? entry : best), undefined);
    const revealed = (path: JsonPointer): boolean =>
      this.#revealAll || this.#touched.has(path)
      || ancestors(path).some((a) => this.#touched.has(a) && (byPath.get(a) ?? []).some(([, info]) => info.takeover));
    const assign = (diagnostic: Diagnostic, refineDepth: number): void => {
      const path = pointerOf(diagnostic);
      const exact = byPath.get(path) ?? [];
      if (refineDepth < 4) {
        for (const [, info] of exact) {
          const refined = info.refine?.current?.(diagnostic);
          if (refined !== undefined && refined.length > 0) {
            for (const d of refined) assign(d, refineDepth + 1);
            return;
          }
        }
      }
      if (!revealed(path)) return;
      let owner = deepest(exact.filter(([, info]) => info.displays)) ?? deepest(exact);
      if (owner === undefined) {
        for (const ancestor of ancestors(path)) {
          owner = deepest((byPath.get(ancestor) ?? []).filter(([, info]) => info.takeover));
          if (owner !== undefined) break;
        }
      }
      if (owner === undefined) {
        form.push(diagnostic);
        return;
      }
      const list = next.get(owner[0]);
      if (list === undefined) next.set(owner[0], [diagnostic]);
      else list.push(diagnostic);
      if (!owner[1].displays) form.push(diagnostic);
    };
    for (const diagnostic of this.#errors) assign(diagnostic, 0);

    let changed = false;
    const merged = new Map<string, Diagnostic[]>();
    for (const [id, list] of next) {
      const previous = this.#ownerErrors.get(id);
      if (previous !== undefined && sameDiagnostics(previous, list)) merged.set(id, previous);
      else {
        merged.set(id, list);
        changed = true;
      }
    }
    for (const id of this.#ownerErrors.keys()) if (!merged.has(id)) changed = true;
    this.#ownerErrors = merged;
    if (!sameDiagnostics(this.#formErrors, form)) {
      this.#formErrors = form.length === 0 ? EMPTY : form;
      changed = true;
    }
    return changed;
  }
}
