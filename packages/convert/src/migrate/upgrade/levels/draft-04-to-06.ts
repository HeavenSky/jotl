// draft-04 → draft-06: id 改名为 $id, 布尔形式的 exclusive 边界改为数值形式.
import type { Level, MutableSchema, RuleContext } from '../rule-context.js';
import { rewriteExclusiveBounds } from './shared-rules.js';

function renameId(node: MutableSchema, ctx: RuleContext): void {
  const id = node.id;
  if (typeof id !== 'string') return;
  if (node.$id !== undefined && node.$id !== id) {
    const choice = ctx.conflict('JOTL3305', { id, dollarId: String(node.$id) }, ['id']);
    if (choice === 'declared') node.$id = id;
  } else {
    ctx.report('JOTL3101', {}, ['id']);
    node.$id = id;
  }
  delete node.id;
  ctx.move(['id'], ['$id']);
}

export const DRAFT_04_TO_06: Level = {
  from: 'draft-04',
  to: 'draft-06',
  rules: [renameId, (node, ctx) => rewriteExclusiveBounds(node, ctx, false)],
};
