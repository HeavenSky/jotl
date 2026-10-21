// Swagger 2.0 → OpenAPI 3.0 的 Schema Object: x-nullable, type: "file" 与字符串形式的 discriminator.
import type { Level, MutableSchema, RuleContext } from '../rule-context.js';

function rewriteXNullable(node: MutableSchema, ctx: RuleContext): void {
  if (!Object.hasOwn(node, 'x-nullable') || node.nullable !== undefined) return;
  ctx.report('JOTL3121', {}, ['x-nullable']);
  node.nullable = node['x-nullable'];
  delete node['x-nullable'];
}

function rewriteFileType(node: MutableSchema, ctx: RuleContext): void {
  if (node.type !== 'file') return;
  ctx.report('JOTL3122', {}, ['type']);
  node.type = 'string';
  node.format = 'binary';
}

function rewriteDiscriminator(node: MutableSchema, ctx: RuleContext): void {
  if (typeof node.discriminator !== 'string') return;
  ctx.report('JOTL3123', { propertyName: 'propertyName' }, ['discriminator']);
  node.discriminator = { propertyName: node.discriminator };
}

export const SWAGGER_2_TO_OPENAPI_3_0: Level = {
  from: 'swagger-2.0',
  to: 'openapi-3.0',
  rules: [rewriteXNullable, rewriteFileType, rewriteDiscriminator],
};
