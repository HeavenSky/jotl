// 语言服务选项, 从 LSP 初始化选项中读取它与界面语言, 并入 jotl.config.json 的登记, 以及换算成编译器选项.
import type { JsonSchemaObject } from "@jotl/core";
import { type CompileOptions, isTypeName } from "@jotl/core";

export interface LanguageServiceOptions {
	/** 除内置组件之外已登记的组件名: 用于 `widget` 补全与 "widget 未注册" 检查; 大驼峰名另作为扩展组件传给编译器. */
	registeredWidgets?: readonly string[];
	/** 已登记名字的底层 schema(来自 jotl.config.json); 不在其中的扩展组件按 `string` 编译. */
	widgets?: Readonly<Record<string, JsonSchemaObject>>;
	/** 写了底层类型的非大驼峰名 → 底层 schema(来自 jotl.config.json); 只传给编译器做 widget 与字段类型的兼容检查. */
	widgetTypes?: Readonly<Record<string, JsonSchemaObject>>;
	/** 文件根元数据 `widgets` 声明的底层 schema, 覆盖同名登记; 只供补全与悬停, compileOptions 不读它. */
	fileWidgets?: Readonly<Record<string, JsonSchemaObject>>;
}

/** 客户端设置所在的节名; `didChangeConfiguration` 的 settings 按 `{ jotl: {...} }` 传入. */
export const CONFIGURATION_SECTION = "jotl";

/** 读取客户端传来的 initializationOptions 或 `jotl` 设置节; 不合法的部分忽略. */
export function readInitializationOptions(raw: unknown): LanguageServiceOptions {
	if (typeof raw !== "object" || raw === null) return {};
	const widgets = (raw as { registeredWidgets?: unknown }).registeredWidgets;
	if (!Array.isArray(widgets)) return {};
	const names = widgets.filter((w): w is string => typeof w === "string" && w !== "");
	return { registeredWidgets: [...new Set(names)] };
}

/** 读取 initializationOptions 或 `jotl` 设置节中的 `locale`(语言标签, 如 `en` `zh-CN`); 没有或不是非空字符串时返回 undefined. */
export function readLocaleOption(raw: unknown): string | undefined {
	if (typeof raw !== "object" || raw === null) return undefined;
	const locale = (raw as { locale?: unknown }).locale;
	return typeof locale === "string" && locale.trim() !== "" ? locale : undefined;
}

/** 并入配置文件登记的名字与底层类型; 同名时以配置文件为准, 设置中的名字补充. */
export function withConfigWidgets(
	options: LanguageServiceOptions,
	widgets: Readonly<Record<string, JsonSchemaObject>>,
	widgetTypes: Readonly<Record<string, JsonSchemaObject>> = {}
): LanguageServiceOptions {
	if (Object.keys(widgets).length === 0) return options;
	const merged: LanguageServiceOptions = {
		registeredWidgets: [
			...new Set([...Object.keys(widgets), ...(options.registeredWidgets ?? [])]),
		],
		widgets,
	};
	return Object.keys(widgetTypes).length === 0 ? merged : { ...merged, widgetTypes };
}

/** 并入文件根元数据 `widgets` 声明的名字与底层 schema, 只供补全, 悬停与 "widget 未注册" 检查; 不要传给 compileOptions, 编译器自行读取文件内声明, 这里按 `string` 补登会盖掉真实底层类型. */
export function withFileWidgets(
	options: LanguageServiceOptions,
	names: readonly string[],
	schemas: Readonly<Record<string, JsonSchemaObject>> = {}
): LanguageServiceOptions {
	if (names.length === 0) return options;
	return {
		...options,
		registeredWidgets: [...new Set([...(options.registeredWidgets ?? []), ...names])],
		fileWidgets: schemas,
	};
}

/** 扩展组件只能是大驼峰名. */
export function extensionComponents(options: LanguageServiceOptions): string[] {
	return (options.registeredWidgets ?? []).filter(isTypeName);
}

/** 扩展组件的底层 schema: 文件内声明优先, 其次配置文件, 只在设置中登记的按 `string`; 不是扩展组件时为 undefined. */
export function extensionSchema(
	options: LanguageServiceOptions,
	name: string
): JsonSchemaObject | undefined {
	if (!isTypeName(name)) return undefined;
	const own = options.fileWidgets ?? {};
	if (Object.hasOwn(own, name)) return own[name];
	if (!extensionComponents(options).includes(name)) return undefined;
	const widgets = options.widgets ?? {};
	return Object.hasOwn(widgets, name) ? widgets[name] : { type: "string" };
}

export function compileOptions(options: LanguageServiceOptions): CompileOptions {
	const names = extensionComponents(options);
	const widgets = options.widgets ?? {};
	const types = options.widgetTypes ?? {};
	return {
		...(names.length === 0
			? {}
			: {
					widgets: Object.fromEntries(
						names.map(name => [
							name,
							Object.hasOwn(widgets, name) ? widgets[name]! : { type: "string" },
						])
					),
				}),
		...(Object.keys(types).length === 0 ? {} : { widgetTypes: types }),
	};
}
