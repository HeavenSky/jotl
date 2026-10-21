// x-ui 的 meta-schema(JSON Schema 2020-12), 供校验, 补全与 F3 判定.
import { JSON_SCHEMA_DIALECT, type JsonSchemaObject } from './json-schema.js';

const stringArray: JsonSchemaObject = { type: 'array', items: { type: 'string' } };

/** XUi 中除 variants rules version widgets 外的通用字段; 各处按需组合. */
const commonProperties: Record<string, JsonSchemaObject> = {
  widget: { type: 'string', minLength: 1 },
  props: { type: 'object' },
  decorator: { anyOf: [{ type: 'string', minLength: 1 }, { const: false }] },
  order: stringArray,
  groups: {
    type: 'array',
    items: {
      type: 'object',
      properties: { title: { type: 'string' }, fields: stringArray },
      required: ['title', 'fields'],
      additionalProperties: false,
    },
  },
  layout: { enum: ['stack', 'tabs', 'grid'] },
  columns: { type: 'integer', minimum: 1 },
  hidden: { type: 'boolean' },
  visibleIf: { $ref: '#/$defs/Condition' },
  summary: { type: 'string', minLength: 1 },
  thousands: { type: 'boolean' },
};

export const xUiMetaSchema: JsonSchemaObject = {
  $schema: JSON_SCHEMA_DIALECT,
  $id: 'https://jotl.dev/schema/x-ui/v1',
  title: 'x-ui',
  type: 'object',
  properties: {
    ...commonProperties,
    variants: { type: 'object', additionalProperties: { $ref: '#/$defs/Variant' } },
    rules: { type: 'array', items: { $ref: '#/$defs/Rule' } },
    version: { const: 1 },
    widgets: {
      type: 'object',
      propertyNames: { minLength: 1 },
      additionalProperties: { $ref: '#/$defs/WidgetModule' },
    },
  },
  additionalProperties: false,
  $defs: {
    Variant: { type: 'object', properties: commonProperties, additionalProperties: false },
    WidgetModule: {
      type: 'object',
      properties: {
        base: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'object' }] },
        module: { type: 'string', minLength: 1 },
        export: { type: 'string', minLength: 1 },
      },
      required: ['module'],
      additionalProperties: false,
    },
    Rule: {
      type: 'object',
      properties: {
        match: {
          type: 'object',
          properties: {
            pointer: { type: 'string' },
            type: { type: 'string' },
            format: { type: 'string' },
            enum: { type: 'boolean' },
            widget: { type: 'string' },
          },
          additionalProperties: false,
        },
        ui: { $ref: '#/$defs/Variant' },
      },
      required: ['match', 'ui'],
      additionalProperties: false,
    },
    Condition: {
      anyOf: [
        {
          type: 'object',
          properties: {
            field: { type: 'string' },
            base: { const: 'node' },
            eq: true,
            ne: true,
            in: { type: 'array' },
            notIn: { type: 'array' },
            truthy: { type: 'boolean' },
            gt: { type: 'number' },
            gte: { type: 'number' },
            lt: { type: 'number' },
            lte: { type: 'number' },
          },
          required: ['field'],
          // field 加且仅加一个比较项, base 可选.
          anyOf: [
            { maxProperties: 2, properties: { base: false } },
            { minProperties: 3, maxProperties: 3, properties: { base: true }, required: ['base'] },
          ],
          minProperties: 2,
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: { all: { type: 'array', items: { $ref: '#/$defs/Condition' } } },
          required: ['all'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: { any: { type: 'array', items: { $ref: '#/$defs/Condition' } } },
          required: ['any'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: { not: { $ref: '#/$defs/Condition' } },
          required: ['not'],
          additionalProperties: false,
        },
      ],
    },
  },
};
