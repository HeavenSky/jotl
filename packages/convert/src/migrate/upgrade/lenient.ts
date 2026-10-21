// 宽松模式: 声明版本中不存在的高版本关键字按 acceptNewerKeywords 接受或移除, 高版本文档中的旧版写法按值识别后改写.
import { mergeDefinitions, rewriteExclusiveBounds, splitDependencies } from './levels/shared-rules.js';
import type { MutableSchema, RuleContext } from './rule-context.js';
import {
  KEYWORD_INTRODUCED,
  OPENAPI_NATIVE_KEYWORDS,
  type DraftVersion,
  draftRank,
  isOpenApi,
  vocabularyBase,
} from './versions.js';

/** 不接受时仍保留: 只是被 $ref 引用的容器, 不参与校验. */
const KEPT_WHEN_IGNORED = new Set(['$defs']);

function newerKeyword(node: MutableSchema, ctx: RuleContext, keyword: string, introduced: DraftVersion): void {
  const params = { keyword, introduced, declared: ctx.declared };
  if (ctx.acceptNewerKeywords) {
    ctx.report('JOTL3201', params, [keyword]);
  } else if (!KEPT_WHEN_IGNORED.has(keyword)) {
    ctx.report('JOTL3202', params, [keyword]);
    delete node[keyword];
  }
}

/** 在逐级规则之前, 按节点的声明版本运行. */
export function applyLenientMode(node: MutableSchema, ctx: RuleContext): void {
  const base = vocabularyBase(ctx.declared);
  if (base === '2020-12') return;
  for (const keyword of Object.keys(node)) {
    const introduced = KEYWORD_INTRODUCED[keyword];
    if (introduced === undefined || draftRank(introduced) <= draftRank(base)) continue;
    if (isOpenApi(ctx.declared) && OPENAPI_NATIVE_KEYWORDS.has(keyword)) continue;
    newerKeyword(node, ctx, keyword, introduced);
  }
  if (base === 'draft-04') {
    for (const keyword of ['exclusiveMaximum', 'exclusiveMinimum']) {
      if (typeof node[keyword] === 'number') newerKeyword(node, ctx, keyword, 'draft-06');
    }
    return;
  }
  rewriteExclusiveBounds(node, ctx, true);
  if (base === '2019-09') {
    mergeDefinitions(node, ctx, true);
    splitDependencies(node, ctx, true);
  }
}
