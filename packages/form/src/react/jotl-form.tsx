// 表单组件 JotlForm: 规划模板树, 创建状态仓库, 同步受控值, 维护钻取的当前页, 暴露实例 API(ref), 渲染根节点.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useReducer, useRef, useState, type Ref } from "react";
import { DEFAULT_SCENE, formatPointer, getLocale, tryParsePointer, type DefaultsOptions, type Diagnostic, type JsonPointer, type JsonSchema, type Locale } from "@jotl/core";
import { fillDefaults, getDefaults, mock, validate } from "@jotl/data";
import { jsonEqual, plan, resolveSchemaAt, type WidgetRegistration } from "../core/index.js";
import { nodeId, syntheticJsonNode, type NodeTarget } from "./child-resolver.js";
import { FormContext, useStoreValue, type FormContextValue } from "./context.js";
import { clampPath, dataRootTarget, isMapValuePath, pageOfPointer } from "./drill.js";
import { localizedDiagnostic } from "./diagnostics.js";
import { FormStore, pointerOf, type ValidationResult } from "./form-store.js";
import { moduleWidgetRegistrations, schemaWidgetModules, type WidgetModule } from "./module-widgets.js";
import { NodeView } from "./node-view.js";
import { sharedDefaultRegistry } from "./registry.js";
import type { SchemaInfo } from "./schema-access.js";
import type { JotlFormHandle, JotlFormProps, ReactAdapters, ReactRegistry } from "./types.js";
import { LocaleContext } from "../locale-context.js";
import { styles as htmlStyles } from "../html/index.js";

const NO_ADAPTERS: ReactAdapters = {};

/** 用默认值补全初始数据; 没有补任何值时沿用原对象, 受控模式据此判断是否需要回报 onChange. 没有初始数据且要求 mock 时用 mock() 生成. */
function initialValue(schema: JsonSchema, data: unknown, props: JotlFormProps): unknown {
  if (data === undefined && props.initialData === "mock") {
    const mocked = mock(schema, props.mockSeed === undefined ? {} : { seed: props.mockSeed }).value;
    if (mocked !== undefined) return mocked;
  }
  const defaults = props.defaults;
  const result = fillDefaults(schema, data, defaults);
  if (result.value === undefined || result.value.filled.length === 0) return data;
  return result.value.data;
}

/** 新增数据: 先按显式默认值, 得不到值时按 required 策略给出零值. */
function createValue(schema: JsonSchema, info: SchemaInfo, defaults: Partial<DefaultsOptions> | undefined): unknown {
  const explicit = getDefaults(schema, { ...defaults, at: info.effective }).value;
  if (explicit !== undefined) return explicit;
  return getDefaults(schema, { ...defaults, strategy: "required", at: info.effective }).value;
}

/** 内容不变时沿用上一次的引用; equal 只在引用变化时调用. */
function useStable<T>(value: T, equal: (a: T, b: T) => boolean): T {
  const ref = useRef(value);
  if (ref.current !== value && !equal(ref.current, value)) ref.current = value;
  return ref.current;
}

function shallowEqual(a: object, b: object): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** 注册表按登记内容稳定: 新实例的全部登记(含父级)与上一次逐项浅相等时沿用上一次的实例, 不重新规划. */
function useStableRegistry(registry: ReactRegistry): ReactRegistry {
  const ref = useRef<{ registry: ReactRegistry; list: WidgetRegistration<unknown>[] } | undefined>(undefined);
  const previous = ref.current;
  if (previous !== undefined && previous.registry === registry) return registry;
  const list = registry.list();
  if (previous !== undefined && previous.list.length === list.length && list.every((r, i) => shallowEqual(r, previous.list[i]!))) return previous.registry;
  ref.current = { registry, list };
  return registry;
}

const FOCUSABLE = "input:not([type=hidden]), select, textarea, button, [tabindex]";

/** 聚焦数据路径上的节点: 节点不在页面上或被隐藏时取最近的祖先; 先展开所在的折叠面板, 节点本身不可聚焦时聚焦其中第一个可聚焦元素. */
function focusPointer(formId: string, pointer: JsonPointer): void {
  if (typeof document === "undefined") return;
  const tokens = tryParsePointer(pointer) ?? [];
  for (let k = tokens.length; k >= 0; k--) {
    const element = document.getElementById(nodeId(formId, formatPointer(tokens.slice(0, k))));
    if (element === null || element.closest("[hidden]") !== null) continue;
    for (let details = element.closest("details"); details !== null; details = details.parentElement?.closest("details") ?? null) details.open = true;
    const target = element.matches(FOCUSABLE) ? element : element.querySelector<HTMLElement>(FOCUSABLE) ?? element;
    target.scrollIntoView?.({ block: "center" });
    target.focus({ preventScroll: true });
    return;
  }
}

let formCount = 0;

/** 未传 id 时的表单 id, 每个表单实例一个(不用 React 18 的 useId). */
function nextFormId(): string {
  formCount += 1;
  return `jotl-f${formCount}`;
}

/** schemaModules 开启时把 schema 根 x-ui.widgets 中的模块声明登记到实例注册表; 声明不变时沿用同一注册表. */
function useSchemaModules(base: ReactRegistry, schema: JsonSchema, option: JotlFormProps["schemaModules"], locale: Locale): ReactRegistry {
  const key = option === undefined || option === false ? "{}" : JSON.stringify(schemaWidgetModules(schema));
  const options = typeof option === "object" ? option : undefined;
  const latestOptions = useRef(options);
  latestOptions.current = options;
  return useMemo(() => {
    if (key === "{}") return base;
    const registry = base.extend();
    const modules = JSON.parse(key) as Record<string, WidgetModule>;
    const options = { ...latestOptions.current, locale: latestOptions.current?.locale ?? locale };
    for (const registration of moduleWidgetRegistrations(modules, options)) registry.register(registration);
    return registry;
  }, [base, key, locale]);
}

function JotlFormImpl(props: JotlFormProps, ref: Ref<JotlFormHandle>) {
  const { mode = "edit", scene = DEFAULT_SCENE, validateOn = "blur", maxDepth, drill = true } = props;
  // schema, adapters 与 registry 按内容稳定, 每次渲染新建内容相同的对象不会重新规划, 也不会让非受控数据重新初始化.
  const schema = useStable(props.schema, jsonEqual);
  const adapters = useStable(props.adapters ?? NO_ADAPTERS, shallowEqual);
  const locale = props.locale ?? getLocale();
  const registry = useSchemaModules(useStableRegistry(props.registry ?? sharedDefaultRegistry()), schema, props.schemaModules, locale);
  const [autoId] = useState(nextFormId);
  const formId = props.id ?? autoId;
  const controlled = props.value !== undefined;

  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  const validator = useMemo(
    () =>
      (value: unknown): ValidationResult => {
        const result = validate(schema, value, { locale });
        return { valid: result.value?.valid === true, errors: result.diagnostics };
      },
    [locale, schema],
  );
  const [store] = useState(
    () => new FormStore({ initial: initialValue(schema, controlled ? props.value : props.defaultValue, props), validate: validator, validateOn }),
  );
  store.configure({ validate: validator, validateOn });

  // 非受控时 schema 变化按新 schema 重新取初始数据并清掉触碰与错误; 在渲染期换数据, 子节点不会拿旧数据按新 schema 渲染.
  const renderedSchema = useRef(schema);
  const reinitialized = useRef(false);
  if (renderedSchema.current !== schema) {
    renderedSchema.current = schema;
    if (!controlled) {
      store.reinitialize(initialValue(schema, props.defaultValue, props));
      reinitialized.current = true;
    }
  }
  useLayoutEffect(() => {
    if (!reinitialized.current) return;
    reinitialized.current = false;
    store.refresh();
    latest.current.onChange?.(store.value);
    // 原页在新 schema 中可能已不存在, 钻取回到根页.
    if (drill && requestedPath !== "") navigate("");
  });

  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  useLayoutEffect(() => {
    store.onChange = (value) => {
      latest.current.onChange?.(value);
      // 受控: 让表单随父组件一起重渲染, 父组件没有采纳新值时在下面的同步中恢复受控值.
      if (latest.current.value !== undefined) forceRender();
    };
    store.onValidate = (result) => latest.current.onValidate?.(result);
  });

  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (controlled && store.value !== props.value) latest.current.onChange?.(store.value);
      return;
    }
    if (controlled && props.value !== store.value) store.replace(props.value);
  });

  const [innerPath, setInnerPath] = useState<JsonPointer>("");
  const requestedPath = props.path ?? innerPath;
  /** 判定缺失的键是否为字典值; 依赖渲染上下文, 由下方在 ctx 就绪后设置. */
  const isMapValue = useRef<((path: JsonPointer) => boolean) | undefined>(undefined);
  const path = useStoreValue(store, () => (drill ? clampPath(store.value, requestedPath, (p) => isMapValue.current?.(p) ?? false) : ""));
  /** 定位错误时等待切到的页与要聚焦的路径; 其他导航取消它. */
  const pendingFocus = useRef<{ page: JsonPointer; pointer: JsonPointer } | undefined>(undefined);
  const navigate = useCallback((next: JsonPointer) => {
    pendingFocus.current = undefined;
    if (latest.current.path === undefined) setInnerPath(next);
    latest.current.onPathChange?.(next);
  }, []);
  useEffect(() => {
    if (drill && path !== requestedPath) navigate(path);
  }, [drill, navigate, path, requestedPath]);

  /** 提交校验失败时跳到第一个错误所在的层; 由下方在 ctx 就绪后设置. */
  const jumpToError = useRef<((result: ValidationResult) => void) | undefined>(undefined);
  /** 表单级错误列表的定位; 由下方在 ctx 就绪后设置. */
  const goToErrorImpl = useRef<((error: Diagnostic) => void) | undefined>(undefined);
  const goToError = useCallback((error: Diagnostic) => goToErrorImpl.current?.(error), []);
  const [submitFailedListeners] = useState(() => new Set<() => void>());
  const onSubmitFailed = useCallback(
    (listener: () => void) => {
      submitFailedListeners.add(listener);
      return () => {
        submitFailedListeners.delete(listener);
      };
    },
    [submitFailedListeners],
  );
  const handle = useMemo<JotlFormHandle>(() => {
    const submit = (): ValidationResult => {
      const result = store.validate();
      if (result.valid) latest.current.onSubmit?.(store.value);
      else {
        jumpToError.current?.(result);
        for (const listener of [...submitFailedListeners]) listener();
      }
      return result;
    };
    return {
      getValues: () => store.value,
      setValues: (value) => store.setValues(value),
      validate: () => store.validate(),
      reset: () => store.reset(),
      submit,
    };
  }, [store, submitFailedListeners]);
  useImperativeHandle(ref, () => handle, [handle]);

  const planned = useMemo(
    () => plan(schema, registry, maxDepth === undefined ? { scene, mode } : { scene, mode, maxDepth }),
    [maxDepth, mode, registry, scene, schema],
  );

  const ctx = useMemo<FormContextValue>(
    () => ({
      store,
      document: schema,
      registry,
      adapters,
      mode,
      scene,
      maxDepth,
      formId,
      report: (event) => latest.current.onDegrade?.(event),
      submit: () => {
        handle.submit();
      },
      reset: () => handle.reset(),
      createValue: (info) => createValue(schema, info, latest.current.defaults),
      drill,
      collapsible: !drill && props.collapsible === true,
      path,
      navigate,
      onSubmitFailed,
      goToError,
      locale,
    }),
    [adapters, drill, props.collapsible, formId, goToError, handle, locale, maxDepth, mode, navigate, onSubmitFailed, path, registry, scene, schema, store],
  );

  const root = useMemo<NodeTarget>(
    () => ({
      node: planned.value ?? syntheticJsonNode("", "", false),
      path: "",
      id: formId,
      info: resolveSchemaAt(schema, ""),
      required: false,
      labelKey: undefined,
      depth: 0,
      page: true,
      element: false,
      itemSummary: undefined,
    }),
    [formId, planned, schema],
  );

  useLayoutEffect(() => {
    isMapValue.current = (p) => {
      const dataRoot = root.node.level === "view" ? dataRootTarget(ctx, root) : undefined;
      return dataRoot !== undefined && isMapValuePath(ctx, dataRoot, p);
    };
    // 首次渲染时 isMapValue 尚未就绪, 落在不存在的字典键上的路径没有收敛; 就绪后重渲染以立即退回.
    if (drill && clampPath(store.value, requestedPath, isMapValue.current) !== path) forceRender();
    jumpToError.current = (result) => {
      const first = result.errors.find((d) => d.severity === "error");
      const dataRoot = root.node.level === "view" ? dataRootTarget(ctx, root) : undefined;
      if (!drill || first === undefined || dataRoot === undefined) return;
      const page = pageOfPointer(ctx, dataRoot, pointerOf(first));
      if (page !== ctx.path) navigate(page);
    };
    goToErrorImpl.current = (error) => {
      const pointer = pointerOf(error);
      const dataRoot = root.node.level === "view" ? dataRootTarget(ctx, root) : undefined;
      const page = drill && dataRoot !== undefined ? pageOfPointer(ctx, dataRoot, pointer) : ctx.path;
      if (page === ctx.path) {
        focusPointer(formId, pointer);
        return;
      }
      navigate(page);
      pendingFocus.current = { page, pointer };
    };
    // 父组件的 layout effect 在子节点提交之后运行, 此时新页的字段已在 DOM 中.
    const pending = pendingFocus.current;
    if (pending !== undefined && pending.page === path) {
      pendingFocus.current = undefined;
      focusPointer(formId, pending.pointer);
    }
  });

  return (
    <LocaleContext.Provider value={locale}>
      <FormContext.Provider value={ctx}>
        {planned.value === undefined && (
          <p className={`jotl-errors ${htmlStyles.errors}`} role="alert">
            {localizedDiagnostic(locale, "JOTL6002").message}
          </p>
        )}
        <NodeView {...root} />
      </FormContext.Provider>
    </LocaleContext.Provider>
  );
}

/** 实例 API 经 ref 取得(forwardRef, 兼容 React 16.8 起的版本). */
export const JotlForm = forwardRef(JotlFormImpl);
JotlForm.displayName = "JotlForm";
