// 补全(E3): 组件名(内置, 本文件类型, 扩展组件, 含根元数据 `widgets` 声明的名字), 按组件过滤的元数据键, `widget` `decorator` `value_format` 取值, 条件 op, 类型串中的名字, `<root/>` `<default/>`, `variants` 场景覆盖的键.
import { type JsonSchemaObject, isSchemaObject, xUiMetaSchema } from "@jotl/core";
import {
  BUILTIN_WIDGETS,
  COMPONENT_NAMES,
  COMPONENT_WIDGETS,
  type ComponentName,
  acceptsWidget,
  compile,
  defaultWidget,
  CONDITION_OPS,
  extensionConstraintKeys,
  isComponentName,
  META_KEY_NAMES,
  META_KEYS,
  metaAppliesTo,
  type MetaTarget,
  TIMESTAMP_VALUE_FORMATS,
  VALUE_FORMAT_ALIASES,
  parse,
} from "@jotl/core";
import { BUILTIN_WIDGETS as UI_WIDGETS, type BuiltinWidgetName } from "@jotl/form/core";
import { type CompletionItem, CompletionItemKind, type Position, type Range } from "vscode-languageserver";
import { type CompletionContext, completionSite } from "./completion-context.js";
import { completionDetails } from "./diagnostics.js";
import { extensionComponents, extensionSchema, type LanguageServiceOptions, withFileWidgets } from "./options.js";
import { declaredTypeNames, fileWidgetNames, fileWidgetSchemas } from "./symbol-index.js";
import { offsetAt, positionAt } from "./text-position.js";

const COMPLETION_FILE = "completion.jotl";

/** 场景覆盖对象的键: x-ui 的 Variant 字段, 条件改写为 `root_if` `node_if`. */
export const SCENE_KEYS: readonly string[] = [
  ...Object.keys((xUiMetaSchema.$defs?.Variant as JsonSchemaObject | undefined)?.properties ?? {}).filter((key) => key !== "visibleIf"),
  "root_if",
  "node_if",
];
export const MARKERS: readonly string[] = ["<root/>", "<default/>"];

/** 求候选用的代表写法: 不带元数据就能编译; 枚举合并单选与多选. */
const WIDGET_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  enum: ["enum{ a b }", "enum[multiple: true]{ a b }"],
  union: ["union[union_item: 'string|number']"],
};
/** 任意形态都接受的通用候选, 排在最后. */
const GENERIC_WIDGETS: readonly string[] = ["output", "json"];

/** 内置组件的 `widget` 候选: 首个为默认, 其余为编译器 `acceptsWidget` 接受的内置名(不含视图与外壳). */
function candidatesOf(component: ComponentName): string[] {
  const out: string[] = [];
  const accepted: string[] = [];
  for (const sample of WIDGET_SAMPLES[component] ?? [component]) {
    const schema = compile(`T: ${sample}`, COMPLETION_FILE).value?.schema.$defs?.T;
    if (!isSchemaObject(schema)) continue;
    out.push(COMPONENT_WIDGETS[component] ?? defaultWidget(schema) ?? "json");
    for (const name of BUILTIN_WIDGETS) if (acceptsWidget(schema, name)) accepted.push(name);
  }
  const rest = accepted.filter((name) => name !== "form" && name !== "field" && !GENERIC_WIDGETS.includes(name));
  return [...new Set([...out, ...rest, ...GENERIC_WIDGETS])];
}

/** 各内置组件的 `widget` 候选, 首个为默认; 与编译器的降级检查(JOTL1045)同一口径. */
export const WIDGET_CANDIDATES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  COMPONENT_NAMES.map((name) => [name, candidatesOf(name)]),
);

/** 各日期组件 `value_format` 的常用格式, 首个为默认; 之后补时间戳(`time` 除外)与 4 个别名. */
export const VALUE_FORMAT_CANDIDATES: Readonly<Record<string, readonly string[]>> = {
  date: ["YYYY-MM-DD", "YYYYMMDD", "YYYY/MM/DD"],
  time: ["HH:mm:ss", "HH:mm", "HH:mm:ssZ"],
  datetime: ["iso", "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"],
};

/** 引用类型, 扩展组件与无法判定时的候选: 除视图与外壳外的全部内置组件. */
const ALL_FIELD_WIDGETS: readonly string[] = [...BUILTIN_WIDGETS].filter((name) => name !== "form" && name !== "field");

function item(label: string, kind: CompletionItemKind, detail: string, range: Range, newText: string = label): CompletionItem {
  return { label, kind, detail, textEdit: { range, newText } };
}

function quote(name: string, quoted: boolean): string {
  return quoted ? name : `'${name}'`;
}

function componentItems(declared: ReadonlySet<string>, options: LanguageServiceOptions, range: Range): CompletionItem[] {
  const items = COMPONENT_NAMES.map((name) => item(name, CompletionItemKind.Keyword, completionDetails().component, range));
  for (const name of declared) items.push(item(name, CompletionItemKind.Class, completionDetails().namedType, range));
  for (const name of extensionComponents(options)) {
    if (!declared.has(name)) items.push(item(name, CompletionItemKind.Class, completionDetails().extension, range));
  }
  return items;
}

function targetOf(component: string, declared: ReadonlySet<string>): MetaTarget {
  if (isComponentName(component)) return component;
  return declared.has(component) ? "ref" : "ext";
}

/** 省略组件时可能是 `string`(无体)或 `object`(有体), 两者的键都给; 扩展组件另给底层类型放行的约束键. */
function metaKeyItems(
  context: Extract<CompletionContext, { kind: "metaKey" }>,
  declared: ReadonlySet<string>,
  options: LanguageServiceOptions,
  range: Range,
): CompletionItem[] {
  if (context.enumMember) {
    return context.used.includes("description") ? [] : [item("description", CompletionItemKind.Property, completionDetails().metaKey, range)];
  }
  const targets: MetaTarget[] = context.component === undefined ? ["string", "object"] : [targetOf(context.component, declared)];
  const base = targets[0] === "ext" ? extensionSchema(options, context.component!) : undefined;
  const constraints = base === undefined ? [] : extensionConstraintKeys(base);
  return META_KEY_NAMES.filter(
    (name) =>
      !context.used.includes(name) &&
      (context.top || !META_KEYS[name]!.rootOnly) &&
      (targets.some((target) => metaAppliesTo(name, target)) || constraints.includes(name)),
  ).map((name) => item(name, CompletionItemKind.Property, completionDetails().metaKey, range));
}

function widgetItems(component: string | undefined, quoted: boolean, options: LanguageServiceOptions, range: Range): CompletionItem[] {
  const builtin =
    component === undefined
      ? [...new Set([...WIDGET_CANDIDATES.string!, ...WIDGET_CANDIDATES.object!])]
      : (Object.hasOwn(WIDGET_CANDIDATES, component) ? WIDGET_CANDIDATES[component] : undefined) ?? ALL_FIELD_WIDGETS;
  const items = builtin.map((name) => item(name, CompletionItemKind.Value, completionDetails().builtinWidget, range, quote(name, quoted)));
  const seen = new Set<string>(builtin);
  for (const name of options.registeredWidgets ?? []) {
    if (seen.has(name) || BUILTIN_WIDGETS.has(name)) continue;
    seen.add(name);
    items.push(item(name, CompletionItemKind.Value, completionDetails().registeredWidget, range, quote(name, quoted)));
  }
  return items;
}

function valueFormatItems(component: string | undefined, quoted: boolean, range: Range): CompletionItem[] {
  const own = component !== undefined && Object.hasOwn(VALUE_FORMAT_CANDIDATES, component) ? VALUE_FORMAT_CANDIDATES[component]! : [];
  const names = [...new Set([...own, ...(component === "time" ? [] : TIMESTAMP_VALUE_FORMATS), ...VALUE_FORMAT_ALIASES])];
  return names.map((name) =>
    item(name, CompletionItemKind.Value, VALUE_FORMAT_ALIASES.includes(name) ? completionDetails().valueFormatAlias : completionDetails().valueFormat, range, quote(name, quoted)),
  );
}

function decoratorItems(quoted: boolean, options: LanguageServiceOptions, range: Range): CompletionItem[] {
  const builtin = (Object.keys(UI_WIDGETS) as BuiltinWidgetName[]).filter((name) => UI_WIDGETS[name].level === "decorator");
  const names = [...new Set([...builtin, ...(options.registeredWidgets ?? [])])];
  return names.map((name) =>
    item(name, CompletionItemKind.Value, builtin.includes(name as BuiltinWidgetName) ? completionDetails().builtinWidget : completionDetails().registeredWidget, range, quote(name, quoted)),
  );
}

function itemsFor(context: CompletionContext, text: string, options: LanguageServiceOptions, range: Range): CompletionItem[] {
  const declared = () => declaredTypeNames(parse(text, COMPLETION_FILE).value);
  switch (context.kind) {
    case "none":
      return [];
    case "component":
      return componentItems(declared(), options, range);
    case "marker":
      return MARKERS.map((name) => item(name, CompletionItemKind.Keyword, completionDetails().marker, range));
    case "metaKey":
      return metaKeyItems(context, declared(), options, range);
    case "widget":
      return widgetItems(context.component, context.quoted, options, range);
    case "decorator":
      return decoratorItems(context.quoted, options, range);
    case "valueFormat":
      return valueFormatItems(context.component, context.quoted, range);
    case "conditionOp":
      return CONDITION_OPS.map((op) => item(op, CompletionItemKind.EnumMember, completionDetails().conditionOp, range, quote(op, context.quoted)));
    case "sceneKey":
      return SCENE_KEYS.filter((key) => !context.used.includes(key)).map((key) => item(key, CompletionItemKind.Property, completionDetails().sceneKey, range));
    case "itemMetaName":
      return context.names
        .filter((name) => name !== "" && !context.used.includes(name))
        .map((name) => item(name, CompletionItemKind.Property, completionDetails().itemTypeName, range));
    case "typeString":
      return componentItems(declared(), options, range).filter((i) => i.label !== "enum");
  }
}

export function getCompletions(text: string, position: Position, options: LanguageServiceOptions = {}): CompletionItem[] {
  const cursor = offsetAt(text, position);
  const site = completionSite(text, cursor);
  const range: Range = { start: positionAt(text, site.replaceStart), end: positionAt(text, cursor) };
  const file = parse(text, COMPLETION_FILE).value;
  return itemsFor(site.context, text, withFileWidgets(options, fileWidgetNames(file), fileWidgetSchemas(file)), range);
}
