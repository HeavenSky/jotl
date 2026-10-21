// JSON Schema 文件中 `x-ui` 的编辑支持(E7): 生成一份沿 2020-12 全部子 schema 关键字递归, 在每个 schema 节点上按 xUiMetaSchema 校验 `x-ui` 的 schema.
import {
  JSON_SCHEMA_DIALECT,
  type JsonSchema,
  type JsonSchemaObject,
  SUBSCHEMA_KEYWORDS,
  xUiMetaSchema,
} from '@jotl/core';

export const X_UI_JSON_SCHEMA_ID = 'https://jotl.dev/schema/json-schema-with-x-ui/v1';

/** 生成的 `$defs` 中表示任一 schema 节点与 x-ui 取值的条目名; 不得与 xUiMetaSchema 自带的 `$defs` 重名. */
export const SCHEMA_NODE_DEF = 'SchemaNode';
export const X_UI_DEF = 'XUi';

const X_UI_KEYWORD = 'x-ui';

/** xUiMetaSchema 的 `$defs` 原样提升到根且名字不变, 其中的 `#/$defs/...` 引用才能在不支持内嵌 `$id` 资源的 JSON 语言服务中解析. */
export function createXUiJsonSchema(): JsonSchemaObject {
  const { $schema: _dialect, $id: _id, $defs: metaDefs = {}, ...xUi } = xUiMetaSchema;
  for (const name of [SCHEMA_NODE_DEF, X_UI_DEF]) {
    if (Object.hasOwn(metaDefs, name)) throw new Error(`xUiMetaSchema 的 $defs 与生成的条目名 ${name} 冲突`);
  }
  const nodeRef = `#/$defs/${SCHEMA_NODE_DEF}`;
  const node: JsonSchemaObject = { $ref: nodeRef };
  const properties: Record<string, JsonSchema> = { [X_UI_KEYWORD]: { $ref: `#/$defs/${X_UI_DEF}` } };
  for (const keyword of SUBSCHEMA_KEYWORDS.single) properties[keyword] = node;
  for (const keyword of SUBSCHEMA_KEYWORDS.array) properties[keyword] = { type: 'array', items: node };
  for (const keyword of SUBSCHEMA_KEYWORDS.map) properties[keyword] = { type: 'object', additionalProperties: node };
  return {
    $schema: JSON_SCHEMA_DIALECT,
    $id: X_UI_JSON_SCHEMA_ID,
    title: 'JSON Schema with x-ui',
    $ref: nodeRef,
    $defs: {
      [SCHEMA_NODE_DEF]: { type: ['object', 'boolean'], properties },
      [X_UI_DEF]: xUi,
      ...metaDefs,
    },
  };
}
