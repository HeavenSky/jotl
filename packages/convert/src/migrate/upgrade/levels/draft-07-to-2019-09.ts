// draft-07 → 2019-09: $ref 旁的关键字, 片段形式的 $id 改为 $anchor, definitions 改为 $defs, 拆分 dependencies.
import type { Level, MutableSchema, RuleContext } from '../rule-context.js';
import { mergeDefinitions, resolveRefSiblings, splitDependencies } from './shared-rules.js';

const ANCHOR_NAME = /^[A-Za-z_][-A-Za-z0-9._]*$/;

function splitIdFragment(node: MutableSchema, ctx: RuleContext): void {
  const id = node.$id;
  if (typeof id !== 'string') return;
  const hash = id.indexOf('#');
  if (hash === -1) return;
  const base = id.slice(0, hash);
  const fragment = id.slice(hash + 1);
  if (fragment === '') {
    ctx.report('JOTL3111', { id }, ['$id']);
    node.$id = base;
    return;
  }
  if (!ANCHOR_NAME.test(fragment) || node.$anchor !== undefined) return;
  if (base === '') {
    ctx.report('JOTL3109', { id, anchor: fragment }, ['$id']);
    delete node.$id;
  } else {
    ctx.report('JOTL3110', { id, base, anchor: fragment }, ['$id']);
    node.$id = base;
  }
  node.$anchor = fragment;
}

export const DRAFT_07_TO_2019_09: Level = {
  from: 'draft-07',
  to: '2019-09',
  rules: [
    resolveRefSiblings,
    splitIdFragment,
    (node, ctx) => mergeDefinitions(node, ctx, false),
    (node, ctx) => splitDependencies(node, ctx, false),
  ],
};
