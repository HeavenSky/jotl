// 关键字改名后改写 $ref 中的 JSON Pointer 片段: 能定位目标文档时按指针映射精确换算, 否则按关键字结构推算.
import { type JsonPointer, appendPointer, formatPointer, tryParsePointer } from '@jotl/core';
import { upgradeDiagnostic } from './diagnostics.js';
import { type DocumentState, type Resource, locate, walkReferenced } from './transform.js';
import { decodeFragment, encodeFragment, resolveUri, splitFragment } from './uri.js';
import { type SchemaVersion, isOlderThan, isOpenApi } from './versions.js';

export interface ResolvedResource {
  state: DocumentState;
  resource: Resource;
}

/** 按绝对 URI(不含片段)查找已升级文档中的资源. */
export type ResourceLookup = (uri: string) => ResolvedResource | undefined;

/** 精确换算: 取映射表中最长的已知前缀, 余下片段原样接上. */
function mapPointer(map: ReadonlyMap<JsonPointer, JsonPointer>, pointer: JsonPointer): JsonPointer | undefined {
  let prefix = pointer;
  let suffix = '';
  for (;;) {
    const hit = map.get(prefix);
    if (hit !== undefined) return hit + suffix;
    if (prefix === '') return undefined;
    const slash = prefix.lastIndexOf('/');
    suffix = prefix.slice(slash) + suffix;
    prefix = prefix.slice(0, slash);
  }
}

const DATA = new Set(['default', 'examples', 'example', 'const', 'enum']);

/** 指针在已知 schema 节点之后的路径是否经过数据关键字(其下的值是实例数据而非 schema). */
function crossesData(map: ReadonlyMap<JsonPointer, JsonPointer>, pointer: JsonPointer): boolean {
  let prefix = pointer;
  while (prefix !== '' && !map.has(prefix)) prefix = prefix.slice(0, prefix.lastIndexOf('/'));
  const tokens = tryParsePointer(pointer.slice(prefix.length));
  return tokens === undefined || tokens.some(t => DATA.has(t));
}

const SINGLE = new Set([
  'additionalProperties',
  'items',
  'additionalItems',
  'contains',
  'propertyNames',
  'not',
  'if',
  'then',
  'else',
  'unevaluatedItems',
  'unevaluatedProperties',
  'contentSchema',
]);
const ARRAY = new Set(['prefixItems', 'allOf', 'anyOf', 'oneOf']);
const MAP = new Set(['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas', 'dependencies']);
const INDEX = /^(0|[1-9]\d*)$/;

/** 目标文档不可得时, 假定它与引用方同版本, 按关键字结构推算改名后的指针. */
export function rewritePointerByStructure(pointer: JsonPointer, version: SchemaVersion): JsonPointer {
  const tokens = tryParsePointer(pointer);
  if (tokens === undefined || isOpenApi(version) || !isOlderThan(version, '2020-12')) return pointer;
  const upTo07 = isOlderThan(version, '2019-09');
  const out = [...tokens];
  let i = 0;
  while (i < out.length) {
    const keyword = out[i]!;
    const next = out[i + 1];
    if (upTo07 && keyword === 'definitions') out[i] = '$defs';
    else if (upTo07 && keyword === 'dependencies') out[i] = 'dependentSchemas';
    else if (keyword === 'items' && next !== undefined && INDEX.test(next)) out[i] = 'prefixItems';
    else if (keyword === 'additionalItems') out[i] = 'items';
    const renamed = out[i]!;
    if (ARRAY.has(renamed) || MAP.has(renamed)) i += 2;
    else if (SINGLE.has(renamed)) i += 1;
    else break;
  }
  return formatPointer(out);
}

function rewriteFragment(
  pointer: JsonPointer,
  target: string,
  site: DocumentState['refSites'][number],
  lookup: ResourceLookup
): JsonPointer {
  const found = lookup(target);
  if (found === undefined) return rewritePointerByStructure(pointer, site.declared);
  const { state, resource } = found;
  const mapped = mapPointer(state.pointerMap, resource.oldPointer + pointer);
  if (mapped === undefined) return pointer;
  if (mapped !== resource.newPointer && !mapped.startsWith(resource.newPointer + '/')) return pointer;
  return mapped.slice(resource.newPointer.length);
}

/** 按 schema 升级 $ref 指向的, 遍历时未经过的位置(如未知关键字下); 新升级的节点中的引用继续处理. 须在 rewriteRefs 之前调用. */
export function walkRefTargets(states: Iterable<DocumentState>, lookup: ResourceLookup): void {
  const all = [...states];
  for (;;) {
    const targets: { state: DocumentState; pointer: JsonPointer; base: string }[] = [];
    for (const state of all) {
      for (const site of state.refSites) {
        const { base: reference, fragment } = splitFragment(site.node[site.keyword] as string);
        if (fragment === undefined) continue;
        const pointer = decodeFragment(fragment);
        if (pointer === undefined || !pointer.startsWith('/')) continue;
        const target = splitFragment(resolveUri(site.base, reference)).base;
        const found = lookup(target);
        if (found !== undefined)
          targets.push({ state: found.state, pointer: found.resource.oldPointer + pointer, base: target });
      }
    }
    targets.sort((a, b) => a.pointer.length - b.pointer.length);
    let changed = false;
    for (const { state, pointer, base } of targets) {
      if (state.pointerMap.has(pointer) || crossesData(state.pointerMap, pointer)) continue;
      const mapped = mapPointer(state.pointerMap, pointer);
      if (mapped !== undefined && walkReferenced(state, pointer, mapped, base)) changed = true;
    }
    if (!changed) return;
  }
}

/** 改写文档中全部 $ref / $dynamicRef 的指针片段, 每处改动记一条 info. */
export function rewriteRefs(state: DocumentState, lookup: ResourceLookup): void {
  for (const site of state.refSites) {
    const value = site.node[site.keyword] as string;
    const { base: reference, fragment } = splitFragment(value);
    if (fragment === undefined) continue;
    const pointer = decodeFragment(fragment);
    if (pointer === undefined || pointer === '' || !pointer.startsWith('/')) continue;
    const target = splitFragment(resolveUri(site.base, reference)).base;
    const rewritten = rewriteFragment(pointer, target, site, lookup);
    if (rewritten === pointer) continue;
    const next = `${reference}#${encodeFragment(rewritten)}`;
    site.node[site.keyword] = next;
    state.diagnostics.push(
      upgradeDiagnostic(
        'JOTL3120',
        { from: value, to: next },
        { location: locate(appendPointer(site.oldPointer, site.keyword), state.uri) }
      )
    );
  }
}
