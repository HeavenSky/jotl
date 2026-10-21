// 项目配置 jotl.config.json 的内容校验, 换算为编译选项, 以及配置文件自身的 JSON Schema; 只处理已解析的 JSON 值, 不查找文件.
import {
	JSON_SCHEMA_DIALECT,
	type JsonSchemaObject,
	type XUiWidgetModule,
	formatMessage,
	getLocale,
	l10n,
} from "../schema/index.js";
import { isTypeName } from "./builtins.js";
import {
	type CompileOptions,
	baseTypeSchemas,
	declaresWidgetType,
	readWidgetDeclaration,
} from "./compiler.js";
import { syntaxReason } from "./diagnostics.js";

export const JOTL_CONFIG_FILE = "jotl.config.json";
export const JOTL_CONFIG_SCHEMA_ID = "https://jotl.dev/schema/jotl-config/v1";

export interface JotlConfig {
	/** 登记的扩展组件与 widget 名 → 底层 schema; 大驼峰名同时是扩展组件. */
	widgets: Record<string, JsonSchemaObject>;
	/** 写成模块声明的项: 名字 → 组件模块(不带 `base`); `module` 原样保留, 相对路径由调用方按配置文件所在目录解析. */
	modules: Record<string, XUiWidgetModule>;
	/** 写了底层类型的非大驼峰名(不带 `base` 的模块声明视为没写) → 底层 schema; 编译器不按它编译, 只用来检查 `widget` 元数据与字段类型是否兼容. readJotlConfig 总会给出; 可选是为了兼容自行构造的配置. */
	widgetTypes?: Record<string, JsonSchemaObject>;
}

export interface JotlConfigIssue {
	/** 问题所在的 JSON Pointer. */
	pointer: string;
	message: string;
}

const MESSAGES = {
	notObject: "配置必须是 JSON 对象",
	unknownKey: "未知的配置项 `{key}`",
	widgetsNotObject: "`widgets` 必须是对象: 名字 → 底层类型或模块声明",
	emptyName: "widget 名不能为空",
} as const;

const MESSAGES_EN: Readonly<Record<keyof typeof MESSAGES, string>> = {
	notObject: "Configuration must be a JSON object",
	unknownKey: "Unknown configuration key `{key}`",
	widgetsNotObject: "`widgets` must be an object: name → base type or module declaration",
	emptyName: "widget name cannot be empty",
};

function message(key: keyof typeof MESSAGES, params?: Readonly<Record<string, string>>): string {
	return formatMessage(getLocale() === "en" ? MESSAGES_EN[key] : MESSAGES[key], params);
}

function escapePointer(segment: string): string {
	return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 校验已解析的配置并换算底层类型; 不合法的项跳过并记入 issues, 其余照常返回. */
export function readJotlConfig(value: unknown): { config: JotlConfig; issues: JotlConfigIssue[] } {
	const config: Required<JotlConfig> = { widgets: {}, modules: {}, widgetTypes: {} };
	const issues: JotlConfigIssue[] = [];
	if (!isObject(value))
		return { config, issues: [{ pointer: "", message: message("notObject") }] };
	for (const key of Object.keys(value)) {
		if (key !== "widgets" && key !== "$schema")
			issues.push({
				pointer: `/${escapePointer(key)}`,
				message: message("unknownKey", { key }),
			});
	}
	const widgets = value["widgets"];
	if (widgets === undefined) return { config, issues };
	if (!isObject(widgets))
		return {
			config,
			issues: [...issues, { pointer: "/widgets", message: message("widgetsNotObject") }],
		};
	for (const [name, type] of Object.entries(widgets)) {
		const pointer = `/widgets/${escapePointer(name)}`;
		if (name === "") {
			issues.push({ pointer, message: message("emptyName") });
			continue;
		}
		const r = readWidgetDeclaration(name, type);
		if ("issue" in r) {
			issues.push({ pointer, message: syntaxReason(r.issue.reason, r.issue.params) });
			continue;
		}
		config.widgets[name] = r.declaration.schema;
		if (!isTypeName(name) && declaresWidgetType(type))
			config.widgetTypes[name] = r.declaration.schema;
		if (r.declaration.module !== undefined) {
			const { base: _base, ...module } = r.declaration.module;
			config.modules[name] = module;
		}
	}
	return { config, issues };
}

/** 编译器只把大驼峰名当作扩展组件; 其余名字只是 widget 名, 写了底层类型的(widgetTypes)只用于兼容检查. */
export function configCompileOptions(
	widgets: Readonly<Record<string, JsonSchemaObject>>,
	widgetTypes: Readonly<Record<string, JsonSchemaObject>> = {}
): CompileOptions {
	const entries = Object.entries(widgets).filter(([name]) => isTypeName(name));
	const types = Object.entries(widgetTypes).filter(([name]) => !isTypeName(name));
	return {
		...(entries.length === 0 ? {} : { widgets: Object.fromEntries(entries) }),
		...(types.length === 0 ? {} : { widgetTypes: Object.fromEntries(types) }),
	};
}

/** jotl.config.json 自身的 JSON Schema, 供编辑器校验与补全. */
export function createJotlConfigJsonSchema(): JsonSchemaObject {
	const names = [...baseTypeSchemas().keys()];
	return {
		$schema: JSON_SCHEMA_DIALECT,
		$id: JOTL_CONFIG_SCHEMA_ID,
		title: "jotl.config.json",
		type: "object",
		properties: {
			$schema: { type: "string" },
			widgets: {
				description: l10n(
					"登记的扩展组件(大驼峰名, 可写在组件位置)与 widget 名 → 底层类型或模块声明",
					"Registered extension components (UpperCamelCase names, usable in component position) and widget names → base type or module declaration"
				),
				type: "object",
				propertyNames: { minLength: 1 },
				additionalProperties: {
					// 不带约束的 properties 只供编辑器在空对象里补全模块声明的键; 改成带约束会让不带 module 的底层 schema 被这些键误判.
					properties: { base: {}, module: {}, export: {} },
					anyOf: [
						{
							description: l10n(
								"JSON Schema 基本类型名或无体的 Jotl 内置组件名",
								"JSON Schema primitive type name or body-less Jotl built-in component name"
							),
							enum: names,
						},
						{
							description: l10n(
								"模块声明: 底层类型 base(缺省 object), 组件模块地址 module, 导出名 export(缺省 default)",
								"Module declaration: base type `base` (defaults to object), component module address `module`, export name `export` (defaults to default)"
							),
							type: "object",
							properties: {
								base: { anyOf: [{ enum: names }, { type: "object" }] },
								module: { type: "string", minLength: 1 },
								export: { type: "string", minLength: 1 },
							},
							required: ["module"],
							additionalProperties: false,
						},
						{
							description: l10n("底层 schema", "Base schema"),
							type: "object",
							not: { required: ["module"] },
						},
					],
				},
			},
		},
		additionalProperties: false,
	};
}
