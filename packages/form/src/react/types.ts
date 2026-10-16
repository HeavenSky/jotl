// 公开类型: 表单属性, 实例 API, 降级事件, 以及 React 下的注册表与适配器别名.
import type { ComponentType, ReactNode } from "react";
import type { DefaultsOptions, JsonPointer, JsonSchema, Locale } from "@jotl/core";
import type { Adapters, PlanDegradeReason, Registry, RenderMode } from "../core/index.js";
import type { ValidateTrigger, ValidationResult } from "./form-store.js";
import type { ModuleWidgetOptions } from "./module-widgets.js";

export type { ValidateTrigger, ValidationResult };

/** 各层组件按 core/ 的 props 契约接收属性. */
// biome-ignore lint/suspicious/noExplicitAny: 各组件 props 不同, 换成 unknown 会因参数逆变使具体组件无法赋值
export type ReactWidgetComponent = ComponentType<any>;
export type ReactRegistry = Registry<ReactWidgetComponent>;
export type ReactAdapters = Adapters<ReactNode>;

/** plan() 期的 F1 F2 F3 F7, 以及渲染期的 F4 F5 F8 F9. */
export type DegradeCode = PlanDegradeReason | "F4" | "F5" | "F8" | "F9";

/** 渲染器内置的替代形态, 作为 DegradeEvent.to 的取值. */
export const DEGRADE_TARGETS = {
  /** F5: 复合组件被拆开, 子节点逐个渲染. */
  split: "split",
  /** 注册表中没有可用的 json 组件时的内置最小兜底. */
  minimalJson: "minimal-json",
  /** 外壳不可用时不再包外壳. */
  none: "none",
} as const;

export interface DegradeEvent {
  code: DegradeCode;
  /** 实际数据路径, 数组下标为具体数字. */
  dataPath: JsonPointer;
  schemaPointer: JsonPointer;
  /** 被替换的组件名; F7 没有原组件. */
  from?: string;
  /** 替代组件名, 或 DEGRADE_TARGETS 中的内置形态. */
  to: string;
  /** F4 F9 的原始错误. */
  error?: unknown;
}

export interface JotlFormHandle {
  getValues(): unknown;
  /** 整体替换表单值并通知 onChange; 不填充默认值. */
  setValues(value: unknown): void;
  /** 校验整个表单并显示全部错误. */
  validate(): ValidationResult;
  /** 回到初始值(已填充默认值), 清除错误与触碰记录. */
  reset(): void;
  /** 校验; 通过时调用 onSubmit. */
  submit(): ValidationResult;
}

export interface JotlFormProps {
  /** 按内容比较; 非受控时内容变化会按新 schema 重新初始化数据, 清掉触碰与错误. */
  schema: JsonSchema;
  /** 受控值; 不为 undefined 时表单受控, 内部改动只经 onChange 通知. */
  value?: unknown;
  /** 非受控的初始值. */
  defaultValue?: unknown;
  onChange?: (value: unknown) => void;
  /** 提交且校验通过时调用. */
  onSubmit?: (value: unknown) => void;
  /** 每次校验后调用. */
  onValidate?: (result: ValidationResult) => void;
  /** 每次降级调用一次(F10). */
  onDegrade?: (event: DegradeEvent) => void;
  /** 默认为 html/ 原生组件的注册表; 替换组件时传入 createDefaultRegistry().extend() 并登记同名组件. */
  registry?: ReactRegistry;
  adapters?: ReactAdapters;
  /** 默认 "edit". */
  mode?: RenderMode;
  /** 场景名, 选取 x-ui.variants; 默认 "default". */
  scene?: string;
  /** 最早的校验时机, 默认 "blur"; 提交总会校验, 校验过一次之后每次改动都会重新校验. */
  validateOn?: ValidateTrigger;
  /** 初始化与新增数据时的默认数据选项. */
  defaults?: Partial<DefaultsOptions>;
  /** 递归类型的展开层数, 传给 plan(). */
  maxDepth?: number;
  /**
   * 钻取渲染的当前页(JSON Pointer, 数据路径); 不为 undefined 时受控, 进入与退回只经 onPathChange 通知.
   * 不传时表单内部维护, 初始为根 "". 指向的数组元素不存在时退回该数组所在的层并经 onPathChange 通知.
   */
  path?: JsonPointer;
  /** 钻取渲染(每层一页, 默认 true); false 时各层在同一页展开, 不显示入口行与面包屑, 忽略 path. */
  drill?: boolean;
  /**
   * drill 为 false 时, 对象(inline 除外), 数组, 字典与含对象分支的联合渲染为可折叠面板: 标题行显示标题(数组元素为序号), 摘要与其下错误数;
   * 第一层默认展开, 更深的默认收起. 默认 false; drill 为 true 时忽略.
   */
  collapsible?: boolean;
  /** 未传 value 与 defaultValue 时初始数据的来源: "defaults"(默认)按 schema 默认值补全; "mock" 用 @jotl/data 的 mock() 生成. 新增数据仍按默认值. */
  initialData?: "defaults" | "mock";
  /** initialData 为 "mock" 时的随机种子, 同一种子生成同样的数据; 不传时每次挂载随机. */
  mockSeed?: number;
  /** 当前页变化(点击入口行或面包屑, 提交失败跳到错误所在层, 数组元素被删除后退回)时调用. */
  onPathChange?: (path: JsonPointer) => void;
  /** 表单根元素 id, 也是各节点 id 的前缀; 默认按表单实例自动生成. */
  id?: string;
  /** 界面文案与校验消息的语言; 缺省取 @jotl/core 的全局 getLocale(). */
  locale?: Locale;
  /**
   * 读取 schema 根 x-ui.widgets 中带 module 的扩展组件声明并登记到本表单的注册表(同名覆盖), 加载失败按 F9 显示失败与重试.
   * 默认 false; 传对象时作为 moduleWidgetRegistrations 的选项(importer, baseUrl, locale; locale 缺省取本表单的 locale). 实例 API 经 ref 取得.
   */
  schemaModules?: boolean | ModuleWidgetOptions;
}
