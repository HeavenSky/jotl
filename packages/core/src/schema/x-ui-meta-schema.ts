// x-ui 的 meta-schema(JSON Schema 2020-12), 供校验, 补全与 F3 判定.
import { JSON_SCHEMA_DIALECT, type JsonSchemaObject } from "./json-schema.js";
import { WIDGET_LEVELS } from "./x-ui.js";

const stringArray: JsonSchemaObject = { type: "array", items: { type: "string" } };

/** XUi 中除 variants rules version widgets 外的通用字段; 各处按需组合. */
const commonProperties: Record<string, JsonSchemaObject> = {
	widget: { type: "string", minLength: 1 },
	props: { type: "object" },
	decorator: { anyOf: [{ type: "string", minLength: 1 }, { const: false }] },
	order: stringArray,
	groups: {
		type: "array",
		items: {
			type: "object",
			properties: { title: { type: "string" }, fields: stringArray },
			required: ["title", "fields"],
			additionalProperties: false,
		},
	},
	layout: { enum: ["stack", "tabs", "grid"] },
	columns: { type: "integer", minimum: 1 },
	hidden: { type: "boolean" },
	visibleIf: { $ref: "#/$defs/Condition" },
	summary: { type: "string", minLength: 1 },
	thousands: { type: "boolean" },
};

export const xUiMetaSchema: JsonSchemaObject = {
	$schema: JSON_SCHEMA_DIALECT,
	$id: "https://jotl.dev/schema/x-ui/v1",
	title: "x-ui",
	type: "object",
	properties: {
		...commonProperties,
		variants: { type: "object", additionalProperties: { $ref: "#/$defs/Variant" } },
		rules: { type: "array", items: { $ref: "#/$defs/Rule" } },
		version: { const: 1 },
		widgets: {
			type: "object",
			propertyNames: { minLength: 1 },
			additionalProperties: { $ref: "#/$defs/WidgetModule" },
		},
	},
	additionalProperties: false,
	$defs: {
		Variant: { type: "object", properties: commonProperties, additionalProperties: false },
		WidgetModule: {
			type: "object",
			properties: {
				base: { anyOf: [{ type: "string", minLength: 1 }, { type: "object" }] },
				module: { type: "string", minLength: 1 },
				export: { type: "string", minLength: 1 },
				level: { enum: [...WIDGET_LEVELS] },
			},
			required: ["module"],
			additionalProperties: false,
		},
		Rule: {
			type: "object",
			properties: {
				match: {
					type: "object",
					properties: {
						pointer: { type: "string" },
						type: { type: "string" },
						format: { type: "string" },
						enum: { type: "boolean" },
						widget: { type: "string" },
					},
					additionalProperties: false,
				},
				ui: { $ref: "#/$defs/Variant" },
			},
			required: ["match", "ui"],
			additionalProperties: false,
		},
		Condition: {
			anyOf: [
				{
					// 叶子: left 加 op, right 按 op 约束类型, base 可选.
					type: "object",
					properties: {
						base: { enum: ["root", "node"] },
						left: { type: "string", minLength: 1 },
						op: {
							enum: ["eq", "ne", "in", "notIn", "truthy", "gt", "gte", "lt", "lte"],
						},
						right: true,
					},
					required: ["left", "op", "right"],
					additionalProperties: false,
					allOf: [
						{
							if: { properties: { op: { const: "in" } }, required: ["op"] },
							then: { properties: { right: { type: "array" } } },
						},
						{
							if: { properties: { op: { const: "notIn" } }, required: ["op"] },
							then: { properties: { right: { type: "array" } } },
						},
						{
							if: { properties: { op: { const: "truthy" } }, required: ["op"] },
							then: { properties: { right: { type: "boolean" } } },
						},
						{
							if: {
								properties: { op: { enum: ["gt", "gte", "lt", "lte"] } },
								required: ["op"],
							},
							then: { properties: { right: { type: "number" } } },
						},
					],
				},
				{
					type: "object",
					properties: {
						op: { const: "and" },
						conditions: {
							type: "array",
							minItems: 1,
							items: { $ref: "#/$defs/Condition" },
						},
					},
					required: ["op", "conditions"],
					additionalProperties: false,
				},
				{
					type: "object",
					properties: {
						op: { const: "or" },
						conditions: {
							type: "array",
							minItems: 1,
							items: { $ref: "#/$defs/Condition" },
						},
					},
					required: ["op", "conditions"],
					additionalProperties: false,
				},
				{
					type: "object",
					properties: { op: { const: "not" }, condition: { $ref: "#/$defs/Condition" } },
					required: ["op", "condition"],
					additionalProperties: false,
				},
			],
		},
	},
};
