// 各类节点的属性组装: 按组件种类订阅所需的最小状态, 生成 core/ 各层 props 并渲染组件.
import { Fragment, useCallback, useLayoutEffect, useMemo, type ReactNode } from "react";
import { appendPointer, escapePointerToken, lastPointerToken, type Diagnostic, type JsonPointer } from "@jotl/core";
import { DATA_TEXT, DATA_TEXT_EN, validate } from "@jotl/data";
import { evaluateCondition, jsonEqual, requiredKeys, resolvePlanNode, type BaseProps, type EntryEditing, type LayoutField, type RenderPlanNode } from "../core/index.js";
import type { TupleRest } from "../core/contracts.js";
import { contentTarget, effectiveNode, isContentContainer, propertyNames, resolveChild, type NodeTarget } from "./child-resolver.js";
import { useFormContext, useStoreValue, type FormContextValue } from "./context.js";
import { copyOf } from "./diagnostics.js";
import { crumbLabel, crumbTargets, dataRootTarget } from "./drill.js";
import { pointerOf, type OwnerInfo } from "./form-store.js";
import { containerKind, literalOf, refName } from "./schema-access.js";
import type { ReactWidgetComponent } from "./types.js";
import { styles } from "./styles.js";

export type HostKind = "view" | "field" | "object" | "array" | "tuple" | "union" | "nullable" | "map" | "tree" | "custom" | "split";

export interface HostProps {
  component: ReactWidgetComponent;
  target: NodeTarget;
  base: BaseProps<ReactNode>;
  errors: Diagnostic[];
  refine: NonNullable<OwnerInfo["refine"]>;
  renderTarget(target: NodeTarget): ReactNode;
}

const NO_KEYS: string[] = [];
const UNION_COLLAPSED = new Set(["JOTL4012", "JOTL4015"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberKeyword(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function useFieldBinding(ctx: FormContextValue, path: JsonPointer, enabled: boolean) {
  const { store } = ctx;
  const value = useStoreValue(store, () => (enabled ? store.getAt(path) : undefined));
  const onChange = useCallback(
    (next: unknown) => {
      if (ctx.mode === "edit") store.change(path, next);
    },
    [ctx.mode, store, path],
  );
  const onBlur = useCallback(() => store.blur(path), [store, path]);
  return { value, onChange, onBlur };
}

/** 联合第 index 个分支的新值: 按该分支的默认值, 可区分联合再写入该分支的区分字段. */
function branchValue(ctx: FormContextValue, node: RenderPlanNode, index: number): unknown {
  const info = resolvePlanNode(node.children[index]!, ctx.document);
  const value = ctx.createValue(info);
  const literal = node.discriminator === undefined ? undefined : literalOf(ctx.document, info, node.discriminator);
  if (literal === undefined || (value !== undefined && !isPlainObject(value))) return value;
  return { ...(value as Record<string, unknown> | undefined), [node.discriminator!]: literal.value };
}

/** 新增元素或条目的值; 可区分联合取第一个分支(界面默认显示的分支)并写入其区分字段. */
function newItemValue(ctx: FormContextValue, item: NodeTarget): unknown {
  const node = effectiveNode(ctx, item.node);
  if (node.discriminator !== undefined && isContentContainer(node)) return branchValue(ctx, node, 0) ?? null;
  return ctx.createValue(item.info) ?? null;
}

function useArrayBinding(ctx: FormContextValue, target: NodeTarget, enabled: boolean) {
  const { store, mode } = ctx;
  const { path, info } = target;
  const keys = useStoreValue(store, () => (enabled ? store.itemKeys(path) : NO_KEYS));
  const items = useMemo(() => keys.map((key, i) => ({ key, dataPath: appendPointer(path, i) })), [keys, path]);
  const min = numberKeyword(info.effective.minItems) ?? 0;
  const max = numberKeyword(info.effective.maxItems);
  const editable = mode === "edit";
  const canAdd = editable && (max === undefined || keys.length < max);
  const canRemove = editable && keys.length > min;
  const add = useCallback(
    (index?: number) => {
      if (!canAdd) return;
      const at = index ?? keys.length;
      const item = resolveChild(ctx, target, String(at));
      store.insertItem(path, at, newItemValue(ctx, item));
    },
    [canAdd, ctx, keys.length, path, store, target],
  );
  const remove = useCallback((index: number) => canRemove && store.removeItem(path, index), [canRemove, path, store]);
  const move = useCallback((from: number, to: number) => editable && store.moveItem(path, from, to), [editable, path, store]);
  const duplicate = useCallback(
    (index: number) => {
      const items = store.getAt(path);
      if (!canAdd || !Array.isArray(items) || index < 0 || index >= items.length) return;
      store.insertItem(path, index + 1, structuredClone(items[index]));
    },
    [canAdd, path, store],
  );
  return { items, canAdd, canRemove, add, remove: remove as (index: number) => void, move: move as (from: number, to: number) => void, duplicate };
}

/** 对象中其余键(additionalProperties)的值模板. */
function isAdditionalTemplate(node: RenderPlanNode, child: RenderPlanNode): boolean {
  return child.dataPath === appendPointer(node.dataPath, "*") && child.schemaPointer.endsWith("/additionalProperties");
}

/** 对象子字段: 模板树中与本节点数据路径不同的子节点, 不含其余键的值模板. */
function objectChildren(node: RenderPlanNode): { key: string; child: RenderPlanNode }[] {
  return node.children
    .filter((child) => child.dataPath !== node.dataPath && !isAdditionalTemplate(node, child))
    .map((child) => ({ key: lastPointerToken(child.dataPath) ?? "", child }));
}

function childHidden(child: RenderPlanNode, path: JsonPointer, data: unknown): boolean {
  return child.hidden || (child.visibleIf !== undefined && !evaluateCondition(child.visibleIf, data, path));
}

function useLayoutBinding(ctx: FormContextValue, target: NodeTarget, enabled: boolean) {
  const { store } = ctx;
  const { node, path, info } = target;
  const children = useMemo(() => (enabled ? objectChildren(node) : []), [enabled, node]);
  const hiddenFlags = useStoreValue(store, () => children.map(({ key, child }) => (childHidden(child, appendPointer(path, key), store.value) ? "1" : "0")).join(""));
  const countsKey = useStoreValue(store, () => children.map(({ key }) => store.errorCountUnder(appendPointer(path, key))).join(","));
  const fields = useMemo<LayoutField[]>(() => {
    const required = requiredKeys(info.effective);
    const counts = countsKey.split(",");
    return children.map(({ key }, i) => ({ key, required: required.has(key), hidden: hiddenFlags[i] === "1", errorCount: Number(counts[i] ?? 0) }));
  }, [children, countsKey, hiddenFlags, info]);
  return { fields, groups: node.groups ?? [], layout: node.layout ?? "stack", columns: node.columns ?? 2 };
}

const NO_NAMES: ReadonlySet<string> = new Set();

/** 键值条目的编辑: 字典的全部键, 或对象中 excluded(已声明属性)以外的键; 数量限制按对象的全部键计. */
function useEntryEditing(ctx: FormContextValue, target: NodeTarget, enabled: boolean, excluded: ReadonlySet<string>): EntryEditing {
  const { store, mode } = ctx;
  const { path, info } = target;
  const namesKey = useStoreValue(store, () => {
    const value = enabled ? store.getAt(path) : undefined;
    return JSON.stringify(isPlainObject(value) ? Object.keys(value) : []);
  });
  const all = useMemo(() => JSON.parse(namesKey) as string[], [namesKey]);
  const names = useMemo(() => all.filter((name) => !excluded.has(name)), [all, excluded]);
  const entries = useMemo(() => names.map((name) => ({ key: store.entryKey(path, name), name, dataPath: appendPointer(path, name) })), [names, path, store]);
  const min = numberKeyword(info.effective.minProperties) ?? 0;
  const max = numberKeyword(info.effective.maxProperties);
  const editable = mode === "edit";
  const canAdd = editable && (max === undefined || all.length < max);
  const canRemove = editable && all.length > min;
  const current = (): Record<string, unknown> => {
    const value = store.getAt(path);
    return isPlainObject(value) ? value : {};
  };
  const rebuild = (pairs: [string, unknown][]): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [name, value] of pairs) Object.defineProperty(out, name, { value, enumerable: true, writable: true, configurable: true });
    return out;
  };
  const addEntry = (name: string) => {
    const value = current();
    if (!canAdd || Object.hasOwn(value, name) || excluded.has(name)) return;
    const child = resolveChild(ctx, target, escapePointerToken(name));
    store.setEntries(path, rebuild([...Object.entries(value), [name, newItemValue(ctx, child)]]));
  };
  const removeEntry = (name: string) => {
    const value = current();
    if (!canRemove || !Object.hasOwn(value, name) || excluded.has(name)) return;
    store.setEntries(path, rebuild(Object.entries(value).filter(([key]) => key !== name)));
  };
  const renameEntry = (from: string, to: string) => {
    const value = current();
    if (!editable || from === to || !Object.hasOwn(value, from) || Object.hasOwn(value, to) || excluded.has(from) || excluded.has(to)) return;
    store.setEntries(path, rebuild(Object.entries(value).map(([key, v]) => [key === from ? to : key, v])), { from, to });
  };
  return { entries, canAdd, canRemove, addEntry, removeEntry, renameEntry };
}

export function FieldHost({ component: C, target, base, errors }: HostProps) {
  const ctx = useFormContext();
  const binding = useFieldBinding(ctx, target.path, true);
  const thousands = target.node.thousands;
  return <C {...base} required={target.required} errors={errors} {...binding} {...(thousands === undefined ? {} : { thousands })} />;
}

export function ObjectHost({ component: C, target, base }: HostProps) {
  const ctx = useFormContext();
  const layout = useLayoutBinding(ctx, target, true);
  const hasAdditional = target.node.children.some((child) => isAdditionalTemplate(target.node, child));
  const declared = useMemo(() => new Set(propertyNames(target.info.effective)), [target.info]);
  const additional = useEntryEditing(ctx, target, hasAdditional, declared);
  return <C {...base} {...layout} {...(hasAdditional ? { additional } : {})} />;
}

/** 元组: prefixItems 各位置(模板树中的子节点, 不含剩余元素模板)的实际路径; items 允许剩余元素时另给出剩余元素的增删, 排序与复制, 排序不越过各位置. */
export function TupleHost({ component: C, target, base, errors }: HostProps) {
  const ctx = useFormContext();
  const items = useMemo(
    () => objectChildren(target.node).filter(({ key }) => key !== "*").map(({ key }) => ({ dataPath: appendPointer(target.path, key) })),
    [target.node, target.path],
  );
  const schema = target.info.effective;
  const hasRest = schema.items === true || isPlainObject(schema.items);
  const prefixLength = Array.isArray(schema.prefixItems) ? schema.prefixItems.length : 0;
  const array = useArrayBinding(ctx, target, hasRest);
  const { add, remove, move, duplicate } = array;
  const filled = array.items.length >= prefixLength;
  const canAdd = array.canAdd && filled;
  const canRemove = array.canRemove && array.items.length > prefixLength;
  const restItems = useMemo(
    () => array.items.slice(prefixLength).map((item, j) => ({ key: item.key, index: prefixLength + j, dataPath: item.dataPath })),
    [array.items, prefixLength],
  );
  const rest = useMemo<TupleRest | undefined>(
    () =>
      hasRest
        ? {
            items: restItems,
            canAdd,
            canRemove,
            add: () => {
              if (canAdd) add();
            },
            remove: (index: number) => {
              if (canRemove && index >= prefixLength) remove(index);
            },
            move: (from: number, to: number) => {
              if (from >= prefixLength && to >= prefixLength) move(from, to);
            },
            duplicate: (index: number) => {
              if (canAdd && index >= prefixLength) duplicate(index);
            },
          }
        : undefined,
    [add, canAdd, canRemove, duplicate, hasRest, move, prefixLength, remove, restItems],
  );
  return <C {...base} items={items} {...(rest === undefined ? {} : { rest })} errors={errors} />;
}

export function ArrayHost({ component: C, target, base, errors }: HostProps) {
  const ctx = useFormContext();
  const array = useArrayBinding(ctx, target, true);
  return <C {...base} {...array} errors={errors} />;
}

function branchTitle(ctx: FormContextValue, node: RenderPlanNode, index: number): string {
  const child = node.children[index]!;
  const info = resolvePlanNode(child, ctx.document);
  if (typeof info.effective.title === "string" && info.effective.title !== "") return info.effective.title;
  const name = child.schemaPointer === node.schemaPointer ? undefined : refName(ctx.document, child.schemaPointer);
  if (name !== undefined) return name;
  if (node.discriminator !== undefined) {
    const literal = literalOf(ctx.document, info, node.discriminator);
    if (literal !== undefined) return typeof literal.value === "string" ? literal.value : JSON.stringify(literal.value);
  }
  const type = info.effective.type;
  const COPY = copyOf(ctx.locale);
  return typeof type === "string" ? (COPY.typeTitles[type] ?? type) : COPY.branchTitle(index);
}

export function UnionHost({ component: C, target, base, errors, refine, renderTarget }: HostProps) {
  const ctx = useFormContext();
  const { store } = ctx;
  const { node, path } = target;
  const active = useStoreValue(store, () => contentIndex(ctx, target));
  const branches = useMemo(() => node.children.map((_, i) => ({ title: branchTitle(ctx, node, i) })), [ctx, node]);
  const content = useMemo(() => contentTarget(ctx, target, active), [ctx, target, active]);
  const selectBranch = useCallback(
    (index: number) => {
      if (ctx.mode !== "edit" || index === active || index < 0 || index >= node.children.length) return;
      store.switchBranch(path, active, index, () => branchValue(ctx, node, index));
    },
    [active, ctx, node, path, store],
  );
  useLayoutEffect(() => {
    refine.current = (diagnostic) => {
      if (!UNION_COLLAPSED.has(diagnostic.code) || pointerOf(diagnostic) !== path || content === undefined) return undefined;
      // 区分字段的值不属于任何分支时, 按猜测的分支细化会给出误导的错误; 保留联合层的错误.
      if (node.discriminator !== undefined && !matchesDiscriminator(ctx, target, store.getAt(path))) return undefined;
      const result = validate(ctx.document, store.getAt(path), { at: content.info.effective, locale: ctx.locale });
      const nested = result.diagnostics.filter((d) => d.severity === "error" && pointerOf(d) !== "");
      // 分支单独校验时分支根的标签是 @jotl/data 的根标签(如 "数据 的第 1 项"), 换成联合字段的标签, 没有时用分支标题.
      const label = titleOf(target.info.effective) ?? target.labelKey ?? titleOf(content.info.effective);
      const rootPrefix = `${(ctx.locale === "en" ? DATA_TEXT_EN : DATA_TEXT).rootLabel} `;
      return nested.map((d) => ({
        ...d,
        message: label !== undefined && d.message.startsWith(rootPrefix) ? `${label} ${d.message.slice(rootPrefix.length)}` : d.message,
        location: { kind: "pointer" as const, pointer: path + pointerOf(d) },
      }));
    };
    return () => {
      refine.current = undefined;
    };
  }, [content, ctx, node, path, refine, store, target]);
  const renderContent = useCallback(() => (content === undefined ? null : renderTarget(content)), [content, renderTarget]);
  return <C {...base} branches={branches} activeBranch={active} selectBranch={selectBranch} renderContent={renderContent} errors={errors} />;
}

function titleOf(schema: { title?: unknown }): string | undefined {
  return typeof schema.title === "string" && schema.title !== "" ? schema.title : undefined;
}

/** 数据的区分字段值是否等于某个分支的字面量. */
function matchesDiscriminator(ctx: FormContextValue, target: NodeTarget, value: unknown): boolean {
  const key = target.node.discriminator;
  if (key === undefined || !isPlainObject(value) || !Object.hasOwn(value, key)) return false;
  return target.node.children.some((child) => {
    const literal = literalOf(ctx.document, resolvePlanNode(child, ctx.document), key);
    return literal !== undefined && jsonEqual(literal.value, value[key]);
  });
}

function contentIndex(ctx: FormContextValue, target: NodeTarget): number {
  const content = contentTarget(ctx, target);
  return content === undefined ? 0 : target.node.children.indexOf(content.node);
}

export function NullableHost({ component: C, target, base, errors, renderTarget }: HostProps) {
  const ctx = useFormContext();
  const { store } = ctx;
  const isNull = useStoreValue(store, () => store.getAt(target.path) === null);
  const content = useMemo(() => contentTarget(ctx, target, 0), [ctx, target]);
  const setNull = useCallback(
    (next: boolean) => {
      if (ctx.mode !== "edit" || next === isNull) return;
      store.setNull(target.path, next, () => (content === undefined ? undefined : ctx.createValue(content.info)));
    },
    [content, ctx, isNull, store, target.path],
  );
  const renderContent = useCallback(() => (isNull || content === undefined ? null : renderTarget(content)), [content, isNull, renderTarget]);
  return <C {...base} isNull={isNull} setNull={setNull} renderContent={renderContent} errors={errors} />;
}

export function TreeHost(props: HostProps) {
  // 树作为当前页的根时直接渲染内容(展开一层即是进入一层).
  return props.target.page && props.target.path !== "" ? <TreeContent {...props} /> : <TreeToggle {...props} />;
}

function TreeContent({ target, renderTarget }: HostProps) {
  const ctx = useFormContext();
  const content = contentTarget(ctx, target, 0);
  return content === undefined ? null : renderTarget(content);
}

function TreeToggle({ component: C, target, base, errors, renderTarget }: HostProps) {
  const ctx = useFormContext();
  const { store } = ctx;
  const expanded = useStoreValue(store, () => store.expanded(target.path));
  const setExpanded = useCallback((next: boolean) => store.setExpanded(target.path, next), [store, target.path]);
  const renderContent = useCallback(() => {
    if (!expanded) return null;
    const content = contentTarget(ctx, target, 0);
    return content === undefined ? null : renderTarget(content);
  }, [ctx, expanded, renderTarget, target]);
  return <C {...base} expanded={expanded} setExpanded={setExpanded} renderContent={renderContent} errors={errors} />;
}

export function MapHost({ component: C, target, base, errors }: HostProps) {
  const ctx = useFormContext();
  const editing = useEntryEditing(ctx, target, true, NO_NAMES);
  return <C {...base} {...editing} errors={errors} />;
}

function under(pointer: JsonPointer, path: JsonPointer): boolean {
  return path === "" || pointer === path || pointer.startsWith(`${path}/`);
}

/** 面包屑: 根到当前页的各层, 点击上层退回; 钻取时各页(含根页)都显示. 上层标出其下不在下一层的表单级错误数, 点击进入该层后由入口行指明位置. */
function Breadcrumb({ crumbs }: { crumbs: NodeTarget[] }) {
  const ctx = useFormContext();
  const labelsKey = useStoreValue(ctx.store, () => JSON.stringify(crumbs.map((c) => crumbLabel(c, ctx.store.getAt(c.path), ctx.locale))));
  const labels = JSON.parse(labelsKey) as string[];
  const last = crumbs.length - 1;
  const countsKey = useStoreValue(ctx.store, () => {
    const pointers = ctx.store.formErrors.filter((d) => d.severity === "error").map(pointerOf);
    return JSON.stringify(crumbs.map((c, i) => (i === last ? 0 : pointers.filter((p) => under(p, c.path) && !under(p, crumbs[i + 1]!.path)).length)));
  });
  const counts = JSON.parse(countsKey) as number[];
  const COPY = copyOf(ctx.locale);
  return (
    <nav className={`jotl-breadcrumb ${styles.breadcrumb}`} aria-label={COPY.breadcrumb}>
      <ol className={`jotl-breadcrumb-list ${styles.breadcrumbList}`}>
        {crumbs.map((crumb, i) => (
          <li key={crumb.path} className={`jotl-breadcrumb-item ${styles.breadcrumbItem}`}>
            {i === last ? (
              <span className={styles.breadcrumbCurrent} aria-current="page">{labels[i]}</span>
            ) : (
              <button type="button" className={`jotl-breadcrumb-link ${styles.breadcrumbLink}`} onClick={() => ctx.navigate(crumb.path)}>
                {labels[i]}
              </button>
            )}
            {counts[i]! > 0 && <span className={`jotl-breadcrumb-errors ${styles.breadcrumbErrors}`}>{COPY.errorCount(counts[i]!)}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ViewHost({ component: C, target, base, renderTarget }: HostProps) {
  const ctx = useFormContext();
  const formErrors = useStoreValue(ctx.store, () => ctx.store.formErrors);
  const root = useMemo(() => dataRootTarget(ctx, target), [ctx, target]);
  const crumbs = useMemo(() => (root === undefined || ctx.path === "" ? [] : crumbTargets(ctx, root, ctx.path)), [ctx, root]);
  const page = useMemo(() => (crumbs.length === 0 ? root : { ...crumbs[crumbs.length - 1]!, page: true }), [crumbs, root]);
  // 钻取时根页也显示只有一层的面包屑, 各层页头的样式与间距一致; 页根对象自身的标题由样式隐藏.
  const header = ctx.drill && root !== undefined ? (crumbs.length > 0 ? crumbs : [root]) : [];
  return (
    <C {...base} submit={ctx.submit} reset={ctx.reset} errors={formErrors} goToError={ctx.goToError}>
      {header.length > 0 && <Breadcrumb crumbs={header} />}
      {page === undefined ? null : <Fragment key={ctx.path}>{renderTarget(page)}</Fragment>}
    </C>
  );
}

/** 自定义的布局或复合组件: 给出该数据形态下全部可用的属性, 便于接管子树. */
export function CustomHost({ component: C, target, base, errors }: HostProps) {
  const ctx = useFormContext();
  const kind = containerKind(target.info.effective);
  const binding = useFieldBinding(ctx, target.path, true);
  const array = useArrayBinding(ctx, target, kind === "array");
  const layout = useLayoutBinding(ctx, target, kind === "object");
  const extra = kind === "array" ? array : kind === "object" ? layout : {};
  return <C {...base} {...extra} required={target.required} errors={errors} {...binding} />;
}

/** 能否拆开为逐个子节点渲染(F5). */
export function canSplit(target: NodeTarget): boolean {
  return containerKind(target.info.effective) !== "none" || isContentContainer(target.node);
}

/** F5: 复合组件报错后不再使用它, 子节点逐个交给渲染器. */
export function SplitHost({ target, base, renderTarget }: HostProps) {
  const ctx = useFormContext();
  const { store } = ctx;
  const kind = containerKind(target.info.effective);
  const keys = useStoreValue(store, () => (kind === "array" ? store.itemKeys(target.path) : NO_KEYS));
  const namesKey = useStoreValue(store, () => {
    if (kind !== "object") return "[]";
    const value = store.getAt(target.path);
    const names = new Set([...objectChildren(target.node).map((c) => c.key), ...propertyNames(target.info.effective)]);
    if (isPlainObject(value)) for (const name of Object.keys(value)) names.add(name);
    return JSON.stringify([...names]);
  });
  let parts: { key: string; target: NodeTarget | undefined }[];
  if (kind === "array") {
    parts = keys.map((key, i) => ({ key, target: resolveChild(ctx, target, String(i)) }));
  } else if (kind === "object") {
    parts = (JSON.parse(namesKey) as string[]).map((name) => ({
      key: name,
      target: resolveChild(ctx, target, escapePointerToken(name)),
    }));
  } else {
    parts = [{ key: "content", target: contentTarget(ctx, target) }];
  }
  return (
    <div id={base.id} className="jotl-split">
      {parts.map(({ key, target: part }) => (
        <div key={key} className="jotl-split-item">
          {part === undefined ? null : renderTarget(part)}
        </div>
      ))}
    </div>
  );
}

export const HOSTS: Record<HostKind, (props: HostProps) => ReactNode> = {
  view: ViewHost,
  field: FieldHost,
  object: ObjectHost,
  array: ArrayHost,
  tuple: TupleHost,
  union: UnionHost,
  nullable: NullableHost,
  map: MapHost,
  tree: TreeHost,
  custom: CustomHost,
  split: SplitHost,
};
